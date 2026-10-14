/**
 * DriverDashboard Component - INTEGRATED VERSION
 * ==============================================
 * Enterprise refactored dashboard with new modular architecture
 * 
 * ✅ Uses DashboardLayout wrapper
 * ✅ Uses imported utilities (not inline functions)
 * ✅ Uses feature components (DriverStatsCards, etc)
 * ✅ Preserves all original business logic
 * ✅ Maintains backward compatibility
 * ✅ Professional code organization
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { DashboardLayout } from '../../components/dashboard'
import { DriverStatsCards } from '../../components/dashboard/driver'
import LiveTripMap from '../../components/tracking/LiveTripMap'
import { apiFetch } from '../../api'
import { useSocket, useSocketEvent } from '../../hooks/useSocket'
import { registerPushSubscription } from '../../lib/pushNotifications'
import Requests from './Requests'
import DriverSettings from './DriverSettings'
import {
	formatDate,
	getStatusLabelClass,
	formatLocation,
	buildMapLink,
	asLatLng,
	distanceInMeters,
	playNotificationSound,
	showBrowserNotification,
} from '../../utils/driverDashboard'
import './DriverDashboard.scss'

// ====== CONSTANTS ======
const defaultProfile = {
	driverPhone: '',
	vehicleType: 'School Service Van',
	plateNumber: '',
	licenseNumber: '',
	licenseExpiry: '',
	emergencyContact: '',
	driverAddress: '',
}
const DEFAULT_MAP_CENTER = [14.5995, 120.9842]
const ARRIVED_RADIUS_METERS = 60

/**
 * Main DriverDashboard Component
 * Professional modular architecture with full business logic preserved
 */
export default function DriverDashboard({ token, user, onLogout }) {
	// ====== SOCKET ======
	const { socket } = useSocket(token)
	const socketRef = useRef(null)

	// ====== STATE ======
	const [activeSection, setActiveSection] = useState('dashboard')
	const [requests, setRequests] = useState([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState('')
	const [requestMessage, setRequestMessage] = useState('')
	const [gpsStatus, setGpsStatus] = useState('Inactive')
	const [coords, setCoords] = useState(' -- ')
	const [selectedRequestId, setSelectedRequestId] = useState('')
	const [acceptingRequestId, setAcceptingRequestId] = useState('')
	const [newRequestCount, setNewRequestCount] = useState(0)
	const [highlightedRequestId, setHighlightedRequestId] = useState(null)
	const [driverOnline, setDriverOnline] = useState(false)
	const [driverBusy, setDriverBusy] = useState(false)
	const [availabilityLoading, setAvailabilityLoading] = useState(false)
	const [isPickedUpModalOpen, setIsPickedUpModalOpen] = useState(false)
	const [isArrivedAtSchoolModalOpen, setIsArrivedAtSchoolModalOpen] = useState(false)
	const [optimizedRoute, setOptimizedRoute] = useState([])
	const [routeStops, setRouteStops] = useState([])

	// Settings state
	const [savingProfile, setSavingProfile] = useState(false)
	const [profileStatus, setProfileStatus] = useState('')
	const [photoName, setPhotoName] = useState('No file selected')
	const [driverIdName, setDriverIdName] = useState('No file selected')
	const [photoPreview, setPhotoPreview] = useState(null)
	const [driverIdPreview, setDriverIdPreview] = useState(null)
	const [photoFile, setPhotoFile] = useState(null)
	const [driverIdFile, setDriverIdFile] = useState(null)
	const [fileError, setFileError] = useState('')

	// Refs
	const watchIdRef = useRef(null)
	const highlightTimeoutRef = useRef(null)
	const notificationPermissionRef = useRef(null)
	const arrivalRecordedRequestIdsRef = useRef(new Set())

	// Profile data
	const [profileData, setProfileData] = useState(() => {
		const storageKey = `hns_driver_profile_${user.id}`
		const stored = localStorage.getItem(storageKey)
		if (!stored) {
			return {
				...defaultProfile,
				driverPhone: user.phone || '',
				driverAddress: user.homeAddress || '',
			}
		}
		try {
			return JSON.parse(stored)
		} catch {
			return {
				...defaultProfile,
				driverPhone: user.phone || '',
				driverAddress: user.homeAddress || '',
			}
		}
	})

	// ====== COMPUTED VALUES ======
	const searchingRequests = useMemo(
		() => requests.filter((item) => item.status === 'searching'),
		[requests]
	)

	const acceptedRequests = useMemo(
		() =>
			requests.filter(
				(item) => ['accepted', 'arrived', 'picked_up'].includes(item.status) && item.driver?._id === user.id
			),
		[requests, user.id]
	)

	const completedTrips = useMemo(
		() => requests.filter((item) => item.status === 'completed'),
		[requests]
	)

	const selectedTrip = useMemo(
		() => acceptedRequests.find((item) => item._id === selectedRequestId) || null,
		[acceptedRequests, selectedRequestId]
	)

	const summary = useMemo(() => {
		const completed = requests.filter((item) => item.status === 'completed').length
		return {
			incoming: searchingRequests.length,
			active: gpsStatus === 'Active' && selectedTrip ? 1 : acceptedRequests.length,
			completed,
			total: requests.length,
		}
	}, [searchingRequests.length, gpsStatus, selectedTrip, acceptedRequests.length, requests])

	const selectedTripVanPosition = selectedTrip ? asLatLng(selectedTrip.liveLocation) : null
	const selectedTripRequesterPosition = selectedTrip ? asLatLng(selectedTrip.requesterLocation) : null
	const selectedTripDestinationPosition = selectedTrip ? asLatLng(selectedTrip.destinationLocation) : null
	const selectedTripMapTargetPosition =
		selectedTrip?.status === 'picked_up' ? selectedTripDestinationPosition : selectedTripRequesterPosition
	const selectedTripMapCenter = selectedTripVanPosition || selectedTripRequesterPosition || DEFAULT_MAP_CENTER

	const activePickupPins = useMemo(() => {
		return acceptedRequests
			.filter((item) => ['accepted', 'arrived'].includes(item.status))
			.map((item, index) => {
				const position = asLatLng(item.requesterLocation)
				if (!position) return null
				const initial = String(item.parent?.fullName || '')
					.trim()
					.slice(0, 1)
					.toUpperCase() || `${index + 1}`
				return { id: String(item._id), position, label: initial }
			})
			.filter(Boolean)
	}, [acceptedRequests])

	const canMarkPickedUp = useMemo(() => {
		if (!selectedTrip) return false
		if (!['accepted', 'arrived'].includes(selectedTrip.status)) return false
		return gpsStatus === 'Active'
	}, [gpsStatus, selectedTrip])

	const canMarkArrivedAtSchool = useMemo(() => {
		if (!selectedTrip) return false
		if (selectedTrip.status !== 'picked_up') return false
		return gpsStatus === 'Active'
	}, [gpsStatus, selectedTrip])

	// ====== API CALLS ======
	const fetchRequests = async ({ silent = false } = {}) => {
		if (!silent) setLoading(true)
		setError('')
		try {
			const response = await apiFetch('/api/drivers/requests', {
				headers: { Authorization: `Bearer ${token}` },
			})
			setRequests(response.requests || [])
		} catch (requestError) {
			setError(requestError.message || 'Unable to load driver requests right now.')
		} finally {
			if (!silent) setLoading(false)
		}
	}

	const fetchDriverAvailability = async () => {
		try {
			const response = await apiFetch('/api/drivers/status', {
				headers: { Authorization: `Bearer ${token}` },
			})
			setDriverOnline(Boolean(response.status?.isOnline))
			setDriverBusy(Boolean(response.status?.activeRequestId))
		} catch (statusError) {
			setError(statusError.message || 'Unable to load driver availability.')
		}
	}

	const toggleDriverAvailability = async () => {
		setAvailabilityLoading(true)
		setError('')
		try {
			const response = await apiFetch('/api/drivers/status/toggle', {
				method: 'PATCH',
				headers: {
					Authorization: `Bearer ${token}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ isOnline: !driverOnline }),
			})
			setDriverOnline(Boolean(response.status?.isOnline))
			setDriverBusy(Boolean(response.status?.activeRequestId))
		} catch (statusError) {
			setError(statusError.message || 'Unable to update driver availability.')
		} finally {
			setAvailabilityLoading(false)
		}
	}

	const handleChangeSection = (section) => {
		setActiveSection(section)
		if (section === 'requests') {
			setNewRequestCount(0)
		}
	}

	const handleAcceptRequest = async (requestId) => {
		setAcceptingRequestId(requestId)
		setRequestMessage('')
		setError('')
		try {
			await apiFetch(`/api/drivers/requests/${requestId}/accept`, {
				method: 'PATCH',
				headers: { Authorization: `Bearer ${token}` },
			})
			setRequestMessage('Request accepted successfully. It will now appear on your dashboard.')
			setActiveSection('dashboard')
			await fetchRequests({ silent: true })
			await fetchDriverAvailability()
			setSelectedRequestId(requestId)
		} catch (requestError) {
			setError(requestError.message || 'Unable to accept request right now.')
		} finally {
			setAcceptingRequestId('')
		}
	}

	const handleRejectRequest = async (requestId) => {
		setAcceptingRequestId(requestId)
		setRequestMessage('')
		setError('')
		try {
			await apiFetch(`/api/drivers/requests/${requestId}/reject`, {
				method: 'PATCH',
				headers: { Authorization: `Bearer ${token}` },
			})
			setRequestMessage('Request rejected. It remains available to other eligible drivers.')
			await fetchRequests({ silent: true })
			await fetchDriverAvailability()
		} catch (requestError) {
			setError(requestError.message || 'Unable to reject request right now.')
		} finally {
			setAcceptingRequestId('')
		}
	}

	const handleArrivedAtPickup = async (requestId) => {
		setError('')
		setRequestMessage('')
		try {
			await apiFetch(`/api/drivers/requests/${requestId}/arrived`, {
				method: 'PATCH',
				headers: { Authorization: `Bearer ${token}` },
			})
			setRequestMessage('Arrival at pickup recorded. The parent has been notified.')
			await fetchRequests({ silent: true })
		} catch (requestError) {
			setError(requestError.message || 'Unable to record arrival at pickup.')
		}
	}

	// ====== GPS TRACKING ======
	const syncTripLocation = (trackingRequestId, latitude, longitude) => {
		const nextCoords = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
		setCoords(nextCoords)

		apiFetch(`/api/drivers/requests/${trackingRequestId}/location`, {
			method: 'PATCH',
			headers: { Authorization: `Bearer ${token}` },
			body: JSON.stringify({ latitude, longitude }),
		}).catch(() => {
			setError('Location update failed. Please try again.')
		})

		setRequests((current) =>
			current.map((item) =>
				item._id === trackingRequestId
					? {
							...item,
							liveLocation: {
								latitude,
								longitude,
								updatedAt: new Date().toISOString(),
							},
					  }
					: item
			)
		)

		// Auto-mark arrival if close to school
		try {
			if (
				selectedTrip?.status === 'picked_up' &&
				selectedTripDestinationPosition &&
				!arrivalRecordedRequestIdsRef.current.has(trackingRequestId)
			) {
				const dist = distanceInMeters([latitude, longitude], selectedTripDestinationPosition)
				if (Number.isFinite(dist) && dist <= ARRIVED_RADIUS_METERS) {
					arrivalRecordedRequestIdsRef.current.add(trackingRequestId)
					apiFetch(`/api/drivers/requests/${trackingRequestId}/arrived-at-school`, {
						method: 'PATCH',
						headers: { Authorization: `Bearer ${token}` },
					})
						.then(() => {
							setRequestMessage('Arrived at school. Parent has been notified.')
							fetchRequests({ silent: true })
							fetchDriverAvailability()
						})
						.catch((arrivalError) => {
							arrivalRecordedRequestIdsRef.current.delete(trackingRequestId)
							setError(arrivalError.message || 'Unable to record arrival at school.')
						})
				}
			}
		} catch (e) {
			// Ignore
		}
	}

	const startGps = async () => {
		if (!selectedTrip) {
			setError('Accept a parent request first before starting GPS.')
			return
		}
		if (!navigator.geolocation) {
			setError('Geolocation is not supported in this browser.')
			return
		}

		setError('')
		setRequestMessage('')
		setGpsStatus('Preparing')
		setCoords(
			selectedTrip.liveLocation
				? `${selectedTrip.liveLocation.latitude}, ${selectedTrip.liveLocation.longitude}`
				: ' -- '
		)

		if (watchIdRef.current !== null) {
			navigator.geolocation.clearWatch(watchIdRef.current)
			watchIdRef.current = null
		}

		const trackingRequestId = selectedTrip._id
		const geolocationOptions = { enableHighAccuracy: true, maximumAge: 8000, timeout: 10000 }

		navigator.geolocation.getCurrentPosition(
			(position) => {
				const { latitude, longitude } = position.coords
				syncTripLocation(trackingRequestId, latitude, longitude)
				setGpsStatus('Active')

				if (socketRef.current) {
					socketRef.current.emit('gps_started', {
						requestId: trackingRequestId,
						driverId: user.id,
					})
				}
			},
			() => {
				setGpsStatus('Inactive')
				setError('Unable to fetch GPS location. Please allow location permission.')
			},
			geolocationOptions
		)

		watchIdRef.current = navigator.geolocation.watchPosition(
			(position) => {
				const { latitude, longitude } = position.coords
				syncTripLocation(trackingRequestId, latitude, longitude)
				setGpsStatus('Active')
			},
			() => {
				setGpsStatus('Inactive')
				setError('Unable to fetch GPS location. Please allow location permission.')
			},
			geolocationOptions
		)
	}

	const stopGps = () => {
		if (watchIdRef.current !== null) {
			navigator.geolocation.clearWatch(watchIdRef.current)
			watchIdRef.current = null
		}

		setOptimizedRoute([])
		setRouteStops([])

		if (selectedTrip) {
			setRequests((current) =>
				current.map((item) =>
					item._id === selectedTrip._id
						? {
								...item,
								liveLocation: null,
						  }
						: item
				)
			)

			if (socketRef.current) {
				socketRef.current.emit('gps_stopped', {
					requestId: selectedTrip._id,
					driverId: user.id,
				})
			}
		}

		setGpsStatus('Inactive')
		setRequestMessage('GPS tracking stopped. Route cleared.')
		setCoords(' -- ')
	}

	const handlePickedUp = async (requestId) => {
		const resolvedRequestId = String(requestId || '')
		if (!resolvedRequestId) return
		setError('')
		setRequestMessage('')

		try {
			await apiFetch(`/api/drivers/requests/${resolvedRequestId}/picked-up`, {
				method: 'PATCH',
				headers: { Authorization: `Bearer ${token}` },
			})
			setRequestMessage('Marked as picked up. Navigation target switched to school.')
			setIsPickedUpModalOpen(false)
			await fetchRequests({ silent: true })
			if (gpsStatus !== 'Active') {
				startGps().catch(() => {})
			}
		} catch (requestError) {
			setError(requestError.message || 'Unable to mark student as picked up right now.')
		}
	}

	const handleArrivedAtSchool = async (requestId) => {
		const resolvedRequestId = String(requestId || '')
		if (!resolvedRequestId) return
		setError('')
		setRequestMessage('')

		try {
			await apiFetch(`/api/drivers/requests/${resolvedRequestId}/arrived-at-school`, {
				method: 'PATCH',
				headers: { Authorization: `Bearer ${token}` },
			})
			setRequestMessage('Student arrival at school recorded. Parent has been notified.')
			setIsArrivedAtSchoolModalOpen(false)
			await fetchRequests({ silent: true })
			await fetchDriverAvailability()
		} catch (requestError) {
			setError(requestError.message || 'Unable to mark arrival at school right now.')
		}
	}

	// ====== SETTINGS HANDLERS ======
	const updateProfileField = (fieldName, fieldValue) => {
		setProfileData((current) => ({
			...current,
			[fieldName]: fieldValue,
		}))
	}

	const validateAndPreviewFile = (file, fileType = 'photo') => {
		const validPhotoTypes = ['image/jpeg', 'image/png', 'image/jpg']
		const validDriverIdTypes = [...validPhotoTypes, 'application/pdf']
		const validTypes = fileType === 'photo' ? validPhotoTypes : validDriverIdTypes
		const maxSizeInMB = 5
		const maxSizeInBytes = maxSizeInMB * 1024 * 1024

		if (!file) return false
		if (!validTypes.includes(file.type)) {
			const supportedTypes = fileType === 'photo' ? 'JPG, PNG, JPEG' : 'JPG, PNG, JPEG, PDF'
			setFileError(`Invalid file type. Supported types: ${supportedTypes}`)
			return false
		}
		if (file.size > maxSizeInBytes) {
			setFileError(`File size exceeds ${maxSizeInMB}MB limit`)
			return false
		}
		return true
	}

	const handlePhotoChange = (event) => {
		const file = event.target.files?.[0]
		setFileError('')

		if (!file) {
			setPhotoName('No file selected')
			setPhotoPreview(null)
			setPhotoFile(null)
			return
		}

		if (!validateAndPreviewFile(file, 'photo')) {
			event.target.value = ''
			setPhotoName('No file selected')
			setPhotoPreview(null)
			setPhotoFile(null)
			return
		}

		setPhotoName(file.name)
		setPhotoFile(file)
		const previewUrl = URL.createObjectURL(file)
		setPhotoPreview(previewUrl)
	}

	const handleDriverIdChange = (event) => {
		const file = event.target.files?.[0]
		setFileError('')

		if (!file) {
			setDriverIdName('No file selected')
			setDriverIdPreview(null)
			setDriverIdFile(null)
			return
		}

		if (!validateAndPreviewFile(file, 'driverId')) {
			event.target.value = ''
			setDriverIdName('No file selected')
			setDriverIdPreview(null)
			setDriverIdFile(null)
			return
		}

		setDriverIdName(file.name)
		setDriverIdFile(file)
		const previewUrl = URL.createObjectURL(file)
		setDriverIdPreview(previewUrl)
	}

	const saveDriverSettings = async (event) => {
		event.preventDefault()
		setSavingProfile(true)
		setProfileStatus('')
		setError('')

		try {
			await apiFetch('/api/drivers/profile', {
				method: 'PATCH',
				headers: { Authorization: `Bearer ${token}` },
				body: JSON.stringify({
					phone: profileData.driverPhone,
					homeAddress: profileData.driverAddress,
					vehicleType: profileData.vehicleType,
					plateNumber: profileData.plateNumber,
					licenseNumber: profileData.licenseNumber,
				}),
			})

			localStorage.setItem(`hns_driver_profile_${user.id}`, JSON.stringify(profileData))
			setProfileStatus('Driver settings saved successfully.')
		} catch (requestError) {
			setError(requestError.message || 'Unable to save driver settings right now.')
		} finally {
			setSavingProfile(false)
		}
	}

	// ====== SOCKET EVENTS ======
	useEffect(() => {
		socketRef.current = socket

		if (notificationPermissionRef.current === null && token) {
			notificationPermissionRef.current = 'requested'
			registerPushSubscription(token).catch(() => {})
		}
	}, [socket, token])

	const handleTripRequestUpdated = (eventPayload) => {
		const nextRequest = eventPayload?.request
		const nextRequestId = String(nextRequest?._id || '')

		if (!nextRequestId) return
		if (
			['cancelled', 'completed'].includes(nextRequest.status) ||
			nextRequest.rejectedBy?.some((driverId) => String(driverId) === String(user.id))
		) {
			setRequests((current) => current.filter((item) => String(item._id) !== nextRequestId))
			if (String(nextRequest.driver?._id || nextRequest.driver || '') === String(user.id)) {
				fetchDriverAvailability()
			}
			return
		}

		setRequests((current) => {
			const exists = current.some((item) => String(item._id) === nextRequestId)
			if (!exists) {
				return [nextRequest, ...current]
			}
			return current.map((item) =>
				String(item._id) === nextRequestId ? { ...item, ...nextRequest } : item
			)
		})
	}

	const handleTripLocationUpdated = (eventPayload) => {
		const requestId = String(eventPayload?.requestId || '')
		const liveLocation = eventPayload?.liveLocation
		const nextStatus = eventPayload?.status

		if (!requestId || !liveLocation) return

		setRequests((current) =>
			current.map((item) =>
				String(item._id) === requestId
					? {
							...item,
							liveLocation,
							...(nextStatus ? { status: nextStatus } : {}),
					  }
					: item
			)
		)
	}

	const handleNewSearchingRequest = (eventPayload) => {
		const nextRequest = eventPayload?.request

		if (!nextRequest) return

		setRequests((current) => {
			const exists = current.some((item) => String(item._id) === String(nextRequest._id))
			if (exists) return current
			return [nextRequest, ...current]
		})

		setNewRequestCount((prev) => prev + 1)
		setHighlightedRequestId(String(nextRequest._id))

		if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current)
		highlightTimeoutRef.current = setTimeout(() => {
			setHighlightedRequestId(null)
		}, 5000)

		playNotificationSound()
		showBrowserNotification('New Ride Request', {
			body: `${nextRequest.studentName} needs pickup at ${nextRequest.pickupZone}`,
			tag: 'new-request',
		})
	}

	const handleGpsStopped = (eventPayload) => {
		const requestId = String(eventPayload?.requestId || '')
		if (!requestId) return

		setRequests((current) =>
			current.map((item) =>
				item._id === requestId
					? {
							...item,
							liveLocation: null,
					  }
					: item
			)
		)
	}

	const handleTripCompleted = (eventPayload) => {
		const requestId = String(eventPayload?.request?._id || eventPayload?.requestId || '')
		if (!requestId) return
		setRequests((current) => current.filter((item) => String(item._id) !== requestId))
		fetchDriverAvailability()
	}

	useSocketEvent(socket, 'trip:request-updated', handleTripRequestUpdated, [handleTripRequestUpdated])
	useSocketEvent(socket, 'trip:location-updated', handleTripLocationUpdated, [handleTripLocationUpdated])
	useSocketEvent(socket, 'new-searching-request', handleNewSearchingRequest, [handleNewSearchingRequest])
	useSocketEvent(socket, 'gps_stopped', handleGpsStopped, [handleGpsStopped])
	useSocketEvent(socket, 'trip:completed', handleTripCompleted, [handleTripCompleted])

	// ====== EFFECTS ======
	useEffect(() => {
		return () => {
			if (socketRef.current) {
				socketRef.current.off()
				socketRef.current = null
			}
			if (watchIdRef.current !== null) {
				navigator.geolocation.clearWatch(watchIdRef.current)
			}
			if (highlightTimeoutRef.current) {
				clearTimeout(highlightTimeoutRef.current)
			}
		}
	}, [])

	useEffect(() => {
		fetchRequests()
	}, [token])

	useEffect(() => {
		fetchDriverAvailability()
	}, [token])

	useEffect(() => {
		const refreshInterval = setInterval(() => {
			fetchRequests({ silent: true })
		}, 30000)
		return () => clearInterval(refreshInterval)
	}, [token])

	useEffect(() => {
		if (!socketRef.current || acceptedRequests.length === 0) return
		acceptedRequests.forEach((item) => {
			socketRef.current.emit('trip:subscribe', { requestId: item._id })
		})
	}, [acceptedRequests])

	useEffect(() => {
		if (acceptedRequests.length === 0) {
			setSelectedRequestId('')
			return
		}
		if (!selectedRequestId || !acceptedRequests.some((item) => item._id === selectedRequestId)) {
			setSelectedRequestId(acceptedRequests[0]._id)
		}
	}, [acceptedRequests, selectedRequestId])

	useEffect(() => {
		if (acceptedRequests.length === 0) {
			return undefined
		}
		const intervalId = setInterval(() => {
			fetchRequests({ silent: true })
		}, 2000)
		return () => clearInterval(intervalId)
	}, [acceptedRequests.length, token])

	useEffect(() => {
		if (!selectedTripVanPosition || !selectedTripRequesterPosition || !selectedTripDestinationPosition) {
			setOptimizedRoute([])
			setRouteStops([])
			return
		}

		const abortController = new AbortController()

		apiFetch('/api/routing/multi-route', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				start: selectedTripVanPosition,
				pickups: [selectedTripRequesterPosition],
				end: selectedTripDestinationPosition,
			}),
			signal: abortController.signal,
		})
			.then((payload) => {
				const coordinates = payload?.route?.coordinates
				if (!Array.isArray(coordinates) || coordinates.length < 2) {
					setOptimizedRoute([])
				} else {
					setOptimizedRoute(
						coordinates
							.filter((point) => Array.isArray(point) && point.length >= 2)
							.map(([lng, lat]) => [Number(lat), Number(lng)])
					)
				}
				setRouteStops(Array.isArray(payload?.stops) ? payload.stops : [])
			})
			.catch(() => {
				setOptimizedRoute([])
				setRouteStops([])
			})

		return () => abortController.abort()
	}, [selectedTripDestinationPosition, selectedTripRequesterPosition, selectedTripVanPosition, token])

	// ====== RENDER ======
	return (
		<DashboardLayout
			role="driver"
			userName={user.name || 'Driver'}
			currentPage={activeSection}
			onNavigate={handleChangeSection}
			onLogout={onLogout}
			pageTitle={
				activeSection === 'dashboard'
					? 'Driver Dashboard'
					: activeSection === 'requests'
						? 'Requests'
						: 'Settings'
			}
			notificationCount={newRequestCount}
			badgeValues={{ newRequestCount }}
		>
			{activeSection === 'dashboard' ? (
				<>
					{/* Messages */}
					{error && (
						<motion.div
							className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg"
							initial={{ opacity: 0, y: -10 }}
							animate={{ opacity: 1, y: 0 }}
						>
							{error}
						</motion.div>
					)}
					{requestMessage && (
						<motion.div
							className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg"
							initial={{ opacity: 0, y: -10 }}
							animate={{ opacity: 1, y: 0 }}
						>
							{requestMessage}
						</motion.div>
					)}

					{/* Stats Cards */}
					<DriverStatsCards
						incomingCount={summary.incoming}
						activeTripsCount={summary.active}
						completedTripsCount={summary.completed}
						earningsAmount={summary.total}
						isLoading={loading}
					/>

					{/* Live Trip Map Section */}
					<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
						<div className="lg:col-span-1">
							<Card>
								<CardHeader>
									<CardTitle className="text-base">Active Trip</CardTitle>
									<CardDescription>GPS tracking status</CardDescription>
								</CardHeader>
								<CardContent className="space-y-3">
									{selectedTrip ? (
										<>
											<div>
												<p className="text-xs font-medium text-gray-600">Parent</p>
												<p className="font-semibold text-gray-900">
													{selectedTrip.parent?.fullName || 'Parent'}
												</p>
											</div>
											<div>
												<p className="text-xs font-medium text-gray-600">Pickup</p>
												<p className="font-semibold text-gray-900">{selectedTrip.pickupZone}</p>
											</div>
											<div>
												<p className="text-xs font-medium text-gray-600">School destination</p>
												<p className="font-semibold text-gray-900">{selectedTrip.schoolName || 'Not provided'}</p>
											</div>
											<div>
												<p className="text-xs font-medium text-gray-600">Status</p>
												<p
													className={`font-semibold ${
														gpsStatus === 'Active' ? 'text-green-600' : 'text-gray-600'
													}`}
												>
													{gpsStatus}
												</p>
											</div>
										</>
									) : (
										<p className="text-sm text-gray-600">Accept a request first</p>
									)}
								</CardContent>
							</Card>
						</div>

						{selectedTrip && (
							<div className="lg:col-span-2">
								<Card>
									<CardHeader>
										<CardTitle className="text-base">Live Location Map</CardTitle>
										<CardDescription>Real-time tracking</CardDescription>
									</CardHeader>
									<CardContent>
										<LiveTripMap
											center={selectedTripMapCenter}
											pickupPosition={selectedTripMapTargetPosition}
											pickupPositions={activePickupPins}
											vanPosition={selectedTripVanPosition}
											plannedRoute={optimizedRoute}
											showRoute={Boolean(
												selectedTripVanPosition &&
													(optimizedRoute.length > 1 || selectedTripMapTargetPosition)
											)}
											routeMode="road"
											height={400}
										/>
									</CardContent>
								</Card>
							</div>
						)}
					</div>

					{/* GPS Controls */}
					<Card>
						<CardHeader>
							<CardTitle className="text-base">GPS Controls</CardTitle>
							<CardDescription>Manage live location tracking</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="flex gap-2 flex-wrap">
								<Button onClick={startGps} disabled={!selectedTrip || gpsStatus === 'Active'}>
									Start GPS
								</Button>
								<Button onClick={stopGps} variant="destructive" disabled={gpsStatus === 'Inactive'}>
									Stop GPS
								</Button>
								<Button
									onClick={() => handleArrivedAtPickup(selectedTrip._id)}
									disabled={!selectedTrip || selectedTrip.status !== 'accepted' || gpsStatus !== 'Active'}
									variant="outline"
								>
									Mark Arrived at Pickup
								</Button>
								<Button
									onClick={() => setIsPickedUpModalOpen(true)}
									disabled={!canMarkPickedUp}
									className="bg-blue-600 hover:bg-blue-700 text-white"
								>
									Mark Picked Up
								</Button>
								<Button
									onClick={() => setIsArrivedAtSchoolModalOpen(true)}
									disabled={!canMarkArrivedAtSchool}
									className="bg-green-600 hover:bg-green-700 text-white"
								>
									Arrived at School
								</Button>
							</div>
						</CardContent>
					</Card>

					{/* Active Trips List */}
					<div className="space-y-4">
						<h3 className="text-lg font-bold text-gray-900">Active Trips</h3>
						{acceptedRequests.length === 0 ? (
							<Card>
								<CardContent className="py-12 text-center">
									<p className="text-gray-600">
										No accepted trips yet. Go to Requests and accept a parent request.
									</p>
								</CardContent>
							</Card>
						) : (
							acceptedRequests.map((trip) => (
								<motion.div
									key={trip._id}
									initial={{ opacity: 0, y: 10 }}
									animate={{ opacity: 1, y: 0 }}
									className="cursor-pointer"
									onClick={() => setSelectedRequestId(trip._id)}
								>
									<Card
										className={`transition-all hover:shadow-lg ${
											selectedRequestId === trip._id ? 'ring-2 ring-blue-500' : ''
										}`}
									>
										<CardHeader className="pb-3">
											<div className="flex justify-between items-start">
												<div>
													<CardTitle className="text-base">
														{trip.parent?.fullName || 'Parent'}
													</CardTitle>
													<CardDescription>{formatDate(trip.createdAt)}</CardDescription>
												</div>
												<span
													className={`px-3 py-1 rounded text-xs font-semibold ${
														trip.status === 'picked_up'
															? 'bg-green-100 text-green-800'
															: 'bg-blue-100 text-blue-800'
													}`}
												>
													{getStatusLabelClass(trip.status)}
												</span>
											</div>
										</CardHeader>
										<CardContent className="grid grid-cols-2 gap-4">
											<div>
												<p className="text-xs font-medium text-gray-600">STUDENT</p>
												<p className="font-semibold text-gray-900">{trip.studentName || 'N/A'}</p>
											</div>
											<div>
												<p className="text-xs font-medium text-gray-600">PICKUP</p>
												<p className="font-semibold text-gray-900">{trip.pickupZone}</p>
											</div>
											<div>
												<p className="text-xs font-medium text-gray-600">SCHOOL</p>
												<p className="font-semibold text-gray-900">{trip.schoolName || 'N/A'}</p>
											</div>
											<div>
												<p className="text-xs font-medium text-gray-600">PHONE</p>
												<p className="font-semibold text-gray-900">{trip.parent?.phone || 'N/A'}</p>
											</div>
										</CardContent>
									</Card>
								</motion.div>
							))
						)}
					</div>

					{/* Modals */}
					{isPickedUpModalOpen && (
						<div
							className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4"
							onClick={() => setIsPickedUpModalOpen(false)}
						>
							<motion.div
								className="bg-white rounded-lg max-w-md w-full max-h-96 overflow-y-auto"
								initial={{ opacity: 0, scale: 0.95 }}
								animate={{ opacity: 1, scale: 1 }}
								onClick={(e) => e.stopPropagation()}
							>
								<div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
									<h3 className="font-bold text-gray-900">Mark Picked Up</h3>
									<button
										onClick={() => setIsPickedUpModalOpen(false)}
										className="text-gray-500 hover:text-gray-700"
									>
										✕
									</button>
								</div>
								<div className="p-4 space-y-3">
									{acceptedRequests.filter((item) =>
										['accepted', 'arrived'].includes(item.status)
									).length === 0 ? (
										<p className="text-gray-600">No active pickup trips.</p>
									) : (
										acceptedRequests
											.filter((item) => ['accepted', 'arrived'].includes(item.status))
											.map((item) => (
												<div
													key={item._id}
													className="border rounded-lg p-3 flex justify-between items-start gap-2"
												>
													<div>
														<p className="font-semibold text-gray-900">
															{item.parent?.fullName || 'Parent'}
														</p>
														<p className="text-sm text-gray-600">Student: {item.studentName}</p>
														<p className="text-sm text-gray-600">Pickup: {item.pickupZone}</p>
													</div>
													<Button
														size="sm"
														onClick={() => {
															handlePickedUp(item._id)
															setIsPickedUpModalOpen(false)
														}}
													>
														Confirm
													</Button>
												</div>
											))
									)}
								</div>
							</motion.div>
						</div>
					)}

					{isArrivedAtSchoolModalOpen && (
						<div
							className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4"
							onClick={() => setIsArrivedAtSchoolModalOpen(false)}
						>
							<motion.div
								className="bg-white rounded-lg max-w-md w-full max-h-96 overflow-y-auto"
								initial={{ opacity: 0, scale: 0.95 }}
								animate={{ opacity: 1, scale: 1 }}
								onClick={(e) => e.stopPropagation()}
							>
								<div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
									<h3 className="font-bold text-gray-900">Confirm Arrival at School</h3>
									<button
										onClick={() => setIsArrivedAtSchoolModalOpen(false)}
										className="text-gray-500 hover:text-gray-700"
									>
										✕
									</button>
								</div>
								<div className="p-4 space-y-3">
									{acceptedRequests.filter((item) => item.status === 'picked_up').length === 0 ? (
										<p className="text-gray-600">No trips in transit.</p>
									) : (
										acceptedRequests
											.filter((item) => item.status === 'picked_up')
											.map((item) => (
												<div
													key={item._id}
													className="border rounded-lg p-3 flex justify-between items-start gap-2"
												>
													<div>
														<p className="font-semibold text-gray-900">
															{item.parent?.fullName || 'Parent'}
														</p>
														<p className="text-sm text-gray-600">Student: {item.studentName}</p>
														<p className="text-sm text-gray-600">School: {item.schoolName}</p>
													</div>
													<Button
														size="sm"
														onClick={() => {
															handleArrivedAtSchool(item._id)
															setIsArrivedAtSchoolModalOpen(false)
														}}
														className="bg-green-600 hover:bg-green-700 text-white"
													>
														Confirm
													</Button>
												</div>
											))
									)}
								</div>
							</motion.div>
						</div>
					)}
				</>
			) : null}

			{activeSection === 'requests' ? (
				<Requests
					requests={requests}
					acceptingRequestId={acceptingRequestId}
					onAcceptRequest={handleAcceptRequest}
					onRejectRequest={handleRejectRequest}
					highlightedRequestId={highlightedRequestId}
					driverOnline={driverOnline}
					driverBusy={driverBusy}
					availabilityLoading={availabilityLoading}
					onToggleAvailability={toggleDriverAvailability}
				/>
			) : null}

			{activeSection === 'settings' ? (
				<DriverSettings
					user={user}
					profileData={profileData}
					photoName={photoName}
					driverIdName={driverIdName}
					photoPreview={photoPreview}
					driverIdPreview={driverIdPreview}
					savingProfile={savingProfile}
					profileStatus={profileStatus}
					fileError={fileError}
					onFieldChange={updateProfileField}
					onPhotoChange={handlePhotoChange}
					onDriverIdChange={handleDriverIdChange}
					onSave={saveDriverSettings}
				/>
			) : null}
		</DashboardLayout>
	)
}
