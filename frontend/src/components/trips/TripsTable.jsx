import { motion, AnimatePresence } from 'framer-motion'
import {
	ChevronDown,
	CheckCircle2,
	AlertTriangle,
	Navigation,
	Clock,
	MapPin,
	Phone,
	Car,
	Star,
	AlertCircle,
	Users,
} from 'lucide-react'
import TripProgressTimeline from './TripProgressTimeline'
import './TripsTable.scss'

// STATUS CONFIGURATION - Maps lowercase status to display properties
// Backend sends: 'completed', 'cancelled', 'on the way', 'searching'
// Display shows: Proper case with colors and icons
const STATUS_CONFIG = {
	completed: {
		className: 'status-completed',
		icon: CheckCircle2,
		display: 'Completed',
	},
	'on the way': {
		className: 'status-active',
		icon: Navigation,
		display: 'On The Way',
	},
	cancelled: {
		className: 'status-cancelled',
		icon: AlertTriangle,
		display: 'Cancelled',
	},
	searching: {
		className: 'status-searching',
		icon: Clock,
		display: 'Searching',
	},
}

function TripCard({ trip, isExpanded, onToggleExpand, onViewReceipt, onHideTrip, onReportIssue }) {
	// Normalize trip status to lowercase for lookup
	const normalizedStatus = trip.status?.toLowerCase?.() || 'completed'
	const statusConfig = STATUS_CONFIG[normalizedStatus] || STATUS_CONFIG.completed
	const StatusIcon = statusConfig.icon

	const cardVariants = {
		collapsed: { height: 'auto' },
		expanded: { height: 'auto' },
	}

	return (
		<motion.div
			className={`trip-card-wrapper ${isExpanded ? 'expanded' : ''}`}
			layout
			initial={{ y: 8 }}
			animate={{ y: 0 }}
			exit={{ y: -8 }}
			transition={{ type: 'spring', stiffness: 300, damping: 25 }}
		>
			{/* Collapsed Header */}
			<motion.button
				type="button"
				className="trip-card-header"
				onClick={() => onToggleExpand(isExpanded ? null : trip.id)}
				whileTap={{ scale: 0.98 }}
				aria-label={`${isExpanded ? 'Collapse' : 'Expand'} trip details for ${trip.studentName}`}
				aria-expanded={isExpanded}
			>
				<div className="trip-header-left">
					<div className={`trip-status-badge ${statusConfig.className}`}>
						<StatusIcon size={18} aria-hidden="true" />
						<span>{statusConfig.display}</span>
					</div>
					<div className="trip-header-info">
						<div className="trip-main-info">
							<span className="trip-student">{trip.studentName}</span>
							<span className="trip-separator">•</span>
							<span className="trip-school">{trip.schoolDestination}</span>
						</div>
						<div className="trip-meta-info">
							<span className="trip-date">{trip.date}</span>
							<span className="trip-separator">•</span>
							<span className="trip-time">{trip.pickupTime}</span>
							<span className="trip-separator">•</span>
							<span className="trip-duration">{trip.duration}</span>
						</div>
					</div>
				</div>

				<div className="trip-header-right">
					<div className="trip-distance">
						<MapPin size={16} />
						<span>{trip.distance}</span>
					</div>
					<motion.div
						className="expand-icon"
						animate={{ rotate: isExpanded ? 180 : 0 }}
						transition={{ duration: 0.3 }}
					>
						<ChevronDown size={20} />
					</motion.div>
				</div>
			</motion.button>

			{['completed', 'cancelled'].includes(normalizedStatus) && (
				<div className="trip-card-quick-actions">
					<button type="button" className="trip-card-hide-button" onClick={() => onHideTrip?.(trip)}>
						Hide
					</button>
				</div>
			)}

			{/* Expanded Details */}
			<AnimatePresence>
				{isExpanded && (
					<motion.div
						className="trip-card-expanded"
						initial={{ height: 0 }}
						animate={{ height: 'auto' }}
						exit={{ height: 0 }}
						transition={{ type: 'spring', stiffness: 300, damping: 30 }}
					>
						<div className="expanded-content">
							{/* Progress Timeline */}
							<TripProgressTimeline trip={trip} />

							{/* Trip Details Grid */}
							<div className="trip-details-grid">
								{/* Student & Parent Info */}
								<div className="detail-section">
									<h4 className="detail-section-title">
										<Users size={16} />
										Travelers
									</h4>
									<div className="detail-items">
										<div className="detail-item">
											<span className="detail-label">Student</span>
											<span className="detail-value">{trip.studentName}</span>
										</div>
										<div className="detail-item">
											<span className="detail-label">Parent</span>
											<span className="detail-value">{trip.parentName}</span>
										</div>
									</div>
								</div>

								{/* Driver Info */}
								{normalizedStatus !== 'cancelled' && (
									<div className="detail-section">
										<h4 className="detail-section-title">
											<Car size={16} />
											Driver & Vehicle
										</h4>
										<div className="detail-items">
											<div className="detail-item">
												<span className="detail-label">Driver</span>
												<div className="driver-with-rating">
													<span className="detail-value">{trip.driverName}</span>
													<div className="rating-badge">
														<Star size={14} />
														<span>{trip.driverRating}</span>
													</div>
												</div>
											</div>
											<div className="detail-item">
												<span className="detail-label">Phone</span>
												<div className="phone-display">
													<Phone size={14} />
													<span>{trip.driverPhone}</span>
												</div>
											</div>
											<div className="detail-item">
												<span className="detail-label">Vehicle</span>
												<span className="detail-value">{trip.vehicleType}</span>
											</div>
											<div className="detail-item">
												<span className="detail-label">Plate Number</span>
												<span className="plate-number">{trip.plateNumber}</span>
											</div>
										</div>
									</div>
								)}

								{/* Locations */}
								<div className="detail-section">
									<h4 className="detail-section-title">
										<MapPin size={16} />
										Locations
									</h4>
									<div className="detail-items">
										<div className="detail-item">
											<span className="detail-label">Pickup</span>
											<span className="detail-value">{trip.pickupAddress}</span>
										</div>
										<div className="detail-item">
											<span className="detail-label">Destination</span>
											<span className="detail-value">{trip.schoolDestination}</span>
										</div>
										<div className="detail-item">
											<span className="detail-label">Route</span>
											<span className="detail-value">{trip.route}</span>
										</div>
									</div>
								</div>

								{/* Time & Distance */}
								<div className="detail-section">
									<h4 className="detail-section-title">
										<Clock size={16} />
										Trip Details
									</h4>
									<div className="detail-items">
										<div className="detail-item">
											<span className="detail-label">Pickup Time</span>
											<span className="detail-value">{trip.pickupTime}</span>
										</div>
										{trip.arrivalTime && (
											<div className="detail-item">
												<span className="detail-label">Arrival Time</span>
												<span className="detail-value">{trip.arrivalTime}</span>
											</div>
										)}
										<div className="detail-item">
											<span className="detail-label">Estimated</span>
											<span className="detail-value">{trip.estimatedArrival}</span>
										</div>
										<div className="detail-item">
											<span className="detail-label">Distance</span>
											<span className="detail-value">{trip.distance}</span>
										</div>
									</div>
								</div>
							</div>

							{/* Action Buttons */}
							<div className="trip-actions">
								{normalizedStatus === 'completed' && (
								<motion.button
									type="button"
									className="action-btn primary"
									onClick={() => onViewReceipt?.(trip.id)}
									whileHover={{ scale: 1.05, boxShadow: '0 12px 32px rgba(102, 126, 234, 0.3)' }}
									whileTap={{ scale: 0.95 }}
								>
									View Receipt
								</motion.button>
								)}
								<motion.button
									type="button"
									className="action-btn secondary"
									onClick={() => onReportIssue?.(trip)}
									whileHover={{ scale: 1.05 }}
									whileTap={{ scale: 0.95 }}
								>
									Report Issue
								</motion.button>
							</div>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</motion.div>
	)
}

export default function TripsTable({ trips, expandedTripId, onToggleExpand, onViewReceipt, onHideTrip, onReportIssue }) {
	return (
		<motion.div className="trips-table">
			<AnimatePresence mode="popLayout">
				{trips.map((trip, index) => (
					<TripCard
						key={trip.id}
						trip={trip}
						isExpanded={expandedTripId === trip.id}
						onToggleExpand={onToggleExpand}
						onViewReceipt={onViewReceipt}
						onHideTrip={onHideTrip}
						onReportIssue={onReportIssue}
					/>
				))}
			</AnimatePresence>
		</motion.div>
	)
}
