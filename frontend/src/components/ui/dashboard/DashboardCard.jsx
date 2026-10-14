/**
 * DashboardCard Component
 * =======================
 * Generic container for dashboard sections
 * Used for consistent card styling across dashboards
 * 
 * Features:
 * - Flexible header with title and action buttons
 * - Loading state support
 * - Error state support
 * - Responsive design
 */

import { motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'

/**
 * DashboardCard Component
 * @param {Object} props
 * @param {string} props.title - Card title
 * @param {string} props.description - Optional card description
 * @param {React.ReactNode} props.children - Card content
 * @param {React.ReactNode} props.action - Optional action button(s)
 * @param {boolean} props.isLoading - Loading state
 * @param {string} props.error - Error message if any
 * @param {boolean} props.isEmpty - Empty state indicator
 * @param {string} props.emptyMessage - Message when empty
 * @param {Function} props.onRefresh - Optional refresh callback
 * @param {string} props.className - Additional CSS classes
 */
function DashboardCard({
  title = 'Section',
  description = '',
  children,
  action = null,
  isLoading = false,
  error = null,
  isEmpty = false,
  emptyMessage = 'No data available',
  onRefresh = null,
  className = '',
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow ${className}`}
    >
      {/* Card Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200">
        <div className="flex-1">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          {description && <p className="text-sm text-gray-600 mt-1">{description}</p>}
        </div>
        {action && <div className="flex items-center gap-2 ml-4">{action}</div>}
      </div>

      {/* Card Content */}
      <div className="p-6">
        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
              <p className="text-sm text-gray-600">Loading...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <div className="text-red-600 mt-0.5">⚠️</div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-900">Error</p>
              <p className="text-sm text-red-800 mt-1">{error}</p>
            </div>
            {onRefresh && (
              <motion.button
                onClick={onRefresh}
                className="text-sm text-red-600 hover:text-red-700 font-medium ml-2"
                whileHover={{ scale: 1.05 }}
              >
                Retry
              </motion.button>
            )}
          </div>
        )}

        {/* Empty State */}
        {isEmpty && !isLoading && !error && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="text-gray-400 text-4xl mb-3">📭</div>
            <p className="text-gray-600 text-center">{emptyMessage}</p>
          </div>
        )}

        {/* Content */}
        {!isLoading && !error && !isEmpty && children}
      </div>
    </motion.div>
  )
}

export default DashboardCard
