import React, { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Clock, MapPin, Zap } from 'lucide-react'
import './TripStatusPanel.css'

/**
 * Real-time Trip Status Panel
 * Displays ETA, trip progress, status messages, and vehicle information
 * Supports live updates and animations
 */
export function TripStatusPanel({
	status = 'idle',
	eta = null,
	progress = 0,
	vehicleType = 'van',
	isMoving = false,
	distanceTraveled = 0,
	totalDistance = 8,
	pickupLocation = null,
	destinationLocation = null,
	driverName = 'Driver',
	vehiclePlate = 'XXX-000',
	isDemoMode = false,
	onRetry = null,
}) {
	const [displayETA, setDisplayETA] = useState(eta)
	const [animateProgress, setAnimateProgress] = useState(false)

	useEffect(() => {
		setDisplayETA(eta)
	}, [eta])

	useEffect(() => {
		setAnimateProgress(true)
		const timer = setTimeout(() => setAnimateProgress(false), 300)
		return () => clearTimeout(timer)
	}, [progress])

	const statusColor = useMemo(() => {
		const statusString = String(status || '').toLowerCase()
		if (statusString.includes('idle')) return '#64748b'
		if (statusString.includes('pickup') || statusString.includes('near')) return '#f59e0b'
		if (statusString.includes('picked')) return '#8b5cf6'
		if (statusString.includes('destination')) return '#3b82f6'
		if (statusString.includes('arrived')) return '#10b981'
		return '#52a3ff'
	}, [status])

	const getStatusIcon = () => {
		const statusString = String(status || '').toLowerCase()
		if (statusString.includes('arrived')) return '✓'
		if (statusString.includes('picked')) return '●'
		if (statusString.includes('destination')) return '⚡'
		if (statusString.includes('pickup')) return '◆'
		return '◎'
	}

	const etaMinutes = useMemo(() => {
		if (!eta) return 'calculating...'
		if (typeof eta === 'object' && eta.minutes !== undefined) {
			return eta.minutes === 0 ? 'arriving' : `${eta.minutes} min`
		}
		return eta
	}, [eta])

	return (
		<motion.div
			className="trip-status-panel"
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.3 }}
		>
			{/* Header with status */}
			<div className="status-header" style={{ borderColor: statusColor }}>
				<div className="status-badge" style={{ backgroundColor: statusColor }}>
					<span className="status-icon">{getStatusIcon()}</span>
					<span className="status-text">{status}</span>
				</div>

				{isDemoMode && (
					<div className="demo-badge">
						<span className="demo-dot" />
						Demo Mode
					</div>
				)}
			</div>

			{/* Main info grid */}
			<div className="status-grid">
				{/* ETA Section */}
				<div className="status-item eta-section">
					<div className="item-icon">
						<Clock size={18} />
					</div>
					<div className="item-content">
						<div className="item-label">Estimated Time</div>
						<motion.div
							className="item-value"
							key={etaMinutes}
							animate={{ scale: animateProgress ? 1.05 : 1 }}
							transition={{ duration: 0.2 }}
						>
							{etaMinutes}
						</motion.div>
					</div>
				</div>

				{/* Distance Section */}
				<div className="status-item distance-section">
					<div className="item-icon">
						<MapPin size={18} />
					</div>
					<div className="item-content">
						<div className="item-label">Distance</div>
						<div className="item-value">
							{distanceTraveled.toFixed(1)} / {totalDistance.toFixed(1)} km
						</div>
					</div>
				</div>

				{/* Speed Section */}
				{isMoving && (
					<div className="status-item speed-section">
						<div className="item-icon">
							<motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity }}>
								<Zap size={18} />
							</motion.div>
						</div>
						<div className="item-content">
							<div className="item-label">Status</div>
							<div className="item-value">In Motion</div>
						</div>
					</div>
				)}
			</div>

			{/* Progress Bar */}
			<div className="progress-section">
				<div className="progress-bar">
					<motion.div
						className="progress-fill"
						initial={{ width: 0 }}
						animate={{ width: `${Math.min(progress * 100, 100)}%` }}
						transition={{ duration: 0.5, ease: 'easeOut' }}
					/>
					<div className="progress-glow" />
				</div>
				<div className="progress-text">
					{Math.round(progress * 100)}% complete
				</div>
			</div>

			{/* Vehicle Info */}
			<div className="vehicle-info">
				<div className="vehicle-type-badge">{vehicleType.toUpperCase()}</div>
				<div className="vehicle-details">
					<div className="driver-info">
						<span className="label">Driver:</span>
						<span className="value">{driverName}</span>
					</div>
					<div className="plate-info">
						<span className="label">Plate:</span>
						<span className="value font-mono">{vehiclePlate}</span>
					</div>
				</div>
			</div>

			{/* Location Info */}
			{(pickupLocation || destinationLocation) && (
				<div className="location-info">
					{pickupLocation && (
						<div className="location-item pickup">
							<span className="location-type">Pickup:</span>
							<span className="location-coords">
								{pickupLocation[0].toFixed(4)}, {pickupLocation[1].toFixed(4)}
							</span>
						</div>
					)}
					{destinationLocation && (
						<div className="location-item destination">
							<span className="location-type">Destination:</span>
							<span className="location-coords">
								{destinationLocation[0].toFixed(4)}, {destinationLocation[1].toFixed(4)}
							</span>
						</div>
					)}
				</div>
			)}

			{/* Action Buttons */}
			{onRetry && (
				<motion.button
					className="retry-button"
					onClick={onRetry}
					whileHover={{ scale: 1.02 }}
					whileTap={{ scale: 0.98 }}
				>
					Retry Demo
				</motion.button>
			)}
		</motion.div>
	)
}

export default TripStatusPanel
