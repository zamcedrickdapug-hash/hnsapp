const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');

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

module.exports = router;
