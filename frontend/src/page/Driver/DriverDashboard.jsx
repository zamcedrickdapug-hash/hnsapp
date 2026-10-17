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
import DriverTripHistory from '../../components/dashboard/driver/DriverTripHistory'
import PaymentLedgerPanel from '../../components/dashboard/PaymentLedgerPanel'
import TripMessages from '../../components/common/TripMessages'
import HelpSupport from '../../components/common/HelpSupport'
import LiveTripMap from '../../components/tracking/LiveTripGoogleMap'
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
	vehicleColor: '',
	seatCapacity: '',
	plateNumber: '',
	licenseNumber: '',
	licenseExpiry: '',
	emergencyContact: '',
	driverAddress: '',
}
const toDateInputValue = (value) => {
	if (!value) return ''
	const datePart = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10)
	return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : ''
}
const DEFAULT_MAP_CENTER = [14.5995, 120.9842]

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
	const [selectedMessageRequestId, setSelectedMessageRequestId] = useState(null)
	const [unreadMessageCount, setUnreadMessageCount] = useState(0)
	const [requests, setRequests] = useState([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState('')
	const [acceptError, setAcceptError] = useState('')
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
	const [isArrivedAtPickupModalOpen, setIsArrivedAtPickupModalOpen] = useState(false)
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
	const [savedPhotoPreview, setSavedPhotoPreview] = useState(null)
	const [photoLoadError, setPhotoLoadError] = useState('')

	useEffect(() => {
		if (activeSection !== 'settings') return undefined

		let isActive = true
		let objectUrl = null
		const controller = new AbortController()
		setSavedPhotoPreview(null)
		setPhotoLoadError('')

		apiFetch('/api/drivers/me/photo', {
			headers: { Authorization: `Bearer ${token}` },
			responseType: 'blob',
			signal: controller.signal,
		})
			.then((blob) => {
				if (!isActive) return
				objectUrl = URL.createObjectURL(blob)
				setSavedPhotoPreview(objectUrl)
			})
			.catch((photoError) => {
				if (!isActive || photoError.name === 'AbortError' || photoError.status === 404) return
				setPhotoLoadError('Unable to load the saved profile photo.')
			})

		return () => {
			isActive = false
			controller.abort()
			if (objectUrl) URL.revokeObjectURL(objectUrl)
		}
	}, [activeSection, token])

	// Refs
	const watchIdRef = useRef(null)
	const activeBookingsRef = useRef([])
	const highlightTimeoutRef = useRef(null)
	const notificationPermissionRef = useRef(null)
	const routeRequestRef = useRef({
		targetKey: '',
		lastRequestedAt: 0,
		lastSuccessfulPosition: null,
		hasRoute: false,
		pending: false,
		requestId: 0,
	})
	const locallyStoppedAfterArrivalRef = useRef('')

	// Profile data
	const [profileData, setProfileData] = useState(() => {
		const storageKey = `hns_driver_profile_${user.id}`
		const stored = localStorage.getItem(storageKey)
		let storedProfile = {}
		try {
			storedProfile = stored ? JSON.parse(stored) : {}
		} catch {
			storedProfile = {}
		}
		return {
			...defaultProfile,
			...storedProfile,
			driverPhone: user.phone || storedProfile.driverPhone || '',
			driverAddress: user.homeAddress || storedProfile.driverAddress || '',
			vehicleColor: user.driver?.vehicleColor ?? storedProfile.vehicleColor ?? '',
			seatCapacity: user.driver?.seatCapacity ?? storedProfile.seatCapacity ?? '',
			licenseExpiry: user.driver?.licenseExpirationDate
				? toDateInputValue(user.driver.licenseExpirationDate)
				: storedProfile.licenseExpiry ?? '',
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
	activeBookingsRef.current = acceptedRequests

	const arrivedAtSchoolRequests = useMemo(
		() =>
			requests.filter(
				(item) => item.status === 'arrived_at_school' && String(item.driver?._id || item.driver || '') === String(user.id)
			),
		[requests, user.id]
	)

	const passengerRequests = useMemo(() => {
		const statusOrder = { accepted: 0, arrived: 1, picked_up: 2, arrived_at_school: 3 }
		return requests
			.filter(
				(item) =>
					['accepted', 'arrived', 'picked_up', 'arrived_at_school'].includes(item.status) &&
					String(item.driver?._id || item.driver || '') === String(user.id)
			)
			.sort((first, second) => {
				const statusDifference = statusOrder[first.status] - statusOrder[second.status]
				if (statusDifference !== 0) return statusDifference
				const firstAcceptedAt = Date.parse(first.acceptedAt || '')
				const secondAcceptedAt = Date.parse(second.acceptedAt || '')
				const firstTime = Number.isNaN(firstAcceptedAt) ? Number.MAX_VALUE : firstAcceptedAt
				const secondTime = Number.isNaN(secondAcceptedAt) ? Number.MAX_VALUE : secondAcceptedAt
				return firstTime - secondTime
			})
	}, [requests, user.id])
	const passengerCount = (request) =>
		Array.isArray(request.students) && request.students.length > 0 ? request.students.length : 1
	const totalPassengerCount = passengerRequests.reduce((total, request) => total + passengerCount(request), 0)
	const onBoardPassengerCount = passengerRequests.reduce(
		(total, request) => total + (request.status === 'picked_up' ? passengerCount(request) : 0),
		0
	)

	const completedTrips = useMemo(
		() => requests.filter((item) => item.status === 'completed'),
		[requests]
	)

	const selectedTrip = useMemo(
		() => acceptedRequests.find((item) => item._id === selectedRequestId) || null,
		[acceptedRequests, selectedRequestId]
	)
	const hasActiveTrip = acceptedRequests.length > 0 || arrivedAtSchoolRequests.length > 0

	const summary = useMemo(() => {
		const completed = requests.filter((item) => item.status === 'completed').length
		return {
			incoming: searchingRequests.length,
			active: gpsStatus === 'Active' && selectedTrip ? 1 : acceptedRequests.length,
			completed,
		}
	}, [searchingRequests.length, gpsStatus, selectedTrip, acceptedRequests.length, requests])

	const mapTrip =
		selectedTrip ||
		arrivedAtSchoolRequests.find((item) => item._id === selectedRequestId) ||
		arrivedAtSchoolRequests[0] ||
		null
	const selectedTripVanPosition = mapTrip ? asLatLng(mapTrip.liveLocation) : null
	const selectedTripRequesterPosition = mapTrip ? asLatLng(mapTrip.requesterLocation) : null
	const selectedTripDestinationPosition = mapTrip ? asLatLng(mapTrip.destinationLocation) : null
	const selectedTripTargetsSchool = ['picked_up', 'arrived_at_school'].includes(mapTrip?.status)
	const selectedTripMapTargetPosition =
		selectedTripTargetsSchool ? selectedTripDestinationPosition : selectedTripRequesterPosition
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

	const canMarkPickedUp = useMemo(
		() => acceptedRequests.some((item) => item.status === 'arrived'),
		[acceptedRequests]
	)

	const canMarkArrivedAtSchool = useMemo(
		() => acceptedRequests.some((item) => item.status === 'picked_up'),
		[acceptedRequests]
	)

	const canMarkArrivedAtPickup = useMemo(
		() => acceptedRequests.some((item) => item.status === 'accepted'),
		[acceptedRequests]
	)

	// ====== API CALLS ======
	const fetchRequests = async ({ silent = false } = {}) => {
		if (!silent) setLoading(true)
		setError('')
		setAcceptError('')
		try {
			const response = await apiFetch('/api/drivers/requests', {
				headers: { Authorization: `Bearer ${token}` },
			})
			const nextRequests = response.requests || []
			setRequests(nextRequests)
			return nextRequests
		} catch (requestError) {
			setError(requestError.message || 'Unable to load driver requests right now.')
			return null
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
		setAcceptError('')
		setRequestMessage('')
		setError('')
		try {
			await apiFetch(`/api/drivers/requests/${requestId}/accept`, {
				method: 'PATCH',
				headers: { Authorization: `Bearer ${token}` },
			})
			setAcceptError('')
			setRequestMessage('Request accepted successfully. It will now appear on your dashboard.')
			setActiveSection('dashboard')
			await fetchRequests({ silent: true })
			await fetchDriverAvailability()
			setSelectedRequestId(requestId)
		} catch (requestError) {
			setAcceptError(requestError.message || 'Unable to accept request right now.')
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
			setIsArrivedAtPickupModalOpen(false)
			await fetchRequests({ silent: true })
		} catch (requestError) {
			setError(requestError.message || 'Unable to record arrival at pickup.')
		}
	}

	// ====== GPS TRACKING ======
	const getTrackingRequest = () => {
		const statusOrder = { accepted: 0, arrived: 1, picked_up: 2 }
		return [...activeBookingsRef.current].sort((first, second) => {
			const statusDifference = statusOrder[first.status] - statusOrder[second.status]
			if (statusDifference !== 0) return statusDifference
			const firstAcceptedAt = Date.parse(first.acceptedAt || '')
			const secondAcceptedAt = Date.parse(second.acceptedAt || '')
			const firstTime = Number.isNaN(firstAcceptedAt) ? Number.MAX_VALUE : firstAcceptedAt
			const secondTime = Number.isNaN(secondAcceptedAt) ? Number.MAX_VALUE : secondAcceptedAt
			return firstTime - secondTime || String(first._id).localeCompare(String(second._id))
		})[0] || null
	}

	const stopGpsLocally = () => {
		if (watchIdRef.current !== null) {
			navigator.geolocation.clearWatch(watchIdRef.current)
			watchIdRef.current = null
		}
		setGpsStatus('Inactive')
	}

	const syncTripLocation = (latitude, longitude) => {
		const trackingRequest = getTrackingRequest()
		if (!trackingRequest) {
			stopGpsLocally()
			return ''
		}
		const trackingRequestId = String(trackingRequest._id)
		const nextCoords = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
		setCoords(nextCoords)

		apiFetch(`/api/drivers/requests/${trackingRequestId}/location`, {
			method: 'PATCH',
			headers: { Authorization: `Bearer ${token}` },
			body: JSON.stringify({ latitude, longitude }),
		}).catch(() => {
			if (getTrackingRequest()) {
				setError('Location update failed. Please try again.')
			} else {
				stopGpsLocally()
			}
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
		return trackingRequestId
	}

	const startGps = async () => {
		const trackingRequest = getTrackingRequest()
		if (!trackingRequest) {
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
			trackingRequest.liveLocation
				? `${trackingRequest.liveLocation.latitude}, ${trackingRequest.liveLocation.longitude}`
				: ' -- '
		)

		if (watchIdRef.current !== null) {
			navigator.geolocation.clearWatch(watchIdRef.current)
			watchIdRef.current = null
		}

		const geolocationOptions = { enableHighAccuracy: true, maximumAge: 8000, timeout: 10000 }

		navigator.geolocation.getCurrentPosition(
			(position) => {
				const { latitude, longitude } = position.coords
				const trackingRequestId = syncTripLocation(latitude, longitude)
				if (!trackingRequestId) return
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
				if (syncTripLocation(latitude, longitude)) {
					setGpsStatus('Active')
				}
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

	const handleCompleteSchoolRun = async () => {
		setError('')
		setRequestMessage('')
		try {
			const response = await apiFetch('/api/drivers/requests/complete-school-run', {
				method: 'PATCH',
				headers: { Authorization: `Bearer ${token}` },
			})
			const refreshedRequests = await fetchRequests({ silent: true })
			await fetchDriverAvailability()
			setRequestMessage(response.message || 'School run completed successfully.')
			if (
				refreshedRequests &&
				!refreshedRequests.some(
					(item) =>
						['accepted', 'arrived', 'picked_up'].includes(item.status) &&
						String(item.driver?._id || item.driver || '') === String(user.id)
				)
			) {
				stopGpsLocally()
			}
		} catch (requestError) {
			setError(requestError.message || 'Unable to complete school run right now.')
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
			const body = {
				phone: profileData.driverPhone,
				homeAddress: profileData.driverAddress,
				vehicleType: profileData.vehicleType,
				plateNumber: profileData.plateNumber,
				licenseNumber: profileData.licenseNumber,
			}
			if (String(profileData.vehicleColor || '').trim()) {
				body.vehicleColor = profileData.vehicleColor
			}
			if (String(profileData.seatCapacity ?? '').trim()) {
				body.seatCapacity = profileData.seatCapacity
			}
			if (profileData.licenseExpiry) {
				body.licenseExpiry = profileData.licenseExpiry
			}

			const response = await apiFetch('/api/drivers/profile', {
				method: 'PATCH',
				headers: { Authorization: `Bearer ${token}` },
				body: JSON.stringify(body),
			})

			const savedProfileData = {
				...profileData,
				driverPhone: response.user?.phone ?? profileData.driverPhone,
				driverAddress: response.user?.homeAddress ?? profileData.driverAddress,
				vehicleType: response.user?.driver?.vehicleType ?? profileData.vehicleType,
				vehicleColor: response.user?.driver?.vehicleColor ?? '',
				seatCapacity: response.user?.driver?.seatCapacity ?? '',
				licenseExpiry: toDateInputValue(response.user?.driver?.licenseExpirationDate),
				plateNumber: response.user?.driver?.plateNumber ?? profileData.plateNumber,
				licenseNumber: response.user?.driver?.licenseNumber ?? profileData.licenseNumber,
			}
			setProfileData(savedProfileData)
			localStorage.setItem(`hns_driver_profile_${user.id}`, JSON.stringify(savedProfileData))
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
		const arrivalPhase = selectedTrip?.status === 'arrived'
			? 'pickup'
			: selectedTrip?.status === 'arrived_at_school'
				? 'school'
				: ''
		if (!arrivalPhase) {
			locallyStoppedAfterArrivalRef.current = ''
			return
		}

		const arrivalKey = `${selectedTrip._id}:${arrivalPhase}`
		if (
			locallyStoppedAfterArrivalRef.current === arrivalKey ||
			!['Active', 'Preparing'].includes(gpsStatus)
		) return

		locallyStoppedAfterArrivalRef.current = arrivalKey
		stopGpsLocally()
	}, [selectedTrip?._id, selectedTrip?.status, gpsStatus])

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
		if (
			!selectedTrip ||
			gpsStatus !== 'Active' ||
			!selectedTripVanPosition ||
			!selectedTripMapTargetPosition
		) {
			routeRequestRef.current = {
				targetKey: '',
				lastRequestedAt: 0,
				lastSuccessfulPosition: null,
				hasRoute: false,
				pending: false,
				requestId: routeRequestRef.current.requestId + 1,
			}
			setOptimizedRoute((current) => (current.length ? [] : current))
			setRouteStops((current) => (current.length ? [] : current))
			return
		}

		const targetPhase = ['picked_up', 'arrived_at_school'].includes(selectedTrip.status) ? 'school' : 'pickup'
		const targetKey = `${selectedTrip._id}:${targetPhase}:${selectedTripMapTargetPosition[0]},${selectedTripMapTargetPosition[1]}`
		const routeState = routeRequestRef.current
		const targetChanged = routeState.targetKey !== targetKey
		if (targetChanged) {
			routeState.targetKey = targetKey
			routeState.lastRequestedAt = 0
			routeState.lastSuccessfulPosition = null
			routeState.hasRoute = false
			routeState.pending = false
		}

		const now = Date.now()
		const elapsedSinceRequest = now - routeState.lastRequestedAt
		const movedSinceSuccess = routeState.lastSuccessfulPosition
			? distanceInMeters(routeState.lastSuccessfulPosition, selectedTripVanPosition)
			: 0
		const shouldRequestRoute =
			targetChanged ||
			(!routeState.pending &&
				(elapsedSinceRequest >= 15000 &&
					(!routeState.hasRoute || movedSinceSuccess >= 100)))

		if (!shouldRequestRoute || routeState.pending) return

		routeState.lastRequestedAt = now
		routeState.pending = true
		const requestId = routeState.requestId + 1
		routeState.requestId = requestId
		const requestPosition = selectedTripVanPosition

		apiFetch('/api/routing/route', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				start: selectedTripVanPosition,
				end: selectedTripMapTargetPosition,
			}),
		})
			.then((payload) => {
				if (
					routeRequestRef.current.requestId !== requestId ||
					routeRequestRef.current.targetKey !== targetKey
				) return

				const coordinates = payload?.route?.coordinates
				const route = Array.isArray(coordinates)
					? coordinates
							.filter((point) => Array.isArray(point) && point.length >= 2)
							.map(([lng, lat]) => [Number(lat), Number(lng)])
							.filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng))
					: []
				if (route.length < 2) {
					routeRequestRef.current.pending = false
					routeRequestRef.current.hasRoute = false
					setOptimizedRoute([requestPosition, selectedTripMapTargetPosition])
					setRouteStops([])
				} else {
					routeRequestRef.current.pending = false
					routeRequestRef.current.hasRoute = true
					routeRequestRef.current.lastSuccessfulPosition = requestPosition
					setOptimizedRoute(route)
					setRouteStops([])
				}
			})
			.catch(() => {
				if (
					routeRequestRef.current.requestId !== requestId ||
					routeRequestRef.current.targetKey !== targetKey
				) return

				routeRequestRef.current.pending = false
				routeRequestRef.current.hasRoute = false
				setOptimizedRoute([requestPosition, selectedTripMapTargetPosition])
				setRouteStops([])
			})

	}, [
		selectedTrip?._id,
		selectedTrip?.status,
		selectedTrip?.liveLocation?.latitude,
		selectedTrip?.liveLocation?.longitude,
		selectedTrip?.requesterLocation?.latitude,
		selectedTrip?.requesterLocation?.longitude,
		selectedTrip?.destinationLocation?.latitude,
		selectedTrip?.destinationLocation?.longitude,
		gpsStatus,
		token,
	])

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
						: activeSection === 'messages'
							? 'Messages'
							: activeSection === 'trips'
								? 'Trip History'
								: activeSection === 'payments'
									? 'Payments'
									: activeSection === 'help'
										? 'Help & Support'
										: 'Settings'
			}
			notificationCount={newRequestCount}
			badgeValues={{ newRequestCount, unreadMessageCount }}
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
												<p className="text-sm font-medium text-on-dark-label">Parent</p>
												<p className="font-semibold text-on-dark-primary">
													{selectedTrip.parent?.fullName || 'Parent'}
												</p>
											</div>
											<div>
												<p className="text-sm font-medium text-on-dark-label">Pickup</p>
												<p className="font-semibold text-on-dark-primary">{selectedTrip.pickupZone}</p>
											</div>
											<div>
												<p className="text-sm font-medium text-on-dark-label">School destination</p>
												<p className="font-semibold text-on-dark-primary">{selectedTrip.schoolName || 'Not provided'}</p>
											</div>
											<div>
												<p className="text-sm font-medium text-on-dark-label">Status</p>
												<p
													className={`font-semibold ${
														gpsStatus === 'Active' ? 'text-green-300' : 'text-on-dark-label'
													}`}
												>
													{gpsStatus}
												</p>
											</div>
											<Button
												size="sm"
												onClick={() => {
													setSelectedMessageRequestId(String(selectedTrip._id))
													setActiveSection('messages')
												}}
												className="bg-blue-600 text-white hover:bg-blue-700"
											>
												Message parent
											</Button>
										</>
									) : (
										<p className="text-sm text-on-dark-label">Accept a request first</p>
									)}
								</CardContent>
							</Card>
						</div>

						{mapTrip && (
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
												mapTrip.status !== 'arrived_at_school' &&
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

					{/* Passengers */}
					<Card>
						<CardHeader>
							<div className="flex flex-wrap items-center justify-between gap-2">
								<CardTitle className="text-base">Passengers</CardTitle>
								<p className="text-sm font-semibold text-on-dark-label">
									On board: {onBoardPassengerCount} / Total: {totalPassengerCount}
								</p>
							</div>
						</CardHeader>
						<CardContent className="space-y-3">
							{passengerRequests.length === 0 ? (
								<p className="text-sm text-on-dark-label">No passengers yet.</p>
							) : (
								passengerRequests.map((item) => {
									const statusLabels = {
										accepted: { label: 'On the way', className: 'bg-gray-100 text-gray-700' },
										arrived: { label: 'Waiting at pickup', className: 'bg-amber-100 text-amber-800' },
										picked_up: { label: 'On board', className: 'bg-green-100 text-green-800' },
										arrived_at_school: { label: 'At school', className: 'bg-blue-100 text-blue-800' },
									}
									const status = statusLabels[item.status]
									return (
										<div
											key={item._id}
											className="flex min-w-0 items-center justify-between gap-3 rounded-lg border p-3"
										>
											<div className="min-w-0 flex-1">
												{Array.isArray(item.students) && item.students.length > 0 ? (
													<ul className="text-sm font-semibold text-on-dark-primary">
														{item.students.map((student, index) => (
															<li key={`${student.studentName}-${index}`}>
																{student.studentName || 'Student'}
																{student.gradeLevel ? ` - ${student.gradeLevel}` : ''}
															</li>
														))}
													</ul>
												) : (
													<p className="truncate text-sm font-semibold text-on-dark-primary">
														{item.studentName || 'Student'}
													</p>
												)}
												<p className="truncate text-sm text-on-dark-label">
													{item.parent?.fullName || 'Parent'}
												</p>
												<p className="truncate text-sm text-on-dark-label">{item.pickupZone || 'Pickup not provided'}</p>
											</div>
											<span
												className={`shrink-0 rounded px-2 py-1 text-sm font-semibold ${status.className}`}
											>
												{status.label}
											</span>
										</div>
									)
								})
							)}
						</CardContent>
					</Card>

					{/* GPS Controls */}
					{hasActiveTrip ? (
					<Card>
						<CardHeader>
							<CardTitle className="text-base">GPS Controls</CardTitle>
							<CardDescription>Manage live location tracking</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
								<Button className="w-full min-h-[44px] sm:w-auto" onClick={startGps} disabled={acceptedRequests.length === 0 || gpsStatus === 'Active'}>
									Start GPS
								</Button>
								<Button className="w-full min-h-[44px] sm:w-auto" onClick={stopGps} variant="destructive" disabled={gpsStatus === 'Inactive'}>
									Stop GPS
								</Button>
								<Button
									className="w-full min-h-[44px] sm:w-auto"
									onClick={() => {
										const acceptedBookings = acceptedRequests.filter((item) => item.status === 'accepted')
										if (acceptedBookings.length === 1) {
											handleArrivedAtPickup(acceptedBookings[0]._id)
										} else {
											setIsArrivedAtPickupModalOpen(true)
										}
									}}
									disabled={!canMarkArrivedAtPickup}
									variant="outline"
								>
									Mark Arrived at Pickup
								</Button>
								<Button
									className="w-full min-h-[44px] sm:w-auto bg-blue-600 hover:bg-blue-700 text-white"
									onClick={() => setIsPickedUpModalOpen(true)}
									disabled={!canMarkPickedUp}
								>
									Mark Picked Up
								</Button>
								<Button
									className="w-full min-h-[44px] sm:w-auto bg-green-600 hover:bg-green-700 text-white"
									onClick={() => setIsArrivedAtSchoolModalOpen(true)}
									disabled={!canMarkArrivedAtSchool}
								>
									Arrived at School
								</Button>
								<Button
									className="col-span-2 w-full min-h-[44px] sm:col-span-1 sm:w-auto bg-purple-600 hover:bg-purple-700 text-white"
									onClick={handleCompleteSchoolRun}
									disabled={arrivedAtSchoolRequests.length === 0}
								>
									Complete School Run
								</Button>
							</div>
						</CardContent>
					</Card>
					) : (
						<Card>
							<CardHeader>
								<CardTitle className="text-base">GPS Controls</CardTitle>
								<CardDescription>Manage live location tracking</CardDescription>
							</CardHeader>
							<CardContent>
								<p className="text-sm text-on-dark-label">Accept a request first to use GPS controls.</p>
							</CardContent>
						</Card>
					)}

					{/* Active Trips List */}
					<div className="space-y-4">
						<h3 className="text-lg font-bold text-on-dark-primary">Active Trips</h3>
						{acceptedRequests.length === 0 ? (
							<Card>
								<CardContent className="py-12 text-center">
									<p className="text-on-dark-label">
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
													className={`px-3 py-1 rounded text-sm font-semibold ${
														trip.status === 'picked_up'
															? 'bg-green-100 text-green-800'
															: 'bg-blue-100 text-blue-800'
													}`}
												>
													{trip.status === 'arrived'
														? 'Arrived at pickup'
														: trip.status === 'arrived_at_school'
															? 'At school'
															: trip.status === 'completed'
																? 'Completed'
																: getStatusLabelClass(trip.status)}
												</span>
											</div>
										</CardHeader>
										<CardContent className="grid grid-cols-2 gap-4">
											<div>
												<p className="text-sm font-medium text-on-dark-label">STUDENT</p>
												<p className="font-semibold text-on-dark-primary">{trip.studentName || 'N/A'}</p>
											</div>
											<div>
												<p className="text-sm font-medium text-on-dark-label">PICKUP</p>
												<p className="font-semibold text-on-dark-primary">{trip.pickupZone}</p>
											</div>
											<div>
												<p className="text-sm font-medium text-on-dark-label">SCHOOL</p>
												<p className="font-semibold text-on-dark-primary">{trip.schoolName || 'N/A'}</p>
											</div>
											<div>
												<p className="text-sm font-medium text-on-dark-label">PHONE</p>
												<p className="font-semibold text-on-dark-primary">{trip.parent?.phone || 'N/A'}</p>
											</div>
										</CardContent>
									</Card>
								</motion.div>
							))
						)}
					</div>

					{/* Modals */}
					{isArrivedAtPickupModalOpen && (
						<div
							className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4"
							onClick={() => setIsArrivedAtPickupModalOpen(false)}
						>
							<motion.div
								className="bg-white rounded-lg max-w-md w-full max-h-96 overflow-y-auto"
								initial={{ opacity: 0, scale: 0.95 }}
								animate={{ opacity: 1, scale: 1 }}
								onClick={(e) => e.stopPropagation()}
							>
								<div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
									<h3 className="font-bold text-gray-900">Mark Arrived at Pickup</h3>
									<button
										onClick={() => setIsArrivedAtPickupModalOpen(false)}
										className="text-gray-500 hover:text-gray-700"
									>
										✕
									</button>
								</div>
								<div className="p-4 space-y-3">
									{acceptedRequests.filter((item) => item.status === 'accepted').length === 0 ? (
										<p className="text-gray-600">No bookings awaiting pickup arrival.</p>
									) : (
										acceptedRequests
											.filter((item) => item.status === 'accepted')
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
														onClick={() => handleArrivedAtPickup(item._id)}
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
									{acceptedRequests.filter((item) => item.status === 'arrived').length === 0 ? (
										<p className="text-gray-600">No bookings awaiting pickup.</p>
									) : (
										acceptedRequests
											.filter((item) => item.status === 'arrived')
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
					acceptError={acceptError}
					onAcceptRequest={handleAcceptRequest}
					onRejectRequest={handleRejectRequest}
					highlightedRequestId={highlightedRequestId}
					driverOnline={driverOnline}
					driverBusy={driverBusy}
					availabilityLoading={availabilityLoading}
					onToggleAvailability={toggleDriverAvailability}
				/>
			) : null}

			{activeSection === 'trips' ? (
				<DriverTripHistory
					token={token}
					onMessageParent={(requestId) => {
						setSelectedMessageRequestId(String(requestId))
						setActiveSection('messages')
					}}
				/>
			) : null}

			{activeSection === 'payments' ? (
				<PaymentLedgerPanel role="driver" token={token} user={user} />
			) : null}

			{activeSection === 'settings' ? (
				<DriverSettings
					user={user}
					profileData={profileData}
					photoName={photoName}
					driverIdName={driverIdName}
					photoPreview={photoPreview}
					savedPhotoPreview={savedPhotoPreview}
					photoLoadError={photoLoadError}
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
			<div className={activeSection === 'messages' ? '' : 'hidden'}>
				<TripMessages
					role="driver"
					token={token}
					socket={socket}
					activeRequestId={selectedMessageRequestId || (
						activeSection === 'messages' ? selectedTrip?._id : null
					)}
					activeRequest={selectedTrip}
					onUnreadCount={setUnreadMessageCount}
				/>
			</div>
			{activeSection === 'help' ? <HelpSupport role="driver" /> : null}
		</DashboardLayout>
	)
}
