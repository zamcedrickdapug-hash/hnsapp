import { motion } from 'framer-motion'
import { TrendingUp, CheckCircle2, Navigation, AlertTriangle, Route, Clock } from 'lucide-react'

const STATS_CONFIG = [
	{
		id: 'total',
		icon: TrendingUp,
		label: 'Total Trips',
		key: 'totalTrips',
		gradient: 'linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%)',
		borderColor: 'rgba(102, 126, 234, 0.3)',
		accentColor: '#a5b4fc',
	},
	{
		id: 'completed',
		icon: CheckCircle2,
		label: 'Completed',
		key: 'completedTrips',
		gradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(34, 197, 94, 0.2) 100%)',
		borderColor: 'rgba(16, 185, 129, 0.3)',
		accentColor: '#86efac',
	},
	{
		id: 'active',
		icon: Navigation,
		label: 'Active Trips',
		key: 'activeTrips',
		gradient: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(99, 102, 241, 0.2) 100%)',
		borderColor: 'rgba(59, 130, 246, 0.3)',
		accentColor: '#93c5fd',
	},
	{
		id: 'cancelled',
		icon: AlertTriangle,
		label: 'Cancelled',
		key: 'cancelledTrips',
		gradient: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(220, 38, 38, 0.2) 100%)',
		borderColor: 'rgba(239, 68, 68, 0.3)',
		accentColor: '#fca5a5',
	},
	{
		id: 'distance',
		icon: Route,
		label: 'Total Distance',
		key: 'totalDistance',
		unit: ' km',
		gradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(217, 119, 6, 0.2) 100%)',
		borderColor: 'rgba(245, 158, 11, 0.3)',
		accentColor: '#fcd34d',
	},
	{
		id: 'duration',
		icon: Clock,
		label: 'Avg Duration',
		key: 'averageDuration',
		unit: ' min',
		gradient: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%)',
		borderColor: 'rgba(168, 85, 247, 0.3)',
		accentColor: '#d8b4fe',
	},
]

export default function TripStatistics({ data }) {
	const containerVariants = {
		hidden: { opacity: 0 },
		visible: {
			opacity: 1,
			transition: {
				staggerChildren: 0.1,
				delayChildren: 0.2,
			},
		},
	}

	const itemVariants = {
		hidden: { opacity: 0, y: 20 },
		visible: {
			opacity: 1,
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
				const displayValue = typeof value === 'number' ? value : value

				return (
					<motion.div
						key={stat.id}
						className="stat-card"
						style={{
							background: stat.gradient,
							borderColor: stat.borderColor,
						}}
						variants={itemVariants}
						whileHover={{
							y: -4,
							borderColor: stat.accentColor,
							boxShadow: `0 0 20px ${stat.accentColor}33`,
						}}
						transition={{ type: 'spring', stiffness: 400, damping: 25 }}
					>
						<div className="stat-card-content">
							<div className="stat-icon-box">
								<Icon size={24} color={stat.accentColor} />
							</div>
							<div className="stat-text">
								<div className="stat-value">
									<span className="stat-number">{displayValue}</span>
									{stat.unit && <span className="stat-unit">{stat.unit}</span>}
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
