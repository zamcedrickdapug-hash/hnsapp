import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
	CheckCircle,
	MapPin,
	AlertCircle,
	Bell,
	Navigation,
	Home,
	Clock,
	AlertTriangle,
} from 'lucide-react'
import './NotificationToast.css'

// Icon mapping for different notification types
const NOTIFICATION_ICONS = {
	driver_accepted: Navigation,
	on_the_way: MapPin,
	arrived_at_pickup: CheckCircle,
	picked_up: Home,
	heading_to_school: Navigation,
	arrived_at_school: CheckCircle,
	emergency: AlertTriangle,
	info: Bell,
}

const NOTIFICATION_COLORS = {
	driver_accepted: '#10b981',
	on_the_way: '#3b82f6',
	arrived_at_pickup: '#06b6d4',
	picked_up: '#8b5cf6',
	heading_to_school: '#3b82f6',
	arrived_at_school: '#10b981',
	emergency: '#ef4444',
	info: '#6366f1',
}

export function NotificationToast({ notification, onDismiss, autoClose = 5000 }) {
	const [isVisible, setIsVisible] = useState(true)

	useEffect(() => {
		if (!autoClose) return

		const timer = setTimeout(() => {
			setIsVisible(false)
			onDismiss?.()
		}, autoClose)

		return () => clearTimeout(timer)
	}, [autoClose, onDismiss])

	const IconComponent = NOTIFICATION_ICONS[notification?.type] || Bell
	const color = NOTIFICATION_COLORS[notification?.type] || '#6366f1'

	const handleClose = () => {
		setIsVisible(false)
		onDismiss?.()
	}

	return (
		<AnimatePresence>
			{isVisible && (
				<motion.div
					className="notification-toast"
					initial={{ opacity: 0, y: -20, x: 20 }}
					animate={{ opacity: 1, y: 0, x: 0 }}
					exit={{ opacity: 0, y: -20, x: 20 }}
					transition={{ duration: 0.3 }}
					style={{ '--notification-color': color }}
				>
					<div className="toast-icon">
						<IconComponent size={24} style={{ color }} />
					</div>

					<div className="toast-content">
						<h4 className="toast-title">{notification?.title}</h4>
						<p className="toast-message">{notification?.message}</p>
					</div>

					<button
						className="toast-close"
						onClick={handleClose}
						aria-label="Dismiss notification"
					>
						✕
					</button>

					<div className="toast-progress-bar" />
				</motion.div>
			)}
		</AnimatePresence>
	)
}

export function NotificationsContainer({ notifications, onDismiss }) {
	return (
		<div className="notifications-container">
			<AnimatePresence>
				{notifications.map((notification) => (
					<NotificationToast
						key={notification.id}
						notification={notification}
						onDismiss={() => onDismiss?.(notification.id)}
					/>
				))}
			</AnimatePresence>
		</div>
	)
}
