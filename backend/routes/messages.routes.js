const express = require('express');
const mongoose = require('mongoose');
const { rateLimit } = require('express-rate-limit');
const Message = require('../models/Message');
const VanRequest = require('../models/VanRequest');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const { getIo, buildUserRoomName } = require('../socket');

const router = express.Router();

const requireChatUser = (req, res, next) => {
  if (!req.user || !['parent', 'driver'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Parent or driver access is required.' });
  }
  return next();
};

const messageRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user._id),
  message: { message: 'Too many messages. Please try again shortly.' },
});

router.use(requireAuth, requireChatUser);

const idString = (id) => (id == null ? '' : String(id._id || id));

const serializeMessage = (message) => ({
  _id: idString(message._id),
  requestId: idString(message.requestId),
  senderId: idString(message.senderId),
  recipientId: idString(message.recipientId),
  senderRole: message.senderRole,
  text: message.text,
  createdAt: message.createdAt,
  readAt: message.readAt ?? null,
});

const loadParticipantRequest = async (req, res) => {
  const { requestId } = req.params;
  if (!mongoose.isValidObjectId(requestId)) {
    res.status(404).json({ message: 'Trip not found.' });
    return null;
  }

  const request = await VanRequest.findById(requestId)
    .select('_id parent driver status studentName schoolName');
  if (!request ||
      (idString(request.parent) !== idString(req.user._id) &&
       idString(request.driver) !== idString(req.user._id))) {
    res.status(404).json({ message: 'Trip not found.' });
    return null;
  }
  return request;
};

router.get('/threads', async (req, res) => {
  try {
    const userId = req.user._id;
    const requests = await VanRequest.find({
      driver: { $ne: null },
      $or: [{ parent: userId }, { driver: userId }],
    }).select('_id parent driver status studentName schoolName').lean();

    if (!requests.length) return res.json({ threads: [] });

    const requestIds = requests.map((request) => request._id);
    const activity = await Message.aggregate([
      { $match: { requestId: { $in: requestIds } } },
      { $sort: { createdAt: -1, _id: -1 } },
      {
        $group: {
          _id: '$requestId',
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$recipientId', userId] },
                    { $eq: [{ $ifNull: ['$readAt', null] }, null] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { 'lastMessage.createdAt': -1, 'lastMessage._id': -1 } },
      { $limit: 50 },
    ]);

    const requestsById = new Map(requests.map((request) => [idString(request._id), request]));
    const threads = await Promise.all(activity.map(async (item) => {
      const request = requestsById.get(idString(item._id));
      if (!request) return null;
      const otherUserId = idString(request.parent) === idString(userId)
        ? request.driver
        : request.parent;
      const otherUser = await User.findById(otherUserId).select('fullName').lean();
      const lastMessage = item.lastMessage;

      return {
        requestId: idString(request._id),
        status: request.status,
        studentName: request.studentName,
        schoolName: request.schoolName,
        otherParty: {
          name: otherUser?.fullName || '',
          role: idString(request.parent) === idString(userId) ? 'driver' : 'parent',
        },
        lastMessage: {
          text: lastMessage.text,
          createdAt: lastMessage.createdAt,
          senderRole: lastMessage.senderRole,
        },
        unreadCount: item.unreadCount,
      };
    }));

    return res.json({ threads: threads.filter(Boolean) });
  } catch (error) {
    console.error('[Messages] Failed to list threads:', error.name || 'UnknownError');
    return res.status(500).json({ message: 'Unable to load message threads.' });
  }
});

router.get('/threads/:requestId/messages', async (req, res) => {
  try {
    const request = await loadParticipantRequest(req, res);
    if (!request) return;
    if (!request.driver) return res.status(404).json({ message: 'Trip not found.' });

    const rawLimit = req.query.limit;
    const parsedLimit = rawLimit === undefined ? 30 : Number(rawLimit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1) {
      return res.status(400).json({ message: 'Limit must be a positive integer.' });
    }
    const limit = Math.min(parsedLimit, 100);
    const query = { requestId: request._id };

    if (req.query.before !== undefined) {
      if (!mongoose.isValidObjectId(req.query.before)) {
        return res.status(400).json({ message: 'Invalid before cursor.' });
      }
      const cursor = await Message.findOne({
        _id: req.query.before,
        requestId: request._id,
      }).select('_id createdAt');
      if (!cursor) return res.status(400).json({ message: 'Invalid before cursor.' });
      query.$or = [
        { createdAt: { $lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, _id: { $lt: cursor._id } },
      ];
    }

    const page = await Message.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean();
    const hasMore = page.length > limit;
    const messages = page.slice(0, limit).reverse().map(serializeMessage);
    return res.json({ messages, hasMore });
  } catch (error) {
    console.error('[Messages] Failed to load trip messages:', error.name || 'UnknownError');
    return res.status(500).json({ message: 'Unable to load messages.' });
  }
});

router.post('/threads/:requestId/messages', messageRateLimit, async (req, res) => {
  try {
    const request = await loadParticipantRequest(req, res);
    if (!request) return;
    if (!request.driver) {
      return res.status(409).json({ message: 'Chat is unavailable for this trip.' });
    }
    if (!['accepted', 'arrived', 'picked_up', 'arrived_at_school'].includes(request.status)) {
      return res.status(409).json({ message: 'Chat is closed for this trip.' });
    }

    if (typeof req.body?.text !== 'string') {
      return res.status(400).json({ message: 'Message text must be a string between 1 and 500 characters.' });
    }
    const text = req.body.text.trim();
    if (text.length < 1 || text.length > 500) {
      return res.status(400).json({ message: 'Message text must be between 1 and 500 characters.' });
    }

    const senderIsParent = idString(request.parent) === idString(req.user._id);
    const senderRole = senderIsParent ? 'parent' : 'driver';
    const recipientId = senderIsParent ? request.driver : request.parent;
    const message = await Message.create({
      requestId: request._id,
      senderId: req.user._id,
      recipientId,
      senderRole,
      text,
    });
    const serializedMessage = serializeMessage(message);
    const payload = { message: serializedMessage, requestId: idString(request._id) };
    const io = getIo();
    if (io) {
      try {
        io.to(buildUserRoomName(request.parent)).emit('trip:message', payload);
        io.to(buildUserRoomName(request.driver)).emit('trip:message', payload);
      } catch (error) {
        console.error('[Messages] Failed to emit message:', error.name || 'UnknownError');
      }
    }

    return res.status(201).json({ message: serializedMessage });
  } catch (error) {
    console.error('[Messages] Failed to send message:', error.name || 'UnknownError');
    return res.status(500).json({ message: 'Unable to send message.' });
  }
});

router.patch('/threads/:requestId/read', async (req, res) => {
  try {
    const request = await loadParticipantRequest(req, res);
    if (!request) return;
    if (!request.driver) return res.status(404).json({ message: 'Trip not found.' });

    const result = await Message.updateMany(
      { requestId: request._id, recipientId: req.user._id, readAt: null },
      { $set: { readAt: new Date() } }
    );
    return res.json({ updated: result.modifiedCount ?? result.nModified ?? 0 });
  } catch (error) {
    console.error('[Messages] Failed to mark thread read:', error.name || 'UnknownError');
    return res.status(500).json({ message: 'Unable to mark messages as read.' });
  }
});

module.exports = router;
