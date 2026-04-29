import { useState } from 'react';
import { apiFetch } from '../../api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import './login.scss';

const LOGIN_STEPS = {
	CONTACT: 'contact',
	VERIFY: 'verify',
};

export default function LoginPage({ onLoggedIn }) {
	const [step, setStep] = useState(LOGIN_STEPS.CONTACT);
	const [accountType, setAccountType] = useState('parent');
	const [contact, setContact] = useState('');
	const [code, setCode] = useState('');
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState('');
	const [statusMessage, setStatusMessage] = useState('');

	const handleSendCode = async (event) => {
		event.preventDefault();
		setSubmitting(true);
		setError('');
		setStatusMessage('');

		try {
			const response = await apiFetch('/api/auth/send-code', {
				method: 'POST',
				body: JSON.stringify({
					contact: contact.trim(),
					accountType,
				}),
			});

			setStatusMessage(response.message || 'Code sent! Check your email or SMS.');
			setStep(LOGIN_STEPS.VERIFY);
		} catch (requestError) {
			const backendStatus = requestError?.data?.accountStatus;

			if (backendStatus) {
				const readableStatus = backendStatus.charAt(0).toUpperCase() + backendStatus.slice(1);
				setStatusMessage(`Your account is currently ${readableStatus}. Access will be granted after approval.`);
			}

			setError(requestError.message || 'Unable to send code right now.');
		} finally {
			setSubmitting(false);
		}
	};

	const handleVerifyCode = async (event) => {
		event.preventDefault();
		setSubmitting(true);
		setError('');
		setStatusMessage('');

		try {
			const response = await apiFetch('/api/auth/verify-code', {
				method: 'POST',
				body: JSON.stringify({
					contact: contact.trim(),
					code: code.trim(),
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

			setError(requestError.message || 'Invalid code or unable to login right now.');
		} finally {
			setSubmitting(false);
		}
	};

	const handleBackToContact = () => {
		setStep(LOGIN_STEPS.CONTACT);
		setCode('');
		setError('');
		setStatusMessage('');
	};

	return (
		<section className="login-page">
			<h2>Login</h2>

			{step === LOGIN_STEPS.CONTACT && (
				<form className="auth-form" onSubmit={handleSendCode}>
					<label>
						Account Type
						<Select value={accountType} onChange={(event) => setAccountType(event.target.value)}>
							<option value="parent">Parent</option>
							<option value="driver">Driver</option>
							<option value="admin">Admin</option>
						</Select>
					</label>

					<label>
						Email or Phone Number
						<Input
							type="text"
							value={contact}
							onChange={(event) => setContact(event.target.value)}
							placeholder="name@example.com or +1 (555) 123-4567"
							required
						/>
					</label>

					<Button type="submit" disabled={submitting}>
						{submitting ? 'Sending Code...' : 'Send Code'}
					</Button>
				</form>
			)}

			{step === LOGIN_STEPS.VERIFY && (
				<form className="auth-form" onSubmit={handleVerifyCode}>
					<p className="info-text">
						We sent a code to <strong>{contact}</strong>. Please check your email or SMS.
					</p>

					<label>
						Verification Code
						<Input
							type="text"
							value={code}
							onChange={(event) => setCode(event.target.value)}
							placeholder="Enter 6-digit code"
							maxLength="6"
							required
						/>
					</label>

					<Button type="submit" disabled={submitting}>
						{submitting ? 'Verifying...' : 'Sign In'}
					</Button>

					<button
						type="button"
						className="back-button"
						onClick={handleBackToContact}
						disabled={submitting}
					>
						← Back
					</button>
				</form>
			)}

			{error ? <p className="feedback error">{error}</p> : null}
			{statusMessage ? <p className="feedback info">{statusMessage}</p> : null}
		</section>
	);
}
