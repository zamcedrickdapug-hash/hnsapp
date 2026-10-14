import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
	Eye,
	EyeOff,
	Lock,
	CheckCircle,
	AlertCircle,
	Loader,
	ArrowLeft,
} from 'lucide-react'
import { apiFetch } from '../../api'
import './ResetPasswordPage.scss'

export default function ResetPasswordPage() {
	const navigate = useNavigate()
	const { token } = useParams()

	const [isValidating, setIsValidating] = useState(true)
	const [tokenValid, setTokenValid] = useState(false)
	const [userEmail, setUserEmail] = useState('')
	const [validationError, setValidationError] = useState('')

	// Form states
	const [password, setPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [showPassword, setShowPassword] = useState(false)
	const [showConfirmPassword, setShowConfirmPassword] = useState(false)
	const [passwordStrength, setPasswordStrength] = useState(0)

	// Submit states
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [submitError, setSubmitError] = useState('')
	const [submitSuccess, setSubmitSuccess] = useState(false)

	// Validation errors
	const [passwordError, setPasswordError] = useState('')
	const [confirmPasswordError, setConfirmPasswordError] = useState('')

	// Validate reset token on mount
	useEffect(() => {
		const validateToken = async () => {
			if (!token) {
				setValidationError('No reset token provided. Please use the link from your email.')
				setIsValidating(false)
				return
			}

			try {
				const response = await apiFetch(`/api/auth/validate-reset-token/${token}`)

				if (response.valid) {
					setTokenValid(true)
					setUserEmail(response.email)
					setValidationError('')
				} else {
					setValidationError(
						response.message || 'Password reset link is invalid or has expired.'
					)
				}
			} catch (error) {
				setValidationError(
					error.message || 'Failed to validate reset link. Please try again.'
				)
			} finally {
				setIsValidating(false)
			}
		}

		validateToken()
	}, [token])

	// Calculate password strength
	const calculatePasswordStrength = (pwd) => {
		if (!pwd) return 0
		let strength = 0
		if (pwd.length >= 6) strength++
		if (pwd.length >= 8) strength++
		if (pwd.length >= 12) strength++
		if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) strength++
		if (/[0-9]/.test(pwd)) strength++
		if (/[^a-zA-Z0-9]/.test(pwd)) strength++
		return Math.min(strength, 4)
	}

	const handlePasswordChange = (e) => {
		const value = e.target.value
		setPassword(value)

		// Real-time validation
		const strength = calculatePasswordStrength(value)
		setPasswordStrength(strength)

		if (value.trim()) {
			if (value.length < 6) {
				setPasswordError('Password must be at least 6 characters long')
			} else {
				setPasswordError('')
			}
		} else {
			setPasswordError('')
		}

		// Check match with confirm password
		if (confirmPassword && value !== confirmPassword) {
			setConfirmPasswordError('Passwords do not match')
		} else if (confirmPassword && value === confirmPassword) {
			setConfirmPasswordError('')
		}
	}

	const handleConfirmPasswordChange = (e) => {
		const value = e.target.value
		setConfirmPassword(value)

		if (value.trim()) {
			if (value !== password) {
				setConfirmPasswordError('Passwords do not match')
			} else {
				setConfirmPasswordError('')
			}
		} else {
			setConfirmPasswordError('')
		}
	}

	const getPasswordStrengthLabel = () => {
		const labels = ['Weak', 'Fair', 'Good', 'Strong']
		return labels[passwordStrength - 1] || 'Very Weak'
	}

	const getPasswordStrengthColor = () => {
		const colors = ['#ef4444', '#f97316', '#eab308', '#10b981']
		return colors[passwordStrength - 1] || '#64748b'
	}

	const handleSubmit = async (e) => {
		e.preventDefault()
		setSubmitError('')

		// Validate
		if (!password.trim() || !confirmPassword.trim()) {
			setSubmitError('Please fill in all fields')
			return
		}

		if (password.length < 6) {
			setPasswordError('Password must be at least 6 characters long')
			return
		}

		if (password !== confirmPassword) {
			setConfirmPasswordError('Passwords do not match')
			return
		}

		setIsSubmitting(true)

		try {
			const response = await apiFetch(`/api/auth/reset-password/${token}`, {
				method: 'POST',
				body: JSON.stringify({
					password: password.trim(),
					confirmPassword: confirmPassword.trim(),
				}),
			})

			setSubmitSuccess(true)
			setPassword('')
			setConfirmPassword('')

			// Redirect to login after 3 seconds
			setTimeout(() => {
				navigate('/login')
			}, 3000)
		} catch (error) {
			setSubmitError(error.message || 'Failed to reset password. Please try again.')
		} finally {
			setIsSubmitting(false)
		}
	}

	if (isValidating) {
		return (
			<section className="reset-password-page">
				<div className="reset-password-page__container">
					<div className="reset-password-page__loading">
						<Loader size={48} className="reset-password-page__loading-icon" />
						<p>Validating reset link...</p>
					</div>
				</div>
			</section>
		)
	}

	if (!tokenValid) {
		return (
			<section className="reset-password-page">
				<div className="reset-password-page__container">
					<div className="reset-password-page__error-state">
						<AlertCircle size={48} className="reset-password-page__error-icon" />
						<h2>Reset Link Invalid or Expired</h2>
						<p>{validationError}</p>
						<button
							onClick={() => navigate('/login')}
							className="reset-password-page__error-button"
						>
							Back to Login
						</button>
						<button
							onClick={() => navigate('/login', { state: { openForgotPassword: true } })}
							className="reset-password-page__error-secondary-button"
						>
							Request New Reset Link
						</button>
					</div>
				</div>
			</section>
		)
	}

	if (submitSuccess) {
		return (
			<section className="reset-password-page">
				<div className="reset-password-page__container">
					<div className="reset-password-page__success-state">
						<CheckCircle size={48} className="reset-password-page__success-icon" />
						<h2>Password Reset Successfully!</h2>
						<p>Your password has been updated. You will be redirected to the login page.</p>
						<button
							onClick={() => navigate('/login')}
							className="reset-password-page__success-button"
						>
							Go to Login
						</button>
					</div>
				</div>
			</section>
		)
	}

	return (
		<section className="reset-password-page">
			<div className="reset-password-page__container">
				<button
					onClick={() => navigate('/login')}
					className="reset-password-page__back-button"
				>
					<ArrowLeft size={18} />
					Back to Login
				</button>

				<div className="reset-password-page__card">
					<div className="reset-password-page__header">
						<div className="reset-password-page__icon-wrapper">
							<Lock size={32} />
						</div>
						<h1>Create New Password</h1>
						<p>Please enter a new password for your account</p>
					</div>

					<form onSubmit={handleSubmit} className="reset-password-page__form">
						{submitError && (
							<div className="reset-password-page__alert reset-password-page__alert--error">
								<AlertCircle size={18} />
								<span>{submitError}</span>
							</div>
						)}

						{/* Password Field */}
						<div className="reset-password-page__field">
							<label htmlFor="password" className="reset-password-page__label">
								New Password
							</label>
							<div className="reset-password-page__input-wrapper">
								<input
									id="password"
									type={showPassword ? 'text' : 'password'}
									value={password}
									onChange={handlePasswordChange}
									placeholder="Enter new password"
									className={`reset-password-page__input ${passwordError ? 'reset-password-page__input--error' : ''}`}
									disabled={isSubmitting}
									autoFocus
									required
								/>
								<button
									type="button"
									onClick={() => setShowPassword(!showPassword)}
									className="reset-password-page__visibility-toggle"
									disabled={isSubmitting}
									aria-label={showPassword ? 'Hide password' : 'Show password'}
								>
									{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
								</button>
							</div>

							{password && (
								<div className="reset-password-page__strength-meter">
									<div className="reset-password-page__strength-bar">
										{[...Array(4)].map((_, i) => (
											<div
												key={i}
												className={`reset-password-page__strength-segment ${
													i < passwordStrength
														? 'reset-password-page__strength-segment--active'
														: ''
												}`}
												style={
													i < passwordStrength
														? {
																backgroundColor: getPasswordStrengthColor(),
														  }
														: {}
												}
											/>
										))}
									</div>
									<span
										className="reset-password-page__strength-label"
										style={{ color: getPasswordStrengthColor() }}
									>
										{getPasswordStrengthLabel()}
									</span>
								</div>
							)}

							{passwordError && (
								<p className="reset-password-page__field-error">
									<AlertCircle size={14} />
									{passwordError}
								</p>
							)}
						</div>

						{/* Confirm Password Field */}
						<div className="reset-password-page__field">
							<label htmlFor="confirmPassword" className="reset-password-page__label">
								Confirm Password
							</label>
							<div className="reset-password-page__input-wrapper">
								<input
									id="confirmPassword"
									type={showConfirmPassword ? 'text' : 'password'}
									value={confirmPassword}
									onChange={handleConfirmPasswordChange}
									placeholder="Confirm new password"
									className={`reset-password-page__input ${confirmPasswordError ? 'reset-password-page__input--error' : ''}`}
									disabled={isSubmitting}
									required
								/>
								<button
									type="button"
									onClick={() => setShowConfirmPassword(!showConfirmPassword)}
									className="reset-password-page__visibility-toggle"
									disabled={isSubmitting}
									aria-label={
										showConfirmPassword ? 'Hide password' : 'Show password'
									}
								>
									{showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
								</button>
							</div>

							{confirmPasswordError && (
								<p className="reset-password-page__field-error">
									<AlertCircle size={14} />
									{confirmPasswordError}
								</p>
							)}
						</div>

						{/* Submit Button */}
						<button
							type="submit"
							className="reset-password-page__submit-button"
							disabled={
								isSubmitting ||
								!password ||
								!confirmPassword ||
								!!passwordError ||
								!!confirmPasswordError
							}
						>
							{isSubmitting ? (
								<>
									<Loader size={18} className="reset-password-page__spinner" />
									Resetting Password...
								</>
							) : (
								<>
									<Lock size={18} />
									Reset Password
								</>
							)}
						</button>
					</form>

					<p className="reset-password-page__hint">
						Remember your password?{' '}
						<button
							onClick={() => navigate('/login')}
							className="reset-password-page__hint-link"
						>
							Go to Login
						</button>
					</p>
				</div>
			</div>
		</section>
	)
}
