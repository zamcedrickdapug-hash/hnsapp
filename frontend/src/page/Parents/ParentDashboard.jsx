/**
 * ParentDashboard Component - REFACTORED
 * =====================================
 * Parent dashboard using unified enterprise architecture (DashboardLayout)
 * 
 * Architecture:
 * ✅ Uses DashboardLayout wrapper (unified with Driver/Admin dashboards)
 * ✅ Modular section components (ParentChildrenCard, ParentTrackingPanel)
 * ✅ Feature-specific panels (booking, history, notifications)
 * ✅ Preserves all original business logic
 * ✅ Maintains backward compatibility
 * ✅ Professional code organization
 * 
 * Benefits Over Old Architecture:
 * - Removed Sidenavbar dependency
 * - Unified layout with other dashboards
 * - Consistent responsive behavior
 * - Easier to maintain and extend
 * - Scalable for additional parent features
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Wifi, WifiOff, AlertCircle, MessageSquare, CreditCard, UserRound, CheckCircle2, AlertTriangle, Save, RotateCcw } from 'lucide-react'
import { isValidPhoneNumber, normalizePhoneNumber } from '../../constants/authConstants'
import { apiFetch } from '../../api'
import { useSocket, useSocketEvent } from '../../hooks/useSocket'
import { DashboardLayout } from '../../components/dashboard'
import { ParentChildrenCard, ParentTrackingPanel } from '../../components/dashboard/parent'
import NotificationHistory from '../../components/ui/NotificationHistory'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import LiveTripMap from '../../components/tracking/LiveTripGoogleMap'
import { NotificationsContainer } from '../../components/notifications/NotificationToast'
import { ReceiptModal } from '../../components/modals/ReceiptModal'
import { ReportIssueModal } from '../../components/modals/ReportIssueModal'
import PickupLocationPicker from '../../components/dashboard/parent/PickupLocationPicker'
import TripHistoryPage from './TripHistoryPage'
import { distanceInMeters } from '../../utils/driverDashboard'
import './ParentDashboard.scss'

// Default settings structure
const defaultSettings = {
  parentDisplayName: '',
  contactNumber: '',
  studentName: '',
  studentGradeSection: '',
  schoolName: '',
  schoolLatitude: '',
  schoolLongitude: '',
  pickupZone: '',
  pickupLatitude: '',
  pickupLongitude: '',
  emergencyContact: '',
  notes: '',
}
const ACTIVE_REQUEST_STATUSES = ['searching', 'accepted', 'arrived', 'picked_up', 'arrived_at_school']
const asLatLng = (location) => {
  const latitude = Number(location?.latitude)
  const longitude = Number(location?.longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  return [latitude, longitude]
}

/**
 * Main ParentDashboard Component
 * Professional modular architecture maintaining all business logic
 */
export default function ParentDashboard({ token, user, onLogout }) {
  // ====== SOCKET CONNECTION ======
  const { socket } = useSocket(token)

  // ====== UI STATE ======
  const [activeSection, setActiveSection] = useState('dashboard')
  const [socketConnected, setSocketConnected] = useState(false)
  const [toastNotifications, setToastNotifications] = useState([])

  // ====== BOOKING STATE ======
  const [activeRideRequest, setActiveRideRequest] = useState(null)
  const [plannedRoute, setPlannedRoute] = useState([])
  const [bookingError, setBookingError] = useState('')
  const [bookingLoading, setBookingLoading] = useState(false)

  // ====== TRIP HISTORY STATE ======
  const [tripHistory, setTripHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [parentNotifications, setParentNotifications] = useState([])
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [notificationsError, setNotificationsError] = useState('')

  // ====== SETTINGS STATE ======
  const initialSettingsData = {
    ...defaultSettings,
    parentDisplayName: user.fullName || user.name || '',
    contactNumber: user.phone || '',
    emergencyContact: user.phone || '',
    pickupZone: user.homeAddress || '',
  }
  const [settingsData, setSettingsData] = useState(initialSettingsData)
  const [savedSettingsData, setSavedSettingsData] = useState(initialSettingsData)
  const [settingsFieldErrors, setSettingsFieldErrors] = useState({})
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsStatus, setSettingsStatus] = useState('')
  const [pickupZoneStatus, setPickupZoneStatus] = useState('')

  // ====== MODAL STATE ======
  const [selectedReceiptId, setSelectedReceiptId] = useState(null)
  const [reportingTrip, setReportingTrip] = useState(null)

  // Refs
  const notificationSoundRef = useRef(null)
  const highlightTimeoutRef = useRef(null)
  const pickupZoneCheckSequenceRef = useRef(0)
  const routeRequestRef = useRef({
    targetKey: '',
    lastRequestedAt: 0,
    lastSuccessfulPosition: null,
    hasRoute: false,
    pending: false,
    requestId: 0,
  })

  // ====== COMPUTED VALUES ======

  const mapParentProfileToSettings = useCallback((profile = {}) => ({
    ...defaultSettings,
    parentDisplayName: profile.parentName || user.fullName || user.name || '',
    contactNumber: profile.contactNumber || user.phone || '',
    emergencyContact: profile.contactNumber || user.phone || '',
    studentName: profile.studentName || '',
    studentGradeSection: profile.gradeSection || '',
    schoolName: profile.schoolName || '',
    schoolLatitude: profile.schoolLatitude ?? '',
    schoolLongitude: profile.schoolLongitude ?? '',
    pickupZone: profile.pickupZone || user.homeAddress || '',
    pickupLatitude: profile.pickupLatitude ?? '',
    pickupLongitude: profile.pickupLongitude ?? '',
  }), [user])

  const loadParentProfile = useCallback(async () => {
    setLoadingSettings(true)
    setSettingsStatus('')
    try {
      const response = await apiFetch('/api/parents/profile', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const profileSettings = mapParentProfileToSettings(response.profile || {})
      setSettingsData(profileSettings)
      setSavedSettingsData(profileSettings)
    } catch (error) {
      setSettingsStatus(error.message || 'Unable to load your saved profile.')
    } finally {
      setLoadingSettings(false)
    }
  }, [mapParentProfileToSettings, token])

  useEffect(() => {
    loadParentProfile()
  }, [loadParentProfile])

  const tripSummary = useMemo(() => {
    const completed = tripHistory.filter((t) => t.status === 'completed').length
    const cancelled = tripHistory.filter((t) => t.status === 'cancelled').length
    return { completed, cancelled, total: tripHistory.length }
  }, [tripHistory])

  const currentTripStatus = useMemo(() => {
    if (!activeRideRequest) return 'Waiting for trip'
    const statusMap = {
      searching: 'Finding driver',
      accepted: 'Driver assigned',
      arrived: 'Driver arrived',
      picked_up: 'On the way',
      arrived_at_school: 'Arrived at school',
      completed: 'Trip complete',
      cancelled: 'Trip cancelled',
    }
    return statusMap[activeRideRequest.status] || 'Waiting'
  }, [activeRideRequest])

  const estimatedArrival = useMemo(() => {
    if (!activeRideRequest) return null
    if (activeRideRequest.status === 'arrived') return 'Driver has arrived at pickup'
    if (['arrived_at_school', 'completed', 'cancelled'].includes(activeRideRequest.status)) return null

    const targetCoordinates =
      activeRideRequest.status === 'picked_up'
        ? activeRideRequest.destinationLocation
        : activeRideRequest.status === 'accepted'
          ? activeRideRequest.requesterLocation
          : null
    const liveLocation = activeRideRequest.liveLocation
    const hasValidCoordinates = (location) =>
      location &&
      location.latitude !== null &&
      location.latitude !== undefined &&
      location.latitude !== '' &&
      location.longitude !== null &&
      location.longitude !== undefined &&
      location.longitude !== ''
    const targetLocation = hasValidCoordinates(targetCoordinates) ? asLatLng(targetCoordinates) : null
    const currentLocation = hasValidCoordinates(liveLocation) ? asLatLng(liveLocation) : null
    if (!currentLocation || !targetLocation) return 'Calculating...'

    const distance = distanceInMeters(currentLocation, targetLocation)
    if (!Number.isFinite(distance)) return 'Calculating...'
    if (distance < 150) {
      return activeRideRequest.status === 'picked_up' ? 'Arriving at school' : 'Arriving'
    }

    const minutes = Math.max(1, Math.ceil((distance * 1.3 * 60) / 22000))
    return activeRideRequest.status === 'picked_up'
      ? `about ${minutes} min to school`
      : `about ${minutes} min`
  }, [activeRideRequest])

  const hasRequiredStudentDetails = [
    settingsData.studentName,
    settingsData.studentGradeSection,
    settingsData.schoolName,
    settingsData.pickupZone,
  ].every((value) => typeof value === 'string' && value.trim())
  const settingsIsDirty = JSON.stringify(settingsData) !== JSON.stringify(savedSettingsData)
  const missingStudentDetails = [
    ['studentName', 'Student name'],
    ['studentGradeSection', 'Grade/section'],
    ['schoolName', 'School name'],
    ['pickupZone', 'Pickup zone'],
  ].filter(([field]) => !String(settingsData[field] || '').trim())
    .map(([, label]) => label)

  const updateSettingsField = (field, value) => {
    setSettingsData((current) => ({ ...current, [field]: value }))
    setSettingsFieldErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const handlePickupLocationChange = useCallback(async ({ pickupZone, latitude, longitude }) => {
    const checkSequence = ++pickupZoneCheckSequenceRef.current
    setSettingsData((current) => ({
      ...current,
      pickupZone: pickupZone || current.pickupZone,
      pickupLatitude: latitude,
      pickupLongitude: longitude,
    }))
    setPickupZoneStatus('Checking pickup service area...')

    try {
      const response = await apiFetch('/api/parents/pickup-zone-check', {
        method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude, longitude }),
      })
      if (checkSequence === pickupZoneCheckSequenceRef.current) {
        setPickupZoneStatus(response.inside
          ? 'Pickup is inside our service area.'
          : 'This pickup is outside our service area')
      }
    } catch (error) {
      if (checkSequence === pickupZoneCheckSequenceRef.current) {
        setPickupZoneStatus(error.message || 'Unable to check this pickup location.')
      }
    }
  }, [token])

  // ====== API CALLS ======

  const loadActiveTrip = useCallback(async () => {
    try {
      const response = await apiFetch('/api/parents/van-requests', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const requests = response.requests || []
      setActiveRideRequest(requests.find((request) => ACTIVE_REQUEST_STATUSES.includes(request.status)) || null)
      setTripHistory(requests.filter((request) => ['completed', 'cancelled'].includes(request.status)))
    } catch (error) {
      setBookingError(error.message || 'Unable to load ride requests.')
    }
  }, [token])

  const loadTripHistory = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setHistoryLoading(true)
    setHistoryError('')

    try {
      const response = await apiFetch('/api/parents/van-requests', {
        headers: { Authorization: `Bearer ${token}` },
      })
      setTripHistory((response.requests || []).filter((request) => ['completed', 'cancelled'].includes(request.status)))
    } catch (error) {
      setHistoryError(error.message || 'Unable to load trip history.')
    } finally {
      if (!silent) setHistoryLoading(false)
    }
  }, [token])

  const loadParentNotifications = useCallback(async () => {
    setNotificationsLoading(true)
    setNotificationsError('')
    try {
      const response = await apiFetch('/api/parents/notifications', {
        headers: { Authorization: `Bearer ${token}` },
      })
      setParentNotifications(response.notifications || [])
    } catch (error) {
      setNotificationsError(error.message || 'Unable to load notifications.')
    } finally {
      setNotificationsLoading(false)
    }
  }, [token])

  const markNotificationAsRead = useCallback(async (notificationId) => {
    try {
      await apiFetch(`/api/parents/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })
      setParentNotifications((current) =>
        current.map((notification) =>
          notification._id === notificationId ? { ...notification, read: true } : notification
        )
      )
    } catch (error) {
      setNotificationsError(error.message || 'Unable to update notification.')
    }
  }, [token])

  const markAllNotificationsAsRead = useCallback(async () => {
    const unreadNotifications = parentNotifications.filter((notification) => !notification.read)
    try {
      for (const notification of unreadNotifications) {
        await apiFetch(`/api/parents/notifications/${notification._id}/read`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
        })
        setParentNotifications((current) =>
          current.map((item) =>
            item._id === notification._id ? { ...item, read: true } : item
          )
        )
      }
    } catch (error) {
      setNotificationsError(error.message || 'Unable to update notifications.')
    }
  }, [parentNotifications, token])

  const bookTrip = useCallback(async () => {
    setBookingError('')
    const pickupLatitude = Number(savedSettingsData.pickupLatitude)
    const pickupLongitude = Number(savedSettingsData.pickupLongitude)
    const hasPickupCoordinates =
      String(savedSettingsData.pickupLatitude ?? '').trim() !== '' &&
      String(savedSettingsData.pickupLongitude ?? '').trim() !== '' &&
      Number.isFinite(pickupLatitude) && pickupLatitude >= -90 && pickupLatitude <= 90 &&
      Number.isFinite(pickupLongitude) && pickupLongitude >= -180 && pickupLongitude <= 180
    if (!hasPickupCoordinates) {
      setBookingError('Set your pickup location in Settings first')
      setActiveSection('settings')
      return
    }
    setBookingLoading(true)

    try {
      const { schoolLatitude, schoolLongitude } = settingsData
      const hasLatitude = String(schoolLatitude ?? '').trim() !== ''
      const hasLongitude = String(schoolLongitude ?? '').trim() !== ''
      if (hasLatitude !== hasLongitude) {
        throw new Error('Enter both school destination coordinates, or leave both blank.')
      }

      const destinationLocation = hasLatitude
        ? { latitude: Number(schoolLatitude), longitude: Number(schoolLongitude) }
        : undefined
      if (destinationLocation && (
        !Number.isFinite(destinationLocation.latitude) ||
        !Number.isFinite(destinationLocation.longitude) ||
        destinationLocation.latitude < -90 || destinationLocation.latitude > 90 ||
        destinationLocation.longitude < -180 || destinationLocation.longitude > 180
      )) {
        throw new Error('Enter valid school destination coordinates.')
      }

      const response = await apiFetch('/api/parents/van-requests', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          pickupZone: settingsData.pickupZone,
          studentName: settingsData.studentName,
          gradeSection: settingsData.studentGradeSection,
          schoolName: settingsData.schoolName,
          emergencyContact: settingsData.emergencyContact || settingsData.contactNumber,
          notes: settingsData.notes,
          destinationLocation,
        }),
      })

      setActiveRideRequest(response.request || null)
      setBookingLoading(false)
      showToast({
        type: 'success',
        title: 'Trip Booked',
        message: 'Your trip has been booked. Waiting for driver...',
      })
    } catch (error) {
      setBookingError(error.message || 'Unable to book trip.')
      setBookingLoading(false)
    }
  }, [token, savedSettingsData, settingsData])

  const cancelTrip = useCallback(async () => {
    if (!activeRideRequest?._id) return

    try {
      const response = await apiFetch(`/api/parents/van-requests/${activeRideRequest._id}/cancel`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })

      setActiveRideRequest(null)
      setTripHistory((current) => [response.request, ...current.filter((trip) => trip._id !== response.request?._id)])
      showToast({
        type: 'info',
        title: 'Trip Cancelled',
        message: 'Your trip has been cancelled.',
      })
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Error',
        message: error.message || 'Unable to cancel trip.',
      })
    }
  }, [activeRideRequest, token])

  const saveSettings = useCallback(async (updatedData) => {
    const parentName = updatedData.parentDisplayName.trim()
    const contactNumber = updatedData.contactNumber.trim()
    setSettingsFieldErrors({})
    if (!parentName) {
      setSettingsFieldErrors({ parentDisplayName: 'Parent name is required.' })
      setSettingsStatus('Parent name is required.')
      return
    }
    if (!isValidPhoneNumber(contactNumber)) {
      setSettingsFieldErrors({ contactNumber: 'Enter a valid Philippine mobile number.' })
      setSettingsStatus('Please enter a valid Philippine mobile number.')
      return
    }

    setSavingSettings(true)
    setSettingsStatus('')

    try {
      const response = await apiFetch('/api/parents/profile', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          parentName,
          contactNumber: normalizePhoneNumber(contactNumber),
          studentName: updatedData.studentName.trim(),
          gradeSection: updatedData.studentGradeSection.trim(),
          schoolName: updatedData.schoolName.trim(),
          pickupZone: updatedData.pickupZone.trim(),
          pickupLatitude: updatedData.pickupLatitude,
          pickupLongitude: updatedData.pickupLongitude,
          schoolLatitude: updatedData.schoolLatitude,
          schoolLongitude: updatedData.schoolLongitude,
        }),
      })
      const profileSettings = mapParentProfileToSettings(response.profile || {})
      setSettingsData(profileSettings)
      setSavedSettingsData(profileSettings)
      setSettingsStatus('Settings saved successfully!')

      setTimeout(() => setSettingsStatus(''), 3000)
    } catch (error) {
      const message = error.message || 'Unable to save settings.'
      setSettingsStatus(message)
      if (/mobile number/i.test(message)) {
        setSettingsFieldErrors({ contactNumber: message })
      } else if (/parent name/i.test(message)) {
        setSettingsFieldErrors({ parentDisplayName: message })
      } else if (/coordinates/i.test(message)) {
        setSettingsFieldErrors({
          schoolLatitude: message,
          schoolLongitude: message,
        })
      }
    } finally {
      setSavingSettings(false)
    }
  }, [mapParentProfileToSettings, token])

  // ====== TOAST NOTIFICATIONS ======

  const showToast = useCallback((notification) => {
    const id = Date.now()
    setToastNotifications((prev) => [...prev, { ...notification, id }])
    return id
  }, [])

  const dismissToast = useCallback((id) => {
    setToastNotifications((prev) => prev.filter((notif) => notif.id !== id))
  }, [])

  // ====== EFFECTS ======

  useEffect(() => {
    loadActiveTrip()
    const interval = setInterval(() => loadActiveTrip(), 5000)
    return () => clearInterval(interval)
  }, [loadActiveTrip])

  const routeTripId = activeRideRequest?._id
  const routeTripStatus = activeRideRequest?.status
  const routeVanLatitude = Number(activeRideRequest?.liveLocation?.latitude)
  const routeVanLongitude = Number(activeRideRequest?.liveLocation?.longitude)
  const routeTargetLatitude = Number(
    routeTripStatus === 'picked_up'
      ? activeRideRequest?.destinationLocation?.latitude
      : activeRideRequest?.requesterLocation?.latitude
  )
  const routeTargetLongitude = Number(
    routeTripStatus === 'picked_up'
      ? activeRideRequest?.destinationLocation?.longitude
      : activeRideRequest?.requesterLocation?.longitude
  )

  useEffect(() => {
    if (
      !routeTripId ||
      !Number.isFinite(routeVanLatitude) ||
      !Number.isFinite(routeVanLongitude) ||
      !Number.isFinite(routeTargetLatitude) ||
      !Number.isFinite(routeTargetLongitude)
    ) {
      routeRequestRef.current = {
        targetKey: '',
        lastRequestedAt: 0,
        lastSuccessfulPosition: null,
        hasRoute: false,
        pending: false,
        requestId: routeRequestRef.current.requestId + 1,
      }
      setPlannedRoute((current) => (current.length ? [] : current))
      return
    }

    const vanPosition = [routeVanLatitude, routeVanLongitude]
    const targetPosition = [routeTargetLatitude, routeTargetLongitude]
    const targetPhase = routeTripStatus === 'picked_up' ? 'school' : 'pickup'
    const targetKey = `${routeTripId}:${targetPhase}:${routeTargetLatitude},${routeTargetLongitude}`
    const routeState = routeRequestRef.current
    const targetChanged = routeState.targetKey !== targetKey

    if (targetChanged) {
      routeState.targetKey = targetKey
      routeState.lastRequestedAt = 0
      routeState.lastSuccessfulPosition = null
      routeState.hasRoute = false
      routeState.pending = false
      setPlannedRoute((current) => (current.length ? [] : current))
    }

    const now = Date.now()
    const elapsedSinceRequest = now - routeState.lastRequestedAt
    const movedSinceSuccess = routeState.lastSuccessfulPosition
      ? distanceInMeters(routeState.lastSuccessfulPosition, vanPosition)
      : 0
    const shouldRequestRoute =
      targetChanged ||
      (!routeState.pending &&
        elapsedSinceRequest >= 15000 &&
        (!routeState.hasRoute || movedSinceSuccess >= 100))

    if (!shouldRequestRoute || routeState.pending) return

    routeState.lastRequestedAt = now
    routeState.pending = true
    const requestId = routeState.requestId + 1
    routeState.requestId = requestId
    const requestPosition = vanPosition

    apiFetch('/api/routing/route', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        start: vanPosition,
        end: targetPosition,
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

        routeRequestRef.current.pending = false
        if (route.length < 2) {
          routeRequestRef.current.hasRoute = false
          setPlannedRoute([])
          return
        }

        routeRequestRef.current.hasRoute = true
        routeRequestRef.current.lastSuccessfulPosition = requestPosition
        setPlannedRoute(route)
      })
      .catch(() => {
        if (
          routeRequestRef.current.requestId !== requestId ||
          routeRequestRef.current.targetKey !== targetKey
        ) return

        routeRequestRef.current.pending = false
        routeRequestRef.current.hasRoute = false
        setPlannedRoute([])
      })
  }, [
    routeTripId,
    routeTripStatus,
    routeVanLatitude,
    routeVanLongitude,
    routeTargetLatitude,
    routeTargetLongitude,
    token,
  ])

  useEffect(() => {
    if (activeSection === 'trips') {
      loadTripHistory()
    }
  }, [activeSection, loadTripHistory])

  useEffect(() => {
    if (activeSection === 'notifications') {
      loadParentNotifications()
    }
  }, [activeSection, loadParentNotifications])

  useEffect(() => {
    setSocketConnected(socket?.connected || false)
  }, [socket])

  // ====== SOCKET EVENTS ======

  const handleTripRequestUpdated = useCallback(({ request } = {}) => {
    if (!request?._id) return
    const requestId = String(request._id)
    const isTerminal = ['completed', 'cancelled'].includes(request.status)

    setActiveRideRequest((current) => {
      if (String(current?._id || '') === requestId) {
        return isTerminal ? null : { ...current, ...request }
      }
      if (!current && ACTIVE_REQUEST_STATUSES.includes(request.status)) return request
      return current
    })

    if (isTerminal) {
      setTripHistory((current) => [
        request,
        ...current.filter((item) => String(item._id) !== requestId),
      ])
    }
  }, [])

  const handleTripLocationUpdated = useCallback((payload = {}) => {
    const requestId = String(payload.requestId || '')
    if (!requestId) return
    setActiveRideRequest((current) => {
      if (String(current?._id || '') !== requestId) return current
      return {
        ...current,
        liveLocation: payload.liveLocation || null,
        ...(payload.status ? { status: payload.status } : {}),
      }
    })
  }, [])

  useSocketEvent(socket, 'trip:request-updated', handleTripRequestUpdated, [handleTripRequestUpdated])
  useSocketEvent(socket, 'trip:location-updated', handleTripLocationUpdated, [handleTripLocationUpdated])

  useEffect(() => {
    if (!socket || !activeRideRequest?._id) return undefined
    const requestId = String(activeRideRequest._id)
    socket.emit('trip:subscribe', { requestId })
    return () => socket.emit('trip:unsubscribe', { requestId })
  }, [socket, activeRideRequest?._id])

  // ====== RENDER ======

  return (
    <DashboardLayout
      role="parent"
      userName={user.fullName || user.name || 'Parent'}
      currentPage={activeSection}
      onNavigate={setActiveSection}
      onLogout={onLogout}
      pageTitle={{
        dashboard: 'Parent Dashboard',
        trips: 'Trip History',
        notifications: 'Notifications',
        messages: 'Messages',
        payments: 'Payments',
        settings: 'Settings',
      }[activeSection] || 'Parent Dashboard'}
      pageDescription={{
        dashboard: 'Book and track your student transportation.',
        trips: 'View your ride requests and past trips.',
        notifications: 'Review updates about your account and trips.',
        messages: 'Messages with drivers will be available here.',
        payments: 'Payment information will be available here.',
        settings: 'Manage your profile and preferences.',
      }[activeSection] || ''}
    >
      {/* Toast Notifications */}
      <NotificationsContainer notifications={toastNotifications} onDismiss={dismissToast} />

      {/* Dashboard Section */}
      {activeSection === 'dashboard' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          {/* Status Bar */}
          <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 p-4">
            <div>
              <h2 className="font-semibold text-gray-900">Current Trip Status</h2>
              <p className="text-sm text-gray-600">{currentTripStatus}</p>
            </div>
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold ${
              socketConnected ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-600'
            }`}>
              {socketConnected ? (
                <>
                  <Wifi size={16} />
                  <span>Connected</span>
                </>
              ) : (
                <>
                  <WifiOff size={16} />
                  <span>Offline</span>
                </>
              )}
            </div>
          </div>

          {/* Error Messages */}
          {bookingError && (
            <motion.div
              className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-start gap-2"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
              <p className="text-sm">{bookingError}</p>
            </motion.div>
          )}

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Student Info & Booking */}
            <div className="lg:col-span-1 space-y-6">
              <ParentChildrenCard
                studentName={settingsData.studentName || 'Student details not added'}
                studentGradeSection={settingsData.studentGradeSection || 'Grade/Section not added'}
                schoolName={settingsData.schoolName || 'School not added'}
                pickupZone={settingsData.pickupZone || 'Pickup zone not added'}
                hasStudentDetails={hasRequiredStudentDetails}
                status={activeRideRequest?.status || 'waiting'}
                onEditClick={() => setActiveSection('settings')}
                isLoading={false}
              />

              {/* Booking Actions */}
              {!activeRideRequest ? (
                <>
                  <Button
                    onClick={bookTrip}
                    disabled={bookingLoading || !hasRequiredStudentDetails}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    size="lg"
                  >
                    {bookingLoading ? 'Booking...' : 'Book Trip'}
                  </Button>
                  {!hasRequiredStudentDetails && (
                    <p className="text-sm text-gray-700">
                      Add the student name, grade/section, school, and pickup zone in Settings before booking.
                    </p>
                  )}
                </>
              ) : (
                <Button
                  onClick={cancelTrip}
                  disabled={activeRideRequest.status === 'picked_up'}
                  variant="outline"
                  className="w-full text-red-600 hover:text-red-700"
                  size="lg"
                >
                  Cancel Trip
                </Button>
              )}
            </div>

            {/* Right Column: Live Tracking & Map */}
            <div className="lg:col-span-2 space-y-6">
              {activeRideRequest && (
                <>
                  <ParentTrackingPanel
                    tripStatus={activeRideRequest.status}
                    driverName={activeRideRequest.driver?.fullName}
                    vehicleType={activeRideRequest.vehicleId?.vehicleType || activeRideRequest.driver?.driver?.vehicleType}
                    vehiclePlate={activeRideRequest.vehicleId?.plateNumber || activeRideRequest.driver?.driver?.plateNumber}
                    currentLocation={
                      asLatLng(activeRideRequest.liveLocation)?.map((value) => value.toFixed(6)).join(', ') ||
                      'Locating...'
                    }
                    destination={activeRideRequest.schoolName || settingsData.schoolName || 'School destination not provided'}
                    estimatedArrival={estimatedArrival}
                    socketConnected={socketConnected}
                    liveLocationUpdatedAt={activeRideRequest.liveLocation?.updatedAt}
                  />

                  <Card>
                    <CardHeader>
                      <CardTitle>Live Location Map</CardTitle>
                      <CardDescription>Real-time driver position and route</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <LiveTripMap
                        vanPosition={asLatLng(activeRideRequest.liveLocation)}
                        plannedRoute={plannedRoute}
                        pickupPosition={
                          activeRideRequest.status === 'picked_up'
                            ? asLatLng(activeRideRequest.destinationLocation)
                            : asLatLng(activeRideRequest.requesterLocation)
                        }
                        showRoute={Boolean(
                          asLatLng(activeRideRequest.liveLocation) &&
                          (activeRideRequest.status === 'picked_up'
                            ? asLatLng(activeRideRequest.destinationLocation)
                            : asLatLng(activeRideRequest.requesterLocation))
                        )}
                        routeMode="road"
                      />
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* History Section */}
      {activeSection === 'trips' && (
        <TripHistoryPage
          trips={tripHistory}
          isLoading={historyLoading}
          error={historyError}
          parentName={settingsData.parentDisplayName}
          studentName={settingsData.studentName}
          schoolName={settingsData.schoolName}
          onViewReceipt={setSelectedReceiptId}
          onReportIssue={(trip) =>
            setReportingTrip({ id: trip.id, date: trip.date })
          }
        />
      )}

      {activeSection === 'notifications' && (
        <div className="space-y-4">
          {notificationsError && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {notificationsError}
            </p>
          )}
          {notificationsLoading ? (
            <p role="status" className="text-sm text-gray-700">Loading notifications...</p>
          ) : (
            <NotificationHistory
              notifications={parentNotifications}
              unreadCount={parentNotifications.filter((notification) => !notification.read).length}
              onMarkAsRead={markNotificationAsRead}
              onMarkAllAsRead={markAllNotificationsAsRead}
            />
          )}
        </div>
      )}

      {activeSection === 'messages' && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <MessageSquare size={40} aria-hidden="true" className="text-slate-500" />
            <h2 className="text-lg font-semibold text-gray-900">Messages are coming soon</h2>
            <p className="max-w-md text-sm text-gray-600">
              Driver conversations will appear here when messaging becomes available.
            </p>
          </CardContent>
        </Card>
      )}

      {activeSection === 'payments' && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <CreditCard size={40} aria-hidden="true" className="text-slate-500" />
            <h2 className="text-lg font-semibold text-gray-900">Payments are coming soon</h2>
            <p className="max-w-md text-sm text-gray-600">
              Payment history and invoices will appear here when billing is available.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Settings Section */}
      {activeSection === 'settings' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="parent-settings"
        >
          <header className="parent-settings__page-header">
            <div>
              <p className="parent-settings__eyebrow">ACCOUNT</p>
              <h1>Settings</h1>
              <p>Keep your family and pickup details up to date.</p>
            </div>
          </header>

          {loadingSettings ? (
            <div className="parent-settings__skeleton" role="status" aria-label="Loading profile settings">
              <div className="parent-settings__skeleton-profile" />
              <div className="parent-settings__skeleton-card" />
              <div className="parent-settings__skeleton-card" />
              <span>Loading your saved profile...</span>
            </div>
          ) : (
            <>
              <section className="parent-settings__profile" aria-label="Account profile">
                <div className="parent-settings__avatar" aria-hidden="true">
                  {(settingsData.parentDisplayName || user.email || 'P')
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((part) => part[0])
                    .join('')
                    .toUpperCase()}
                </div>
                <div className="parent-settings__profile-copy">
                  <h2>{settingsData.parentDisplayName || 'Parent account'}</h2>
                  <span className="parent-settings__role">Parent</span>
                  {user.email && <p>{user.email}</p>}
                </div>
                <UserRound className="parent-settings__profile-icon" size={22} aria-hidden="true" />
              </section>

              <section
                className={`parent-settings__readiness ${hasRequiredStudentDetails ? 'is-ready' : 'needs-details'}`}
                aria-live="polite"
              >
                {hasRequiredStudentDetails
                  ? <CheckCircle2 size={20} aria-hidden="true" />
                  : <AlertTriangle size={20} aria-hidden="true" />}
                <div>
                  <strong>
                    {hasRequiredStudentDetails
                      ? 'Ready to book'
                      : 'Complete student details to book'}
                  </strong>
                  {!hasRequiredStudentDetails && (
                    <p>Still needed: {missingStudentDetails.join(', ')}.</p>
                  )}
                </div>
              </section>

              {bookingError && (
                <div className="parent-settings__status is-error" role="alert">
                  {bookingError}
                </div>
              )}

              {settingsStatus && (
                <div
                  className={`parent-settings__status ${settingsStatus.includes('successfully') ? 'is-success' : 'is-error'}`}
                  role={settingsStatus.includes('successfully') ? 'status' : 'alert'}
                >
                  {settingsStatus}
                </div>
              )}

              <section className="parent-settings__card" aria-labelledby="parent-info-title">
                <div className="parent-settings__section-heading">
                  <div>
                    <h2 id="parent-info-title">Parent Information</h2>
                    <p>Your contact details for trip updates.</p>
                  </div>
                </div>
                <div className="parent-settings__grid">
                  <div className="parent-settings__field">
                    <label htmlFor="parent-name">Parent Name <span aria-hidden="true">*</span></label>
                    <input
                      id="parent-name"
                      type="text"
                      autoComplete="name"
                      placeholder="Enter parent name"
                      value={settingsData.parentDisplayName}
                      onChange={(event) => updateSettingsField('parentDisplayName', event.target.value)}
                      aria-invalid={Boolean(settingsFieldErrors.parentDisplayName)}
                      aria-describedby={settingsFieldErrors.parentDisplayName ? 'parent-name-error' : undefined}
                      disabled={savingSettings}
                    />
                    {settingsFieldErrors.parentDisplayName && (
                      <p className="parent-settings__field-error" id="parent-name-error">
                        {settingsFieldErrors.parentDisplayName}
                      </p>
                    )}
                  </div>
                  <div className="parent-settings__field">
                    <label htmlFor="contact-number">Contact Number <span aria-hidden="true">*</span></label>
                    <input
                      id="contact-number"
                      type="tel"
                      autoComplete="tel"
                      placeholder="+639XXXXXXXXX"
                      value={settingsData.contactNumber}
                      onChange={(event) => updateSettingsField('contactNumber', event.target.value)}
                      aria-invalid={Boolean(settingsFieldErrors.contactNumber)}
                      aria-describedby={settingsFieldErrors.contactNumber
                        ? 'contact-number-help contact-number-error'
                        : 'contact-number-help'}
                      disabled={savingSettings}
                    />
                    <p className="parent-settings__helper" id="contact-number-help">
                      Use 09XXXXXXXXX or international format such as +639XXXXXXXXX.
                    </p>
                    {settingsFieldErrors.contactNumber && (
                      <p className="parent-settings__field-error" id="contact-number-error">
                        {settingsFieldErrors.contactNumber}
                      </p>
                    )}
                  </div>
                </div>
              </section>

              <section className="parent-settings__card" aria-labelledby="student-info-title">
                <div className="parent-settings__section-heading">
                  <div>
                    <h2 id="student-info-title">Student Information</h2>
                    <p>These details are used to prepare your trip booking.</p>
                  </div>
                </div>
                <div className="parent-settings__grid">
                  <div className="parent-settings__field">
                    <label htmlFor="student-name">Student Name <span aria-hidden="true">*</span></label>
                    <input
                      id="student-name"
                      type="text"
                      placeholder="Enter student name"
                      value={settingsData.studentName}
                      onChange={(event) => updateSettingsField('studentName', event.target.value)}
                      disabled={savingSettings}
                    />
                  </div>
                  <div className="parent-settings__field">
                    <label htmlFor="student-grade">Grade/Section <span aria-hidden="true">*</span></label>
                    <input
                      id="student-grade"
                      type="text"
                      placeholder="e.g. Grade 5 - Section A"
                      value={settingsData.studentGradeSection}
                      onChange={(event) => updateSettingsField('studentGradeSection', event.target.value)}
                      disabled={savingSettings}
                    />
                  </div>
                  <div className="parent-settings__field">
                    <label htmlFor="school-name">School Name <span aria-hidden="true">*</span></label>
                    <input
                      id="school-name"
                      type="text"
                      placeholder="Enter school name"
                      value={settingsData.schoolName}
                      onChange={(event) => updateSettingsField('schoolName', event.target.value)}
                      disabled={savingSettings}
                    />
                  </div>
                  <div className="parent-settings__field">
                    <label htmlFor="pickup-zone">Pickup Zone <span aria-hidden="true">*</span></label>
                    <input
                      id="pickup-zone"
                      type="text"
                      autoComplete="street-address"
                      placeholder="Enter pickup address or zone"
                      value={settingsData.pickupZone}
                      onChange={(event) => updateSettingsField('pickupZone', event.target.value)}
                      disabled={savingSettings}
                    />
                    <PickupLocationPicker
                      pickupZone={settingsData.pickupZone}
                      latitude={settingsData.pickupLatitude}
                      longitude={settingsData.pickupLongitude}
                      onLocationChange={handlePickupLocationChange}
                      disabled={savingSettings}
                    />
                    {pickupZoneStatus && (
                      <p
                        className={`mt-2 text-sm ${
                          pickupZoneStatus === 'This pickup is outside our service area'
                            ? 'text-amber-800'
                            : 'text-gray-600'
                        }`}
                        role="status"
                      >
                        {pickupZoneStatus}
                      </p>
                    )}
                  </div>
                  <div className="parent-settings__field">
                    <label htmlFor="school-latitude">School Destination Latitude</label>
                    <input
                      id="school-latitude"
                      type="number"
                      placeholder="e.g. 14.5995"
                      min="-90"
                      max="90"
                      step="any"
                      value={settingsData.schoolLatitude ?? ''}
                      onChange={(event) => updateSettingsField('schoolLatitude', event.target.value)}
                      aria-invalid={Boolean(settingsFieldErrors.schoolLatitude)}
                      aria-describedby={settingsFieldErrors.schoolLatitude
                        ? 'school-coordinates-help school-latitude-error'
                        : 'school-coordinates-help'}
                      disabled={savingSettings}
                    />
                    {settingsFieldErrors.schoolLatitude && (
                      <p className="parent-settings__field-error" id="school-latitude-error">
                        {settingsFieldErrors.schoolLatitude}
                      </p>
                    )}
                  </div>
                  <div className="parent-settings__field">
                    <label htmlFor="school-longitude">School Destination Longitude</label>
                    <input
                      id="school-longitude"
                      type="number"
                      placeholder="e.g. 120.9842"
                      min="-180"
                      max="180"
                      step="any"
                      value={settingsData.schoolLongitude ?? ''}
                      onChange={(event) => updateSettingsField('schoolLongitude', event.target.value)}
                      aria-invalid={Boolean(settingsFieldErrors.schoolLongitude)}
                      aria-describedby={settingsFieldErrors.schoolLongitude
                        ? 'school-coordinates-help school-longitude-error'
                        : 'school-coordinates-help'}
                      disabled={savingSettings}
                    />
                    {settingsFieldErrors.schoolLongitude && (
                      <p className="parent-settings__field-error" id="school-longitude-error">
                        {settingsFieldErrors.schoolLongitude}
                      </p>
                    )}
                    <p className="parent-settings__helper" id="school-coordinates-help">
                      Optional. Enter both coordinates to enable destination routing and arrival detection.
                    </p>
                  </div>
                </div>
              </section>

              <div className="parent-settings__save-bar">
                <p>{settingsIsDirty ? 'You have unsaved changes.' : 'All changes are saved.'}</p>
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSettingsData(savedSettingsData)
                      setSettingsFieldErrors({})
                      setSettingsStatus('')
                    }}
                    disabled={!settingsIsDirty || savingSettings}
                  >
                    <RotateCcw size={16} aria-hidden="true" />
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={() => saveSettings(settingsData)}
                    disabled={!settingsIsDirty || savingSettings}
                    className="parent-settings__save-button"
                  >
                    <Save size={16} aria-hidden="true" />
                    {savingSettings ? 'Saving...' : 'Save changes'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </motion.div>
      )}

      {/* Modals */}
      {selectedReceiptId && (
        <ReceiptModal
          tripId={selectedReceiptId}
          token={token}
          onClose={() => setSelectedReceiptId(null)}
        />
      )}

      {reportingTrip && (
        <ReportIssueModal
          isOpen
          trip={reportingTrip}
          onClose={() => setReportingTrip(null)}
          onSubmit={async (reportData) => {
            const response = await apiFetch('/api/issues/create-report', {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                tripId: reportData.tripId,
                category: reportData.category,
                description: reportData.description,
                screenshot: reportData.screenshot,
              }),
            })

            if (!response?.success) {
              throw new Error(response?.message || 'Failed to submit issue report.')
            }

            showToast({
              type: 'success',
              title: 'Report Submitted',
              message: 'Thank you for reporting this issue.',
            })
          }}
        />
      )}
    </DashboardLayout>
  )
}
