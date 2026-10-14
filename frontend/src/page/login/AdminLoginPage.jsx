import { useState } from 'react';
import { apiFetch } from '../../api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import './admin-login.scss';

export default function AdminLoginPage({ onLoggedIn, onBackToMain }) {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [showPassword, setShowPassword] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState('');

	const handleLogin = async (event) => {
		event.preventDefault();
		setError('');

		// Validate
		if (!email.trim() || !password) {
			setError('Please enter your email address and password.');
			return;
		}

		setSubmitting(true);

		try {
			const response = await apiFetch('/api/auth/admin-login', {
				method: 'POST',
				body: JSON.stringify({
					email: email.trim().toLowerCase(),
					password: password,
				}),
			});

			onLoggedIn(response);
		} catch (requestError) {
			setError(requestError.message || 'Invalid email address or password.');
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<section className="admin-login-page">
			<div className="admin-login-container">
				<div className="admin-login-header">
					<div className="header-icon">🔐</div>
					<h2>Admin Access</h2>
					<p>Enter your admin credentials to continue</p>
				</div>

				<form className="admin-auth-form" autoComplete="off" onSubmit={handleLogin}>
					<label>
						Email Address
						<Input
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder="admin@example.com"
							required
							disabled={submitting}
							autoComplete="off"
						/>
					</label>

					<label>
						Password
						<div className="password-input-wrapper">
							<Input
								type={showPassword ? 'text' : 'password'}
								value={password}
								onChange={(event) => setPassword(event.target.value)}
								placeholder="Enter your password"
								required
								disabled={submitting}
								autoComplete="new-password"
							/>
							<button
								type="button"
								className="password-toggle"
								onClick={() => setShowPassword(!showPassword)}
								disabled={submitting}
								title={showPassword ? 'Hide password' : 'Show password'}
							>
								{showPassword ? '🙈' : '👁️'}
							</button>
						</div>
					</label>

					<Button type="submit" disabled={submitting || !email || !password}>
						{submitting ? 'Logging in...' : 'Sign In'}
					</Button>
				</form>

				{error && <p className="feedback error">{error}</p>}

				<div className="form-footer">
					<button type="button" className="back-link" onClick={onBackToMain} disabled={submitting}>
						← Back to Login
					</button>
				</div>
			</div>
		</section>
	);
}
