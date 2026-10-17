import { motion } from 'framer-motion'
import {
	Send,
	CheckCircle,
	MapPin,
	Car,
	Users,
	Navigation,
	MapIcon,
	CheckCircle2,
	AlertCircle,
} from 'lucide-react'

const TIMELINE_STEPS = [
	{ id: 1, label: 'Request Sent', icon: Send },
	{ id: 2, label: 'Driver Assigned', icon: CheckCircle },
	{ id: 3, label: 'Driver Started', icon: Car },
	{ id: 4, label: 'At Pickup', icon: MapPin },
	{ id: 5, label: 'Picked Up', icon: Users },
	{ id: 6, label: 'On The Way', icon: Navigation },
	{ id: 7, label: 'At Destination', icon: MapIcon },
	{ id: 8, label: 'Completed', icon: CheckCircle2 },
]

export default function TripProgressTimeline({ trip }) {
	// Determine which step the trip is at based on status
	const getCompletedSteps = () => {
		switch (trip.status) {
			case 'Completed':
				return 8
			case 'On The Way':
				return 6
			case 'Searching':
				return 1
			case 'Cancelled':
				return 1
			default:
				return 1
		}
	}

	const completedSteps = getCompletedSteps()

	const containerVariants = {
		hidden: {},
		visible: {
			transition: {
				staggerChildren: 0.08,
				delayChildren: 0.1,
			},
		},
	}

	const itemVariants = {
		hidden: { y: 6 },
		visible: {
			y: 0,
			transition: { type: 'spring', stiffness: 100, damping: 12 },
		},
	}

	return (
		<div className="trip-progress-timeline">
			<h4 className="timeline-title">Trip Progress</h4>

			<motion.div
				className="timeline-container"
				variants={containerVariants}
				initial="hidden"
				animate="visible"
			>
				{TIMELINE_STEPS.map((step, index) => {
					const isCompleted = index < completedSteps
					const isCurrent = index === completedSteps - 1
					const Icon = step.icon

					return (
						<motion.div
							key={step.id}
							className={`timeline-item ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}`}
							variants={itemVariants}
						>
							{/* Timeline Dot */}
							<motion.div
								className="timeline-dot-wrapper"
								animate={isCurrent ? { scale: [1, 1.2, 1] } : {}}
								transition={isCurrent ? { duration: 2, repeat: Infinity } : {}}
							>
								<div className="timeline-dot">
									{isCompleted ? (
										<motion.div
											className="dot-icon"
											initial={{ scale: 0 }}
											animate={{ scale: 1 }}
											transition={{ type: 'spring', stiffness: 300, damping: 20 }}
										>
											<Icon size={16} />
										</motion.div>
									) : (
										<div className="dot-empty" />
									)}
								</div>

								{/* Timeline Line */}
								{index < TIMELINE_STEPS.length - 1 && (
									<motion.div
										className="timeline-line"
										initial={{ scaleX: 0 }}
										animate={{ scaleX: isCompleted ? 1 : 0 }}
										transition={{ duration: 0.5, delay: 0.2 }}
										style={{ originX: 0 }}
									/>
								)}
							</motion.div>

							{/* Step Label */}
							<div className="step-content">
								<span className="step-label">{step.label}</span>
							</div>
						</motion.div>
					)
				})}
			</motion.div>
		</div>
	)
}
