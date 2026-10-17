/**
 * AdminStatsCards Component
 * ========================
 * Displays key metrics for admin dashboard
 * 
 * Architecture: Reusable stats display component following DriverStatsCards pattern
 * Shows: Total registrations, pending approvals, active drivers, system metrics
 */

import { motion } from 'framer-motion'
import { Users, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card'

const statsConfig = [
  {
    label: 'Total Registrations',
    icon: Users,
    colorClass: 'text-blue-800',
    bgClass: 'bg-blue-50',
  },
  {
    label: 'Pending Approvals',
    icon: Clock,
    colorClass: 'text-yellow-800',
    bgClass: 'bg-yellow-50',
  },
  {
    label: 'Approved Users',
    icon: CheckCircle,
    colorClass: 'text-green-800',
    bgClass: 'bg-green-50',
  },
  {
    label: 'System Alerts',
    icon: AlertCircle,
    colorClass: 'text-red-800',
    bgClass: 'bg-red-50',
  },
]

export function AdminStatsCards({
  totalRegistrations = 0,
  pendingApprovals = 0,
  approvedUsers = 0,
  systemAlerts = 0,
  isLoading = false,
}) {
  const statsData = [totalRegistrations, pendingApprovals, approvedUsers, systemAlerts]

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsConfig.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-on-dark-label">{stat.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-gray-200 rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {statsConfig.map((stat, index) => {
        const Icon = stat.icon
        const value = statsData[index]

        return (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-on-dark-label">{stat.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-3xl font-bold text-on-dark-primary">{value}</div>
                  <div className={`${stat.bgClass} p-3 rounded-lg`}>
                    <Icon className={`w-6 h-6 ${stat.colorClass}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )
      })}
    </div>
  )
}
