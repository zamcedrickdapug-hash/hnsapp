import { useEffect, useMemo, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { apiFetch } from '../../api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import LiveTripMap from '../../components/tracking/LiveTripMap'
import Sidenavbar from './Sidenavbar'
import Requests from './Requests'
import DriverSettings from './DriverSettings'
import './DriverDashboard.scss'

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

function formatDate(dateValue) {
	if (!dateValue) {
		return 'N/A'
	}

	return new Date(dateValue).toLocaleString()
}

function getStatusLabelClass(status) {
	if (status === 'accepted') {
		return 'active'
	}

	if (status === 'completed') {
		return 'completed'
	}

	if (status === 'cancelled') {
		return 'cancelled'
	}

	return 'pending'
}

function formatLocation(location) {
	if (!location || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) {
		return 'No requester location'
	}

	return `${Number(location.latitude).toFixed(6)}, ${Number(location.longitude).toFixed(6)}`
}

function buildMapLink(location) {
	if (!location || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) {
		return ''
	}

	return `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`
}

function asLatLng(location) {
	const latitude = Number(location?.latitude)
	const longitude = Number(location?.longitude)

	if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
		return null
	}

	return [latitude, longitude]
}

function distanceInMeters(first, second) {
	if (!Array.isArray(first) || !Array.isArray(second) || first.length < 2 || second.length < 2) return Infinity
	const lat1 = Number(first[0])
	const lon1 = Number(first[1])
	const lat2 = Number(second[0])
	const lon2 = Number(second[1])
	if (![lat1, lon1, lat2, lon2].every((value) => Number.isFinite(value))) return Infinity

	const R = 6371000
	const toRad = (deg) => (deg * Math.PI) / 180
	const dLat = toRad(lat2 - lat1)
	const dLon = toRad(lon2 - lon1)
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
	return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default function DriverDashboard({ token, user, onLogout }) {
	const socketRef = useRef(null)
	const [activeSection, setActiveSection] = useState('dashboard')
	const [requests, setRequests] = useState([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState('')
	const [gpsStatus, setGpsStatus] = useState('Inactive')
	const [coords, setCoords] = useState(' -- ')
	const [selectedRequestId, setSelectedRequestId] = useState('')
	const [acceptingRequestId, setAcceptingRequestId] = useState('')
	const [requestMessage, setRequestMessage] = useState('')
	const [savingProfile, setSavingProfile] = useState(false)
	const [profileStatus, setProfileStatus] = useState('')
	const [photoName, setPhotoName] = useState('No file selected')
	const [driverIdName, setDriverIdName] = useState('No file selected')
	const watchIdRef = useRef(null)

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

	const fetchRequests = async ({ silent = false } = {}) => {
		if (!silent) {
			setLoading(true)
		}
		setError('')

		try {
			const response = await apiFetch('/api/driver/requests', {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			})

			setRequests(response.requests || [])
		} catch (requestError) {
			setError(requestError.message || 'Unable to load driver requests right now.')
		} finally {
			if (!silent) {
				setLoading(false)
			}
		}
	}

	useEffect(() => {
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

		return () => {
			socket.disconnect()
			socketRef.current = null
		}
	}, [token])

	useEffect(() => {
		return () => {
			if (watchIdRef.current !== null) {
				navigator.geolocation.clearWatch(watchIdRef.current)
			}
		}
	}, [])

	const searchingRequests = useMemo(
		() => requests.filter((item) => item.status === 'searching'),
		[requests],
	)

	const acceptedRequests = useMemo(
		() =>
			requests.filter(
				(item) => ['accepted', 'arrived', 'picked_up'].includes(item.status) && item.driver?._id === user.id,
			),
		[requests, user.id],
	)

	useEffect(() => {
		if (!socketRef.current || acceptedRequests.length === 0) {
			return
		}

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

	const selectedTrip = useMemo(
		() => acceptedRequests.find((item) => item._id === selectedRequestId) || null,
		[acceptedRequests, selectedRequestId],
	)

	const SCHOOL_LOCATION = useMemo(() => [14.81298106386082, 121.07158042431617], [])
	const selectedTripRequesterPosition = useMemo(() => asLatLng(selectedTrip?.requesterLocation), [selectedTrip])
	const selectedTripVanPosition = useMemo(() => asLatLng(selectedTrip?.liveLocation), [selectedTrip])
	const selectedTripDestinationPosition = useMemo(
		() => (selectedTrip?.status === 'picked_up' ? SCHOOL_LOCATION : selectedTripRequesterPosition),
		[selectedTrip?.status, SCHOOL_LOCATION, selectedTripRequesterPosition],
	)
	const selectedTripMapCenter = selectedTripVanPosition || selectedTripRequesterPosition || DEFAULT_MAP_CENTER

	useEffect(() => {
		if (acceptedRequests.length === 0) {
			return undefined
		}

		const intervalId = setInterval(() => {
			fetchRequests({ silent: true })
		}, 2000)

		return () => clearInterval(intervalId)
	}, [acceptedRequests.length, token])

	const summary = useMemo(() => {
		const completed = requests.filter((item) => item.status === 'completed').length
		return {
			incoming: searchingRequests.length,
			active: gpsStatus === 'Active' && selectedTrip ? 1 : acceptedRequests.length,
			completed,
			total: requests.length,
		}
	}, [searchingRequests.length, gpsStatus, selectedTrip, acceptedRequests.length, requests])

	const updateProfileField = (fieldName, fieldValue) => {
		setProfileData((current) => ({
			...current,
			[fieldName]: fieldValue,
		}))
	}

	const handleAcceptRequest = async (requestId) => {
		setAcceptingRequestId(requestId)
		setRequestMessage('')
		setError('')

		try {
			await apiFetch(`/api/driver/requests/${requestId}/accept`, {
				method: 'PATCH',
				headers: {
					Authorization: `Bearer ${token}`,
				},
			})

			setRequestMessage('Request accepted successfully. It will now appear on your dashboard.')
			setActiveSection('dashboard')
			await fetchRequests({ silent: true })
			setSelectedRequestId(requestId)
		} catch (requestError) {
			setError(requestError.message || 'Unable to accept request right now.')
		} finally {
			setAcceptingRequestId('')
		}
	}

	const syncTripLocation = (trackingRequestId, latitude, longitude) => {
		const nextCoords = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
		setCoords(nextCoords)

		apiFetch(`/api/driver/requests/${trackingRequestId}/location`, {
			method: 'PATCH',
			headers: {
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify({
				latitude,
				longitude,
			}),
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
					: item,
			),
		)
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
		setGpsStatus('Preparing')
		setCoords(
			selectedTrip.liveLocation
				? `${selectedTrip.liveLocation.latitude}, ${selectedTrip.liveLocation.longitude}`
				: ' -- ',
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
			},
			() => {
				setGpsStatus('Inactive')
				setError('Unable to fetch GPS location. Please allow location permission.')
			},
			geolocationOptions,
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
			geolocationOptions,
		)
	}

	const stopGps = () => {
		if (watchIdRef.current !== null) {
			navigator.geolocation.clearWatch(watchIdRef.current)
			watchIdRef.current = null
		}

		setGpsStatus('Inactive')
	}

	const canMarkPickedUp = useMemo(() => {
		if (!selectedTrip) return false
		if (selectedTrip.status !== 'arrived') return false
		if (gpsStatus !== 'Active') return false
		const driverPos = selectedTripVanPosition
		const pickupPos = selectedTripRequesterPosition
		if (!driverPos || !pickupPos) return false
		return distanceInMeters(driverPos, pickupPos) <= 60
	}, [gpsStatus, selectedTrip, selectedTripRequesterPosition, selectedTripVanPosition])

	const handlePickedUp = async () => {
		if (!selectedTrip) return
		setError('')
		setRequestMessage('')

		try {
			await apiFetch(`/api/driver/requests/${selectedTrip._id}/picked-up`, {
				method: 'PATCH',
				headers: {
					Authorization: `Bearer ${token}`,
				},
			})

			setRequestMessage('Marked as picked up. Navigation target switched to school.')
			await fetchRequests({ silent: true })
		} catch (requestError) {
			setError(requestError.message || 'Unable to mark student as picked up right now.')
		}
	}

	const saveDriverSettings = async (event) => {
		event.preventDefault()
		setSavingProfile(true)
		setProfileStatus('')
		setError('')

		try {
			await apiFetch('/api/driver/profile', {
				method: 'PATCH',
				headers: {
					Authorization: `Bearer ${token}`,
				},
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

	return (
		<section className="driver-shell">
			<Sidenavbar
				user={user}
				activeSection={activeSection}
				onChangeSection={setActiveSection}
				onLogout={onLogout}
			/>

			<div className="driver-main">
				{activeSection === 'dashboard' ? (
					<>
						<header className="driver-main__header">
							<h1>Driver Dashboard</h1>
							<p>Track your accepted parent requests and share live location updates.</p>
						</header>

						<section className="driver-stats-grid">
							<Card>
								<CardHeader>
									<CardTitle>{summary.incoming}</CardTitle>
									<CardDescription>Incoming Requests</CardDescription>
								</CardHeader>
							</Card>
							<Card>
								<CardHeader>
									<CardTitle>{summary.active}</CardTitle>
									<CardDescription>Active Trips</CardDescription>
								</CardHeader>
							</Card>
							<Card>
								<CardHeader>
									<CardTitle>{summary.completed}</CardTitle>
									<CardDescription>Completed</CardDescription>
								</CardHeader>
							</Card>
							<Card>
								<CardHeader>
									<CardTitle>{summary.total}</CardTitle>
									<CardDescription>Total</CardDescription>
								</CardHeader>
							</Card>
						</section>

						<Card>
							<CardHeader className="driver-section-head">
								<div>
									<CardTitle>Live Trip Location</CardTitle>
									<CardDescription>
										Show and update current location of your accepted parent request.
									</CardDescription>
								</div>
								<span className={`driver-pill ${gpsStatus === 'Active' ? 'driver-pill--active' : 'driver-pill--inactive'}`}>
									{gpsStatus}
								</span>
							</CardHeader>

							<CardContent className="driver-gps-grid">
								<div>
									<h4>Accepted Request</h4>
									<p>{selectedTrip ? selectedTrip.parent?.fullName || 'Parent Request' : '--'}</p>
									<small>{selectedTrip ? `Pickup: ${selectedTrip.pickupZone}` : 'Accept a request first in Requests tab.'}</small>
									<div className="driver-gps-actions">
										<Button onClick={startGps} disabled={!selectedTrip}>
											Start GPS
										</Button>
										<Button variant="destructive" onClick={stopGps}>
											Stop GPS
										</Button>
										<Button
											variant="secondary"
											onClick={handlePickedUp}
											disabled={!canMarkPickedUp}
										>
											Picked up student
										</Button>
									</div>
								</div>

								<div>
									<h4>Current Coordinates</h4>
									<p>
										{coords !== ' -- '
											? coords
											: selectedTrip?.liveLocation
												? `${selectedTrip.liveLocation.latitude}, ${selectedTrip.liveLocation.longitude}`
													: ' -- '}
									</p>
									<small>{selectedTrip ? `School: ${selectedTrip.schoolName || 'Not set'}` : 'No active accepted trip.'}</small>
									{selectedTrip ? (
										<small>Requester Location: {formatLocation(selectedTrip.requesterLocation)}</small>
									) : null}
								</div>

								<div className="driver-gps-map">
									<LiveTripMap
										center={selectedTripMapCenter}
										pickupPosition={selectedTripDestinationPosition}
										vanPosition={selectedTripVanPosition}
										showRoute={Boolean(selectedTripDestinationPosition && selectedTripVanPosition)}
										routeMode="road"
										height={370}
									/>
								</div>
							</CardContent>
						</Card>

						{loading ? <p className="driver-state-text">Loading driver requests...</p> : null}
						{error ? <p className="driver-state-text driver-state-text--error">{error}</p> : null}
						{requestMessage ? <p className="driver-state-text driver-state-text--success">{requestMessage}</p> : null}

						<section className="driver-trips-grid">
							{acceptedRequests.length === 0 && !loading ? (
								<Card>
									<CardContent>
										<p className="driver-empty-text">
											No accepted trips yet. Go to Requests and accept a parent request.
										</p>
									</CardContent>
								</Card>
							) : null}

							{acceptedRequests.map((trip) => (
								<Card key={trip._id}>
									<CardHeader className="driver-trip-head">
										<div>
											<CardTitle>{trip.parent?.fullName || 'Parent Request'}</CardTitle>
											<CardDescription>{formatDate(trip.createdAt)}</CardDescription>
										</div>
										<span className={`driver-trip-badge ${getStatusLabelClass(trip.status)}`}>Accepted</span>
									</CardHeader>

									<CardContent className="driver-trip-body">
										<div>
											<p>PARENT</p>
											<h4>{trip.parent?.fullName || 'N/A'}</h4>
										</div>
										<div>
											<p>PHONE</p>
											<h4>{trip.parent?.phone || 'N/A'}</h4>
										</div>
										<div>
											<p>PICKUP ZONE</p>
											<h4>{trip.pickupZone}</h4>
										</div>
										<div>
											<p>SCHOOL DESTINATION</p>
											<h4>{trip.schoolName || 'Not set'}</h4>
										</div>
										<div>
											<p>REQUESTER LOCATION</p>
											<h4>{formatLocation(trip.requesterLocation)}</h4>
										</div>
										<div>
											<p>LAST LOCATIONS</p>
											<h4>
												{trip.liveLocation
													? `${trip.liveLocation.latitude}, ${trip.liveLocation.longitude}`
													: 'No location yet'}
											</h4>
										</div>

										<div className="driver-trip-actions">
											<Button variant="secondary" onClick={() => setSelectedRequestId(trip._id)}>
												Use for GPS
											</Button>
											{buildMapLink(trip.requesterLocation) ? (
												<Button variant="secondary" onClick={() => window.open(buildMapLink(trip.requesterLocation), '_blank')}>
													Open Requester Location
												</Button>
											) : null}
										</div>
									</CardContent>
								</Card>
							))}
						</section>
					</>
				) : null}

				{activeSection === 'requests' ? (
					<Requests
						requests={requests}
						acceptingRequestId={acceptingRequestId}
						onAcceptRequest={handleAcceptRequest}
					/>
				) : null}

				{activeSection === 'settings' ? (
					<DriverSettings
						user={user}
						profileData={profileData}
						photoName={photoName}
						driverIdName={driverIdName}
						savingProfile={savingProfile}
						profileStatus={profileStatus}
						onFieldChange={updateProfileField}
						onPhotoChange={(event) => setPhotoName(event.target.files?.[0]?.name || 'No file selected')}
						onDriverIdChange={(event) => setDriverIdName(event.target.files?.[0]?.name || 'No file selected')}
						onSave={saveDriverSettings}
					/>
				) : null}
			</div>
		</section>
	)
}
