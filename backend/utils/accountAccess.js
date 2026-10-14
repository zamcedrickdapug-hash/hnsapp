// Keep login, restored sessions, and protected APIs on the same account policy.
const getAccountAccessError = (user) => {
  if (['suspended', 'banned'].includes(String(user.accountState || 'active'))) {
    return {
      message: user.accountState === 'banned'
        ? 'Your account has been banned. Please contact support.'
        : 'Your account has been suspended. Please contact support.',
      accountState: user.accountState,
    };
  }

  if (user.role === 'driver' && user.status !== 'approved') {
    return {
      message: user.status === 'declined'
        ? 'Your driver application was declined. Please contact support.'
        : 'Your driver account is pending admin approval. You will be able to log in once approved.',
      accountStatus: user.status,
    };
  }

  if (user.role === 'parent' && user.status !== 'approved') {
    return {
      message: user.status === 'declined'
        ? 'Your Parent account application was rejected by an administrator. Please contact support.'
        : 'Your account is awaiting administrator approval.',
      accountStatus: user.status || 'pending',
    };
  }

  return null;
};

module.exports = { getAccountAccessError };
