import { motion, AnimatePresence } from 'framer-motion'
import { X, Download, Printer, MapPin, Clock, DollarSign, User, Navigation } from 'lucide-react'
import './ReceiptModal.css'

export function ReceiptModal({ isOpen, onClose, trip, driver }) {
	if (!trip) return null

	const handlePrint = () => {
		window.print()
	}

	const handleDownload = () => {
		// This would integrate with a PDF generation library like jsPDF
		const content = generateReceiptText()
		const blob = new Blob([content], { type: 'text/plain' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = `receipt-${trip.id || 'trip'}.txt`
		document.body.appendChild(a)
		a.click()
		document.body.removeChild(a)
		URL.revokeObjectURL(url)
	}

	const generateReceiptText = () => {
		return `
TRIP RECEIPT
============
Trip ID: ${trip.id || 'N/A'}
Date: ${trip.date || new Date().toLocaleDateString()}

STUDENT INFORMATION
${trip.studentName || 'N/A'}

DRIVER INFORMATION
${driver?.fullName || 'N/A'}
Vehicle: ${driver?.vehicleType || 'Van'} - ${driver?.plateNumber || 'N/A'}
Contact: ${driver?.phone || 'N/A'}

TRIP DETAILS
Pickup Time: ${trip.pickupTime || 'N/A'}
Drop-off Time: ${trip.dropoffTime || 'N/A'}
Pickup Location: ${trip.pickupLocation || 'N/A'}
Drop-off Location: ${trip.dropoffLocation || 'N/A'}

FARE BREAKDOWN
Base Fare: ₱${trip.baseFare || '0'}
Distance: ${trip.distance || '0'} km
Duration: ${trip.duration || '0'} mins
Surcharge: ₱${trip.surcharge || '0'}
Discount: -₱${trip.discount || '0'}
───────────────
TOTAL: ₱${trip.totalFare || '0'}

PAYMENT STATUS
${trip.paymentStatus === 'paid' ? '✓ Paid' : 'Pending'}
Payment Method: ${trip.paymentMethod || 'Cash'}

Thank you for using HNS App!
		`
	}

	return (
		<AnimatePresence>
			{isOpen && (
				<motion.div
					className="receipt-modal-overlay"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					onClick={onClose}
				>
					<motion.div
						className="receipt-modal"
						initial={{ scale: 0.95, opacity: 0, y: 20 }}
						animate={{ scale: 1, opacity: 1, y: 0 }}
						exit={{ scale: 0.95, opacity: 0, y: 20 }}
						transition={{ type: 'spring', stiffness: 300, damping: 30 }}
						onClick={(e) => e.stopPropagation()}
					>
						{/* Header */}
						<div className="receipt-header">
							<motion.div
								initial={{ opacity: 0, x: -10 }}
								animate={{ opacity: 1, x: 0 }}
							>
								<h2>Trip Receipt</h2>
								<p>Receipt for trip on {trip.date}</p>
							</motion.div>
							<motion.button
								className="close-btn"
								onClick={onClose}
								whileHover={{ scale: 1.1, rotate: 90 }}
								whileTap={{ scale: 0.9 }}
							>
								<X size={20} />
							</motion.button>
						</div>

						{/* Receipt Content */}
						<div className="receipt-content">
							{/* Trip ID & Status */}
							<motion.div
								className="receipt-section trip-meta"
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.1 }}
							>
								<div className="meta-row">
									<span className="meta-label">Trip ID</span>
									<span className="meta-value">{trip.id || 'N/A'}</span>
								</div>
								<div className="meta-row">
									<span className="meta-label">Status</span>
									<span className={`meta-value status-${trip.status}`}>
										{trip.status ? trip.status.charAt(0).toUpperCase() + trip.status.slice(1) : 'Completed'}
									</span>
								</div>
							</motion.div>

							{/* Student & Driver Info */}
							<motion.div
								className="receipt-section info-grid"
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.15 }}
							>
								<div className="info-box">
									<div className="info-header">
										<User size={18} />
										<span>Student</span>
									</div>
									<div className="info-value">{trip.studentName || 'N/A'}</div>
								</div>

								<div className="info-box">
									<div className="info-header">
										<Navigation size={18} />
										<span>Driver</span>
									</div>
									<div className="info-value">{driver?.fullName || 'N/A'}</div>
									<div className="info-subtext">
										{driver?.vehicleType} • {driver?.plateNumber}
									</div>
								</div>
							</motion.div>

							{/* Location & Time Details */}
							<motion.div
								className="receipt-section"
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.2 }}
							>
								<div className="detail-row">
									<div className="detail-item">
										<MapPin size={16} />
										<div>
											<span className="detail-label">Pickup Location</span>
											<span className="detail-value">{trip.pickupLocation || 'N/A'}</span>
										</div>
									</div>
								</div>

								<div className="detail-row">
									<div className="detail-item">
										<MapPin size={16} />
										<div>
											<span className="detail-label">Drop-off Location</span>
											<span className="detail-value">{trip.dropoffLocation || 'N/A'}</span>
										</div>
									</div>
								</div>

								<div className="detail-row">
									<div className="detail-item">
										<Clock size={16} />
										<div>
											<span className="detail-label">Pickup Time</span>
											<span className="detail-value">{trip.pickupTime || 'N/A'}</span>
										</div>
									</div>

									<div className="detail-item">
										<Clock size={16} />
										<div>
											<span className="detail-label">Drop-off Time</span>
											<span className="detail-value">{trip.dropoffTime || 'N/A'}</span>
										</div>
									</div>
								</div>
							</motion.div>

							{/* Fare Breakdown */}
							<motion.div
								className="receipt-section fare-breakdown"
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.25 }}
							>
								<div className="fare-item">
									<span>Base Fare</span>
									<span>₱{trip.baseFare || '0'}</span>
								</div>

								{trip.distance && (
									<div className="fare-item">
										<span>Distance ({trip.distance} km)</span>
										<span>₱{(parseFloat(trip.distance) * 15).toFixed(2)}</span>
									</div>
								)}

								{trip.surcharge > 0 && (
									<div className="fare-item">
										<span>Surcharge</span>
										<span>₱{trip.surcharge}</span>
									</div>
								)}

								{trip.discount > 0 && (
									<div className="fare-item discount">
										<span>Discount</span>
										<span>-₱{trip.discount}</span>
									</div>
								)}

								<div className="fare-divider" />

								<div className="fare-item total">
									<span>Total Fare</span>
									<span>₱{trip.totalFare || '0'}</span>
								</div>
							</motion.div>

							{/* Payment Status */}
							<motion.div
								className="receipt-section payment-status"
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.3 }}
							>
								<div className="status-row">
									<span className="status-label">Payment Status</span>
									<span className={`status-badge ${trip.paymentStatus || 'paid'}`}>
										{trip.paymentStatus === 'paid' ? '✓ Paid' : 'Pending'}
									</span>
								</div>

								<div className="status-row">
									<span className="status-label">Payment Method</span>
									<span className="status-value">{trip.paymentMethod || 'Cash'}</span>
								</div>
							</motion.div>

							{/* Footer Message */}
							<motion.div
								className="receipt-footer"
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								transition={{ delay: 0.35 }}
							>
								<p>Thank you for using HNS App!</p>
								<p className="footer-note">Keep this receipt for your records</p>
							</motion.div>
						</div>

						{/* Actions */}
						<motion.div
							className="receipt-actions"
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.4 }}
						>
							<motion.button
								className="action-btn primary"
								onClick={handlePrint}
								whileHover={{ scale: 1.02 }}
								whileTap={{ scale: 0.98 }}
							>
								<Printer size={18} />
								<span>Print</span>
							</motion.button>
							<motion.button
								className="action-btn secondary"
								onClick={handleDownload}
								whileHover={{ scale: 1.02 }}
								whileTap={{ scale: 0.98 }}
							>
								<Download size={18} />
								<span>Download</span>
							</motion.button>
							<motion.button
								className="action-btn tertiary"
								onClick={onClose}
								whileHover={{ scale: 1.02 }}
								whileTap={{ scale: 0.98 }}
							>
								<span>Close</span>
							</motion.button>
						</motion.div>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	)
}
