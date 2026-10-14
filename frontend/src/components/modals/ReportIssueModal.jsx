import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Upload, AlertCircle, Send } from 'lucide-react'
import './ReportIssueModal.css'

const ISSUE_CATEGORIES = [
	{ value: 'driver-behavior', label: 'Driver Behavior' },
	{ value: 'vehicle-issue', label: 'Vehicle Issue' },
	{ value: 'route-issue', label: 'Route Issue' },
	{ value: 'safety-concern', label: 'Safety Concern' },
	{ value: 'payment-issue', label: 'Payment Issue' },
	{ value: 'lost-item', label: 'Lost Item' },
	{ value: 'other', label: 'Other' },
]

export function ReportIssueModal({ isOpen, onClose, trip, onSubmit }) {
	const [formData, setFormData] = useState({
		category: 'other',
		description: '',
		screenshot: null,
		screenshotPreview: null,
	})
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [submitError, setSubmitError] = useState('')
	const [submitSuccess, setSubmitSuccess] = useState(false)
	const fileInputRef = useRef(null)
	const submitInProgressRef = useRef(false)

	const handleCategoryChange = (e) => {
		setFormData((prev) => ({
			...prev,
			category: e.target.value,
		}))
	}

	const handleDescriptionChange = (e) => {
		setFormData((prev) => ({
			...prev,
			description: e.target.value,
		}))
	}

	const handleFileSelect = (e) => {
		const file = e.target.files?.[0]
		if (!file) return

		// Validate file size (max 5MB)
		if (file.size > 5 * 1024 * 1024) {
			setSubmitError('File size must be less than 5MB')
			return
		}

		// Validate file type
		if (!file.type.startsWith('image/')) {
			setSubmitError('Please select an image file')
			return
		}

		setSubmitError('')
		const reader = new FileReader()
		reader.onload = (event) => {
			setFormData((prev) => ({
				...prev,
				screenshot: file,
				screenshotPreview: event.target?.result,
			}))
		}
		reader.readAsDataURL(file)
	}

	const handleRemoveScreenshot = () => {
		setFormData((prev) => ({
			...prev,
			screenshot: null,
			screenshotPreview: null,
		}))
		if (fileInputRef.current) {
			fileInputRef.current.value = ''
		}
	}

	const handleSubmit = async (e) => {
		e.preventDefault()

		if (submitInProgressRef.current) return

		if (!formData.description.trim()) {
			setSubmitError('Please describe the issue')
			return
		}

		submitInProgressRef.current = true
		setIsSubmitting(true)
		setSubmitError('')

		try {
			const reportData = {
				tripId: trip?.id,
				category: formData.category,
				description: formData.description,
				timestamp: new Date().toISOString(),
				screenshot: formData.screenshotPreview || null,
			}

			// Call parent's onSubmit with the report data
			if (onSubmit) {
				await onSubmit(reportData)
			}

			setSubmitSuccess(true)
			setTimeout(() => {
				setFormData({
					category: 'other',
					description: '',
					screenshot: null,
					screenshotPreview: null,
				})
				setSubmitSuccess(false)
				onClose()
			}, 2000)
		} catch (error) {
			setSubmitError(error.message || 'Failed to submit report. Please try again.')
			submitInProgressRef.current = false
			setIsSubmitting(false)
		}
	}

	return (
		<AnimatePresence>
			{isOpen && (
				<motion.div
					className="report-issue-overlay"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					onClick={onClose}
				>
					<motion.div
						className="report-issue-modal"
						initial={{ scale: 0.95, opacity: 0, y: 20 }}
						animate={{ scale: 1, opacity: 1, y: 0 }}
						exit={{ scale: 0.95, opacity: 0, y: 20 }}
						transition={{ type: 'spring', stiffness: 300, damping: 30 }}
						onClick={(e) => e.stopPropagation()}
					>
						{/* Header */}
						<div className="report-header">
							<motion.div
								initial={{ opacity: 0, x: -10 }}
								animate={{ opacity: 1, x: 0 }}
							>
								<h2>Report an Issue</h2>
								<p>Help us improve our service by reporting any issues</p>
							</motion.div>
							<motion.button
								className="close-btn"
								onClick={onClose}
								disabled={isSubmitting}
								whileHover={{ scale: 1.1, rotate: 90 }}
								whileTap={{ scale: 0.9 }}
							>
								<X size={20} />
							</motion.button>
						</div>

						{/* Content */}
						<form className="report-content" onSubmit={handleSubmit}>
							{/* Success Message */}
							<AnimatePresence>
								{submitSuccess && (
									<motion.div
										className="success-message"
										initial={{ opacity: 0, y: -10 }}
										animate={{ opacity: 1, y: 0 }}
										exit={{ opacity: 0, y: -10 }}
									>
										<div className="success-icon">✓</div>
										<p>Report submitted successfully!</p>
										<p className="success-subtitle">Thank you for helping us improve.</p>
									</motion.div>
								)}
							</AnimatePresence>

							{/* Error Message */}
							<AnimatePresence>
								{submitError && (
									<motion.div
										className="error-message"
										initial={{ opacity: 0, y: -10 }}
										animate={{ opacity: 1, y: 0 }}
										exit={{ opacity: 0, y: -10 }}
									>
										<AlertCircle size={16} />
										<span>{submitError}</span>
									</motion.div>
								)}
							</AnimatePresence>

							{/* Category Selection */}
							<motion.div
								className="form-group"
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.1 }}
							>
								<label htmlFor="category">Issue Category *</label>
								<select
									id="category"
									value={formData.category}
									onChange={handleCategoryChange}
									disabled={isSubmitting}
									className="form-select"
								>
									{ISSUE_CATEGORIES.map((cat) => (
										<option key={cat.value} value={cat.value}>
											{cat.label}
										</option>
									))}
								</select>
							</motion.div>

							{/* Description */}
							<motion.div
								className="form-group"
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.15 }}
							>
								<label htmlFor="description">
									Description *
									<span className="char-count">
										{formData.description.length}/500
									</span>
								</label>
								<textarea
									id="description"
									value={formData.description}
									onChange={handleDescriptionChange}
									placeholder="Please describe the issue in detail..."
									maxLength={500}
									disabled={isSubmitting}
									className="form-textarea"
									rows={5}
								/>
							</motion.div>

							{/* Screenshot Upload */}
							<motion.div
								className="form-group"
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.2 }}
							>
								<label>Screenshot (Optional)</label>

								{formData.screenshotPreview ? (
									<motion.div
										className="screenshot-preview"
										initial={{ opacity: 0, scale: 0.9 }}
										animate={{ opacity: 1, scale: 1 }}
									>
										<img src={formData.screenshotPreview} alt="Screenshot" />
										<motion.button
											type="button"
											className="remove-btn"
											onClick={handleRemoveScreenshot}
											whileHover={{ scale: 1.1 }}
											whileTap={{ scale: 0.9 }}
										>
											<X size={16} />
										</motion.button>
									</motion.div>
								) : (
									<motion.div
										className="upload-area"
										whileHover={{ background: 'rgba(0, 212, 255, 0.15)' }}
										onClick={() => fileInputRef.current?.click()}
										role="button"
										tabIndex={0}
										onKeyDown={(e) => {
											if (e.key === 'Enter' || e.key === ' ') {
												fileInputRef.current?.click()
											}
										}}
									>
										<Upload size={32} />
										<p>Click to upload or drag and drop</p>
										<span>PNG, JPG, GIF up to 5MB</span>
									</motion.div>
								)}

								<input
									ref={fileInputRef}
									type="file"
									accept="image/*"
									onChange={handleFileSelect}
									disabled={isSubmitting}
									className="hidden-input"
								/>
							</motion.div>

							{/* Trip Reference */}
							{trip && (
								<motion.div
									className="trip-reference"
									initial={{ opacity: 0, y: 10 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: 0.25 }}
								>
									<p className="reference-label">This report is for:</p>
									<p className="reference-value">Trip on {trip.date}</p>
								</motion.div>
							)}
						</form>

						{/* Actions */}
						<motion.div
							className="report-actions"
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.3 }}
						>
							<motion.button
								type="button"
								className="action-btn secondary"
								onClick={onClose}
								disabled={isSubmitting}
								whileHover={{ scale: 1.02 }}
								whileTap={{ scale: 0.98 }}
							>
								Cancel
							</motion.button>
							<motion.button
								type="submit"
								className="action-btn primary"
								disabled={isSubmitting || !formData.description.trim()}
								onClick={handleSubmit}
								whileHover={{ scale: 1.02 }}
								whileTap={{ scale: 0.98 }}
							>
								{isSubmitting ? (
									<>
										<motion.span
											animate={{ rotate: 360 }}
											transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
										>
											⏳
										</motion.span>
										<span>Submitting...</span>
									</>
								) : (
									<>
										<Send size={16} />
										<span>Submit Report</span>
									</>
								)}
							</motion.button>
						</motion.div>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	)
}
