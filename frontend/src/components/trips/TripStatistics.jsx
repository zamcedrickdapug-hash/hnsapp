import { motion } from 'framer-motion'
import { TrendingUp, CheckCircle2, Navigation, AlertTriangle, Route, Clock } from 'lucide-react'

const STATS_CONFIG = [
	{
		id: 'total',
		icon: TrendingUp,
		label: 'Total Trips',
		key: 'totalTrips',
	},
	{
		id: 'completed',
		icon: CheckCircle2,
		label: 'Completed',
		key: 'completedTrips',
	},
	{
		id: 'active',
		icon: Navigation,
		label: 'Active Trips',
		key: 'activeTrips',
	},
	{
		id: 'cancelled',
		icon: AlertTriangle,
		label: 'Cancelled',
		key: 'cancelledTrips',
	},
	{
		id: 'distance',
		icon: Route,
		label: 'Total Distance',
		key: 'totalDistance',
		unit: ' km',
	},
	{
		id: 'duration',
		icon: Clock,
		label: 'Avg Duration',
		key: 'averageDuration',
		unit: ' min',
	},
]

export default function TripStatistics({ data }) {
	const containerVariants = {
		hidden: { y: 8 },
		visible: {
			y: 0,
			transition: {
				staggerChildren: 0.1,
				delayChildren: 0.2,
			},
		},
	}

	const itemVariants = {
		hidden: { y: 12 },
		visible: {
			y: 0,
			transition: { type: 'spring', stiffness: 100, damping: 12 },
		},
	}

	return (
		<motion.div
			className="trip-statistics"
			variants={containerVariants}
			initial="hidden"
			animate="visible"
		>
			{STATS_CONFIG.map((stat, index) => {
				const Icon = stat.icon
				const value = data[stat.key]
				const hasValue = value !== null && value !== undefined && value !== '' && value !== '—'
				const displayValue = hasValue ? value : '-'

				return (
					<motion.div
						key={stat.id}
						className={`stat-card stat-card--${stat.id}${hasValue ? '' : ' stat-card--missing'}`}
						variants={itemVariants}
						whileHover={{
							y: -4,
						}}
						transition={{ type: 'spring', stiffness: 400, damping: 25 }}
					>
						<div className="stat-card-content">
							<div className="stat-icon-box" aria-hidden="true">
								<Icon size={20} />
							</div>
							<div className="stat-text">
								<div className="stat-value">
									<span className="stat-number">{displayValue}</span>
									{stat.unit && hasValue && <span className="stat-unit">{stat.unit}</span>}
								</div>
								<div className="stat-label">{stat.label}</div>
							</div>
						</div>
					</motion.div>
				)
			})}
		</motion.div>
	)
}
