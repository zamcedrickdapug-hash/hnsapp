const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getAccountAccessError } = require('../utils/accountAccess');
const { getJwtSecret } = require('../utils/jwtSecret');

const isDatabaseUnavailable = (error) => (
  /^(Mongo|Mongoose)/.test(error?.name || '')
  || ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT'].includes(error?.code)
);

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
      console.info('[AUTH] Request denied: token is missing.');
      return res.status(401).json({ message: 'Authentication token is required.' });
    }

    const payload = jwt.verify(token, getJwtSecret());
    if (typeof payload?.userId !== 'string' || !payload.userId) {
      console.info('[AUTH] Request denied: token has no account subject.');
      return res.status(401).json({ message: 'Authentication token is invalid or expired.' });
    }
    const user = await User.findById(payload.userId);

    if (!user) {
      console.info('[AUTH] Request denied: account no longer exists.');
      return res.status(401).json({ message: 'Invalid authentication token.' });
    }

    const accessError = getAccountAccessError(user);
    if (accessError) {
      console.info('[AUTH] Request denied: account access is restricted.');
      return res.status(403).json(accessError);
    }

    req.user = user;
    console.info('[AUTH] Request authenticated:', { role: user.role });
    return next();
  } catch (error) {
    if (error.code === 'JWT_SECRET_MISSING') {
      console.error('[AUTH] Authentication configuration is unavailable.');
      return res.status(503).json({ message: 'Authentication service is temporarily unavailable.' });
    }

    if (['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError', 'CastError'].includes(error.name)) {
      console.info('[AUTH] Request denied: token is invalid or expired.');
      return res.status(401).json({ message: 'Authentication token is invalid or expired.' });
    }

    if (isDatabaseUnavailable(error)) {
      console.error('[AUTH] Database unavailable during authentication:', error.name);
      return res.status(503).json({ message: 'Authentication service is temporarily unavailable.' });
    }

    console.error('[AUTH] Unexpected authentication failure:', error.name || 'UnknownError');
    return res.status(500).json({ message: 'Unable to authenticate this request.' });
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

const requireDriver = async (req, res, next) => {
  await requireAuth(req, res, async () => {
    if (!req.user || req.user.role !== 'driver') {
      return res.status(403).json({ message: 'Driver access is required.' });
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
  requireDriver,
  requireApplicant,
};
