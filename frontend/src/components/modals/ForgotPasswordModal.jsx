import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Mail, Loader, CheckCircle, AlertCircle } from 'lucide-react'
import { apiFetch } from '../../api'
import './ForgotPasswordModal.css'

export function ForgotPasswordModal({ isOpen, onClose }) {
	const [email, setEmail] = useState('')
	const [emailError, setEmailError] = useState('')
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [submitError, setSubmitError] = useState('')
	const [submitSuccess, setSubmitSuccess] = useState(false)

	// Email validation
	const isValidEmail = (emailValue) => {
		const trimmed = (emailValue || '').trim().toLowerCase()
		return /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/.test(trimmed)
	}

	const handleEmailChange = (e) => {
		const value = e.target.value
		setEmail(value)

		// Real-time validation
		if (value.trim()) {
			if (!isValidEmail(value)) {
				setEmailError('Please enter a valid email address')
			} else {
				setEmailError('')
			}
		} else {
			setEmailError('')
		}
	}

	const handleSubmit = async (e) => {
		e.preventDefault()
		setSubmitError('')

		// Validate
		if (!email.trim()) {
			setEmailError('Email address is required')
			return
		}

		if (!isValidEmail(email)) {
			setEmailError('Please enter a valid email address')
			return
		}

		setIsSubmitting(true)

		try {
			const response = await apiFetch('/api/auth/forgot-password', {
				method: 'POST',
				body: JSON.stringify({
					email: email.trim().toLowerCase(),
				}),
			})

			setSubmitSuccess(true)
			setEmail('')
			setEmailError('')

			// Auto-close after 4 seconds
			setTimeout(() => {
				onClose()
				setSubmitSuccess(false)
			}, 4000)
		} catch (error) {
			setSubmitError(
				error.message || 'Failed to send reset email. Please try again.'
			)
		} finally {
			setIsSubmitting(false)
		}
	}

	const handleClose = () => {
		if (!isSubmitting) {
			setEmail('')
			setEmailError('')
			setSubmitError('')
			setSubmitSuccess(false)
			onClose()
		}
	}

	return (
		<AnimatePresence>
			{isOpen && (
				<>
					{/* Backdrop */}
					<motion.div
						className="forgot-password-modal__backdrop"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={handleClose}
						aria-hidden="true"
					/>

					{/* Modal */}
					<motion.div
						className="forgot-password-modal"
						initial={{ opacity: 0, scale: 0.95, y: 20 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.95, y: 20 }}
						transition={{ duration: 0.2 }}
						role="dialog"
						aria-modal="true"
						aria-labelledby="forgot-password-title"
					>
						{/* Header */}
						<div className="forgot-password-modal__header">
							<h2 id="forgot-password-title" className="forgot-password-modal__title">
								Reset Your Password
							</h2>
							<button
								className="forgot-password-modal__close"
								onClick={handleClose}
								disabled={isSubmitting}
								aria-label="Close dialog"
								type="button"
							>
								<X size={20} />
							</button>
						</div>

						{/* Content */}
						{submitSuccess ? (
							<motion.div
								className="forgot-password-modal__success"
								initial={{ opacity: 0, scale: 0.9 }}
								animate={{ opacity: 1, scale: 1 }}
								exit={{ opacity: 0, scale: 0.9 }}
							>
								<CheckCircle size={48} className="forgot-password-modal__success-icon" />
								<h3 className="forgot-password-modal__success-title">Email Sent!</h3>
								<p className="forgot-password-modal__success-message">
									We've sent a password reset link to <strong>{email}</strong>. Please check
									your inbox and click the link to reset your password.
								</p>
								<p className="forgot-password-modal__success-hint">
									The link will expire in 30 minutes.
								</p>
							</motion.div>
						) : (
							<form onSubmit={handleSubmit} className="forgot-password-modal__form">
								<p className="forgot-password-modal__description">
									Enter your email address and we'll send you a link to reset your password.
								</p>

								{/* Email Input */}
								<div className="forgot-password-modal__field">
									<label htmlFor="forgot-email" className="forgot-password-modal__label">
										Email Address
									</label>
									<div className="forgot-password-modal__input-wrapper">
										<Mail size={18} className="forgot-password-modal__input-icon" />
										<input
											id="forgot-email"
											type="email"
											value={email}
											onChange={handleEmailChange}
											placeholder="Enter your email"
											className={`forgot-password-modal__input ${emailError ? 'forgot-password-modal__input--error' : ''}`}
											disabled={isSubmitting}
											autoComplete="email"
											required
										/>
									</div>
									{emailError && (
										<motion.div
											className="forgot-password-modal__error-message"
											initial={{ opacity: 0, y: -5 }}
											animate={{ opacity: 1, y: 0 }}
											exit={{ opacity: 0, y: -5 }}
										>
											<AlertCircle size={14} />
											{emailError}
										</motion.div>
									)}
								</div>

								{/* Error Message */}
								{submitError && (
									<motion.div
										className="forgot-password-modal__error-box"
										initial={{ opacity: 0, y: -5 }}
										animate={{ opacity: 1, y: 0 }}
										exit={{ opacity: 0, y: -5 }}
									>
										<AlertCircle size={18} />
										<span>{submitError}</span>
									</motion.div>
								)}

								{/* Submit Button */}
								<button
									type="submit"
									className="forgot-password-modal__submit-button"
									disabled={isSubmitting || !!emailError || !email.trim()}
								>
									{isSubmitting ? (
										<>
											<Loader size={18} className="forgot-password-modal__spinner" />
											Sending...
										</>
									) : (
										<>
											<Mail size={18} />
											Send Reset Link
										</>
									)}
								</button>

								{/* Divider */}
								<div className="forgot-password-modal__divider">
									<span>or</span>
								</div>

								{/* Back to Login */}
								<button
									type="button"
									className="forgot-password-modal__back-button"
									onClick={handleClose}
									disabled={isSubmitting}
								>
									Back to Login
								</button>
							</form>
						)}
					</motion.div>
				</>
			)}
		</AnimatePresence>
	)
}
