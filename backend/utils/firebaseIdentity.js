const path = require('path');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const identityError = (status, message) => Object.assign(new Error(message), { status });

const getFirebaseServiceAccount = () => {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  }

  const credentialsPath = process.env.FIREBASE_ADMIN_SDK_PATH
    ? path.resolve(process.env.FIREBASE_ADMIN_SDK_PATH)
    : path.resolve(__dirname, '../serviceAccountKey.json');
  return require(credentialsPath);
};

const verifyFirebaseIdentity = async (idToken) => {
  if (typeof idToken !== 'string' || !idToken.trim()) {
    throw identityError(400, 'Firebase ID token is required.');
  }

  let admin;
  try {
    admin = require('firebase-admin');
    if (!admin.apps.length) {
      const serviceAccount = getFirebaseServiceAccount();
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    }
  } catch {
    throw identityError(503, 'Firebase authentication is not configured.');
  }

  let decodedToken;
  try {
    decodedToken = await admin.auth().verifyIdToken(idToken);
  } catch {
    throw identityError(401, 'Invalid or expired Firebase token.');
  }

  const email = typeof decodedToken.email === 'string' ? decodedToken.email.trim().toLowerCase() : '';
  if (!decodedToken.uid || !EMAIL_REGEX.test(email)) {
    throw identityError(400, 'Firebase user must have a valid email address.');
  }

  return { uid: decodedToken.uid, email, emailVerified: decodedToken.email_verified === true };
};

const verifyRegistrationIdentity = async (body) => {
  const identity = await verifyFirebaseIdentity(body.idToken);
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

  if (identity.email !== email || identity.uid !== body.firebaseUid) {
    throw identityError(403, 'The registration details do not match the authenticated account.');
  }

  return identity;
};

module.exports = { verifyFirebaseIdentity, verifyRegistrationIdentity };
