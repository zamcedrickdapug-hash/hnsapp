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
import TripStatistics from './TripStatistics'
import TripsFilterBar from './TripsFilterBar'
import TripsTable from './TripsTable'
import './TripHistoryPage.scss'

export default function TripHistoryPage() {
	const [searchQuery, setSearchQuery] = useState('')
	const [selectedFilter, setSelectedFilter] = useState('all')
	const [dateRange, setDateRange] = useState({ start: '', end: '' })
	const [sortBy, setSortBy] = useState('date-desc')
	const [expandedTripId, setExpandedTripId] = useState(null)

	// Mock trip data - replace with API data
	// STATUS NORMALIZATION: All statuses are lowercase for consistent filtering
	const mockTrips = [
		{
			id: 1,
			date: '2026-05-12',
			pickupTime: '08:00 AM',
			arrivalTime: '08:35 AM',
			duration: '35 mins',
			distance: '12.5 km',
			status: 'completed', // NORMALIZED: lowercase
			studentName: 'John Doe',
			parentName: 'Jane Doe',
			driverName: 'Michael Johnson',
			driverPhone: '+1234567890',
			driverRating: 4.8,
			vehicleType: 'Toyota Hiace',
			plateNumber: 'ABC-1234',
			pickupAddress: '123 Main St, Downtown',
			schoolDestination: 'Central High School',
			estimatedArrival: '08:34 AM',
			route: 'Downtown → School District',
			notesCount: 2,
			emergencyCount: 0,
			createdAt: new Date('2026-05-12'),
		},
		{
			id: 2,
			date: '2026-05-11',
			pickupTime: '08:05 AM',
			arrivalTime: '08:40 AM',
			duration: '35 mins',
			distance: '12.5 km',
			status: 'completed', // NORMALIZED: lowercase
			studentName: 'Sarah Smith',
			parentName: 'Robert Smith',
			driverName: 'Michael Johnson',
			driverPhone: '+1234567890',
			driverRating: 4.8,
			vehicleType: 'Toyota Hiace',
			plateNumber: 'ABC-1234',
			pickupAddress: '456 Oak Ave, Midtown',
			schoolDestination: 'Central High School',
			estimatedArrival: '08:39 AM',
			route: 'Midtown → School District',
			notesCount: 0,
			emergencyCount: 0,
			createdAt: new Date('2026-05-11'),
		},
		{
			id: 3,
			date: '2026-05-10',
			pickupTime: '08:10 AM',
			arrivalTime: null,
			duration: 'Ongoing',
			distance: '8.3 km',
			status: 'on the way', // NORMALIZED: lowercase
			studentName: 'Emma Wilson',
			parentName: 'David Wilson',
			driverName: 'Sarah Davis',
			driverPhone: '+0987654321',
			driverRating: 4.9,
			vehicleType: 'Honda Odyssey',
			plateNumber: 'XYZ-5678',
			pickupAddress: '789 Pine Rd, Uptown',
			schoolDestination: 'Lincoln Middle School',
			estimatedArrival: '08:45 AM',
			route: 'Uptown → School District',
			notesCount: 1,
			emergencyCount: 0,
			createdAt: new Date('2026-05-10'),
		},
		{
			id: 4,
			date: '2026-05-09',
			pickupTime: '08:15 AM',
			arrivalTime: null,
			duration: 'Cancelled',
			distance: '0 km',
			status: 'cancelled', // NORMALIZED: lowercase
			studentName: 'Lucas Brown',
			parentName: 'Jennifer Brown',
			driverName: 'N/A',
			driverPhone: 'N/A',
			driverRating: 0,
			vehicleType: 'N/A',
			plateNumber: 'N/A',
			pickupAddress: '321 Elm St, Downtown',
			schoolDestination: 'Central High School',
			estimatedArrival: 'N/A',
			route: 'N/A',
			notesCount: 1,
			emergencyCount: 0,
			createdAt: new Date('2026-05-09'),
		},
	]

	// DEBUG: Log trips data
	console.log('✅ Trips data loaded:', mockTrips.length, 'trips')

	// Filter trips - REAL FUNCTIONAL FILTERING
	const filteredTrips = useMemo(() => {
		let result = [...mockTrips]

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
			result = result.filter((trip) => new Date(trip.date) >= new Date(dateRange.start))
		}
		if (dateRange.end) {
			result = result.filter((trip) => new Date(trip.date) <= new Date(dateRange.end))
		}

		// SORTING
		result.sort((a, b) => {
			switch (sortBy) {
				case 'date-desc':
					return new Date(b.date) - new Date(a.date)
				case 'date-asc':
					return new Date(a.date) - new Date(b.date)
				case 'distance-desc':
					return parseFloat(b.distance || 0) - parseFloat(a.distance || 0)
				case 'distance-asc':
					return parseFloat(a.distance || 0) - parseFloat(b.distance || 0)
				default:
					return 0
			}
		})

		// DEBUG: Log filtering info
		console.log('🔍 Filter Applied:', {
			activeFilter: selectedFilter,
			searchQuery: searchQuery || 'none',
			filteredCount: result.length,
			totalCount: mockTrips.length,
			details: {
				completed: result.filter((t) => t.status === 'completed').length,
				cancelled: result.filter((t) => t.status === 'cancelled').length,
				onTheWay: result.filter((t) => t.status === 'on the way').length,
			},
		})

		return result
	}, [selectedFilter, searchQuery, dateRange, sortBy, mockTrips])

	// Calculate statistics and filter counts
	const statistics = useMemo(() => {
		return {
			totalTrips: mockTrips.length,
			completedTrips: mockTrips.filter((t) => t.status === 'completed').length,
			activeTrips: mockTrips.filter((t) => t.status === 'on the way').length,
			cancelledTrips: mockTrips.filter((t) => t.status === 'cancelled').length,
			totalDistance: mockTrips
				.reduce((sum, t) => sum + parseFloat(t.distance || 0), 0)
				.toFixed(1),
			averageDuration: Math.round(
				mockTrips
					.filter((t) => t.status === 'completed')
					.reduce((sum, t) => sum + parseInt(t.duration), 0) /
					mockTrips.filter((t) => t.status === 'completed').length
			),
		}
	}, [mockTrips])

	// FILTER COUNTS - For displaying on filter buttons
	const filterCounts = useMemo(() => {
		return {
			all: mockTrips.length,
			completed: mockTrips.filter((t) => t.status === 'completed').length,
			cancelled: mockTrips.filter((t) => t.status === 'cancelled').length,
			'on the way': mockTrips.filter((t) => t.status === 'on the way').length,
			searching: mockTrips.filter((t) => t.status === 'searching').length,
		}
	}, [mockTrips])

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
						/>
					</motion.div>
				) : (
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
				)}
			</AnimatePresence>
		</motion.div>
	)
}
