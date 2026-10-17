/**
 * DriverStatsCards Component
 * ==========================
 * Displays key driver statistics and metrics
 * Part of the modular driver dashboard
 * 
 * Displays:
 * - Incoming requests
 * - Active trips
 * - Completed trips today
 */

import { motion } from 'framer-motion'
import { Clock, Navigation, CheckCircle2 } from 'lucide-react'
import StatsCard from '../../ui/dashboard/StatsCard'

/**
 * DriverStatsCards Component
 * @param {Object} props
 * @param {number} props.incomingCount - Number of incoming requests
 * @param {number} props.activeTripsCount - Number of active trips
 * @param {number} props.completedTripsCount - Trips completed today
 * @param {boolean} props.isLoading - Loading state
 */
function DriverStatsCards({
  incomingCount = 0,
  activeTripsCount = 0,
  completedTripsCount = 0,
  isLoading = false,
}) {
  const stats = [
    {
      id: 'incoming',
      icon: Clock,
      label: 'Incoming Requests',
      value: incomingCount,
      color: 'orange',
      trend: incomingCount > 0 ? 'up' : 'stable',
    },
    {
      id: 'active',
      icon: Navigation,
      label: 'Active Trips',
      value: activeTripsCount,
      color: 'blue',
      description: 'In progress',
    },
    {
      id: 'completed',
      icon: CheckCircle2,
      label: 'Completed Today',
      value: completedTripsCount,
      color: 'green',
    },
  ]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8"
    >
      {stats.map((stat, index) => (
        <motion.div
          key={stat.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1, duration: 0.3 }}
        >
          <StatsCard
            icon={stat.icon}
            label={stat.label}
            value={isLoading ? '--' : stat.value}
            unit={stat.unit || ''}
            color={stat.color}
            trend={stat.trend}
            description={stat.description}
          />
        </motion.div>
      ))}
    </motion.div>
  )
}

export default DriverStatsCards
