const webpush = require('web-push');
const User = require('../models/User');

let vapidConfigured = false;

const DEV_VAPID_PUBLIC_KEY =
  'BB__5yp749RONDwJKG825GEblqTadEiN3adToq6Vzxqea8eM7Ht91FKGWbyDhD7o0XqS8tGxniLdeLBtJXG6Nxg';
const DEV_VAPID_PRIVATE_KEY = '2gsjbClzi9PvGHo9S-q9VH9yZftnt0Df2yDuWeHbUTQ';

const getVapidConfig = () => {
  const publicKey = String(process.env.VAPID_PUBLIC_KEY || DEV_VAPID_PUBLIC_KEY).trim();
  const privateKey = String(process.env.VAPID_PRIVATE_KEY || DEV_VAPID_PRIVATE_KEY).trim();
  const subject = String(process.env.VAPID_SUBJECT || 'mailto:admin@hnsapp.local').trim();

  return {
    publicKey,
    privateKey,
    subject,
  };
};

const ensureVapidConfigured = () => {
  if (vapidConfigured) {
    return true;
  }

  const config = getVapidConfig();

  if (!config.publicKey || !config.privateKey) {
    return false;
  }

  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  vapidConfigured = true;
  return true;
};

const getVapidPublicKey = () => getVapidConfig().publicKey;

const isValidSubscription = (subscription) => {
  return Boolean(
    subscription &&
      typeof subscription.endpoint === 'string' &&
      subscription.endpoint &&
      subscription.keys &&
      typeof subscription.keys.auth === 'string' &&
      subscription.keys.auth &&
      typeof subscription.keys.p256dh === 'string' &&
      subscription.keys.p256dh
  );
};

const normalizeSubscription = (subscription, userAgent = '') => ({
  endpoint: String(subscription.endpoint).trim(),
  expirationTime:
    Number.isFinite(Number(subscription.expirationTime)) && subscription.expirationTime !== null
      ? Number(subscription.expirationTime)
      : null,
  keys: {
    auth: String(subscription.keys.auth).trim(),
    p256dh: String(subscription.keys.p256dh).trim(),
  },
  userAgent: String(userAgent || '').trim(),
  lastUsedAt: new Date(),
});

const buildPushPayload = ({ title, body, data = {} }) => {
  return JSON.stringify({
    title: String(title || 'H&S Booking System'),
    body: String(body || 'You have a new notification.'),
    icon: '/vite.svg',
    badge: '/vite.svg',
    data,
  });
};

const cleanupInvalidEndpoints = async (invalidByUserId) => {
  const operations = Object.entries(invalidByUserId).map(([userId, endpoints]) => {
    return User.updateOne(
      { _id: userId },
      {
        $pull: {
          pushSubscriptions: {
            endpoint: { $in: endpoints },
          },
        },
      }
    );
  });

  await Promise.allSettled(operations);
};

const sendPushToUserIds = async (userIds = [], payload = {}) => {
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return { sent: 0, skipped: 0, reason: 'no-recipients' };
  }

  if (!ensureVapidConfigured()) {
    return { sent: 0, skipped: userIds.length, reason: 'vapid-not-configured' };
  }

  const uniqueIds = [...new Set(userIds.map((id) => String(id)).filter(Boolean))];

  const users = await User.find({
    _id: { $in: uniqueIds },
    'pushSubscriptions.0': { $exists: true },
  }).select('_id pushSubscriptions');

  const invalidByUserId = {};
  let sent = 0;

  for (const user of users) {
    for (const subscription of user.pushSubscriptions || []) {
      try {
        await webpush.sendNotification(subscription, buildPushPayload(payload));
        sent += 1;
      } catch (error) {
        const statusCode = Number(error?.statusCode || 0);

        if (statusCode === 404 || statusCode === 410) {
          const userId = String(user._id);
          invalidByUserId[userId] = invalidByUserId[userId] || [];
          invalidByUserId[userId].push(subscription.endpoint);
        }
      }
    }
  }

  if (Object.keys(invalidByUserId).length > 0) {
    await cleanupInvalidEndpoints(invalidByUserId);
  }

  return {
    sent,
    skipped: Math.max(uniqueIds.length - users.length, 0),
  };
};

module.exports = {
  ensureVapidConfigured,
  getVapidPublicKey,
  isValidSubscription,
  normalizeSubscription,
  sendPushToUserIds,
};
