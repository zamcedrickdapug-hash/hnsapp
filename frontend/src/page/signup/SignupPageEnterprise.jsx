import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { auth } from '../../firebase';
import { apiFetch } from '../../api';
import {
  AUTH_ROUTES,
  isValidPhoneNumber,
  normalizePhoneNumber,
  VALIDATION,
} from '../../constants/authConstants';
import AuthLayout from '../../components/auth/AuthLayout.jsx';
import './SignupPage.css';

const INITIAL_FORM = {
  fullName: '', email: '', password: '', confirmPassword: '', phone: '', homeAddress: '',
  licenseNumber: '', licenseExpiry: '', vehicleType: '', vehicleColor: '', seatCapacity: '12', plateNumber: '', yearsOfExperience: '',
};

const DRIVER_FIELDS = ['phone', 'homeAddress', 'licenseNumber', 'licenseExpiry', 'vehicleType', 'vehicleColor', 'seatCapacity', 'plateNumber', 'yearsOfExperience'];
const DOCUMENT_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const DOCUMENT_EXTENSIONS = /\.(jpe?g|png|pdf)$/i;

function todayString() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function registrationError(error) {
  if (error.code === 'auth/email-already-in-use') return 'This email is already registered. Sign in to your account instead.';
  if (error.code === 'auth/invalid-email') return 'Please enter a valid email address.';
  if (error.code === 'auth/weak-password') return 'Please choose a stronger password with at least 8 characters.';
  if (error.code === 'auth/network-request-failed') return 'Check your connection and try again.';
  if (error.code === 'auth/too-many-requests') return 'Too many attempts. Please wait a few minutes and try again.';
  if (Array.isArray(error.data?.errors)) return error.data.errors.join(' ');
  return error.message || 'We could not create your account. Please try again.';
}

function Field({ name, label, error, hint, children, ...inputProps }) {
  const id = `signup-${name}`;
  const descriptions = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined;
  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      {children || <input id={id} name={name} className="auth-input" aria-invalid={Boolean(error)} aria-describedby={descriptions} {...inputProps} />}
      {hint && <p className="signup-hint" id={`${id}-hint`}>{hint}</p>}
      {error && <p className="signup-field-error" id={`${id}-error`}>{error}</p>}
    </div>
  );
}

export default function SignupPageEnterprise({ initialRole = 'parent' }) {
  const [role, setRole] = useState(initialRole);
  const [form, setForm] = useState(INITIAL_FORM);
  const [validId, setValidId] = useState(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const createdUser = useRef(null);
  const requestInProgress = useRef(false);
  const isDriver = role === 'driver';

  useEffect(() => {
    setRole(initialRole);
  }, [initialRole]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: '' }));
    setError('');
  };

  const validate = () => {
    const nextErrors = {};
    if (!form.fullName.trim()) nextErrors.fullName = 'Enter your full name.';
    if (!VALIDATION.EMAIL_REGEX.test(form.email.trim().toLowerCase())) nextErrors.email = 'Use a valid email address.';
    if (!isDriver && !form.phone.trim()) nextErrors.phone = 'Enter your mobile number.';
    if (!isDriver && form.phone.trim() && !isValidPhoneNumber(form.phone)) nextErrors.phone = 'Use a valid Philippine mobile number.';
    if (!accountCreated && form.password.length < VALIDATION.MIN_PASSWORD_LENGTH) nextErrors.password = `Use at least ${VALIDATION.MIN_PASSWORD_LENGTH} characters.`;
    if (!accountCreated && form.password !== form.confirmPassword) nextErrors.confirmPassword = 'Passwords do not match.';
    if (isDriver) {
      const required = {
        phone: 'Enter your phone number.', homeAddress: 'Enter your home address.',
        licenseNumber: 'Enter your license number.', licenseExpiry: 'Enter your license expiry date.',
        vehicleType: 'Enter your vehicle type.', vehicleColor: 'Enter your vehicle color.',
        seatCapacity: 'Enter the number of seats.', plateNumber: 'Enter your plate number.',
        yearsOfExperience: 'Enter your years of experience.',
      };
      for (const [name, message] of Object.entries(required)) {
        if (!form[name].trim()) nextErrors[name] = message;
      }
      if (form.vehicleColor.trim().length > 30) nextErrors.vehicleColor = 'Vehicle color must be 30 characters or fewer.';
      const seatCapacity = Number(form.seatCapacity);
      if (form.seatCapacity && (!Number.isInteger(seatCapacity) || seatCapacity < 3 || seatCapacity > 20)) {
        nextErrors.seatCapacity = 'Enter a whole number from 3 to 20.';
      }
      if (form.phone.trim() && !isValidPhoneNumber(form.phone)) nextErrors.phone = 'Use a valid Philippine mobile number.';
      if (form.licenseExpiry && (Number.isNaN(Date.parse(form.licenseExpiry)) || form.licenseExpiry < todayString())) {
        nextErrors.licenseExpiry = 'Your license must be valid today or later.';
      }
      const experience = Number(form.yearsOfExperience);
      if (form.yearsOfExperience && (!Number.isInteger(experience) || experience < 0 || experience > 60)) {
        nextErrors.yearsOfExperience = 'Enter a whole number from 0 to 60.';
      }
      if (!validId) nextErrors.validId = 'Upload a valid ID for verification.';
      else if (!DOCUMENT_EXTENSIONS.test(validId.name) || !DOCUMENT_TYPES.includes(validId.type)) nextErrors.validId = 'Choose a JPEG, PNG, or PDF file.';
      else if (validId.size > 2 * 1024 * 1024) nextErrors.validId = 'Choose a file no larger than 2 MB.';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const sendVerification = async () => {
    await sendEmailVerification(createdUser.current);
    setVerificationSent(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (requestInProgress.current || !validate()) return;
    requestInProgress.current = true;
    setSubmitting(true);
    setError('');
    try {
      // Keep this identity for retries if the profile request fails after Firebase succeeds.
      if (!createdUser.current) {
        const credential = await createUserWithEmailAndPassword(auth, form.email.trim().toLowerCase(), form.password);
        createdUser.current = credential.user;
        setAccountCreated(true);
        setForm((current) => ({ ...current, password: '', confirmPassword: '' }));
      }
      const normalizedPhone = normalizePhoneNumber(form.phone);
      const identity = {
        fullName: form.fullName.trim(),
        email: createdUser.current.email,
        phone: normalizedPhone,
        firebaseUid: createdUser.current.uid,
        idToken: await createdUser.current.getIdToken(),
      };
      if (isDriver) {
        const payload = new FormData();
        for (const [name, value] of Object.entries(identity)) {
          if (name !== 'phone') payload.append(name, value);
        }
        for (const name of DRIVER_FIELDS) {
          if (name !== 'phone') payload.append(name, form[name].trim());
        }
        payload.set('phone', normalizedPhone);
        payload.append('validId', validId);
        await apiFetch('/api/drivers/create-profile', { method: 'POST', body: payload });
      } else {
        await apiFetch('/api/parents/create-profile', { method: 'POST', body: JSON.stringify(identity) });
      }
      setProfileSaved(true);
      try {
        await sendVerification();
      } catch (verificationError) {
        setError(verificationError.code === 'auth/too-many-requests'
          ? 'Your account is saved. Please wait a few minutes before requesting another verification email.'
          : 'Your account is saved, but we could not send the verification email. Please try sending it again.');
      }
    } catch (requestError) {
      setError(registrationError(requestError));
    } finally {
      requestInProgress.current = false;
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (requestInProgress.current) return;
    requestInProgress.current = true;
    setSubmitting(true);
    setError('');
    try {
      await sendVerification();
    } catch (verificationError) {
      setError(verificationError.code === 'auth/too-many-requests'
        ? 'Please wait a few minutes before requesting another verification email.'
        : 'We could not send the verification email. Check your connection and try again.');
    } finally {
      requestInProgress.current = false;
      setSubmitting(false);
    }
  };

  if (profileSaved) {
    return (
      <AuthLayout title={isDriver ? 'Application submitted' : 'Verify your email'} subtitle={isDriver ? 'Your driver application is now pending review.' : 'One more step to secure your account.'}>
        <div className="auth-form" aria-busy={submitting}>
          <p className="signup-copy" role="status">
            {verificationSent ? 'We sent a verification link to ' : 'Your account has been saved for '}
            <strong>{form.email.trim().toLowerCase()}</strong>.
          </p>
          <p className="signup-copy">{isDriver ? 'Your profile and vehicle information have been submitted for administrator review.' : 'Open the link in your inbox to verify your email. After verification, your account will await administrator approval. You can sign in once it is approved. Check your spam folder if the email has not arrived.'}</p>
          {isDriver && <p className="auth-message signup-note">Your driver application is pending admin review. You will not be able to sign in as an active driver until your application has been approved.</p>}
          {error && <p className="auth-message auth-message--error" role="alert">{error}</p>}
          <button className="auth-primary" type="button" onClick={handleResend} disabled={submitting}>
            {submitting ? 'Sending email...' : verificationSent ? 'Resend verification email' : 'Send verification email'}
          </button>
          <p className="auth-footer"><Link className="auth-link" to={AUTH_ROUTES.LOGIN}>Back to Sign In</Link></p>
        </div>
      </AuthLayout>
    );
  }

  const field = (name, label, props = {}) => (
    <Field key={name} name={name} label={label} value={form[name]} error={errors[name]} onChange={handleChange} disabled={submitting} required {...props} />
  );

  return (
    <AuthLayout title={isDriver ? 'Drive with Hatid-Sundo' : 'Create Parent Account'} subtitle={isDriver ? 'Help students get to school safely and reliably.' : 'Create a secure parent account to manage school transportation.'} wide={isDriver}>
      <form className="auth-form" onSubmit={handleSubmit} noValidate aria-busy={submitting}>
        {isDriver && (
          <div className="driver-application-intro" aria-label="Driver onboarding overview">
            <div className="driver-application-badge">Driver onboarding</div>
            <div className="driver-application-steps">
              <span>1. Submit your application</span>
              <span>2. Add driver and vehicle details</span>
              <span>3. Await admin verification</span>
              <span>4. Start driving once approved</span>
            </div>
          </div>
        )}

        {accountCreated && <p className="auth-message signup-note" role="status">Your sign-in details are saved. Review the remaining details and retry to finish creating your profile.</p>}
        {error && <p className="auth-message auth-message--error" role="alert">{error}</p>}
        {Object.values(errors).some(Boolean) && <p className="signup-field-error" role="alert">Please check the highlighted fields.</p>}

        <div className={isDriver ? 'auth-form-grid' : 'signup-field-stack'}>
          {field('fullName', 'Full name', { autoComplete: 'name' })}
          {field('email', 'Email address', { type: 'email', autoComplete: 'email', placeholder: 'you@example.com', disabled: submitting || accountCreated, hint: 'Use your real email address for verification.' })}
          {!isDriver && field('phone', 'Mobile number', { type: 'tel', autoComplete: 'tel', placeholder: '+63 917 123 4567' })}
          {!accountCreated && [['password', 'Password', showPassword, setShowPassword], ['confirmPassword', 'Confirm password', showConfirmPassword, setShowConfirmPassword]].map(([name, label, visible, setVisible]) => (
            <Field key={name} name={name} label={label} error={errors[name]} hint={name === 'password' ? `At least ${VALIDATION.MIN_PASSWORD_LENGTH} characters.` : undefined}>
              <div className="signup-password">
                <input className="auth-input" id={`signup-${name}`} name={name} type={visible ? 'text' : 'password'} autoComplete="new-password" value={form[name]} onChange={handleChange} required disabled={submitting} minLength={VALIDATION.MIN_PASSWORD_LENGTH} aria-invalid={Boolean(errors[name])} aria-describedby={[errors[name] && `signup-${name}-error`, name === 'password' && 'signup-password-hint'].filter(Boolean).join(' ') || undefined} />
                <button className="signup-password-toggle" type="button" aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`} aria-pressed={visible} onClick={() => setVisible(!visible)} disabled={submitting}>{visible ? 'Hide' : 'Show'}</button>
              </div>
            </Field>
          ))}
        </div>

        {isDriver && <>
          <fieldset className="signup-section" disabled={submitting}>
            <legend>Driver information</legend>
            <div className="auth-form-grid">
              {field('phone', 'Phone number', { type: 'tel', autoComplete: 'tel' })}
              {field('homeAddress', 'Home address', { autoComplete: 'street-address' })}
              {field('licenseNumber', 'License number')}
              {field('licenseExpiry', 'License expiry date', { type: 'date', min: todayString() })}
            </div>
          </fieldset>
          <fieldset className="signup-section" disabled={submitting}>
            <legend>Vehicle information</legend>
            <div className="auth-form-grid">
              {field('vehicleType', 'Vehicle type', { placeholder: 'e.g. Van' })}
              {field('vehicleColor', 'Vehicle color', { maxLength: 30 })}
              {field('seatCapacity', 'Seat capacity', { type: 'number', min: '3', max: '20', step: '1', inputMode: 'numeric' })}
              {field('plateNumber', 'Plate number')}
              {field('yearsOfExperience', 'Years of experience', { type: 'number', min: '0', max: '60', step: '1', inputMode: 'numeric' })}
            </div>
          </fieldset>
          <Field name="validId" label="Valid ID document" type="file" accept=".jpg,.jpeg,.png,.pdf" hint="JPEG, PNG, or PDF. Maximum 2 MB." error={errors.validId} disabled={submitting} required onChange={(event) => { setValidId(event.target.files?.[0] || null); setErrors((current) => ({ ...current, validId: '' })); }} />
          <p className="signup-copy">Your application and documents will be reviewed by an administrator before you can access the driver dashboard.</p>
        </>}

        <button className="auth-primary" type="submit" disabled={submitting}>
          {submitting ? 'Creating account...' : accountCreated ? 'Finish registration' : isDriver ? 'Submit driver application' : 'Create account'}
        </button>
        <p className="auth-footer">Already have an account? <Link className="auth-link" to={AUTH_ROUTES.LOGIN}>Sign In</Link></p>
      </form>
    </AuthLayout>
  );
}
