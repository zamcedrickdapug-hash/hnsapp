import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Eye, EyeOff, LoaderCircle } from 'lucide-react';
import AuthLayout from '../../components/auth/AuthLayout';
import { AUTH_ROUTES } from '../../constants/authConstants';
import { getAuthErrorMessage, loginWithCredentials, requestPasswordReset, resendVerificationEmail } from '../../lib/authService';

export default function LoginPageEnterprise({ onLoggedIn }) {
  const { pathname } = useLocation();
  const isReset = pathname === AUTH_ROUTES.FORGOT_PASSWORD;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [needsVerification, setNeedsVerification] = useState(false);
  const requestRef = useRef(null);

  useEffect(() => {
    setEmail('');
    setPassword('');
    setShowPassword(false);
    setError('');
    setNotice('');
    setNeedsVerification(false);
  }, [pathname]);

  useEffect(() => () => requestRef.current?.abort(), []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setError('');
    setNotice('');
    setNeedsVerification(false);
    if (!email.trim() || (!isReset && !password)) {
      setError(isReset ? 'Please enter your email address.' : 'Please enter your email and password.');
      return;
    }
    const controller = new AbortController();
    requestRef.current = controller;
    setSubmitting(true);
    try {
      if (isReset) {
        await requestPasswordReset(email);
        if (!controller.signal.aborted) setNotice('If this email has an account, a password reset link will arrive shortly. Check your inbox and spam folder.');
      } else {
        const response = await loginWithCredentials(email, password, controller.signal);
        if (!controller.signal.aborted) onLoggedIn(response);
      }
    } catch (failure) {
      if (!controller.signal.aborted) {
        if (isReset && failure.code === 'auth/user-not-found') {
          setNotice('If this email has an account, a password reset link will arrive shortly.');
        } else {
          setError(getAuthErrorMessage(failure));
          setNeedsVerification(failure.code === 'auth/email-not-verified');
        }
      }
    } finally {
      if (!controller.signal.aborted) setSubmitting(false);
    }
  };

  const handleResend = async () => {
    const controller = new AbortController();
    requestRef.current = controller;
    setSubmitting(true);
    setError('');
    try {
      await resendVerificationEmail(email);
      if (!controller.signal.aborted) setNotice('Verification email sent. Check your inbox and spam folder.');
    } catch (failure) {
      if (!controller.signal.aborted) setError(getAuthErrorMessage(failure));
    } finally {
      if (!controller.signal.aborted) setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title={isReset ? 'Forgot password?' : 'Welcome back'}
      subtitle={isReset ? 'Enter your email to receive a reset link.' : 'Sign in to manage your child\'s school transportation.'}
    >
      <form className="auth-form" onSubmit={handleSubmit} aria-busy={submitting} autoComplete="off">
        <div className="auth-field">
          <label htmlFor="account-address">Email address</label>
          <input id="account-address" name="account-address" className="auth-input" type="email" autoComplete="off" autoCapitalize="none" spellCheck={false}
            placeholder="you@example.com" value={email} onChange={(event) => { setEmail(event.target.value); setNeedsVerification(false); }} required disabled={submitting} />
        </div>
        {!isReset && <>
          <div className="auth-field">
            <label htmlFor="account-key">Password</label>
            <div className="auth-password">
              <input id="account-key" name="account-key" className="auth-input" type={showPassword ? 'text' : 'password'} autoComplete="new-password"
                placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={submitting} />
              <button className="auth-password-toggle" type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}
                onClick={() => setShowPassword((visible) => !visible)} disabled={submitting}>
                {showPassword ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
              </button>
            </div>
          </div>
          <div className="auth-form-actions"><Link className="auth-link" to={AUTH_ROUTES.FORGOT_PASSWORD}>Forgot password?</Link></div>
        </>}
        {error && <p className="auth-message" role="alert">{error}</p>}
        {notice && <p className="auth-message auth-message--success" role="status">{notice}</p>}
        <button className="auth-primary" type="submit" disabled={submitting}>
          {submitting && <LoaderCircle size={18} className="auth-spinner" aria-hidden="true" />}
          {submitting ? (isReset ? 'Sending link…' : 'Signing in…') : (isReset ? 'Send reset link' : 'Sign In')}
        </button>
        {needsVerification && <button className="auth-link" type="button" onClick={handleResend} disabled={submitting}>Resend verification email</button>}
        {isReset && <p className="auth-hint">For an account managed by your school or an administrator, contact your system administrator for password help.</p>}
      </form>
      <p className="auth-footer">
        {isReset ? <>Remember your password? <Link className="auth-link" to={AUTH_ROUTES.LOGIN}>Sign In</Link></> : <>Need a Parent account? <Link className="auth-link" to={AUTH_ROUTES.SIGNUP}>Create Parent Account</Link></>}
      </p>
      {!isReset && (
        <p className="auth-footer auth-footer--compact">
          Want to drive with Hatid-Sundo? <Link className="auth-link" to={AUTH_ROUTES.DRIVER_APPLY}>Apply as Driver</Link>
        </p>
      )}
    </AuthLayout>
  );
}
