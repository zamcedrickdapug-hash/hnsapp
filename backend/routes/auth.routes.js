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
const {
  generateVerificationCode,
  sendSmsCode,
  sendEmailCode,
  isValidPhoneNumber,
  isValidEmail,
} = require('../utils/verification');

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

    if (['parent', 'driver'].includes(user.role) && ['suspended', 'banned'].includes(String(user.accountState || 'active'))) {
      return res.status(403).json({
        message:
          user.accountState === 'banned'
            ? 'Your account has been banned. Please contact support.'
            : 'Your account has been suspended. Please contact support.',
        accountState: user.accountState,
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

// Send verification code via SMS or Email
router.post('/send-code', async (req, res) => {
  try {
    const contact = (req.body?.contact || '').trim();
    const accountType = req.body?.accountType || 'parent';

    if (!contact) {
      return res.status(400).json({ message: 'Email or phone number is required.' });
    }

    if (!['parent', 'driver', 'admin'].includes(accountType)) {
      return res.status(400).json({ message: 'Invalid account type.' });
    }

    const isPhone = isValidPhoneNumber(contact);
    const isEmail = isValidEmail(contact);

    if (!isPhone && !isEmail) {
      return res.status(400).json({ message: 'Please provide a valid email address or phone number.' });
    }

    // Generate verification code
    const code = generateVerificationCode();
    const expiresIn = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Find or create user
    let user;
    const query = isPhone ? { phone: contact } : { email: contact.toLowerCase() };

    user = await User.findOne(query);

    if (!user) {
      // For new users, create a temporary user entry
      user = new User({
        email: isEmail ? contact.toLowerCase() : `temp-${Date.now()}@temp.com`,
        phone: isPhone ? contact : '',
        fullName: '', // Will be filled in during verify-code
        role: accountType,
        signupMethod: isPhone ? 'phone' : 'email',
        verificationCode: code,
        verificationCodeExpires: expiresIn,
      });
    } else {
      // Update existing user's verification code
      user.verificationCode = code;
      user.verificationCodeExpires = expiresIn;
      user.signupMethod = isPhone ? 'phone' : 'email';
    }

    // Save user with verification code
    await user.save();

    // Send code via SMS or Email
    let sendResult;
    if (isPhone) {
      sendResult = await sendSmsCode(contact, code);
    } else {
      sendResult = await sendEmailCode(contact, code);
    }

    if (!sendResult.success) {
      return res.status(500).json({
        message: `Failed to send ${isPhone ? 'SMS' : 'email'} code. Please try again.`,
      });
    }

    return res.status(200).json({
      message: `Verification code sent to your ${isPhone ? 'phone number' : 'email address'}.`,
      contactType: isPhone ? 'phone' : 'email',
      isDevelopment: sendResult.isDevelopment,
      ...(sendResult.isDevelopment && { code }), // Only in development
    });
  } catch (error) {
    console.error('Send code error:', error);
    return res.status(500).json({ message: 'Unable to send verification code at this moment.' });
  }
});

// Verify code and login/signup
router.post('/verify-code', async (req, res) => {
  try {
    const { contact, code, fullName, accountType } = req.body;

    if (!contact || !code) {
      return res.status(400).json({ message: 'Contact and verification code are required.' });
    }

    if (!['parent', 'driver', 'admin'].includes(accountType)) {
      return res.status(400).json({ message: 'Invalid account type.' });
    }

    const isPhone = isValidPhoneNumber(contact);
    const isEmail = isValidEmail(contact);

    if (!isPhone && !isEmail) {
      return res.status(400).json({ message: 'Please provide a valid email address or phone number.' });
    }

    // Find user
    const query = isPhone ? { phone: contact } : { email: contact.toLowerCase() };
    const user = await User.findOne(query).select('+verificationCode +verificationCodeExpires');

    if (!user || !user.verificationCode) {
      return res.status(401).json({ message: 'No verification code found. Please request a new code.' });
    }

    // Check if code is expired
    if (new Date() > user.verificationCodeExpires) {
      user.verificationCode = null;
      user.verificationCodeExpires = null;
      await user.save();
      return res.status(401).json({ message: 'Verification code has expired. Please request a new code.' });
    }

    // Check if code matches
    if (user.verificationCode !== code) {
      return res.status(401).json({ message: 'Invalid verification code.' });
    }

    // Check if this is a new signup (fullName provided means signup)
    if (fullName && !user.fullName) {
      // This is a new user signup
      user.fullName = fullName.trim();
      user.isVerified = true;
      user.status = accountType === 'admin' ? 'approved' : 'pending'; // Admins approved, others pending
    } else if (!user.fullName) {
      // Existing user login
      user.isVerified = true;
    }

    // Clear verification code
    user.verificationCode = null;
    user.verificationCodeExpires = null;
    user.role = accountType;

    // Check account status for existing users
    if (['parent', 'driver'].includes(user.role) && user.status !== 'approved' && fullName) {
      // New signup - will be pending
      // This is OK
    } else if (['parent', 'driver'].includes(user.role) && user.status !== 'approved' && !fullName) {
      // Existing user trying to login but not approved yet
      await user.save();
      return res.status(403).json({
        message: 'Your account is not active yet. Please wait for admin verification.',
        accountStatus: user.status,
      });
    }

    // Check if account is suspended or banned
    if (['suspended', 'banned'].includes(String(user.accountState || 'active'))) {
      return res.status(403).json({
        message:
          user.accountState === 'banned'
            ? 'Your account has been banned. Please contact support.'
            : 'Your account has been suspended. Please contact support.',
        accountState: user.accountState,
      });
    }

    await user.save();

    // Generate JWT token
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
      isNewUser: !!fullName,
    });
  } catch (error) {
    console.error('Verify code error:', error);
    return res.status(500).json({ message: 'Unable to verify code at this moment.' });
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
