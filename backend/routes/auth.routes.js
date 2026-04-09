const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const {
  getVapidPublicKey,
  isValidSubscription,
  normalizeSubscription,
} = require('../utils/pushNotifications');

const router = express.Router();

const buildAuthPayload = (user) => ({
  id: user._id,
  role: user.role,
  fullName: user.fullName,
  email: user.email,
  phone: user.phone,
  homeAddress: user.homeAddress,
  status: user.status,
});

router.post('/login', async (req, res) => {
  try {
    const email = (req.body?.email || '').trim().toLowerCase();
    const password = req.body?.password || '';
    const accountType = req.body?.accountType || 'parent';

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    if (!['parent', 'driver', 'admin'].includes(accountType)) {
      return res.status(400).json({ message: 'Invalid account type.' });
    }

    const user = await User.findOne({ email, role: accountType }).select('+passwordHash');

    if (!user) {
      const accountWithEmail = await User.findOne({ email }).select('role');

      if (accountWithEmail) {
        return res.status(400).json({
          message: `This email is registered as a ${accountWithEmail.role} account. Please select ${accountWithEmail.role} in account type.`,
        });
      }

      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordCorrect) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    if (['parent', 'driver'].includes(user.role) && user.status !== 'approved') {
      return res.status(403).json({
        message: 'Your account is not active yet. Please wait for admin verification.',
        accountStatus: user.status,
      });
    }

    const token = jwt.sign(
      {
        userId: user._id,
        role: user.role,
      },
      process.env.JWT_SECRET || 'development-secret-key',
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      token,
      user: buildAuthPayload(user),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to login at the moment.' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  const user = req.user;

  return res.status(200).json({
    user: buildAuthPayload(user),
  });
});

router.get('/push/vapid-public-key', (req, res) => {
  const publicKey = getVapidPublicKey();

  if (!publicKey) {
    return res.status(503).json({ message: 'Push notifications are not configured on the server.' });
  }

  return res.status(200).json({ publicKey });
});

router.post('/push/subscribe', requireAuth, async (req, res) => {
  try {
    const subscription = req.body?.subscription;

    if (!isValidSubscription(subscription)) {
      return res.status(400).json({ message: 'A valid push subscription is required.' });
    }

    const normalizedSubscription = normalizeSubscription(subscription, req.headers['user-agent'] || '');
    const existingIndex = (req.user.pushSubscriptions || []).findIndex(
      (item) => String(item.endpoint) === normalizedSubscription.endpoint
    );

    if (existingIndex >= 0) {
      req.user.pushSubscriptions[existingIndex] = normalizedSubscription;
    } else {
      req.user.pushSubscriptions.push(normalizedSubscription);
    }

    await req.user.save();

    return res.status(200).json({ message: 'Push subscription saved.' });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to save push subscription right now.' });
  }
});

router.post('/push/unsubscribe', requireAuth, async (req, res) => {
  try {
    const endpoint = String(req.body?.endpoint || '').trim();

    if (!endpoint) {
      return res.status(400).json({ message: 'Subscription endpoint is required.' });
    }

    req.user.pushSubscriptions = (req.user.pushSubscriptions || []).filter(
      (item) => String(item.endpoint) !== endpoint
    );

    await req.user.save();

    return res.status(200).json({ message: 'Push subscription removed.' });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to remove push subscription right now.' });
  }
});

module.exports = router;
