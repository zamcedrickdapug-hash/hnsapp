/**
 * ParentTrackingPanel Component
 * =============================
 * Live tracking display for active trip with real-time updates
 * 
 * Architecture: Reusable component showing current trip details
 * Shows: Driver info, vehicle details, location, ETA, trip progress
 */

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card'
import { Phone, MapPin, Clock, AlertCircle } from 'lucide-react'
import { apiFetch } from '../../../api'

export function ParentTrackingPanel({
  tripStatus = 'waiting',
  requestId = null,
  token = null,
  driverProfile = null,
  driverName = null,
  driverPhone = null,
  vehicleType = 'School Service Van',
  vehiclePlate = 'Not Available',
  currentLocation = null,
  destination = null,
  estimatedArrival = null,
  socketConnected = false,
  liveLocationUpdatedAt = null,
  isLoading = false,
}) {
  const [currentTime, setCurrentTime] = useState(Date.now())
  const [driverPhoto, setDriverPhoto] = useState(null)
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 5000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const photoVersion = driverProfile?.photoVersion
    if (photoVersion == null || !requestId || !token) {
      setDriverPhoto(null)
      return undefined
    }

    setDriverPhoto(null)
    let isCurrent = true
    let photoUrl = null
    apiFetch(`/api/parents/van-requests/${requestId}/driver-photo?v=${encodeURIComponent(photoVersion)}`, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'blob',
    })
      .then((photoBlob) => {
        if (!isCurrent) return
        photoUrl = URL.createObjectURL(photoBlob)
        setDriverPhoto({ requestId, photoVersion, url: photoUrl })
      })
      .catch(() => {
        if (isCurrent) setDriverPhoto(null)
      })

    return () => {
      isCurrent = false
      if (photoUrl) URL.revokeObjectURL(photoUrl)
    }
  }, [driverProfile?.photoVersion, requestId, token])

  const locationUpdatedAt = Date.parse(liveLocationUpdatedAt || '')
  const locationAge = currentTime - locationUpdatedAt
  const hasRecentLocationUpdate =
    Number.isFinite(locationUpdatedAt) && locationAge >= 0 && locationAge <= 30000

  const statusConfig = {
    searching: { label: 'Finding Driver', color: 'text-yellow-600', bg: 'bg-yellow-50' },
    accepted: { label: 'Driver Assigned', color: 'text-blue-600', bg: 'bg-blue-50' },
    arrived: { label: 'Driver Arrived', color: 'text-green-600', bg: 'bg-green-50' },
    picked_up: { label: 'On The Way', color: 'text-blue-600', bg: 'bg-blue-50' },
    arrived_at_school: { label: 'Arrived at School', color: 'text-green-600', bg: 'bg-green-50' },
    completed: { label: 'Trip Complete', color: 'text-green-600', bg: 'bg-green-50' },
    cancelled: { label: 'Cancelled', color: 'text-red-600', bg: 'bg-red-50' },
  }

  const statusInfo = statusConfig[tripStatus] || statusConfig.searching
  const publicDriverName = driverProfile?.name || driverName
  const driverPhotoUrl = driverPhoto?.requestId === requestId &&
    driverPhoto?.photoVersion === driverProfile?.photoVersion
    ? driverPhoto.url
    : null
  const initials = String(publicDriverName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
  const licenseMonth = /^(\d{4})-(\d{2})$/.exec(driverProfile?.licenseValidUntil || '')
  const licenseValidUntil = licenseMonth
    ? new Date(Date.UTC(Number(licenseMonth[1]), Number(licenseMonth[2]) - 1, 1))
      .toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
    : null

  if (isLoading || !driverName) {
    return (
      <Card className="border-2">
        <CardHeader className="pb-2">
          <CardTitle>Live Tracking</CardTitle>
          <CardDescription>Real-time trip updates</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3 animate-pulse" />
          <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse" />
        </CardContent>
      </Card>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="border-2 border-blue-200 bg-blue-50/30">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg">Live Tracking</CardTitle>
              <CardDescription>Real-time trip updates</CardDescription>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-semibold ${statusInfo.bg} ${statusInfo.color}`}>
              {statusInfo.label}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Driver Info */}
          {driverName && (
            <div className="pb-4 border-b border-blue-100">
              <p className="text-xs font-medium text-gray-600">Driver</p>
              <div className="flex items-center justify-between mt-2 gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  aria-hidden="true"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-800"
                >
                  {driverPhotoUrl ? (
                    <img
                      src={driverPhotoUrl}
                      alt=""
                      className="h-11 w-11 rounded-full object-cover"
                    />
                  ) : (
                    initials || 'D'
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">{publicDriverName}</p>
                  <p className="text-sm text-gray-600">{driverProfile?.vehicleType || vehicleType}</p>
                  <p className="text-xs text-gray-500 font-mono">{driverProfile?.plateNumber || vehiclePlate}</p>
                  {driverPhone && (
                    <a className="mt-1 inline-flex items-center gap-1 text-sm text-blue-700 underline" href={`tel:${driverPhone}`}>
                      <Phone size={14} aria-hidden="true" />
                      Call driver
                    </a>
                  )}
                  {driverProfile?.verified && (
                    <p className="mt-1 text-xs font-semibold text-green-700">Verified by admin</p>
                  )}
                  {driverProfile?.licenseExpired ? (
                    <p className="mt-1 text-xs text-red-700">License expired</p>
                  ) : licenseValidUntil ? (
                    <p className="mt-1 text-xs text-gray-600">License valid until {licenseValidUntil}</p>
                  ) : null}
                </div>
              </div>
                <div className="text-right">
                  <div className={`inline-block px-2 py-1 rounded text-xs font-semibold ${socketConnected ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-600'}`}>
                    {socketConnected ? '🟢 Live' : '⚪ Offline'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Location Info */}
          <div className="space-y-3">
            {currentLocation && (
              <div>
                <p className="text-xs font-medium text-gray-600">Current Location</p>
                <div className="flex items-start gap-2 mt-1">
                  <MapPin size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-gray-900">{currentLocation}</p>
                </div>
              </div>
            )}

            {destination && (
              <div>
                <p className="text-xs font-medium text-gray-600">Destination</p>
                <div className="flex items-start gap-2 mt-1">
                  <MapPin size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-gray-900">{destination}</p>
                </div>
              </div>
            )}

            {estimatedArrival && (
              <div>
                <p className="text-xs font-medium text-gray-600">Estimated Arrival</p>
                <div className="flex items-start gap-2 mt-1">
                  <Clock size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-gray-900">{estimatedArrival}</p>
                </div>
              </div>
            )}
          </div>

          {/* Status Alert */}
          {!hasRecentLocationUpdate && (
            <motion.div
              className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2"
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <AlertCircle size={16} className="text-yellow-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-yellow-700">Waiting for live updates...</p>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
