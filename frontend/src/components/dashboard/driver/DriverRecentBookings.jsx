/**
 * DriverRecentBookings Component
 * ==============================
 * Displays recent booking history
 * Shows completed trips with details
 * 
 * Features:
 * - Trip list with status
 * - Trip details
 * - Rating/review section
 * - Trip receipt access
 */

import { motion, AnimatePresence } from 'framer-motion'
import { Star, MapPin, Clock, User, FileText } from 'lucide-react'
import DashboardCard from '../../ui/dashboard/DashboardCard'
import EmptyState from '../../ui/dashboard/EmptyState'
import { formatDate } from '../../../utils/driverDashboard'

/**
 * DriverRecentBookings Component
 * @param {Object} props
 * @param {Array} props.bookings - Recent bookings array
 * @param {boolean} props.isLoading - Loading state
 * @param {Function} props.onViewReceipt - Callback for view receipt
 * @param {Function} props.onRateTrip - Callback for rating trip
 */
function DriverRecentBookings({
  bookings = [],
  isLoading = false,
  onViewReceipt = () => {},
  onRateTrip = () => {},
}) {
  // Get recent bookings (limit to last 5)
  const recentBookings = bookings.slice(0, 5)

  const getStatusBadge = (status) => {
    const statusConfig = {
      completed: { bg: 'bg-green-100', text: 'text-green-800', label: 'Completed' },
      cancelled: { bg: 'bg-red-100', text: 'text-red-800', label: 'Cancelled' },
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pending' },
    }
    return statusConfig[status] || statusConfig.pending
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <DashboardCard
        title="Recent Bookings"
        description={`${recentBookings.length} recent trip${recentBookings.length !== 1 ? 's' : ''}`}
        isLoading={isLoading}
        isEmpty={recentBookings.length === 0 && !isLoading}
        emptyMessage="No bookings yet. Check back when you complete trips!"
      >
        <div className="space-y-3">
          <AnimatePresence>
            {recentBookings.map((booking, index) => {
              const statusBadge = getStatusBadge(booking.status)

              return (
                <motion.div
                  key={booking._id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: index * 0.1 }}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  {/* Booking Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-gray-900">{booking.studentName || 'Trip'}</h4>
                        <span className={`px-2 py-1 text-sm font-semibold rounded-full ${statusBadge.bg} ${statusBadge.text}`}>
                          {statusBadge.label}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{formatDate(booking.createdAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">${(booking.amount / 100).toFixed(2)}</p>
                      <p className="text-sm text-gray-600 mt-1">Fare</p>
                    </div>
                  </div>

                  {/* Booking Details */}
                  <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                    <div className="flex items-start gap-2">
                      <User size={16} className="text-primary-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-gray-600 text-sm">Parent</p>
                        <p className="text-gray-900 font-medium">{booking.requesterName || 'N/A'}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <Clock size={16} className="text-primary-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-gray-600 text-sm">Duration</p>
                        <p className="text-gray-900 font-medium">{booking.duration || '--'} min</p>
                      </div>
                    </div>
                  </div>

                  {/* Rating Section */}
                  {booking.status === 'completed' && !booking.rating && (
                    <div className="bg-yellow-50 rounded-lg p-3 mb-4">
                      <p className="text-sm font-medium text-yellow-900 mb-2">⭐ Rate this trip</p>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <motion.button
                            key={star}
                            onClick={() => onRateTrip(booking._id, star)}
                            className="text-xl text-gray-300 hover:text-yellow-400 transition-colors"
                            whileHover={{ scale: 1.2 }}
                            whileTap={{ scale: 0.9 }}
                          >
                            ★
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <motion.button
                      onClick={() => onViewReceipt(booking._id)}
                      className="flex-1 px-4 py-2 border border-gray-300 hover:bg-gray-100 text-gray-700 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <FileText size={16} />
                      Receipt
                    </motion.button>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </DashboardCard>
    </motion.div>
  )
}

export default DriverRecentBookings
