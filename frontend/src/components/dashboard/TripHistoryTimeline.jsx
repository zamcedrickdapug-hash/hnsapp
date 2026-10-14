import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, MapPin, Clock, DollarSign, Navigation, CheckCircle, XCircle } from 'lucide-react'
import './TripHistoryTimeline.css'

const STATUS_CONFIG = {
	completed: { icon: CheckCircle, color: '#10b981', label: 'Completed' },
	cancelled: { icon: XCircle, color: '#ef4444', label: 'Cancelled' },
	in_progress: { icon: Navigation, color: '#3b82f6', label: 'In Progress' },
	picked_up: { icon: CheckCircle, color: '#8b5cf6', label: 'Picked Up' },
	searching: { icon: Clock, color: '#f59e0b', label: 'Searching' },
}

export function TripCard({ trip, index, isExpanded, onToggle, onViewReceipt, onReportIssue }) {
	// Handle missing data
	if (!trip) {
		console.warn('TripCard received null trip')
		return null
	}

	// Normalize status for looking up config
	const statusNormalized = (trip.status || '')
		.toString()
		.trim()
		.toLowerCase()
		.replace(/\s+/g, '_')

	console.log(`🎫 TripCard [${trip.studentName}] status: "${trip.status}" → lookup key: "${statusNormalized}"`)

	// Get config with fallback
	const statusConfig = STATUS_CONFIG[statusNormalized] || STATUS_CONFIG.completed
	const StatusIcon = statusConfig.icon

	return (
		<motion.div
			className={`trip-card ${isExpanded ? 'expanded' : ''}`}
			initial={{ opacity: 0, y: 20 }}
			whileInView={{ opacity: 1, y: 0 }}
			viewport={{ once: true }}
			transition={{
				type: 'spring',
				stiffness: 100,
				damping: 12,
				delay: index * 0.05,
			}}
		>
			<div className="trip-timeline-dot">
				<div className="dot-inner" />
				<div className="dot-line" />
			</div>

			<motion.button
				className="trip-card-header"
				onClick={() => onToggle()}
				whileHover={{ background: 'rgba(255, 255, 255, 0.08)' }}
				whileTap={{ scale: 0.98 }}
			>
				<div className="trip-header-left">
					<div className="trip-date-badge">
						<span className="trip-date">{trip.date}</span>
						<span className="trip-time">{trip.pickupTime}</span>
					</div>

					<div className="trip-status-section">
						<StatusIcon size={20} color={statusConfig.color} />
						<span className="trip-status" style={{ color: statusConfig.color }}>
							{statusConfig.label}
						</span>
					</div>
				</div>

				<motion.div
					animate={{ rotate: isExpanded ? 180 : 0 }}
					transition={{ duration: 0.3 }}
					className="trip-expand-icon"
				>
					<ChevronDown size={20} />
				</motion.div>
			</motion.button>

			<AnimatePresence>
				{isExpanded && (
					<motion.div
						className="trip-card-content"
						initial={{ opacity: 0, height: 0 }}
						animate={{ opacity: 1, height: 'auto' }}
						exit={{ opacity: 0, height: 0 }}
						transition={{ duration: 0.3 }}
					>
						<div className="trip-details">
							<div className="detail-group">
								<div className="detail-item">
									<div className="detail-label">
										<MapPin size={16} />
										<span>Student</span>
									</div>
									<div className="detail-value">{trip.studentName}</div>
								</div>

								<div className="detail-item">
									<div className="detail-label">
										<Clock size={16} />
										<span>Pickup Time</span>
									</div>
									<div className="detail-value">{trip.pickupTime}</div>
								</div>
							</div>

							<div className="detail-group">
								<div className="detail-item">
									<div className="detail-label">
										<Navigation size={16} />
										<span>Driver</span>
									</div>
									<div className="detail-value">{trip.driver}</div>
								</div>

								<div className="detail-item">
									<div className="detail-label">
										<Clock size={16} />
										<span>Drop-off Time</span>
									</div>
									<div className="detail-value">{trip.dropoffTime}</div>
								</div>
							</div>

							<div className="trip-actions">
								<motion.button
									type="button"
									className="action-btn primary"
									onClick={() => onViewReceipt?.(trip)}
									whileHover={{ scale: 1.02 }}
									whileTap={{ scale: 0.98 }}
								>
									<span>View Receipt</span>
								</motion.button>
								<motion.button
									type="button"
									className="action-btn secondary"
									onClick={() => onReportIssue?.(trip)}
									whileHover={{ scale: 1.02 }}
									whileTap={{ scale: 0.98 }}
								>
									<span>Report Issue</span>
								</motion.button>
							</div>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</motion.div>
	)
}

export function TripHistoryTimeline({ trips = [], onFilterChange, onViewReceipt, onReportIssue }) {
	const [expandedTrip, setExpandedTrip] = useState(null)
	const [activeTab, setActiveTab] = useState('all')

	// ===== STEP 1: INSPECT RAW DATA =====
	console.log('\n✅ [STEP 1] RAW TRIP DATA')
	console.log('trips prop received:', {
		type: typeof trips,
		isArray: Array.isArray(trips),
		length: trips?.length,
		value: trips,
	})

	if (trips && trips.length > 0) {
		const firstTrip = trips[0]
		console.log('First trip:', firstTrip)
		console.log('First trip keys:', Object.keys(firstTrip))
		console.log('First trip.status:', {
			value: firstTrip.status,
			type: typeof firstTrip.status,
			exists: 'status' in firstTrip,
		})
	}

	const displayTrips = Array.isArray(trips) ? trips : []

	console.log('Final displayTrips:', displayTrips)

	// ===== STEP 2: NORMALIZE STATUS =====
	const normalizeStatus = (status) => {
		if (status === null || status === undefined || status === '') return ''
		const str = String(status).trim().toLowerCase()
		return str
	}

	// ===== STEP 3: CREATE FILTERS WITH DETAILED LOGGING =====
	console.log('\n✅ [STEP 3] CREATING FILTERS')

	const allStatuses = []
	
	const completedTrips = displayTrips.filter((trip, idx) => {
		if (!trip || trip === null || trip === undefined) {
			console.warn(`  [${idx}] Trip is null/undefined`)
			return false
		}

		const status = trip.status
		allStatuses.push(status)

		const norm = normalizeStatus(status)
		const isCompleted = norm === 'completed'

		console.log(
			`  [${idx}] "${trip.studentName || 'Unknown'}" | status: "${status}" (${typeof status}) | normalized: "${norm}" | MATCHES "completed": ${isCompleted}`
		)

		return isCompleted
	})

	console.log('Completed trips found:', completedTrips.length)
	console.log('All statuses encountered:', [...new Set(allStatuses)].map(s => `"${s}"`).join(', '))

	const cancelledTrips = displayTrips.filter((trip, idx) => {
		if (!trip) return false
		const norm = normalizeStatus(trip.status)
		const isCancelled = norm === 'cancelled'
		if (isCancelled) {
			console.log(`  [${idx}] "${trip.studentName}" MATCHES "cancelled"`)
		}
		return isCancelled
	})

	console.log('Cancelled trips found:', cancelledTrips.length)

	// ===== STEP 5: RENDER LOGIC =====
	console.log('\n✅ [STEP 5] RENDER LOGIC')
	console.log('activeTab:', activeTab)

	let displayedTrips = displayTrips

	if (activeTab === 'completed') {
		displayedTrips = completedTrips
		console.log('→ Showing completed trips:', displayedTrips.length)
	} else if (activeTab === 'cancelled') {
		displayedTrips = cancelledTrips
		console.log('→ Showing cancelled trips:', displayedTrips.length)
	} else {
		console.log('→ Showing all trips:', displayedTrips.length)
	}

	// ===== TAB CLICK HANDLER =====
	const handleFilterChange = (tabName) => {
		console.log('\n🔴 [TAB CLICKED]', tabName)
		setActiveTab(tabName)
		onFilterChange?.(tabName)
	}

	return (
		<div className="trip-history-timeline">
			<div className="timeline-header">
				<h2>Trip History</h2>
				<div className="timeline-filters">
					<FilterButton
						label="All"
						isActive={activeTab === 'all'}
						onClick={() => handleFilterChange('all')}
					/>
					<FilterButton
						label="Completed"
						isActive={activeTab === 'completed'}
						onClick={() => handleFilterChange('completed')}
					/>
					<FilterButton
						label="Cancelled"
						isActive={activeTab === 'cancelled'}
						onClick={() => handleFilterChange('cancelled')}
					/>
				</div>
			</div>

			<div className="timeline-content">
				{displayedTrips && displayedTrips.length > 0 ? (
					<motion.div className="trips-list" layout>
						{displayedTrips.map((trip, index) => (
							<TripCard
								key={trip?.id || `trip-${index}`}
								trip={trip}
								index={index}
								isExpanded={expandedTrip === trip?.id}
								onToggle={() => setExpandedTrip(expandedTrip === trip?.id ? null : trip?.id)}
								onViewReceipt={onViewReceipt}
								onReportIssue={onReportIssue}
							/>
						))}
					</motion.div>
				) : (
					<motion.div
						className="empty-state"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
					>
						<div className="empty-icon">
							<Navigation size={48} />
						</div>
						<h3>
							{activeTab === 'all'
								? 'No trips yet'
								: activeTab === 'completed'
									? 'No completed trips found'
									: 'No cancelled trips found'}
						</h3>
						<p>
							{activeTab === 'all'
								? 'Your trip history will appear here once you complete a ride'
								: `You don't have any ${activeTab} trips yet`}
						</p>
					</motion.div>
				)}
			</div>
		</div>
	)
}

function FilterButton({ label, isActive, onClick }) {
	return (
		<motion.button
			className={`filter-btn ${isActive ? 'active' : ''}`}
			onClick={onClick}
			whileHover={{ background: 'rgba(255, 255, 255, 0.15)' }}
			whileTap={{ scale: 0.95 }}
		>
			{label}
			{isActive && (
				<motion.div
					className="active-indicator"
					layoutId="activeIndicator"
					transition={{ type: 'spring', stiffness: 500, damping: 30 }}
				/>
			)}
		</motion.button>
	)
}
