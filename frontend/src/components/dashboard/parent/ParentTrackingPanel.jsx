/**
 * ParentTrackingPanel Component
 * =============================
 * Live tracking display for active trip with real-time updates
 * 
 * Architecture: Reusable component showing current trip details
 * Shows: Driver info, vehicle details, location, ETA, trip progress
 */

import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card'
import { Phone, MapPin, Clock, AlertCircle } from 'lucide-react'

export function ParentTrackingPanel({
  tripStatus = 'waiting',
  driverName = null,
  vehicleType = 'School Service Van',
  vehiclePlate = 'Not Available',
  currentLocation = null,
  destination = null,
  estimatedArrival = null,
  socketConnected = false,
  isLoading = false,
}) {
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
              <div className="flex items-center justify-between mt-2">
                <div>
                  <p className="font-semibold text-gray-900">{driverName}</p>
                  <p className="text-sm text-gray-600">{vehicleType}</p>
                  <p className="text-xs text-gray-500 font-mono">{vehiclePlate}</p>
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
          {!socketConnected && (
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
