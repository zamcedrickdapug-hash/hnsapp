import { useState } from 'react';
import { signInWithEmailAndPassword, reload } from 'firebase/auth';
import { auth } from '../../firebase';
import { apiFetch } from '../../api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import AdminLoginPage from './AdminLoginPage';
import './login.scss';

const ACCOUNT_ICONS = {
	parent: '👨‍👩‍👧',
	driver: '🚐',
	admin: '⚙️',
};

const ACCOUNT_DESCRIPTIONS = {
	parent: 'Parents',
	driver: 'Drivers',
	admin: 'Admins',
};

const isValidEmail = (email) => {
	const trimmed = (email || '').trim().toLowerCase();
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
};

export default function LoginPage({ onLoggedIn, onSignUpClick }) {
	const [accountType, setAccountType] = useState('parent');
	const [showAdminLogin, setShowAdminLogin] = useState(false);
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [showPassword, setShowPassword] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState('');
	const [emailError, setEmailError] = useState('');

	const handleEmailChange = (e) => {
		const value = e.target.value;
		setEmail(value);
		
		// Real-time Gmail validation
		if (value.trim()) {
			if (!isValidEmail(value)) {
				setEmailError('Please enter a valid email address.');
			} else {
				setEmailError('');
			}
		} else {
			setEmailError('');
		}
	};

	const handleLogin = async (event) => {
		event.preventDefault();
		setError('');

		// Validate
		if (!email.trim() || !password) {
			setError('Please enter your email address and password.');
			return;
		}

		// Validate the real email format for parent and driver accounts.
		if ((accountType === 'parent' || accountType === 'driver') && !isValidEmail(email)) {
			setError('Please enter a valid email address.');
			return;
		}

		setSubmitting(true);

		try {
			const emailLower = email.trim().toLowerCase();

			if (accountType === 'parent') {
				const userCredential = await signInWithEmailAndPassword(auth, emailLower, password);
				const user = userCredential.user;

				await reload(user);

				if (!user.emailVerified) {
					setError('Please verify your email address before logging in. Check your inbox for the verification email.');
					setSubmitting(false);
					return;
				}

				const idToken = await user.getIdToken();
				const response = await apiFetch('/api/auth/verify-firebase-token', {
					method: 'POST',
					body: JSON.stringify({
						idToken,
						accountType: 'parent',
					}),
				});

				onLoggedIn(response);
			} else if (accountType === 'driver') {
				const userCredential = await signInWithEmailAndPassword(auth, emailLower, password);
				const user = userCredential.user;

				await reload(user);

				if (!user.emailVerified) {
					setError('Please verify your email address before logging in. Check your inbox for the verification email.');
					setSubmitting(false);
					return;
				}

				const idToken = await user.getIdToken();
				const response = await apiFetch('/api/auth/verify-firebase-token', {
					method: 'POST',
					body: JSON.stringify({
						idToken,
						accountType: 'driver',
					}),
				});

				onLoggedIn(response);
			}
		} catch (error) {
			if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
				setError('Invalid email address or password. Please try again.');
			} else if (error.code === 'auth/invalid-email') {
				setError('Invalid email address format.');
			} else if (error.code === 'auth/user-disabled') {
				setError('This account has been disabled. Please contact support.');
			} else if (error?.data?.accountStatus) {
				const readableStatus = error.data.accountStatus.charAt(0).toUpperCase() + error.data.accountStatus.slice(1);
				setError(`Your account is currently ${readableStatus}. Access will be granted after approval.`);
			} else {
				setError(error.message || 'Unable to login. Please try again.');
			}
		} finally {
			setSubmitting(false);
		}
	};

	const handleAccountTypeChange = (newAccountType) => {
		setAccountType(newAccountType);
		setEmail('');
		setPassword('');
		setError('');
		setEmailError('');
		setShowAdminLogin(false);
	};

	const handleForgotPassword = (e) => {
		e.preventDefault();
		// TODO: Implement forgot password flow
		alert('Forgot password feature coming soon');
	};

	// Show admin password login if admin is selected
	if (showAdminLogin && accountType === 'admin') {
		return (
			<AdminLoginPage
				onLoggedIn={onLoggedIn}
				onBackToMain={() => {
					setShowAdminLogin(false);
					setEmail('');
					setPassword('');
				}}
			/>
		);
	}

	return (
		<div className="auth-page-modern">
			{/* Background Gradient */}
			<div className="auth-bg-gradient"></div>
			
			<div className="auth-container">
				{/* Role Selection Cards */}
				<div className="role-cards-container">
					{['parent', 'driver', 'admin'].map((type) => (
						<button
							key={type}
							type="button"
							className={`role-card ${accountType === type ? 'active' : ''}`}
							onClick={() => handleAccountTypeChange(type)}
							title={ACCOUNT_DESCRIPTIONS[type]}
						>
							<span className="role-card-icon">{ACCOUNT_ICONS[type]}</span>
							<span className="role-card-label">{ACCOUNT_DESCRIPTIONS[type]}</span>
						</button>
					))}
				</div>

				{/* Main Auth Card */}
				<div className="auth-card">
					{accountType === 'admin' ? (
						<div className="admin-intro">
							<div className="admin-intro-header">
								<h2>Admin Access</h2>
								<p>Sign in to your admin account</p>
							</div>
							<Button 
								onClick={(e) => {
									e.preventDefault();
									setShowAdminLogin(true);
								}} 
								disabled={submitting}
								className="btn-primary"
							>
								Continue to Admin Login
							</Button>
						</div>
					) : (
						<form className="auth-form" autoComplete="off" onSubmit={handleLogin}>
							<div className="auth-header">
								<h2>Sign In</h2>
								<p>Welcome back, {accountType}</p>
							</div>

							{/* Email Input */}
							<div className="form-field">
								<label htmlFor="email-input">Email Address</label>
								<div className="input-wrapper">
									<Input
										id="email-input"
										type="email"
										value={email}
										onChange={handleEmailChange}
													placeholder={accountType === 'admin' ? 'admin@example.com' : 'name@example.com'}
										required
										autoComplete="username"
										className={emailError ? 'has-error' : ''}
									/>
								</div>
								{emailError && <span className="field-error">{emailError}</span>}
							</div>

							{/* Password Input */}
							<div className="form-field">
								<label htmlFor="password-input">Password</label>
								<div className="password-input-wrapper">
									<Input
										id="password-input"
										type={showPassword ? 'text' : 'password'}
										value={password}
										onChange={(e) => setPassword(e.target.value)}
										placeholder="••••••••"
										required
										autoComplete="current-password"
									/>
									<button
										type="button"
										className="password-toggle-btn"
										onClick={() => setShowPassword(!showPassword)}
										aria-label={showPassword ? 'Hide password' : 'Show password'}
									>
										{showPassword ? '👁️' : '👁️‍🗨️'}
									</button>
								</div>
							</div>

							{/* Forgot Password Link */}
							<div className="auth-links">
								<button 
									type="button" 
									className="link-btn forgot-btn"
									onClick={handleForgotPassword}
								>
									Forgot password?
								</button>
							</div>

							{/* Error Message */}
							{error && <div className="error-banner">{error}</div>}

							{/* Login Button */}
							<Button 
								type="submit" 
								disabled={submitting || !!emailError || !email || !password}
								className="btn-primary btn-block"
							>
								{submitting ? 'Signing in...' : 'Sign In'}
							</Button>

							{/* Sign Up Prompt */}
							<div className="signup-section">
								<p>Don't have an account? 
									<button 
										type="button" 
										onClick={onSignUpClick} 
										className="link-btn signup-btn"
									>
										Create one here
									</button>
								</p>
							</div>
						</form>
					)}
				</div>
			</div>
		</div>
	);
}
