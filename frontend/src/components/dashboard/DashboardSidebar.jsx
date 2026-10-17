/**
 * DashboardSidebar Component
 * ==========================
 * Reusable sidebar for all dashboards (driver, parent, admin)
 * Single source of truth for navigation across all roles
 * 
 * Architecture Decision:
 * - One sidebar component for all roles
 * - Role-based navigation via dashboardNavigation config
 * - Active link highlighting
 * - Smooth animations
 * 
 * Features:
 * - Role-based navigation items
 * - Active page highlighting
 * - Notification badges
 * - Professional animations
 * - User profile section
 */

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronRight, LogOut } from 'lucide-react'
import { getNavigationByRole, SECONDARY_NAVIGATION, DASHBOARD_CONFIG } from '../../constants/dashboardNavigation'

/**
 * DashboardSidebar Component
 * @param {Object} props
 * @param {string} props.role - User role (driver, parent, admin)
 * @param {string} props.currentPage - Current active page
 * @param {Function} props.onNavigate - Callback when navigation item clicked
 * @param {Function} props.onLogout - Callback for logout
 * @param {string} props.userName - User name for profile section
 * @param {Object} props.badgeValues - Dynamic badge values (e.g., newRequestCount)
 */
function DashboardSidebar({
  role = 'parent',
  currentPage = 'dashboard',
  onNavigate = () => {},
  onLogout = () => {},
  userName = 'User',
  badgeValues = {},
}) {
  const [expandedMenus, setExpandedMenus] = useState({})

  // Get navigation items for this role
  const navigationItems = getNavigationByRole(role)

  const toggleMenuExpand = (menuId) => {
    setExpandedMenus((prev) => ({
      ...prev,
      [menuId]: !prev[menuId],
    }))
  }

  const handleNavigate = (page) => {
    onNavigate(page)
  }

  // Sidebar content
  const sidebarContent = (
    <div className="dashboard-sidebar flex flex-col h-full bg-slate-900 text-slate-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center font-bold">
            HS
          </div>
          <span className="font-bold text-lg">H&S Booking</span>
        </div>
      </div>

      {/* User Profile Section */}
      <div className="px-6 py-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center font-bold text-sm">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{userName}</p>
            <p className="text-sm text-slate-300 capitalize">{role}</p>
          </div>
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 overflow-y-auto py-4">
        <div className="px-3 space-y-1">
          {navigationItems.map((item, index) => {
            const Icon = item.icon
            const isActive = currentPage === item.id
            const badgeValue = item.badge ? badgeValues[item.badge] : null

            return (
              <motion.button
                key={item.id}
                onClick={() => handleNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all group ${
                  isActive
                    ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-lg'
                    : 'text-slate-200 hover:bg-slate-800'
                }`}
                whileHover={{ x: 4 }}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  delay: index * DASHBOARD_CONFIG.ANIMATION_DELAY,
                  duration: 0.3,
                }}
              >
                <Icon size={20} className="flex-shrink-0" />
                <span className="flex-1 text-left text-sm font-medium">{item.label}</span>

                {/* Badge */}
                {badgeValue > 0 && (
                  <motion.span
                    className="bg-red-700 text-white text-sm font-bold rounded-full px-2 py-1"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500 }}
                  >
                    {badgeValue > 99 ? '99+' : badgeValue}
                  </motion.span>
                )}

                {isActive && (
                  <motion.div
                    className="absolute right-0 w-1 h-8 bg-white rounded-l-lg"
                    layoutId="activeNav"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                  />
                )}
              </motion.button>
            )
          })}
        </div>
      </nav>

      {/* Secondary Navigation */}
      <div className="border-t border-gray-800 px-3 py-4 space-y-1">
        {SECONDARY_NAVIGATION.map((item) => {
          const Icon = item.icon
          const isActive = currentPage === item.id

          return (
            <motion.button
              key={item.id}
              onClick={() => handleNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-all text-sm ${
                isActive ? 'bg-slate-700 text-white' : 'text-slate-200 hover:bg-slate-800'
              }`}
              whileHover={{ x: 4 }}
            >
              <Icon size={18} />
              <span className="flex-1 text-left">{item.label}</span>
            </motion.button>
          )
        })}
      </div>

      {/* Logout Button */}
      <div className="border-t border-gray-800 p-4">
        <motion.button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 text-slate-200 hover:bg-red-700 hover:text-white rounded-lg transition-all group"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <LogOut size={20} />
          <span className="text-sm font-medium">Logout</span>
        </motion.button>
      </div>
    </div>
  )

  return (
    <aside className="hidden md:flex flex-col w-72 bg-gray-900 border-r border-gray-800 h-screen sticky top-0">
      {sidebarContent}
    </aside>
  )
}

export default DashboardSidebar
