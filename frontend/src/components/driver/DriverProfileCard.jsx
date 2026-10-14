import { motion, AnimatePresence } from 'framer-motion'
import { Phone, MapPin, Wind, Zap, Smartphone, AlertCircle, User } from 'lucide-react'
import './DriverProfileCard.css'

export function DriverProfileCard({ driver, liveLocation, status }) {
	if (!driver) {
		return (
			<motion.div
				className="driver-profile-card loading-state"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
			>
				<div className="skeleton-avatar" />
				<div className="skeleton-content">
					<div className="skeleton-line" />
					<div className="skeleton-line short" />
				</div>
			</motion.div>
		)
	}

	const isOnline = status === 'accepted' || status === 'arrived' || status === 'picked_up'
	const profileImage = driver.profilePhoto || null

	return (
		<motion.div
			className="driver-profile-card"
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ type: 'spring', stiffness: 100 }}
		>
			{/* Header with gradient background */}
			<div className="card-background" />

			{/* Online Status Badge */}
			<motion.div
				className={`online-badge ${isOnline ? 'online' : 'offline'}`}
				animate={{
					boxShadow: isOnline
						? ['0 0 10px rgba(16, 185, 129, 0.5)', '0 0 20px rgba(16, 185, 129, 0.7)']
						: 'none',
				}}
				transition={{
					duration: 2,
					repeat: isOnline ? Infinity : 0,
				}}
			>
				<motion.span
					className="status-dot"
					animate={{
						scale: isOnline ? [1, 1.2, 1] : 1,
					}}
					transition={{
						duration: 2,
						repeat: isOnline ? Infinity : 0,
					}}
				/>
				<span>{isOnline ? 'Online' : 'Offline'}</span>
			</motion.div>

			{/* Profile Picture */}
			<div className="profile-section">
				{profileImage ? (
					<img src={profileImage} alt={driver.fullName} className="driver-photo" />
				) : (
					<div className="driver-photo-placeholder">
						<User size={32} />
					</div>
				)}
				<motion.div
					className="rating-badge"
					whileHover={{ scale: 1.1 }}
				>
					<span className="rating-value">4.8</span>
					<span className="rating-stars">★</span>
				</motion.div>
			</div>

			{/* Driver Info */}
			<div className="driver-info">
				<h3 className="driver-name">{driver.fullName}</h3>
				<p className="driver-vehicle">
					{driver.vehicleType || 'Van'} • {driver.plateNumber || 'Pending'}
				</p>
			</div>

			{/* Contact & Vehicle Details Grid */}
			<div className="details-grid">
				<motion.a
					href={`tel:${driver.phone}`}
					className="detail-item phone"
					whileHover={{ scale: 1.05 }}
					whileTap={{ scale: 0.95 }}
				>
					<Phone size={18} />
					<span>{driver.phone}</span>
				</motion.a>

				{liveLocation && (
					<motion.div
						className="detail-item location"
						whileHover={{ scale: 1.05 }}
					>
						<MapPin size={18} />
						<span>
							{liveLocation[0].toFixed(4)}, {liveLocation[1].toFixed(4)}
						</span>
					</motion.div>
				)}

				{driver.licenseNumber && (
					<div className="detail-item license">
						<Smartphone size={18} />
						<span>{driver.licenseNumber}</span>
					</div>
				)}

				{driver.licenseExpiry && (
					<div className="detail-item expiry">
						<Zap size={18} />
						<span>License: {driver.licenseExpiry}</span>
					</div>
				)}
			</div>

			{/* Action Buttons */}
			<div className="card-actions">
				<motion.a
					href={`tel:${driver.phone}`}
					className="action-btn primary"
					whileHover={{ scale: 1.02 }}
					whileTap={{ scale: 0.98 }}
				>
					<Phone size={18} />
					Call Driver
				</motion.a>
				<motion.a
					href={`sms:${driver.phone}`}
					className="action-btn secondary"
					whileHover={{ scale: 1.02 }}
					whileTap={{ scale: 0.98 }}
				>
					<span>Send SMS</span>
				</motion.a>
			</div>

			{/* GPS Status Indicator */}
			{liveLocation && (
				<motion.div
					className="gps-status"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
				>
					<motion.span
						className="gps-dot"
						animate={{ scale: [1, 1.2, 1] }}
						transition={{ duration: 2, repeat: Infinity }}
					/>
					<span>GPS Active - Real-time tracking</span>
				</motion.div>
			)}
		</motion.div>
	)
}
