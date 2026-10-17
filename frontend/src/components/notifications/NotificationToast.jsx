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

export function NotificationToast({ notification, onDismiss, onNotificationClick, autoClose = 5000 }) {
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

	const handleNotificationClick = () => {
		if (!onNotificationClick?.(notification)) return
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
					<button
						type="button"
						className="notification-toast__action"
						onClick={handleNotificationClick}
					>
						<span className="toast-icon">
							<IconComponent size={24} style={{ color }} />
						</span>
						<span className="toast-content">
							<span className="toast-title">{notification?.title}</span>
							<span className="toast-message">{notification?.message}</span>
						</span>
					</button>

					<button
						className="toast-close"
						onClick={(event) => {
							event.stopPropagation()
							handleClose()
						}}
						aria-label="Dismiss notification"
						type="button"
					>
						✕
					</button>

					<div className="toast-progress-bar" />
				</motion.div>
			)}
		</AnimatePresence>
	)
}

export function NotificationsContainer({ notifications, onDismiss, onNotificationClick }) {
	return (
		<div className="notifications-container">
			<AnimatePresence>
				{notifications.map((notification) => (
					<NotificationToast
						key={notification.id}
						notification={notification}
						onDismiss={() => onDismiss?.(notification.id)}
						onNotificationClick={onNotificationClick}
					/>
				))}
			</AnimatePresence>
		</div>
	)
}
