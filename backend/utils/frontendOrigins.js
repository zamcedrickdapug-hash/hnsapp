const getAllowedFrontendOrigins = () => {
  const configuredOrigins = String(process.env.FRONTEND_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => new URL(origin).origin);

  if (process.env.NODE_ENV !== 'production') {
    configuredOrigins.push('http://localhost:5173');
  }

  return [...new Set(configuredOrigins)];
};

module.exports = { getAllowedFrontendOrigins };
