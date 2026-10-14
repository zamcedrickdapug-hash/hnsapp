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
import { Wifi, WifiOff, AlertCircle } from 'lucide-react'
import { apiFetch } from '../../api'
import { useSocket, useSocketEvent } from '../../hooks/useSocket'
import { DashboardLayout } from '../../components/dashboard'
import { ParentChildrenCard, ParentTrackingPanel } from '../../components/dashboard/parent'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import LiveTripMap from '../../components/tracking/LiveTripMap'
import { NotificationsContainer } from '../../components/notifications/NotificationToast'
import { ReceiptModal } from '../../components/modals/ReceiptModal'
import { ReportIssueModal } from '../../components/modals/ReportIssueModal'
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
  const [bookingError, setBookingError] = useState('')
  const [bookingLoading, setBookingLoading] = useState(false)

  // ====== TRIP HISTORY STATE ======
  const [tripHistory, setTripHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')

  // ====== SETTINGS STATE ======
  const [settingsData, setSettingsData] = useState(() => {
    const storageKey = `hns_parent_profile_${user.id}`
    const stored = localStorage.getItem(storageKey)
    return stored ? JSON.parse(stored) : { ...defaultSettings }
  })
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsStatus, setSettingsStatus] = useState('')

  // ====== MODAL STATE ======
  const [selectedReceiptId, setSelectedReceiptId] = useState(null)
  const [reportingTrip, setReportingTrip] = useState(null)
  const [editingSettings, setEditingSettings] = useState(false)

  // Refs
  const notificationSoundRef = useRef(null)
  const highlightTimeoutRef = useRef(null)

  // ====== COMPUTED VALUES ======

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

  const bookTrip = useCallback(async () => {
    setBookingError('')
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

      const requesterLocation = navigator.geolocation
        ? await new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
              ({ coords }) => resolve({
                latitude: coords.latitude,
                longitude: coords.longitude,
                accuracy: coords.accuracy,
              }),
              () => resolve(undefined),
              { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 },
            )
          })
        : undefined

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
          requesterLocation,
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
      if (!requesterLocation) {
        showToast({
          type: 'info',
          title: 'Pickup GPS unavailable',
          message: 'Your pickup address was saved, but live arrival proximity needs a shared device location.',
        })
      }
    } catch (error) {
      setBookingError(error.message || 'Unable to book trip.')
      setBookingLoading(false)
    }
  }, [token, settingsData])

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
    setSavingSettings(true)
    setSettingsStatus('')

    try {
      const storageKey = `hns_parent_profile_${user.id}`
      localStorage.setItem(storageKey, JSON.stringify(updatedData))
      setSettingsData(updatedData)
      setSettingsStatus('Settings saved successfully!')
      setEditingSettings(false)

      setTimeout(() => setSettingsStatus(''), 3000)
    } catch (error) {
      setSettingsStatus(error.message || 'Unable to save settings.')
    } finally {
      setSavingSettings(false)
    }
  }, [user.id])

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

  useEffect(() => {
    if (activeSection === 'history') {
      loadTripHistory()
    }
  }, [activeSection, loadTripHistory])

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
      pageTitle={
        activeSection === 'dashboard'
          ? 'Parent Dashboard'
          : activeSection === 'history'
            ? 'Trip History'
            : 'Settings'
      }
      pageDescription={
        activeSection === 'dashboard'
          ? 'Book and track your student transportation.'
          : activeSection === 'history'
            ? 'View past trips and receipts.'
            : 'Manage your profile and preferences.'
      }
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
                studentName={settingsData.studentName || 'Student'}
                studentGradeSection={settingsData.studentGradeSection || 'N/A'}
                schoolName={settingsData.schoolName || 'School'}
                pickupZone={settingsData.pickupZone || 'N/A'}
                status={activeRideRequest?.status || 'waiting'}
                onEditClick={() => setEditingSettings(true)}
                isLoading={false}
              />

              {/* Booking Actions */}
              {!activeRideRequest ? (
                <Button
                  onClick={bookTrip}
                  disabled={bookingLoading || !settingsData.pickupZone}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  size="lg"
                >
                  {bookingLoading ? 'Booking...' : 'Book Trip'}
                </Button>
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
                    estimatedArrival={activeRideRequest.estimatedArrival || 'Calculating...'}
                    socketConnected={socketConnected}
                  />

                  <Card>
                    <CardHeader>
                      <CardTitle>Live Location Map</CardTitle>
                      <CardDescription>Real-time driver position and route</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <LiveTripMap
                        vanPosition={asLatLng(activeRideRequest.liveLocation)}
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
      {activeSection === 'history' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Total Trips', value: tripSummary.total, color: 'text-blue-600' },
              { label: 'Completed', value: tripSummary.completed, color: 'text-green-600' },
              { label: 'Cancelled', value: tripSummary.cancelled, color: 'text-red-600' },
            ].map((stat, idx) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
              >
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                    <p className={`text-3xl font-bold ${stat.color} mt-2`}>{stat.value}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Trip History List */}
          {historyLoading ? (
            <Card>
              <CardContent className="pt-6">
                <div className="h-40 bg-gray-200 rounded animate-pulse" />
              </CardContent>
            </Card>
          ) : tripHistory.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-gray-500 py-8">No trips yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {tripHistory.map((trip, idx) => (
                <motion.div
                  key={trip._id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="pt-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{trip.driver?.fullName || 'Driver'}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(trip.createdAt).toLocaleDateString()} • {trip.status}
                        </p>
                      </div>
                      {trip.status === 'completed' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedReceiptId(trip._id)}
                        >
                          View Receipt
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setReportingTrip({
                            id: trip._id,
                            date: new Date(trip.createdAt).toLocaleDateString(),
                          })
                        }
                      >
                        Report Issue
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Settings Section */}
      {activeSection === 'settings' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="max-w-2xl space-y-6"
        >
          <Card>
            <CardHeader>
              <CardTitle>Parent Information</CardTitle>
              <CardDescription>Update your profile details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Parent Name</label>
                <input
                  type="text"
                  value={settingsData.parentDisplayName}
                  onChange={(e) =>
                    setSettingsData((prev) => ({
                      ...prev,
                      parentDisplayName: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  disabled={savingSettings}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Contact Number</label>
                <input
                  type="tel"
                  value={settingsData.contactNumber}
                  onChange={(e) =>
                    setSettingsData((prev) => ({
                      ...prev,
                      contactNumber: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  disabled={savingSettings}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Student Name</label>
                <input
                  type="text"
                  value={settingsData.studentName}
                  onChange={(e) =>
                    setSettingsData((prev) => ({
                      ...prev,
                      studentName: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  disabled={savingSettings}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Grade/Section</label>
                <input
                  type="text"
                  value={settingsData.studentGradeSection}
                  onChange={(e) =>
                    setSettingsData((prev) => ({
                      ...prev,
                      studentGradeSection: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  disabled={savingSettings}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">School Name</label>
                <input
                  type="text"
                  value={settingsData.schoolName}
                  onChange={(e) =>
                    setSettingsData((prev) => ({
                      ...prev,
                      schoolName: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  disabled={savingSettings}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">School Destination Latitude (optional)</label>
                <input
                  type="number"
                  min="-90"
                  max="90"
                  step="any"
                  value={settingsData.schoolLatitude ?? ''}
                  onChange={(e) =>
                    setSettingsData((prev) => ({ ...prev, schoolLatitude: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  disabled={savingSettings}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">School Destination Longitude (optional)</label>
                <input
                  type="number"
                  min="-180"
                  max="180"
                  step="any"
                  value={settingsData.schoolLongitude ?? ''}
                  onChange={(e) =>
                    setSettingsData((prev) => ({ ...prev, schoolLongitude: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  disabled={savingSettings}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Provide the school&apos;s real coordinates to enable destination routing and automatic arrival detection.
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Pickup Zone</label>
                <input
                  type="text"
                  value={settingsData.pickupZone}
                  onChange={(e) =>
                    setSettingsData((prev) => ({
                      ...prev,
                      pickupZone: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  disabled={savingSettings}
                />
              </div>

              {settingsStatus && (
                <motion.div
                  className={`p-3 rounded-lg text-sm ${
                    settingsStatus.includes('successfully')
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {settingsStatus}
                </motion.div>
              )}

              <Button
                onClick={() => saveSettings(settingsData)}
                disabled={savingSettings}
                className="w-full"
              >
                {savingSettings ? 'Saving...' : 'Save Settings'}
              </Button>
            </CardContent>
          </Card>
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
