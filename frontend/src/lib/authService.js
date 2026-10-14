import { reload, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { apiFetch } from '../api';

export async function loginWithCredentials(email, password, signal) {
  const normalizedEmail = email.trim().toLowerCase();

  const { user } = await signInWithEmailAndPassword(auth, normalizedEmail, password);
  await reload(user);
  signal?.throwIfAborted();

  if (!user.emailVerified) {
    const error = new Error('Please verify your email address using the link in your inbox before signing in.');
    error.code = 'auth/email-not-verified';
    throw error;
  }

  const idToken = await user.getIdToken(true);
  return apiFetch('/api/auth/verify-firebase-token', {
    method: 'POST', body: JSON.stringify({ idToken }), signal,
  });
}

export function resendVerificationEmail(email) {
  const user = auth.currentUser;
  if (!user || user.email?.toLowerCase() !== email.trim().toLowerCase()) {
    throw new Error('Enter your email and password and sign in again to resend verification.');
  }
  return sendEmailVerification(user);
}

export function requestPasswordReset(email) {
  return sendPasswordResetEmail(auth, email.trim().toLowerCase());
}

export function signOutIdentity() { return signOut(auth); }

export function getAuthErrorMessage(error) {
  switch (error.code) {
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'Incorrect email or password. Please try again.';
    case 'auth/invalid-email': return 'Please enter a valid email address.';
    case 'auth/user-disabled': return 'This account is disabled. Please contact support.';
    case 'auth/too-many-requests': return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'Could not reach Firebase Authentication. Check your internet connection and frontend Firebase configuration.';
    case 'auth/api-key-not-valid':
    case 'auth/invalid-api-key':
    case 'auth/configuration-not-found':
      return 'Firebase Authentication is not configured correctly for this frontend. Check its VITE_FIREBASE_* settings.';
    default:
      if (error instanceof TypeError) return 'Unable to connect. Please try again.';
      return error.message || 'Unable to sign in. Please try again.';
  }
}
