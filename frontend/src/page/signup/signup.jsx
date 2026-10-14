import { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebase';
import { apiFetch } from '../../api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { emailVerificationBestPractices, getVerificationMessage } from '../../lib/firebaseAuthEnhanced';
import './signup.scss';

const SIGNUP_STEPS = {
	ROLE_SELECT: 'role-select',
	FORM: 'form',
	VERIFICATION_SENT: 'verification-sent',
};

const initialParentForm = {
	fullName: '',
	email: '',
	password: '',
	confirmPassword: '',
};

const initialDriverForm = {
	fullName: '',
	email: '',
	phone: '',
	homeAddress: '',
	password: '',
	confirmPassword: '',
	licenseNumber: '',
	licenseExpiry: '',
	vehicleType: '',
	plateNumber: '',
	yearsOfExperience: '',
};

const initialAdminForm = {
	fullName: '',
	email: '',
	password: '',
	confirmPassword: '',
};

const isValidEmail = (email) => {
	const trimmed = (email || '').trim().toLowerCase();
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
};

const getTodayString = () => {
	const today = new Date();
	const year = today.getFullYear();
	const month = String(today.getMonth() + 1).padStart(2, '0');
	const day = String(today.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
};

export default function SignupPage({ onLoggedIn, onBackToLogin }) {
	const [step, setStep] = useState(SIGNUP_STEPS.ROLE_SELECT);
	const [accountType, setAccountType] = useState('parent');

	// Form states
	const [parentForm, setParentForm] = useState(initialParentForm);
	const [driverForm, setDriverForm] = useState(initialDriverForm);
	const [adminForm, setAdminForm] = useState(initialAdminForm);

	// UI states
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [errors, setErrors] = useState([]);
	const [successMessage, setSuccessMessage] = useState('');
	const [emailError, setEmailError] = useState('');
	const [licenseExpiryError, setLicenseExpiryError] = useState('');

	// Get current form based on account type
	const getCurrentForm = () => {
		if (accountType === 'parent') return parentForm;
		if (accountType === 'driver') return driverForm;
		return adminForm;
	};

	const setCurrentForm = (form) => {
		if (accountType === 'parent') setParentForm(form);
		else if (accountType === 'driver') setDriverForm(form);
		else setAdminForm(form);
	};

	const handleRoleSelect = (role) => {
		setAccountType(role);
		setErrors([]);
		setEmailError('');
		setStep(SIGNUP_STEPS.FORM);
	};

	const handleEmailChange = (e) => {
		const value = e.target.value;
		const newForm = { ...getCurrentForm(), email: value };
		setCurrentForm(newForm);

		if (value.trim()) {
			if (!isValidEmail(value) && accountType !== 'admin') {
				setEmailError('Please enter a valid email address.');
			} else {
				setEmailError('');
			}
		} else {
			setEmailError('');
		}
	};

	const handleLicenseExpiryChange = (e) => {
		const value = e.target.value;
		const newForm = { ...getCurrentForm(), licenseExpiry: value };
		setCurrentForm(newForm);

		if (value.trim()) {
			const today = getTodayString();
			if (value < today) {
				setLicenseExpiryError('Driver license expiration date must be today or a future date.');
			} else {
				setLicenseExpiryError('');
			}
		} else {
			setLicenseExpiryError('');
		}
	};

	const handleFormChange = (e) => {
		const { name, value } = e.target;
		const newForm = { ...getCurrentForm(), [name]: value };
		setCurrentForm(newForm);
	};

	const validateCommonFields = (form) => {
		const errors = [];
		if (!form.fullName.trim()) errors.push('Full name is required');
		if (!form.email.trim()) errors.push('Email address is required');
		if (!form.password) errors.push('Password is required');
		if (form.password.length < 6) errors.push('Password must be at least 6 characters');
		if (form.password !== form.confirmPassword) errors.push('Passwords do not match');
		return errors;
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		const form = getCurrentForm();
		console.log('[AUTH_DEBUG] Signup attempt started', { accountType, email: form.email?.substring(0, 5) + '...', timestamp: new Date().toISOString() })
		
		const newErrors = validateCommonFields(form);

		// Email validation for non-admin
		if (accountType !== 'admin' && !isValidEmail(form.email)) {
			newErrors.push('Please enter a valid email address.');
		}

		// Driver-specific validation
		if (accountType === 'driver') {
			if (!form.phone.trim()) newErrors.push('Phone number is required');
			if (!form.homeAddress.trim()) newErrors.push('Home address is required');
			if (!form.licenseNumber.trim()) newErrors.push('License number is required');
			if (!form.licenseExpiry.trim()) newErrors.push('License expiry date is required');
			else {
				// Validate that the license expiry date is not in the past
				const today = getTodayString();
				if (form.licenseExpiry < today) {
					newErrors.push('Driver license expiration date must be today or a future date.');
				}
			}
			if (!form.vehicleType.trim()) newErrors.push('Vehicle type is required');
			if (!form.plateNumber.trim()) newErrors.push('License plate number is required');
			if (!form.yearsOfExperience) newErrors.push('Years of experience is required');
		}

		if (newErrors.length > 0) {
			setErrors(newErrors);
			return;
		}

		setSubmitting(true);
		setErrors([]);

		try {
			const emailLower = form.email.trim().toLowerCase();

			// Create Firebase account
			const userCredential = await createUserWithEmailAndPassword(auth, emailLower, form.password);
			const user = userCredential.user;
			console.log('[AUTH_DEBUG] Firebase account created', { email: emailLower, accountType, uid: user.uid, timestamp: new Date().toISOString() })

			// Send verification email for Parent and Driver only
			if (accountType !== 'admin') {
				try {
					// Use enhanced email verification with retry logic and custom URL
					const verificationResult = await emailVerificationBestPractices.sendVerificationEmailWithRetry(user, 3);

					if (!verificationResult.success) {
						console.error('[AUTH_DEBUG] Verification email failed to send', { error: verificationResult.error, timestamp: new Date().toISOString() })
						setErrors([
							'Failed to send verification email. Please check your internet connection and try again.',
							'If the problem persists, you can request a new verification email after logging in.',
						]);
						setSubmitting(false);
						return;
					}

					console.log('[AUTH_DEBUG] Verification email sent successfully', { email: emailLower, timestamp: new Date().toISOString() })
				} catch (emailError) {
					console.error('[AUTH_DEBUG] Error sending verification email', { error: emailError?.message, timestamp: new Date().toISOString() })
					setErrors(['An error occurred while sending the verification email. Please try again.']);
					setSubmitting(false);
					return;
				}
			}

			// Create profile in backend
			if (accountType === 'parent') {
				console.log('[AUTH_DEBUG] Creating parent profile', { email: emailLower, timestamp: new Date().toISOString() })
				await apiFetch('/api/parents/create-profile', {
					method: 'POST',
					body: JSON.stringify({
						fullName: form.fullName.trim(),
						email: emailLower,
						firebaseUid: user.uid,
					}),
				});
			} else if (accountType === 'driver') {
				console.log('[AUTH_DEBUG] Creating driver profile', { email: emailLower, timestamp: new Date().toISOString() })
				await apiFetch('/api/drivers/create-profile', {
					method: 'POST',
					body: JSON.stringify({
						fullName: form.fullName.trim(),
						email: emailLower,
						phone: form.phone.trim(),
						homeAddress: form.homeAddress.trim(),
						licenseNumber: form.licenseNumber.trim(),
						licenseExpiry: form.licenseExpiry,
						vehicleType: form.vehicleType.trim(),
						plateNumber: form.plateNumber.trim(),
						yearsOfExperience: parseInt(form.yearsOfExperience),
						firebaseUid: user.uid,
					}),
				});
			} else if (accountType === 'admin') {
				console.log('[AUTH_DEBUG] Creating admin account', { email: emailLower, timestamp: new Date().toISOString() })
				// Admin signup
				const response = await apiFetch('/api/auth/admin-signup', {
					method: 'POST',
					body: JSON.stringify({
						fullName: form.fullName.trim(),
						email: emailLower,
						password: form.password,
					}),
				});
				console.log('[AUTH_DEBUG] Admin signup successful, logging in directly', { timestamp: new Date().toISOString() })
				// Log in admin directly (no verification needed)
				onLoggedIn(response);
				return;
			}

			setSuccessMessage(
				accountType === 'admin'
					? '✅ Admin account created successfully!'
					: '✅ Verification email sent! Please check your inbox and verify your email address.'
			);
			setStep(SIGNUP_STEPS.VERIFICATION_SENT);
		} catch (error) {
			console.error('[AUTH_DEBUG] Signup error', { error: error?.message, code: error?.code, timestamp: new Date().toISOString() })
			if (error.code === 'auth/email-already-in-use') {
				setErrors(['This email address is already registered']);
			} else if (error.code === 'auth/invalid-email') {
				setErrors(['Invalid email address']);
			} else if (error.code === 'auth/weak-password') {
				setErrors(['Password is too weak']);
			} else {
				setErrors([error.message || 'Failed to create account']);
			}
		} finally {
			setSubmitting(false);
		}
	};

	// ============ RENDER LOGIC ============

	if (step === SIGNUP_STEPS.ROLE_SELECT) {
		return (
			<div className="signup-page-modern">
				<div className="signup-bg-gradient"></div>
				<div className="signup-container">
					<div className="signup-header">
						<h1>Create Account</h1>
						<p>Choose your role to get started</p>
					</div>

					<div className="role-selection-grid">
						<button
							type="button"
							className="role-card-large"
							onClick={() => handleRoleSelect('parent')}
						>
							<div className="role-icon-lg">👨‍👩‍👧</div>
							<h3>Parent</h3>
							<p>Book school services for your child</p>
						</button>

						<button
							type="button"
							className="role-card-large"
							onClick={() => handleRoleSelect('driver')}
						>
							<div className="role-icon-lg">🚐</div>
							<h3>Driver</h3>
							<p>Manage school service routes</p>
						</button>

						<button
							type="button"
							className="role-card-large"
							onClick={() => handleRoleSelect('admin')}
						>
							<div className="role-icon-lg">⚙️</div>
							<h3>Admin</h3>
							<p>System administration</p>
						</button>
					</div>

					<div className="signup-footer">
						<p>Already have an account? 
							<button type="button" className="link-btn" onClick={onBackToLogin}>
								Sign in here
							</button>
						</p>
					</div>
				</div>
			</div>
		);
	}

	if (step === SIGNUP_STEPS.VERIFICATION_SENT) {
		const verificationMsg = getVerificationMessage(accountType);

		return (
			<div className="signup-page-modern">
				<div className="signup-bg-gradient"></div>
				<div className="signup-container">
					<div className="verification-card">
						<div className="verification-icon">✓</div>
						<h2>{verificationMsg.title}</h2>
						<p className="verification-message">
							{verificationMsg.message}
						</p>
						
						{accountType !== 'admin' && (
							<div className="verification-instructions">
								<h3>What to do next:</h3>
								<ol>
									{verificationMsg.instructions.map((instruction, index) => (
										<li key={index}>{instruction}</li>
									))}
								</ol>

								<div className="troubleshooting-section">
									<h4>📧 Email not received?</h4>
									<ul>
										{verificationMsg.troubleshooting.tips.slice(0, 4).map((tip, index) => (
											<li key={index}>{tip}</li>
										))}
									</ul>
									<p className="support-contact">
										Need help? Contact <a href={`mailto:${verificationMsg.troubleshooting.support.email}`}>{verificationMsg.troubleshooting.support.email}</a>
									</p>
								</div>
							</div>
						)}

						<Button onClick={onBackToLogin} className="btn-primary">
							{accountType === 'admin' ? 'Log In' : 'Back to Login'}
						</Button>
					</div>
				</div>
			</div>
		);
	}

	// Form view
	const form = getCurrentForm();
	const isDriver = accountType === 'driver';
	const isAdmin = accountType === 'admin';

	return (
		<div className="signup-page-modern">
			<div className="signup-bg-gradient"></div>
			<div className="signup-container">
				<form className="signup-form" onSubmit={handleSubmit}>
					<div className="form-header-signup">
						<button
							type="button"
							className="back-btn"
							onClick={() => setStep(SIGNUP_STEPS.ROLE_SELECT)}
							disabled={submitting}
						>
							← Back
						</button>
						<div>
							<h2>Create {accountType.charAt(0).toUpperCase() + accountType.slice(1)} Account</h2>
							<p>Fill in your information to get started</p>
						</div>
					</div>

					{/* Full Name */}
					<div className="form-field">
						<label htmlFor="fullName">Full Name</label>
						<Input
							id="fullName"
							type="text"
							name="fullName"
							value={form.fullName}
							onChange={handleFormChange}
							placeholder="Your full name"
							required
							disabled={submitting}
						/>
					</div>

					{/* Email */}
					<div className="form-field">
						<label htmlFor="email">Email Address</label>
						<Input
							id="email"
							type="email"
							name="email"
							value={form.email}
							onChange={handleEmailChange}
								placeholder={isAdmin ? "admin@example.com" : "name@example.com"}
							required
							disabled={submitting}
							className={emailError ? 'has-error' : ''}
						/>
						{emailError && <span className="field-error">{emailError}</span>}
					</div>

					{/* Driver-specific fields */}
					{isDriver && (
						<>
							<div className="form-field">
								<label htmlFor="phone">Phone Number</label>
								<Input
									id="phone"
									type="tel"
									name="phone"
									value={form.phone}
									onChange={handleFormChange}
									placeholder="Your phone number"
									required
									disabled={submitting}
								/>
							</div>

							<div className="form-field">
								<label htmlFor="homeAddress">Home Address</label>
								<Input
									id="homeAddress"
									type="text"
									name="homeAddress"
									value={form.homeAddress}
									onChange={handleFormChange}
									placeholder="Your home address"
									required
									disabled={submitting}
								/>
							</div>

							<div className="form-field">
								<label htmlFor="licenseNumber">License Number</label>
								<Input
									id="licenseNumber"
									type="text"
									name="licenseNumber"
									value={form.licenseNumber}
									onChange={handleFormChange}
									placeholder="Driver's license number"
									required
									disabled={submitting}
								/>
							</div>

							<div className="form-field">
								<label htmlFor="licenseExpiry">License Expiry Date</label>
								<Input
									id="licenseExpiry"
									type="date"
									name="licenseExpiry"
									value={form.licenseExpiry}
									onChange={handleLicenseExpiryChange}
									min={getTodayString()}
									required
									disabled={submitting}
									className={licenseExpiryError ? 'has-error' : ''}
								/>
								{licenseExpiryError && <span className="field-error">{licenseExpiryError}</span>}
							</div>

							<div className="form-field">
								<label htmlFor="vehicleType">Vehicle Type</label>
								<select
									id="vehicleType"
									name="vehicleType"
									value={form.vehicleType}
									onChange={handleFormChange}
									required
									disabled={submitting}
									className="form-select"
								>
									<option value="">Select vehicle type</option>
									<option value="van">Van</option>
									<option value="car">Car</option>
									<option value="bus">Bus</option>
									<option value="suv">SUV</option>
								</select>
							</div>

							<div className="form-field">
								<label htmlFor="plateNumber">License Plate Number</label>
								<Input
									id="plateNumber"
									type="text"
									name="plateNumber"
									value={form.plateNumber}
									onChange={handleFormChange}
									placeholder="Vehicle license plate"
									required
									disabled={submitting}
								/>
							</div>

							<div className="form-field">
								<label htmlFor="yearsOfExperience">Years of Experience</label>
								<Input
									id="yearsOfExperience"
									type="number"
									name="yearsOfExperience"
									value={form.yearsOfExperience}
									onChange={handleFormChange}
									placeholder="0"
									min="0"
									required
									disabled={submitting}
								/>
							</div>
						</>
					)}

					{/* Password */}
					<div className="form-field">
						<label htmlFor="password">Password</label>
						<div className="password-input-wrapper">
							<Input
								id="password"
								type={showPassword ? 'text' : 'password'}
								name="password"
								value={form.password}
								onChange={handleFormChange}
								placeholder="••••••••"
								required
								disabled={submitting}
							/>
							<button
								type="button"
								className="password-toggle-btn"
								onClick={() => setShowPassword(!showPassword)}
								disabled={submitting}
								aria-label={showPassword ? 'Hide password' : 'Show password'}
							>
								{showPassword ? '👁️' : '👁️‍🗨️'}
							</button>
						</div>
					</div>

					{/* Confirm Password */}
					<div className="form-field">
						<label htmlFor="confirmPassword">Confirm Password</label>
						<div className="password-input-wrapper">
							<Input
								id="confirmPassword"
								type={showConfirmPassword ? 'text' : 'password'}
								name="confirmPassword"
								value={form.confirmPassword}
								onChange={handleFormChange}
								placeholder="••••••••"
								required
								disabled={submitting}
							/>
							<button
								type="button"
								className="password-toggle-btn"
								onClick={() => setShowConfirmPassword(!showConfirmPassword)}
								disabled={submitting}
								aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
							>
								{showConfirmPassword ? '👁️' : '👁️‍🗨️'}
							</button>
						</div>
					</div>

					{/* Errors */}
					{errors.length > 0 && (
						<div className="errors-container">
							{errors.map((error, idx) => (
								<div key={idx} className="error-message">
									{error}
								</div>
							))}
						</div>
					)}

					{/* Submit Button */}
					<Button
						type="submit"
						disabled={submitting || !!emailError || !!licenseExpiryError || !form.fullName || !form.email || !form.password}
						className="btn-primary"
					>
						{submitting ? 'Creating Account...' : 'Create Account'}
					</Button>

					{/* Back to Login */}
					<div className="form-footer">
						<p>Already have an account? 
							<button type="button" className="link-btn" onClick={onBackToLogin} disabled={submitting}>
								Sign in here
							</button>
						</p>
					</div>
				</form>
			</div>
		</div>
	);
}
