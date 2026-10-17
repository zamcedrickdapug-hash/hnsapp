/**
 * DashboardHeader Component
 * =========================
 * Reusable header for all dashboards
 * Shows page title, notifications, and user profile
 * 
 * Architecture Decision:
 * - Single header component replaces scattered header logic
 * - Responsive design for mobile and desktop
 * - Notification badge support
 * - User profile menu (logout, settings)
 * 
 * Features:
 * - Notification indicator
 * - User profile dropdown
 * - Professional animations
 * - Consistent styling across dashboards
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, User, LogOut, Settings, ChevronDown } from 'lucide-react'

/**
 * DashboardHeader Component
 * @param {Object} props
 * @param {string} props.title - Page title
 * @param {string} props.userName - User name for profile
 * @param {number} props.notificationCount - Number of unread notifications
 * @param {Function} props.onNotificationClick - Callback for notification bell
 * @param {Function} props.onSettingsClick - Callback for settings
 * @param {Function} props.onLogout - Callback for logout
 */
function DashboardHeader({
  role = 'parent',
  title = 'Dashboard',
  description = '',
  userName = 'User',
  notificationCount = 0,
  onNotificationClick = () => {},
  onSettingsClick = () => {},
  onLogout = () => {},
}) {
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)

  return (
    <>
      {/* Desktop Header */}
      <header className="dashboard-header hidden md:flex h-20 bg-white border-b border-gray-200 items-center justify-between px-8 shadow-sm sticky top-0 z-40">
        {/* Left: Title */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {description && <p className="dashboard-header__description">{description}</p>}
        </div>

        {/* Right: Actions & Profile */}
        <div className="flex items-center gap-6">
          {/* Notifications */}
          <motion.button
            onClick={onNotificationClick}
            className="relative shrink-0 p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            aria-label="Notifications"
          >
            <Bell size={24} />
            {notificationCount > 0 && (
              <motion.span
                className="absolute top-1 right-1 bg-red-700 text-white text-sm font-bold rounded-full min-w-5 min-h-5 flex items-center justify-center"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              >
                {notificationCount > 99 ? '99+' : notificationCount}
              </motion.span>
            )}
          </motion.button>

          {/* Profile Dropdown */}
          <div className="relative">
            <motion.button
              onClick={() => setProfileMenuOpen(!profileMenuOpen)}
              className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100 rounded-lg transition-colors group"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center">
                <User size={20} className="text-white" />
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-sm font-semibold text-gray-900">{userName}</p>
                <p className="text-sm text-gray-600">Profile</p>
              </div>
              <ChevronDown
                size={18}
                className={`text-gray-600 transition-transform ${profileMenuOpen ? 'rotate-180' : ''}`}
              />
            </motion.button>

            {/* Dropdown Menu */}
            <AnimatePresence>
              {profileMenuOpen && (
                <motion.div
                  initial={role === 'admin' ? { y: 0, scale: 1 } : { opacity: 0, y: -10, scale: 0.95 }}
                  animate={role === 'admin' ? { y: 0, scale: 1 } : { opacity: 1, y: 0, scale: 1 }}
                  exit={role === 'admin' ? { y: 0, scale: 1 } : { opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-50"
                >
                  {/* Menu Items */}
                  <motion.button
                    onClick={() => {
                      onSettingsClick()
                      setProfileMenuOpen(false)
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 transition-colors text-left"
                    whileHover={{ x: 4 }}
                  >
                    <Settings size={18} className="text-gray-600" />
                    <span className="text-sm font-medium">Settings</span>
                  </motion.button>

                  <div className="border-t border-gray-200" />

                  <motion.button
                    onClick={() => {
                      onLogout()
                      setProfileMenuOpen(false)
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 transition-colors text-left"
                    whileHover={{ x: 4 }}
                  >
                    <LogOut size={18} />
                    <span className="text-sm font-medium">Logout</span>
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Mobile Header */}
      <header className="dashboard-header dashboard-mobile-header md:hidden sticky top-0 z-40 flex items-center justify-between border-b border-gray-200 bg-white">
        {/* Mobile Title */}
        {role === 'admin' ? (
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-left text-lg font-semibold text-gray-900" title={title}>{title}</h1>
            {description && <p className="dashboard-header__description dashboard-header__description--mobile truncate">{description}</p>}
          </div>
        ) : (
          <h1 className="min-w-0 flex-1 truncate text-left text-lg font-semibold text-gray-900" title={title}>{title}</h1>
        )}

        {/* Mobile Actions */}
        <div className="ml-2 flex shrink-0 items-center gap-1">
          {/* Mobile Notifications */}
          <motion.button
            onClick={onNotificationClick}
            className="relative flex h-11 w-11 items-center justify-center rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            aria-label="Notifications"
          >
            <Bell size={22} />
            {notificationCount > 0 && (
              <motion.span
                className="absolute top-0 right-0 bg-red-700 text-white text-sm font-bold rounded-full min-w-5 min-h-5 flex items-center justify-center"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
              >
                {notificationCount > 9 ? '9+' : notificationCount}
              </motion.span>
            )}
          </motion.button>

          {/* Mobile Profile */}
          <motion.button
            onClick={() => setProfileMenuOpen(!profileMenuOpen)}
            className="flex h-11 w-11 items-center justify-center rounded-lg p-2 transition-colors hover:bg-gray-100"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            aria-label="Open profile menu"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-primary-700">
              <User size={16} className="text-white" />
            </div>
          </motion.button>
        </div>

        {/* Mobile Dropdown */}
        <AnimatePresence>
          {profileMenuOpen && (
            <motion.div
              initial={role === 'admin' ? { y: 0 } : { opacity: 0, y: -10 }}
              animate={role === 'admin' ? { y: 0 } : { opacity: 1, y: 0 }}
              exit={role === 'admin' ? { y: 0 } : { opacity: 0, y: -10 }}
              className="dashboard-mobile-profile-menu absolute right-4 z-50 w-44 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
            >
              <motion.button
                onClick={() => {
                  onSettingsClick()
                  setProfileMenuOpen(false)
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 text-left"
              >
                <Settings size={16} />
                <span className="text-sm font-medium">Settings</span>
              </motion.button>

              <div className="border-t border-gray-200" />

              <motion.button
                onClick={() => {
                  onLogout()
                  setProfileMenuOpen(false)
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 text-left"
              >
                <LogOut size={16} />
                <span className="text-sm font-medium">Logout</span>
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
    </>
  )
}

export default DashboardHeader
