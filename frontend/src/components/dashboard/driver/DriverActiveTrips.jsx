/**
 * DriverActiveTrips Component
 * ===========================
 * Displays active trips with real-time updates
 * Shows map view and trip details
 * 
 * Features:
 * - Live map with driver location
 * - Active trip details
 * - Trip progress indicators
 * - Trip completion actions
 */

import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Phone, User, CheckCircle2, Navigation } from 'lucide-react'
import DashboardCard from '../../ui/dashboard/DashboardCard'
import EmptyState from '../../ui/dashboard/EmptyState'
import LoadingState from '../../ui/dashboard/LoadingState'
import { formatLocation } from '../../../utils/driverDashboard'

/**
 * DriverActiveTrips Component
 * @param {Object} props
 * @param {Array} props.trips - Active trips array
 * @param {boolean} props.isLoading - Loading state
 * @param {Function} props.onTripAction - Callback for trip actions
 * @param {React.ReactNode} props.mapComponent - Map component to display
 */
function DriverActiveTrips({
  trips = [],
  isLoading = false,
  onTripAction = () => {},
  mapComponent = null,
}) {
  const activeTrips = trips.filter((trip) => trip.status === 'accepted')

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Map Section */}
      {mapComponent && (
        <DashboardCard title="Live Location" description="Real-time GPS tracking">
          <div className="bg-gray-100 rounded-lg overflow-hidden" style={{ height: '400px' }}>
            {mapComponent}
          </div>
        </DashboardCard>
      )}

      {/* Active Trips List */}
      <DashboardCard
        title="Active Trips"
        description={`${activeTrips.length} trip${activeTrips.length !== 1 ? 's' : ''} in progress`}
        isLoading={isLoading}
        isEmpty={activeTrips.length === 0 && !isLoading}
        emptyMessage="No active trips. Waiting for new requests."
      >
        <div className="space-y-4">
          <AnimatePresence>
            {activeTrips.map((trip, index) => (
              <motion.div
                key={trip._id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: index * 0.1 }}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                {/* Trip Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">{trip.requesterName || 'Trip'}</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      {trip.requestType === 'pickup' ? '📍 Pickup' : '🏫 Dropoff'}
                    </p>
                  </div>
                  <motion.span
                    className="px-3 py-1 bg-green-100 text-green-800 text-sm font-semibold rounded-full"
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    Active
                  </motion.span>
                </div>

                {/* Trip Details Grid */}
                <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                  {/* Location */}
                  <div className="flex items-start gap-2">
                    <MapPin size={16} className="text-primary-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-gray-600 text-sm">Location</p>
                      <p className="text-gray-900 font-medium">{formatLocation(trip.requesterLocation)}</p>
                    </div>
                  </div>

                  {/* Contact */}
                  <div className="flex items-start gap-2">
                    <Phone size={16} className="text-primary-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-gray-600 text-sm">Contact</p>
                      <p className="text-gray-900 font-medium">{trip.requesterPhone || 'N/A'}</p>
                    </div>
                  </div>

                  {/* Student Name */}
                  <div className="flex items-start gap-2">
                    <User size={16} className="text-primary-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-gray-600 text-sm">Student</p>
                      <p className="text-gray-900 font-medium">{trip.studentName || 'Unknown'}</p>
                    </div>
                  </div>

                  {/* Duration */}
                  <div className="flex items-start gap-2">
                    <Navigation size={16} className="text-primary-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-gray-600 text-sm">Duration</p>
                      <p className="text-gray-900 font-medium">{trip.estimatedDuration || '--'} min</p>
                    </div>
                  </div>
                </div>

                {/* Trip Progress */}
                <div className="bg-gray-100 rounded-lg p-2 mb-4">
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                    <span>Progress</span>
                    <span>{trip.progress || 0}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-primary-500 to-primary-600"
                      initial={{ width: 0 }}
                      animate={{ width: `${trip.progress || 0}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <motion.button
                    onClick={() => onTripAction('arrived', trip._id)}
                    className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <CheckCircle2 size={16} />
                    Mark Arrived
                  </motion.button>

                  <motion.button
                    onClick={() => onTripAction('contact', trip._id)}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Phone size={16} />
                    Contact
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </DashboardCard>
    </motion.div>
  )
}

export default DriverActiveTrips
