const jwt = require('jsonwebtoken');
const User = require('../models/User');

const getTokenFromHeader = (req) => {
  const authHeader = req.headers.authorization || '';

  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.slice(7);
};

const requireAuth = async (req, res, next) => {
  try {
    const token = getTokenFromHeader(req);

    if (!token) {
      return res.status(401).json({ message: 'Authentication token is required.' });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET || 'development-secret-key');
    const user = await User.findById(payload.userId);

    if (!user) {
      return res.status(401).json({ message: 'Invalid authentication token.' });
    }

    if (user.role !== 'admin' && ['suspended', 'banned'].includes(String(user.accountState || 'active'))) {
      return res.status(403).json({
        message:
          user.accountState === 'banned'
            ? 'Your account has been banned. Please contact support.'
            : 'Your account has been suspended. Please contact support.',
        accountState: user.accountState,
      });
    }

    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Authentication failed.' });
  }
};

const requireAdmin = async (req, res, next) => {
  await requireAuth(req, res, async () => {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access is required.' });
    }

    return next();
  });
};

const requireParent = async (req, res, next) => {
  await requireAuth(req, res, async () => {
    if (!req.user || req.user.role !== 'parent') {
      return res.status(403).json({ message: 'Parent access is required.' });
    }

    return next();
  });
};

const requireApplicant = async (req, res, next) => {
  await requireAuth(req, res, async () => {
    if (!req.user || !['parent', 'driver'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Applicant access is required.' });
    }

    return next();
  });
};

module.exports = {
  requireAuth,
  requireAdmin,
  requireParent,
  requireApplicant,
};
