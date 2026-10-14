/**
 * DriverEarningsPanel Component
 * =============================
 * Displays earnings summary and financial information
 * 
 * Shows:
 * - Daily earnings
 * - Weekly earnings
 * - Monthly earnings
 * - Pending payments
 */

import { motion } from 'framer-motion'
import { TrendingUp, DollarSign, Calendar, Wallet } from 'lucide-react'
import DashboardCard from '../../ui/dashboard/DashboardCard'

/**
 * DriverEarningsPanel Component
 * @param {Object} props
 * @param {number} props.dailyEarnings - Today's earnings (in cents)
 * @param {number} props.weeklyEarnings - This week's earnings (in cents)
 * @param {number} props.monthlyEarnings - This month's earnings (in cents)
 * @param {number} props.pendingPayments - Pending payment amount (in cents)
 * @param {boolean} props.isLoading - Loading state
 * @param {Function} props.onWithdraw - Callback for withdrawal action
 */
function DriverEarningsPanel({
  dailyEarnings = 0,
  weeklyEarnings = 0,
  monthlyEarnings = 0,
  pendingPayments = 0,
  isLoading = false,
  onWithdraw = () => {},
}) {
  const formatCurrency = (amount) => (amount / 100).toFixed(2)

  const earningsData = [
    {
      id: 'daily',
      icon: DollarSign,
      label: 'Today',
      amount: dailyEarnings,
      color: 'blue',
    },
    {
      id: 'weekly',
      icon: Calendar,
      label: 'This Week',
      amount: weeklyEarnings,
      color: 'green',
    },
    {
      id: 'monthly',
      icon: TrendingUp,
      label: 'This Month',
      amount: monthlyEarnings,
      color: 'purple',
    },
    {
      id: 'pending',
      icon: Wallet,
      label: 'Pending',
      amount: pendingPayments,
      color: 'orange',
    },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <DashboardCard
        title="Earnings Summary"
        description="Financial overview and payment status"
        isLoading={isLoading}
      >
        <div className="space-y-6">
          {/* Earnings Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {earningsData.map((item, index) => {
              const Icon = item.icon
              const colorClasses = {
                blue: 'from-blue-500 to-blue-600',
                green: 'from-green-500 to-green-600',
                purple: 'from-purple-500 to-purple-600',
                orange: 'from-orange-500 to-orange-600',
              }

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-gray-50 rounded-lg p-4 text-center"
                >
                  <div className={`w-10 h-10 bg-gradient-to-br ${colorClasses[item.color]} rounded-lg flex items-center justify-center mx-auto mb-2`}>
                    <Icon size={20} className="text-white" />
                  </div>
                  <p className="text-xs font-medium text-gray-600 mb-1">{item.label}</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${formatCurrency(item.amount)}
                  </p>
                </motion.div>
              )
            })}
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200" />

          {/* Payment Actions */}
          <div className="space-y-3">
            <h4 className="font-semibold text-gray-900 text-sm">Payment Methods</h4>
            <div className="space-y-2">
              <motion.button
                onClick={() => onWithdraw('bank')}
                className="w-full px-4 py-3 border border-primary-500 text-primary-600 font-medium rounded-lg hover:bg-primary-50 transition-colors text-sm"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Withdraw to Bank Account
              </motion.button>
              <motion.button
                onClick={() => onWithdraw('wallet')}
                className="w-full px-4 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors text-sm"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Withdraw to E-Wallet
              </motion.button>
            </div>
          </div>

          {/* Payment Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-blue-900 mb-2">💡 Payment Information</p>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• Payments are processed every Friday</li>
              <li>• Minimum withdrawal: $5.00</li>
              <li>• Processing time: 2-3 business days</li>
            </ul>
          </div>
        </div>
      </DashboardCard>
    </motion.div>
  )
}

export default DriverEarningsPanel
