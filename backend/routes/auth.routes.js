const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const { getAccountAccessError } = require('../utils/accountAccess');
const { getJwtSecret } = require('../utils/jwtSecret');
const { verifyFirebaseIdentity } = require('../utils/firebaseIdentity');
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
  accountState: user.accountState,
});

const sendLoginResponse = (user, res) => {
  const accessError = getAccountAccessError(user);
  if (accessError) {
    return res.status(403).json(accessError);
  }

  const token = jwt.sign(
    { userId: user._id, role: user.role },
    getJwtSecret(),
    { expiresIn: '7d' }
  );

  if (user.role === 'admin') console.info('[AUTH] Admin login succeeded.');
  return res.status(200).json({ message: 'Login successful.', token, user: buildAuthPayload(user) });
};

// A verified Firebase identity authenticates an existing public account only.
router.post('/verify-firebase-token', async (req, res) => {
  try {
    const identity = await verifyFirebaseIdentity(req.body?.idToken);
    if (!identity.emailVerified) {
      return res.status(403).json({ message: 'Please verify your Gmail address before logging in.' });
    }

    const user = await User.findOne({ firebaseUid: identity.uid }) || await User.findOne({ email: identity.email });
    if (!user) {
      return res.status(403).json({ message: 'Please complete Sign Up before signing in.' });
    }

    if (user.email.toLowerCase() !== identity.email) {
      return res.status(403).json({ message: 'This Firebase identity does not match the registered account.' });
    }

    if (user.firebaseUid && user.firebaseUid !== identity.uid) {
      return res.status(403).json({ message: 'This Firebase identity does not match the registered account.' });
    }

    if (user.role === 'admin') {
      return res.status(403).json({ message: 'This account requires its existing administrator-managed login.' });
    }

    if (!['parent', 'driver'].includes(user.role)) {
      return res.status(403).json({ message: 'This account requires its existing administrator-managed login.' });
    }

    const accessError = getAccountAccessError(user);
    if (accessError) return res.status(403).json(accessError);

    if (!user.firebaseUid || !user.isVerified) {
      user.firebaseUid = identity.uid;
      user.isVerified = true;
      await user.save();
    }

    return sendLoginResponse(user, res);
  } catch (error) {
    if (error.code === 'JWT_SECRET_MISSING') {
      return res.status(500).json({ message: 'JWT authentication is not configured on the server.' });
    }
    if (error.status) return res.status(error.status).json({ message: error.message });
    return res.status(500).json({ message: 'Failed to verify Firebase token.' });
  }
});

// One credential endpoint for existing MongoDB accounts, including admins.
// A generic 401 lets the client try its existing Firebase sign-in flow without
// exposing the account's role or authentication provider before authentication.
const loginWithPassword = async (req, res, adminOnly = false) => {
  try {
    const { email, password } = req.body || {};

    if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const emailValue = email.trim().toLowerCase();
    const query = { email: emailValue, ...(adminOnly ? { role: 'admin' } : {}) };
    const user = await User.findOne(query).select('+passwordHash');

    if (!user || !['parent', 'driver', 'admin'].includes(user.role)) {
      if (adminOnly) console.info('[AUTH] Admin login rejected: credentials were not accepted.');
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    if (!adminOnly && user.firebaseUid) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    if (!user.passwordHash) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      if (adminOnly) console.info('[AUTH] Admin login rejected: credentials were not accepted.');
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    if (adminOnly && user.role !== 'admin') {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const accessError = getAccountAccessError(user);
    if (accessError) {
      if (adminOnly) console.info('[AUTH] Admin login denied: account access is restricted.');
      return res.status(403).json(accessError);
    }

    return sendLoginResponse(user, res);
  } catch (error) {
    if (error.code === 'JWT_SECRET_MISSING') {
      return res.status(500).json({ message: 'JWT authentication is not configured on the server.' });
    }
    return res.status(500).json({ message: 'Failed to login. Please try again.' });
  }
};

router.post('/login', (req, res) => loginWithPassword(req, res));
// Retain the existing dedicated endpoint for older clients.
router.post('/admin-login', (req, res) => loginWithPassword(req, res, true));

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
