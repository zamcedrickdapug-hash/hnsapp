import { useState } from 'react';
import { apiFetch } from '../../api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import './login.scss';

export default function LoginPage({ onLoggedIn }) {
	const [accountType, setAccountType] = useState('parent');
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [showPassword, setShowPassword] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState('');
	const [statusMessage, setStatusMessage] = useState('');

	const handleSubmit = async (event) => {
		event.preventDefault();

		setSubmitting(true);
		setError('');
		setStatusMessage('');

		try {
			const response = await apiFetch('/api/auth/login', {
				method: 'POST',
				body: JSON.stringify({
					email,
					password,
					accountType,
				}),
			});

			onLoggedIn(response);
		} catch (requestError) {
			const backendStatus = requestError?.data?.accountStatus;

			if (backendStatus) {
				const readableStatus = backendStatus.charAt(0).toUpperCase() + backendStatus.slice(1);
				setStatusMessage(`Your account is currently ${readableStatus}. Access will be granted after approval.`);
			}

			setError(requestError.message || 'Unable to login right now.');
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<section className="login-page">
			<h2>Login</h2>
		

			<form className="auth-form" onSubmit={handleSubmit}>
				<label>
					Account Type
					<Select value={accountType} onChange={(event) => setAccountType(event.target.value)}>
						<option value="parent">Parent</option>
						<option value="driver">Driver</option>
						<option value="admin">Admin</option>
					</Select>
				</label>

				<label>
					Email Address
					<Input
						type="email"
						value={email}
						onChange={(event) => setEmail(event.target.value)}
						placeholder="name@example.com"
						required
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
						/>
						<button
							type="button"
							className="password-toggle"
							onClick={() => setShowPassword(!showPassword)}
							aria-label={showPassword ? 'Hide password' : 'Show password'}
						>
							{showPassword ? '👁️' : '👁️‍🗨️'}
						</button>
					</div>
				</label>

				<Button type="submit" disabled={submitting}>
					{submitting ? 'Signing In...' : 'Sign In'}
				</Button>
			</form>

			{error ? <p className="feedback error">{error}</p> : null}
			{statusMessage ? <p className="feedback info">{statusMessage}</p> : null}
		</section>
	);
}
