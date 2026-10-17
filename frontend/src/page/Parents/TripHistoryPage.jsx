import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
	Search,
	Filter,
	Calendar,
	SortAsc,
	TrendingUp,
	Clock,
	MapPin,
	Navigation,
	CheckCircle2,
	AlertTriangle,
	Zap,
	Users,
} from 'lucide-react'
import TripStatistics from '../../components/trips/TripStatistics'
import TripsFilterBar from '../../components/trips/TripsFilterBar'
import TripsTable from '../../components/trips/TripsTable'
import './TripHistoryPage.scss'

export default function TripHistoryPage({
	trips = [],
	isLoading = false,
	error = '',
	parentName = 'Parent',
	studentName = '',
	schoolName = '',
	onViewReceipt,
	onReportIssue,
}) {
	const [searchQuery, setSearchQuery] = useState('')
	const [selectedFilter, setSelectedFilter] = useState('all')
	const [dateRange, setDateRange] = useState({ start: '', end: '' })
	const [sortBy, setSortBy] = useState('date-desc')
	const [expandedTripId, setExpandedTripId] = useState(null)

	const historyTrips = useMemo(() => trips.map((trip) => {
		const createdAt = new Date(trip.createdAt)
		const endedAt = trip.arrivedAtSchoolAt || (trip.status === 'completed' ? trip.updatedAt : null)
		const rawDurationMinutes = endedAt && Number.isFinite(createdAt.getTime())
			? Math.round((new Date(endedAt) - createdAt) / 60000)
			: null
		const durationMinutes = Number.isFinite(rawDurationMinutes)
			? Math.max(0, rawDurationMinutes)
			: null
		const rawStatus = String(trip.status || '').toLowerCase()
		const status = rawStatus === 'completed'
			? 'completed'
			: rawStatus === 'cancelled'
				? 'cancelled'
				: rawStatus === 'searching'
					? 'searching'
					: 'on the way'
		const distanceKm = trip.distance == null || trip.distance === ''
			? null
			: Number.isFinite(Number(trip.distance))
				? Number(trip.distance)
				: null
		const displayStatus = status === 'on the way'
			? 'On The Way'
			: status.charAt(0).toUpperCase() + status.slice(1)

		return {
			id: String(trip._id),
			date: Number.isFinite(createdAt.getTime()) ? createdAt.toLocaleDateString() : 'Date unavailable',
			pickupTime: Number.isFinite(createdAt.getTime())
				? createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
				: '—',
			arrivalTime: trip.arrivedAtSchoolAt
				? new Date(trip.arrivedAtSchoolAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
				: null,
			duration: durationMinutes === null ? '—' : `${durationMinutes} mins`,
			durationMinutes,
			distance: distanceKm === null ? '—' : `${distanceKm} km`,
			distanceKm,
			status: displayStatus,
			displayStatus,
			studentName: trip.studentName || studentName || 'Student details unavailable',
			parentName,
			driverName: trip.driver?.fullName || 'No driver assigned',
			driverPhone: trip.driver?.phone || 'N/A',
			driverRating: trip.driver?.rating ?? 'N/A',
			vehicleType: trip.vehicleId?.vehicleType || 'N/A',
			plateNumber: trip.vehicleId?.plateNumber || 'N/A',
			pickupAddress: trip.pickupZone || 'N/A',
			schoolDestination: trip.schoolName || schoolName || 'N/A',
			estimatedArrival: 'N/A',
			route: 'N/A',
			notesCount: 0,
			emergencyCount: 0,
			createdAt,
		}
	}), [trips, parentName, studentName, schoolName])

	// Filter trips - REAL FUNCTIONAL FILTERING
	const filteredTrips = useMemo(() => {
		let result = [...historyTrips]

		// STATUS FILTER - Most important filter
		if (selectedFilter !== 'all') {
			result = result.filter((trip) => {
				const tripStatus = trip.status?.toLowerCase?.()?.trim?.() || ''
				const filterStatus = selectedFilter?.toLowerCase?.()?.trim?.() || ''
				return tripStatus === filterStatus
			})
		}

		// SEARCH FILTER
		if (searchQuery) {
			const query = searchQuery.toLowerCase().trim()
			result = result.filter(
				(trip) =>
					trip.studentName?.toLowerCase?.()?.includes?.(query) ||
					trip.driverName?.toLowerCase?.()?.includes?.(query) ||
					trip.schoolDestination?.toLowerCase?.()?.includes?.(query) ||
					trip.pickupAddress?.toLowerCase?.()?.includes?.(query)
			)
		}

		// DATE RANGE FILTER
		if (dateRange.start) {
			result = result.filter((trip) => trip.createdAt >= new Date(dateRange.start))
		}
		if (dateRange.end) {
			const endDate = new Date(dateRange.end)
			endDate.setHours(23, 59, 59, 999)
			result = result.filter((trip) => trip.createdAt <= endDate)
		}

		// SORTING
		result.sort((a, b) => {
			switch (sortBy) {
				case 'date-desc':
					return b.createdAt - a.createdAt
				case 'date-asc':
					return a.createdAt - b.createdAt
				case 'distance-desc':
					return (b.distanceKm ?? -1) - (a.distanceKm ?? -1)
				case 'distance-asc':
					return (a.distanceKm ?? Number.MAX_VALUE) - (b.distanceKm ?? Number.MAX_VALUE)
				default:
					return 0
			}
		})

		return result
	}, [selectedFilter, searchQuery, dateRange, sortBy, historyTrips])

	// Calculate statistics and filter counts
	const statistics = useMemo(() => {
		return {
			totalTrips: historyTrips.length,
			completedTrips: historyTrips.filter((t) => t.status.toLowerCase() === 'completed').length,
			activeTrips: historyTrips.filter((t) => t.status.toLowerCase() === 'on the way').length,
			cancelledTrips: historyTrips.filter((t) => t.status.toLowerCase() === 'cancelled').length,
			totalDistance: historyTrips.some((trip) => trip.distanceKm !== null)
				? historyTrips.reduce((sum, trip) => sum + (trip.distanceKm ?? 0), 0).toFixed(1)
				: '—',
			averageDuration: (() => {
				const completedDurations = historyTrips
					.filter((trip) => trip.status.toLowerCase() === 'completed' && trip.durationMinutes !== null)
					.map((trip) => trip.durationMinutes)
				return completedDurations.length
					? Math.round(completedDurations.reduce((sum, duration) => sum + duration, 0) / completedDurations.length)
					: '—'
			})(),
		}
	}, [historyTrips])

	// FILTER COUNTS - For displaying on filter buttons
	const filterCounts = useMemo(() => {
		return {
			all: historyTrips.length,
			completed: historyTrips.filter((t) => t.status.toLowerCase() === 'completed').length,
			cancelled: historyTrips.filter((t) => t.status.toLowerCase() === 'cancelled').length,
			'on the way': historyTrips.filter((t) => t.status.toLowerCase() === 'on the way').length,
			searching: historyTrips.filter((t) => t.status.toLowerCase() === 'searching').length,
		}
	}, [historyTrips])

	return (
		<motion.div
			className="trip-history-page"
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			transition={{ duration: 0.5 }}
		>
			{/* Header */}
			<motion.div className="history-header" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
				<div className="header-content">
					<div>
						<h1>Trip History</h1>
						<p>View and manage all your school transport trips</p>
					</div>
					<div className="header-icon">
						<Navigation size={32} />
					</div>
				</div>
			</motion.div>

			{/* Statistics */}
			<TripStatistics data={statistics} />
			{isLoading && <p role="status" className="text-sm text-on-dark-label">Loading trips...</p>}
			{error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}

			{/* Search and Filters */}
			<motion.div
				className="search-filter-section"
				initial={{ y: 20, opacity: 0 }}
				animate={{ y: 0, opacity: 1 }}
				transition={{ delay: 0.1 }}
			>
				<div className="search-bar-wrapper">
					<Search size={18} className="search-icon" />
					<input
						type="text"
						className="search-bar"
						placeholder="Search by student, driver, or destination..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
					/>
				</div>

				<TripsFilterBar
					selectedFilter={selectedFilter}
					onFilterChange={setSelectedFilter}
					dateRange={dateRange}
					onDateRangeChange={setDateRange}
					sortBy={sortBy}
					onSortChange={setSortBy}
					filterCounts={filterCounts}
				/>
			</motion.div>

			{/* Trips List */}
			<AnimatePresence mode="wait">
				{filteredTrips.length > 0 ? (
					<motion.div
						key="trips-list"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="trips-list"
					>
						<TripsTable
							trips={filteredTrips}
							expandedTripId={expandedTripId}
							onToggleExpand={setExpandedTripId}
							onViewReceipt={onViewReceipt}
							onReportIssue={onReportIssue}
						/>
					</motion.div>
				) : !isLoading ? (
					<motion.div
						key="empty-state"
						initial={{ opacity: 0, scale: 0.9 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: 0.9 }}
						className="empty-state"
					>
						<div className="empty-icon">
							<MapPin size={64} />
						</div>
						<h2>No trips found</h2>
						<p>Try adjusting your filters or search to find trips</p>
					</motion.div>
				) : null}
			</AnimatePresence>
		</motion.div>
	)
}
