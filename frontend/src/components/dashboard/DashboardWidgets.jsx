import { motion } from 'framer-motion'
import { TrendingUp, Activity, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import './DashboardWidgets.css'

const WIDGET_VARIANTS = {
	hidden: { opacity: 0, y: 20 },
	visible: (index) => ({
		opacity: 1,
		y: 0,
		transition: {
			type: 'spring',
			stiffness: 100,
			damping: 12,
			delay: index * 0.1,
		},
	}),
	hover: {
		y: -4,
		transition: {
			type: 'spring',
			stiffness: 200,
			damping: 20,
		},
	},
}

export function StatsWidget({
	title,
	value,
	subtitle,
	icon: Icon,
	gradient,
	trend,
	index = 0,
}) {
	return (
		<motion.div
			className="stats-widget"
			initial="hidden"
			whileInView="visible"
			whileHover="hover"
			viewport={{ once: true }}
			variants={WIDGET_VARIANTS}
			custom={index}
			style={{
				background: gradient || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
			}}
		>
			<div className="widget-background">
				<div className="widget-glow" />
			</div>

			<div className="widget-content">
				<div className="widget-header">
					<div className="widget-icon">
						<Icon size={24} />
					</div>
					{trend && <div className="widget-trend">{trend}</div>}
				</div>

				<div className="widget-body">
					<div className="widget-value">{value}</div>
					<div className="widget-title">{title}</div>
				</div>

				<div className="widget-footer">
					<span className="widget-subtitle">{subtitle}</span>
				</div>
			</div>
		</motion.div>
	)
}

export function DashboardWidgets({ stats = {} }) {
	const defaultStats = {
		totalTrips: 24,
		activeTrips: 1,
		completedTrips: 23,
		pendingRequests: 0,
		monthlyActivity: '18 trips',
		...stats,
	}

	const widgets = [
		{
			title: 'Total Trips',
			value: defaultStats.totalTrips,
			subtitle: 'All time',
			icon: Activity,
			gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
			trend: '+2 this week',
		},
		{
			title: 'Active Trips',
			value: defaultStats.activeTrips,
			subtitle: 'In progress',
			icon: Clock,
			gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
			trend: defaultStats.activeTrips > 0 ? 'Live now' : 'None',
		},
		{
			title: 'Completed',
			value: defaultStats.completedTrips,
			subtitle: 'Success rate 100%',
			icon: CheckCircle,
			gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
			trend: '+5 this month',
		},
		{
			title: 'Pending',
			value: defaultStats.pendingRequests,
			subtitle: 'Awaiting driver',
			icon: AlertCircle,
			gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
			trend: defaultStats.pendingRequests > 0 ? 'Urgent' : 'None',
		},
	]

	return (
		<div className="dashboard-widgets">
			<motion.div
				className="widgets-grid"
				initial={{ opacity: 0 }}
				whileInView={{ opacity: 1 }}
				viewport={{ once: true }}
				transition={{ duration: 0.5 }}
			>
				{widgets.map((widget, index) => (
					<StatsWidget key={widget.title} {...widget} index={index} />
				))}
			</motion.div>
		</div>
	)
}
