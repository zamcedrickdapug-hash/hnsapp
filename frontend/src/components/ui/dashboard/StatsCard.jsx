/**
 * StatsCard Component
 * ===================
 * Reusable card for displaying key statistics
 * Used across all dashboards for consistency
 * 
 * Architecture Decision:
 * - Generic component (no driver-specific logic)
 * - Accepts data and formatting as props
 * - Reusable across dashboards
 * - Professional animations
 */

import { motion } from 'framer-motion'

/**
 * StatsCard Component
 * @param {Object} props
 * @param {React.ReactNode} props.icon - Icon component
 * @param {string} props.label - Card label
 * @param {string|number} props.value - Main value to display
 * @param {string} props.unit - Unit of measurement
 * @param {string} props.trend - Trend indicator (up/down/stable)
 * @param {string} props.trendValue - Trend percentage or change
 * @param {string} props.color - Color theme (blue, green, purple, etc)
 * @param {string} props.description - Optional description
 * @param {Function} props.onClick - Optional click handler
 */
function StatsCard({
  icon: Icon,
  label = 'Statistic',
  value = '--',
  unit = '',
  trend = null,
  trendValue = '',
  color = 'blue',
  description = '',
  onClick = null,
}) {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    purple: 'from-purple-500 to-purple-600',
    orange: 'from-orange-500 to-orange-600',
    red: 'from-red-500 to-red-600',
    yellow: 'from-yellow-500 to-yellow-600',
    cyan: 'from-cyan-500 to-cyan-600',
  }

  const gradientClass = colorClasses[color] || colorClasses.blue

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      onClick={onClick}
      className={`bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow ${onClick ? 'cursor-pointer' : ''}`}
      whileHover={onClick ? { y: -4 } : {}}
    >
      {/* Icon & Label */}
      <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 bg-gradient-to-br ${gradientClass} rounded-lg flex items-center justify-center`}>
          {Icon && <Icon size={24} className="text-white" />}
        </div>
        {trend && (
          <span className={`text-sm font-semibold ${trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-600'}`}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendValue}
          </span>
        )}
      </div>

      <p className="text-gray-600 text-sm font-medium mb-2">{label}</p>

      {/* Main Value */}
      <p className="text-3xl font-bold text-gray-900 mb-1">
        {value}
        {unit && <span className="text-lg text-gray-500 ml-2">{unit}</span>}
      </p>

      {/* Description */}
      {description && <p className="text-xs text-gray-500">{description}</p>}
    </motion.div>
  )
}

export default StatsCard
