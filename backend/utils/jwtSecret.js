const getJwtSecret = () => {
  const configuredSecret = process.env.JWT_SECRET;
  if (typeof configuredSecret !== 'string' || !configuredSecret.trim()) {
    const error = new Error('JWT_SECRET must be configured before JWT authentication can be used.');
    error.code = 'JWT_SECRET_MISSING';
    throw error;
  }

  return configuredSecret;
};

module.exports = { getJwtSecret };
