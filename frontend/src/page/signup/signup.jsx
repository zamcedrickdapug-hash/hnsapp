import { useState } from 'react';
import { apiFetch } from '../../api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import './signup.scss';

const SIGNUP_STEPS = {
	CONTACT: 'contact',
	VERIFY: 'verify',
	COMPLETE: 'complete',
};

export default function SignupPage({ onLoggedIn }) {
	const [step, setStep] = useState(SIGNUP_STEPS.CONTACT);
	const [accountType, setAccountType] = useState('parent');
	const [contactMethod, setContactMethod] = useState('email'); // 'email' or 'phone'
	const [contact, setContact] = useState('');
	const [code, setCode] = useState('');
	const [fullName, setFullName] = useState('');
	const [submitting, setSubmitting] = useState(false);
	const [errors, setErrors] = useState([]);
	const [successMessage, setSuccessMessage] = useState('');

	const handleSendCode = async (event) => {
		event.preventDefault();
		setSubmitting(true);
		setErrors([]);

		try {
			const response = await apiFetch('/api/auth/send-code', {
				method: 'POST',
				body: JSON.stringify({
					contact: contact.trim(),
					accountType,
				}),
			});

			setSuccessMessage(response.message || 'Verification code sent!');
			setStep(SIGNUP_STEPS.VERIFY);
		} catch (requestError) {
			setErrors([requestError.message || 'Failed to send verification code.']);
		} finally {
			setSubmitting(false);
		}
	};

	const handleVerifyCode = async (event) => {
		event.preventDefault();
		setSubmitting(true);
		setErrors([]);

		if (!fullName.trim()) {
			setErrors(['Please enter your full name.']);
			setSubmitting(false);
			return;
		}

		try {
			const response = await apiFetch('/api/auth/verify-code', {
				method: 'POST',
				body: JSON.stringify({
					contact: contact.trim(),
					code: code.trim(),
					fullName: fullName.trim(),
					accountType,
				}),
			});

			setSuccessMessage('Account created successfully!');
			onLoggedIn(response);
		} catch (requestError) {
			setErrors([requestError.message || 'Failed to verify code.']);
		} finally {
			setSubmitting(false);
		}
	};

	const handleBackToContact = () => {
		setStep(SIGNUP_STEPS.CONTACT);
		setCode('');
		setFullName('');
		setErrors([]);
		setSuccessMessage('');
	};

	return (
		<section className="signup-page">
			<h2>Create Account</h2>

			{step === SIGNUP_STEPS.CONTACT && (
				<form className="auth-form" onSubmit={handleSendCode}>
					<label>
						Account Type
						<Select value={accountType} onChange={(event) => setAccountType(event.target.value)}>
							<option value="parent">Parent</option>
							<option value="driver">Driver</option>
						</Select>
					</label>

					<label>
						Sign up with
						<div className="contact-method-selector">
							<button
								type="button"
								className={`method-btn ${contactMethod === 'email' ? 'active' : ''}`}
								onClick={() => setContactMethod('email')}
							>
								Email
							</button>
							<button
								type="button"
								className={`method-btn ${contactMethod === 'phone' ? 'active' : ''}`}
								onClick={() => setContactMethod('phone')}
							>
								Phone
							</button>
						</div>
					</label>

					<label>
						{contactMethod === 'email' ? 'Email Address' : 'Phone Number'}
						<Input
							type={contactMethod === 'email' ? 'email' : 'tel'}
							value={contact}
							onChange={(event) => setContact(event.target.value)}
							placeholder={
								contactMethod === 'email'
									? 'name@example.com'
									: '+1 (555) 123-4567'
							}
							required
						/>
					</label>

					<Button type="submit" disabled={submitting}>
						{submitting ? 'Sending Code...' : 'Send Verification Code'}
					</Button>
				</form>
			)}

			{step === SIGNUP_STEPS.VERIFY && (
				<form className="auth-form" onSubmit={handleVerifyCode}>
					<p className="info-text">
						We sent a verification code to{' '}
						<strong>
							{contactMethod === 'email'
								? contact
								: `your phone (${contact})`}
						</strong>
					</p>

					<label>
						Full Name
						<Input
							type="text"
							value={fullName}
							onChange={(event) => setFullName(event.target.value)}
							placeholder="Enter your full name"
							required
						/>
					</label>

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
						{submitting ? 'Verifying...' : 'Verify & Create Account'}
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

			{errors.length > 0 && (
				<ul className="errors">
					{errors.map((error, index) => (
						<li key={index}>{error}</li>
					))}
				</ul>
			)}

			{successMessage && (
				<p className="success">{successMessage}</p>
			)}
		</section>
	);
}
