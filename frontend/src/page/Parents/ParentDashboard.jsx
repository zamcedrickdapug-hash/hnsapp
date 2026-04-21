import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { apiFetch } from '../../api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Input } from '../../components/ui/input'
import { Button } from '../../components/ui/button'
import LiveTripMap from '../../components/tracking/LiveTripMap'
import Sidenavbar from './Sidenavbar'
import './ParentDashboard.scss'

const weeklySchedule = [
	{ day: 'Monday', pickup: '6:30 AM', dropoff: '4:30 PM' },
	{ day: 'Tuesday', pickup: '6:30 AM', dropoff: '4:30 PM' },
	{ day: 'Wednesday', pickup: '6:30 AM', dropoff: '4:30 PM' },
	{ day: 'Thursday', pickup: '6:30 AM', dropoff: '4:30 PM' },
	{ day: 'Friday', pickup: '6:30 AM', dropoff: '4:30 PM' },
]

const defaultSettings = {
	parentDisplayName: '',
	contactNumber: '',
	studentName: '',
	studentGradeSection: '',
	schoolName: '',
	pickupZone: '',
	emergencyContact: '',
	notes: '',
}

function formatDate(dateValue) {
	if (!dateValue) {
		return 'N/A'
	}

	return new Date(dateValue).toLocaleString()
}

function deriveTripStatus(request) {
	if (!request) {
		return 'Waiting for pickup'
	}

	if (request.status === 'searching') {
		return 'Waiting for pickup'
	}

	if (request.status === 'accepted') {
		return request.liveLocation ? 'On the way' : 'Waiting for pickup'
	}

	if (request.status === 'completed') {
		return 'Arrived'
	}

	if (request.status === 'cancelled') {
		return 'Cancelled'
	}

	return 'Waiting for pickup'
}

function getStatusClass(status) {
	if (status === 'Arrived') {
		return 'arrived'
	}

	if (status === 'Picked up') {
		return 'picked-up'
	}

	if (status === 'On the way') {
		return 'on-the-way'
	}

	if (status === 'Cancelled') {
		return 'cancelled'
	}

	return 'waiting'
}

function asLatLng(location) {
	const latitude = Number(location?.latitude)
	const longitude = Number(location?.longitude)

	if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
		return null
	}

	return [latitude, longitude]
}

function formatCoordinates(position) {
	if (!Array.isArray(position)) {
		return 'Not available'
	}

	return `${position[0].toFixed(6)}, ${position[1].toFixed(6)}`
}

function getCurrentRequesterLocation() {
	if (typeof window === 'undefined' || !navigator.geolocation) {
		return Promise.resolve(null)
	}

	return new Promise((resolve) => {
		navigator.geolocation.getCurrentPosition(
			(position) => {
				resolve({
					latitude: position.coords.latitude,
					longitude: position.coords.longitude,
					accuracy: position.coords.accuracy,
				})
			},
			() => resolve(null),
			{ enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
		)
	})
}

function hasMovedEnough(previousLocation, nextLocation) {
	if (!previousLocation) {
		return true
	}

	const previousLatitude = Number(previousLocation.latitude)
	const previousLongitude = Number(previousLocation.longitude)
	const nextLatitude = Number(nextLocation.latitude)
	const nextLongitude = Number(nextLocation.longitude)

	if (
		!Number.isFinite(previousLatitude) ||
		!Number.isFinite(previousLongitude) ||
		!Number.isFinite(nextLatitude) ||
		!Number.isFinite(nextLongitude)
	) {
		return true
	}

	return (
		Math.abs(previousLatitude - nextLatitude) > 0.00002 ||
		Math.abs(previousLongitude - nextLongitude) > 0.00002
	)
}

export default function ParentDashboard({ token, user, onLogout }) {
	const socketRef = useRef(null)
	const requesterWatchIdRef = useRef(null)
	const lastRequesterSyncAtRef = useRef(0)
	const lastRequesterLocationRef = useRef(null)
	const [notifications, setNotifications] = useState([])
	const [requests, setRequests] = useState([])
	const [loading, setLoading] = useState(false)
	const [requestsLoading, setRequestsLoading] = useState(false)
	const [requestSubmitting, setRequestSubmitting] = useState(false)
	const [error, setError] = useState('')
	const [isSidebarOpen, setIsSidebarOpen] = useState(true)
	const [activeSection, setActiveSection] = useState('dashboard')
	const [emergencyText, setEmergencyText] = useState('')
	const [settingsSavedText, setSettingsSavedText] = useState('')
	const [showDriverPreview, setShowDriverPreview] = useState(false)
	const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false)
	const [settingsData, setSettingsData] = useState(() => {
		const storageKey = `hns_parent_settings_${user.id}`
		const stored = localStorage.getItem(storageKey)

		if (stored) {
			try {
				return JSON.parse(stored)
			} catch {
				return {
					...defaultSettings,
					parentDisplayName: user.fullName || '',
					contactNumber: user.phone || '',
				}
			}
		}

		return {
			...defaultSettings,
			parentDisplayName: user.fullName || '',
			contactNumber: user.phone || '',
		}
	})

	const fetchNotifications = async ({ silent = false } = {}) => {
		if (!silent) {
			setLoading(true)
		}
		setError('')

		try {
			const response = await apiFetch('/api/parents/notifications', {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			})

			setNotifications(response.notifications || [])
		} catch (requestError) {
			setError(requestError.message || 'Unable to load dashboard notifications right now.')
		} finally {
			if (!silent) {
				setLoading(false)
			}
		}
	}

	const fetchRequests = async ({ silent = false } = {}) => {
		if (!silent) {
			setRequestsLoading(true)
		}
		setError('')

		try {
			const response = await apiFetch('/api/parents/van-requests', {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			})

			setRequests(response.requests || [])
		} catch (requestError) {
			setError(requestError.message || 'Unable to load ride requests right now.')
		} finally {
			if (!silent) {
				setRequestsLoading(false)
			}
		}
	}

	useEffect(() => {
		fetchNotifications()
		fetchRequests()
	}, [token])

	useEffect(() => {
		if (!token) {
			return undefined
		}

		const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin
		const socket = io(socketUrl, {
			path: '/socket.io',
			auth: { token },
			transports: ['websocket', 'polling'],
		})

		socketRef.current = socket

		socket.on('trip:location-updated', (eventPayload) => {
			const requestId = String(eventPayload?.requestId || '')
			const liveLocation = eventPayload?.liveLocation
			const nextStatus = eventPayload?.status

			if (!requestId || !liveLocation) {
				return
			}

			setRequests((current) =>
				current.map((item) =>
					String(item._id) === requestId
						? {
								...item,
								liveLocation,
								...(nextStatus ? { status: nextStatus } : {}),
						  }
						: item,
				),
			)
		})

		socket.on('trip:request-updated', (eventPayload) => {
			const nextRequest = eventPayload?.request
			const nextRequestId = String(nextRequest?._id || '')

			if (!nextRequestId) {
				return
			}

			setRequests((current) => {
				const exists = current.some((item) => String(item._id) === nextRequestId)

				if (!exists) {
					return [nextRequest, ...current]
				}

				return current.map((item) => (String(item._id) === nextRequestId ? { ...item, ...nextRequest } : item))
			})
		})

		return () => {
			socket.disconnect()
			socketRef.current = null
		}
	}, [token])

	useEffect(() => {
		if (typeof window === 'undefined') {
			return undefined
		}

		const mediaQuery = window.matchMedia('(max-width: 900px)')
		const syncSidebarWithViewport = () => {
			setIsSidebarOpen(!mediaQuery.matches)
		}

		syncSidebarWithViewport()

		if (typeof mediaQuery.addEventListener === 'function') {
			mediaQuery.addEventListener('change', syncSidebarWithViewport)
			return () => mediaQuery.removeEventListener('change', syncSidebarWithViewport)
		}

		mediaQuery.addListener(syncSidebarWithViewport)
		return () => mediaQuery.removeListener(syncSidebarWithViewport)
	}, [])

	const activeRideRequest = useMemo(
		() => requests.find((item) => ['searching', 'accepted'].includes(item.status)) || null,
		[requests],
	)

	useEffect(() => {
		if (!socketRef.current || !activeRideRequest?._id) {
			return
		}

		socketRef.current.emit('trip:subscribe', { requestId: activeRideRequest._id })
	}, [activeRideRequest?._id])

	useEffect(() => {
		if (!activeRideRequest) {
			return undefined
		}

		const pollInterval = activeRideRequest.status === 'accepted' ? 2000 : 6000
		const pollId = setInterval(() => {
			fetchRequests({ silent: true })
		}, pollInterval)

		return () => clearInterval(pollId)
	}, [activeRideRequest])

	const orderedNotifications = useMemo(
		() => [...notifications].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
		[notifications],
	)
	const unreadNotificationsCount = useMemo(
		() => notifications.filter((item) => !item.read).length,
		[notifications],
	)

	const currentTripStatus = deriveTripStatus(activeRideRequest)

	const requesterPosition = useMemo(() => asLatLng(activeRideRequest?.requesterLocation), [activeRideRequest])
	const vanPosition = useMemo(() => asLatLng(activeRideRequest?.liveLocation), [activeRideRequest])
	const mapCenter = vanPosition || requesterPosition || [14.5995, 120.9842]
	const trackTarget = vanPosition || requesterPosition
	const trackLiveLink = trackTarget
		? `https://www.google.com/maps/search/?api=1&query=${trackTarget[0]},${trackTarget[1]}`
		: ''

	const todaySchedule = useMemo(
		() => [
			{
				type: 'Pickup',
				time: '6:30 AM',
				location: settingsData.pickupZone || 'Set pickup zone in settings',
			},
			{
				type: 'Drop-off',
				time: '7:20 AM',
				location: settingsData.schoolName || 'Set school name in settings',
			},
			{
				type: 'Return',
				time: '4:30 PM',
				location: settingsData.pickupZone || 'Set pickup zone in settings',
			},
		],
		[settingsData.pickupZone, settingsData.schoolName],
	)

	const tripHistory = useMemo(
		() =>
			requests.map((item) => {
				const pickupTime = new Date(item.createdAt)
				const dropoffTime = new Date(pickupTime.getTime() + 45 * 60 * 1000)
				const status =
					item.status === 'cancelled'
						? 'Cancelled'
						: item.status === 'completed'
							? 'Completed'
							: item.status === 'accepted'
								? 'In Progress'
								: 'Searching'
				return {
					id: item._id,
					date: pickupTime.toLocaleDateString(),
					pickupTime: pickupTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
					dropoffTime: dropoffTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
					status,
				}
			}),
		[requests],
	)

	const accountStatusLabel =
		user.status === 'approved' ? 'Verified' : user.status === 'reviewing' ? 'Pending Approval' : 'Pending Approval'

	const syncRequesterLocation = useCallback(
		async (requestId, requesterLocation) => {
			await apiFetch(`/api/parents/van-requests/${requestId}/requester-location`, {
				method: 'PATCH',
				headers: {
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify(requesterLocation),
			})
		},
		[token],
	)

	useEffect(() => {
		if (typeof window === 'undefined' || !navigator.geolocation) {
			return undefined
		}

		const activeRequestId = String(activeRideRequest?._id || '')
		const isRequestActive = ['searching', 'accepted'].includes(activeRideRequest?.status)

		if (!activeRequestId || !isRequestActive) {
			if (requesterWatchIdRef.current !== null) {
				navigator.geolocation.clearWatch(requesterWatchIdRef.current)
				requesterWatchIdRef.current = null
			}

			lastRequesterSyncAtRef.current = 0
			lastRequesterLocationRef.current = null
			return undefined
		}

		const geolocationOptions = { enableHighAccuracy: true, maximumAge: 8000, timeout: 10000 }

		const syncPosition = (position) => {
			const nextLocation = {
				latitude: position.coords.latitude,
				longitude: position.coords.longitude,
				accuracy: position.coords.accuracy,
			}

			setRequests((current) =>
				current.map((item) =>
					String(item._id) === activeRequestId
						? {
								...item,
								requesterLocation: {
									...nextLocation,
									capturedAt: new Date().toISOString(),
								},
						  }
						: item,
				),
			)

			const now = Date.now()
			const shouldSyncBecauseTime = now - lastRequesterSyncAtRef.current >= 5000
			const shouldSyncBecauseMoved = hasMovedEnough(lastRequesterLocationRef.current, nextLocation)

			if (!shouldSyncBecauseTime && !shouldSyncBecauseMoved) {
				return
			}

			lastRequesterSyncAtRef.current = now
			lastRequesterLocationRef.current = nextLocation

			syncRequesterLocation(activeRequestId, nextLocation).catch(() => {})
		}

		navigator.geolocation.getCurrentPosition(syncPosition, () => {}, geolocationOptions)

		const watchId = navigator.geolocation.watchPosition(syncPosition, () => {}, geolocationOptions)
		requesterWatchIdRef.current = watchId

		return () => {
			navigator.geolocation.clearWatch(watchId)
			if (requesterWatchIdRef.current === watchId) {
				requesterWatchIdRef.current = null
			}
		}
	}, [activeRideRequest?._id, activeRideRequest?.status, syncRequesterLocation])

	const markRead = async (notificationId) => {
		if (String(notificationId).startsWith('local-')) {
			setNotifications((current) =>
				current.map((item) => (item._id === notificationId ? { ...item, read: true } : item)),
			)
			return
		}

		try {
			await apiFetch(`/api/parents/notifications/${notificationId}/read`, {
				method: 'PATCH',
				headers: {
					Authorization: `Bearer ${token}`,
				},
			})

			setNotifications((current) =>
				current.map((item) =>
					item._id === notificationId
						? {
								...item,
								read: true,
						  }
						: item,
				),
			)
		} catch (requestError) {
			setError(requestError.message || 'Unable to mark item as read.')
		}
	}

	const handleRequestRide = async () => {
		if (activeRideRequest) {
			setError('You already have an active ride request.')
			return
		}

		setRequestSubmitting(true)
		setError('')
		setEmergencyText('')

		try {
			const requesterLocation = await getCurrentRequesterLocation()
			const fallbackPickupZone = settingsData.pickupZone || user.homeAddress || ''

			await apiFetch('/api/parents/van-requests', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					studentName: settingsData.studentName,
					gradeSection: settingsData.studentGradeSection,
					schoolName: settingsData.schoolName,
					pickupZone: fallbackPickupZone,
					emergencyContact: settingsData.emergencyContact,
					notes: settingsData.notes,
					requesterLocation,
				}),
			})

			await fetchRequests({ silent: true })
			await fetchNotifications({ silent: true })
		} catch (requestError) {
			setError(requestError.message || 'Unable to submit ride request right now.')
		} finally {
			setRequestSubmitting(false)
		}
	}

	const handleEmergency = () => {
		const alertTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
		setEmergencyText(`Emergency alert sent to admin and driver at ${alertTime}.`)
		setNotifications((current) => [
			{
				_id: `local-panic-${Date.now()}`,
				title: 'Emergency alert triggered',
				message: 'Admin and assigned driver were immediately notified.',
				status: 'reviewing',
				read: false,
				createdAt: new Date().toISOString(),
			},
			...current,
		])
	}

	const updateSettingsField = (fieldName, fieldValue) => {
		setSettingsData((current) => ({
			...current,
			[fieldName]: fieldValue,
		}))
	}

	const handleSectionChange = (nextSection) => {
		setActiveSection(nextSection)
		setIsNotificationsModalOpen(false)

		if (typeof window !== 'undefined' && window.innerWidth <= 900) {
			setIsSidebarOpen(false)
		}
	}

	const saveSettings = (event) => {
		event.preventDefault()
		const storageKey = `hns_parent_settings_${user.id}`
		localStorage.setItem(storageKey, JSON.stringify(settingsData))
		setSettingsSavedText('Settings saved successfully. Sensitive information remains hidden from dashboard view.')
	}

	const rideStatusText =
		!activeRideRequest
			? 'No active request'
			: activeRideRequest.status === 'searching'
				? 'Searching for driver'
				: activeRideRequest.status === 'accepted'
					? 'Accepted'
					: activeRideRequest.status
	const etaLabel = currentTripStatus === 'On the way' ? '8 mins' : currentTripStatus === 'Arrived' ? 'Arrived' : 'Pending'

	const safeDriverName = activeRideRequest?.driver?.fullName || 'Driver not assigned'
	const safeDriverPhone = activeRideRequest?.driver?.phone || 'Hidden'
	const safeVehicleType = activeRideRequest?.driver?.driver?.vehicleType || 'Pending assignment'
	const safePlateNumber = activeRideRequest?.driver?.driver?.plateNumber || 'Pending assignment'
	const vanCoordinatesText = formatCoordinates(vanPosition)
	const requesterCoordinatesText = formatCoordinates(requesterPosition)

	const canPreviewDriver = Boolean(activeRideRequest?.driver)

	return (
		<section className={`parent-shell ${isSidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'}`}>
			{isSidebarOpen ? (
				<button
					type="button"
					className="sidebar-backdrop"
					onClick={() => setIsSidebarOpen(false)}
					aria-label="Close sidebar"
				/>
			) : null}

			<Sidenavbar
				user={user}
				activeSection={activeSection}
				onChangeSection={handleSectionChange}
				onLogout={onLogout}
				isOpen={isSidebarOpen}
				onToggle={() => setIsSidebarOpen((current) => !current)}
			/>

			<div className="parent-main">
				{!isSidebarOpen ? (
					<div className="parent-main__navtrigger">
						<button
							type="button"
							className="sidebar-open-button"
							onClick={() => setIsSidebarOpen(true)}
							aria-label="Open sidebar"
						>
							<span className="material-symbols-rounded" aria-hidden="true">
								menu
							</span>
						</button>
					</div>
				) : null}

				{activeSection === 'dashboard' ? (
					<>
						<header className="parent-main__header">
							<h1>Parent Tracking Dashboard</h1>
							<p>Monitor live trip updates, schedule, and child transport safety in real time</p>
							<div className="parent-main__header-actions">
								<span className={`account-pill ${user.status === 'approved' ? 'verified' : 'pending'}`}>
									Account: {accountStatusLabel}
								</span>

								<button
									type="button"
									className="notification-bell"
									onClick={() => setIsNotificationsModalOpen(true)}
									aria-label="Open notifications"
								>
									<span className="material-symbols-rounded" aria-hidden="true">
										notifications
									</span>
									{unreadNotificationsCount > 0 ? (
										<span className="notification-bell__badge">
											{unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
										</span>
									) : null}
								</button>
							</div>
						</header>

						{isNotificationsModalOpen ? (
							<div
								className="notifications-modal-backdrop"
								onClick={() => setIsNotificationsModalOpen(false)}
							>
								<div
									className="notifications-modal"
									role="dialog"
									aria-modal="true"
									aria-label="Notifications"
									onClick={(event) => event.stopPropagation()}
								>
									<div className="notifications-modal__header">
										<h3>Notifications</h3>
										<button
											type="button"
											className="notifications-modal__close"
											onClick={() => setIsNotificationsModalOpen(false)}
											aria-label="Close notifications"
										>
											<span className="material-symbols-rounded" aria-hidden="true">
												close
											</span>
										</button>
									</div>

									<div className="notifications-modal__body">
										{orderedNotifications.length > 0 ? (
											orderedNotifications.map((item) => (
												<div
													key={item._id}
													className={`notification-item ${item.read ? '' : 'unread'}`}
												>
													<div>
														<h4>{item.title}</h4>
														<p>{item.message}</p>
														<small>{formatDate(item.createdAt)}</small>
													</div>
													{!item.read ? (
														<Button size="sm" variant="secondary" onClick={() => markRead(item._id)}>
															Mark Read
														</Button>
													) : null}
												</div>
											))
										) : (
											<p className="state-text">No updates yet.</p>
										)}
									</div>
								</div>
							</div>
						) : null}

						<section className="tracking-grid">
							<Card className="map-card">
								<CardHeader>
									<CardTitle>Live Tracking Map</CardTitle>
									<CardDescription>
										Track van and student location during active trip window
									</CardDescription>
								</CardHeader>
								<CardContent>
									<LiveTripMap
										className="tracking-map"
										center={mapCenter}
										pickupPosition={requesterPosition}
										vanPosition={vanPosition}
										showRoute={Boolean(vanPosition && requesterPosition)}
										routeMode="road"
										height={350}
									/>

									<div className="map-meta">
										<span>Van: {vanCoordinatesText}</span>
										<span>Request Pin: {requesterCoordinatesText}</span>
										<span className={`trip-status-pill ${getStatusClass(currentTripStatus)}`}>
											{currentTripStatus}
										</span>
									</div>
								</CardContent>
							</Card>

							<Card>
								<CardHeader>
									<CardTitle>Trip Status</CardTitle>
									<CardDescription>Real-time trip summary and quick tracking action</CardDescription>
								</CardHeader>
								<CardContent className="status-card-content">
									<div className="status-line">
										<strong>Driver:</strong>
										<span>{safeDriverName}</span>
									</div>
									<div className="status-line">
										<strong>Plate Number:</strong>
										<span>{safePlateNumber}</span>
									</div>
									<div className="status-line">
										<strong>ETA:</strong>
										<span>{etaLabel}</span>
									</div>
									
									<Button variant="secondary" onClick={() => setShowDriverPreview((current) => !current)} disabled={!canPreviewDriver}>
										Preview Driver Info
									</Button>

									<div className="quick-actions-panel">
										<p className={`request-status ${activeRideRequest?.status || 'idle'}`}>
											Status: {rideStatusText}
										</p>

										<div className="quick-actions-buttons">
											<Button onClick={handleRequestRide} disabled={requestSubmitting || Boolean(activeRideRequest)}>
												{requestSubmitting
													? 'Submitting...'
													: activeRideRequest
														? 'Request Active'
														: 'Request a School Van'}
											</Button>
											<Button variant="destructive" onClick={handleEmergency}>
												Panic Button
											</Button>
										</div>

										{emergencyText ? <p className="emergency-text">{emergencyText}</p> : null}
									</div>

									{showDriverPreview && canPreviewDriver ? (
										<div className="driver-preview-card">
											<p>
												<strong>Name:</strong> {safeDriverName}
											</p>
											<p>
												<strong>Phone:</strong> {safeDriverPhone}
											</p>
											<p>
												<strong>Vehicle:</strong> {safeVehicleType}
											</p>
											<p>
												<strong>Plate:</strong> {safePlateNumber}
											</p>
										</div>
									) : null}
								</CardContent>
							</Card>
						</section>

						{loading || requestsLoading ? <p className="state-text">Loading dashboard data...</p> : null}
						{error ? <p className="state-text state-text--error">{error}</p> : null}

						<section className="dashboard-grid">
							<Card>
								<CardHeader>
									<CardTitle>Schedule Overview</CardTitle>
									<CardDescription>Today's transport schedule and weekly overview</CardDescription>
								</CardHeader>
								<CardContent className="schedule-content">
									<div className="today-schedule">
										{todaySchedule.map((item) => (
											<div key={item.type} className="schedule-row">
												<div>
													<h4>{item.type}</h4>
													<p>{item.location}</p>
												</div>
												<span>{item.time}</span>
											</div>
										))}
									</div>

									<div className="weekly-schedule">
										{weeklySchedule.map((item) => (
											<div key={item.day} className="weekly-row">
												<span>{item.day}</span>
												<span>
													{item.pickup} / {item.dropoff}
												</span>
											</div>
										))}
									</div>
								</CardContent>
							</Card>

							<Card>
								<CardHeader>
									<CardTitle>Driver Info (Limited)</CardTitle>
									<CardDescription>Only safe and necessary driver details are displayed</CardDescription>
								</CardHeader>
								<CardContent className="status-card-content">
									<div className="status-line">
										<strong>Name:</strong>
										<span>{safeDriverName}</span>
									</div>
									<div className="status-line">
										<strong>Vehicle:</strong>
										<span>{safeVehicleType}</span>
									</div>
									<div className="status-line">
										<strong>Plate:</strong>
										<span>{safePlateNumber}</span>
									</div>
								</CardContent>
							</Card>
						</section>

						<section className="timeline-row">
							<span className={currentTripStatus === 'Waiting for pickup' ? 'active' : ''}>Waiting for pickup</span>
							<span className={currentTripStatus === 'On the way' ? 'active' : ''}>On the way</span>
							<span className={currentTripStatus === 'Picked up' ? 'active' : ''}>Picked up</span>
							<span className={currentTripStatus === 'Arrived' ? 'active' : ''}>Arrived</span>
						</section>
					</>
				) : null}

				{activeSection === 'history' ? (
					<Card>
						<CardHeader>
							<CardTitle>Trip History</CardTitle>
							<CardDescription>Review previous pickup and drop-off records</CardDescription>
						</CardHeader>
						<CardContent className="history-list">
							{tripHistory.map((item) => (
								<div key={item.id} className="history-item">
									<div>
										<h4>{item.date}</h4>
										<p>Pickup: {item.pickupTime}</p>
										<p>Drop-off: {item.dropoffTime}</p>
									</div>
									<span className={`history-status ${item.status.toLowerCase().replace(' ', '-')}`}>{item.status}</span>
								</div>
							))}

							{tripHistory.length === 0 ? <p className="state-text">No trip history available yet.</p> : null}
						</CardContent>
					</Card>
				) : null}

				{activeSection === 'settings' ? (
					<Card>
						<CardHeader>
							<CardTitle>Settings</CardTitle>
							<CardDescription>
								Manage parent and student profile details used in trip coordination.
								 Sensitive fields and documents are intentionally excluded.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<form className="settings-form" onSubmit={saveSettings}>
								<label>
									<span>Parent Display Name</span>
									<Input
										value={settingsData.parentDisplayName}
										onChange={(event) => updateSettingsField('parentDisplayName', event.target.value)}
										placeholder="Enter display name"
										required
									/>
								</label>

								<label>
									<span>Contact Number</span>
									<Input
										value={settingsData.contactNumber}
										onChange={(event) => updateSettingsField('contactNumber', event.target.value)}
										placeholder="09XXXXXXXXX"
										required
									/>
								</label>

								<label>
									<span>Student Name</span>
									<Input
										value={settingsData.studentName}
										onChange={(event) => updateSettingsField('studentName', event.target.value)}
										placeholder="Enter student name"
										required
									/>
								</label>

								<label>
									<span>Grade / Section</span>
									<Input
										value={settingsData.studentGradeSection}
										onChange={(event) => updateSettingsField('studentGradeSection', event.target.value)}
										placeholder="Example: Grade 5 - Rizal"
										required
									/>
								</label>

								<label>
									<span>School Name</span>
									<Input
										value={settingsData.schoolName}
										onChange={(event) => updateSettingsField('schoolName', event.target.value)}
										placeholder="Enter school"
										required
									/>
								</label>

								<label>
									<span>Pickup Zone (Barangay / Landmark only)</span>
									<Input
										value={settingsData.pickupZone}
										onChange={(event) => updateSettingsField('pickupZone', event.target.value)}
										placeholder="Example: Near Barangay Hall"
										required
									/>
								</label>

								<label>
									<span>Emergency Contact</span>
									<Input
										value={settingsData.emergencyContact}
										onChange={(event) => updateSettingsField('emergencyContact', event.target.value)}
										placeholder="09XXXXXXXXX"
										required
									/>
								</label>

								<label>
									<span>Notes for Driver</span>
									<Input
										value={settingsData.notes}
										onChange={(event) => updateSettingsField('notes', event.target.value)}
										placeholder="Landmark or important reminder"
									/>
								</label>

								<div className="settings-actions">
									<Button type="submit">Save Settings</Button>
								</div>

								{settingsSavedText ? <p className="settings-saved-text">{settingsSavedText}</p> : null}
							</form>
						</CardContent>
					</Card>
				) : null}
			</div>
		</section>
	)
}
