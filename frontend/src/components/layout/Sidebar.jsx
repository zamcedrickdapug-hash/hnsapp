import { useState } from 'react'
import { motion } from 'framer-motion'
import { Menu, X, Home, Settings, LogOut, Bell, MapPin, Users, BarChart3 } from 'lucide-react'

export default function Sidebar({
  role = 'parent',
  userName = 'User',
  onLogout = () => {},
  currentPage = 'dashboard',
  onNavigate = () => {},
  isOpen = false,
  onToggle = () => {},
}) {
  const [notificationCount] = useState(0)

  const getNavItems = () => {
    const commonItems = [
      { id: 'dashboard', label: 'Dashboard', icon: Home },
      { id: 'notifications', label: 'Notifications', icon: Bell, badge: notificationCount },
      { id: 'settings', label: 'Settings', icon: Settings },
    ]

    const roleItems = {
      driver: [
        { id: 'dashboard', label: 'Dashboard', icon: Home },
        { id: 'trips', label: 'My Trips', icon: MapPin },
        { id: 'notifications', label: 'Notifications', icon: Bell, badge: notificationCount },
        { id: 'settings', label: 'Settings', icon: Settings },
      ],
      parent: [
        { id: 'dashboard', label: 'Dashboard', icon: Home },
        { id: 'trips', label: 'Trip History', icon: MapPin },
        { id: 'notifications', label: 'Notifications', icon: Bell, badge: notificationCount },
        { id: 'settings', label: 'Settings', icon: Settings },
      ],
      admin: [
        { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
        { id: 'users', label: 'Users', icon: Users },
        { id: 'notifications', label: 'Notifications', icon: Bell, badge: notificationCount },
        { id: 'settings', label: 'Settings', icon: Settings },
      ],
    }

    return roleItems[role] || commonItems
  }

  const navItems = getNavItems()

  return (
    <>
      {/* Mobile Toggle Button */}
      <motion.button
        className="fixed bottom-6 right-6 md:hidden z-40 w-14 h-14 bg-gradient-to-br from-primary-600 to-primary-500 rounded-full shadow-lg flex items-center justify-center text-white"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onToggle}
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </motion.button>

      {/* Overlay for mobile */}
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <motion.aside
        className={`fixed left-0 top-0 h-screen w-64 bg-white border-r border-gray-200 flex flex-col shadow-lg md:shadow-none transition-all duration-300 z-40 ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
        initial={false}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="h-20 flex items-center justify-between px-6 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">HS</span>
              </div>
              <span className="font-bold text-lg text-gray-900">H&S</span>
            </div>
            <motion.button
              className="md:hidden text-gray-500 hover:text-gray-900"
              onClick={onToggle}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <X size={20} />
            </motion.button>
          </div>

          {/* User Profile Section */}
          <div className="px-6 py-6 border-b border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-secondary-400 rounded-full flex items-center justify-center text-white font-semibold">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{userName}</p>
                <p className="text-xs text-gray-500 capitalize">{role}</p>
              </div>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = currentPage === item.id

              return (
                <motion.button
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id)
                    onToggle && onToggle()
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all relative group ${
                    isActive
                      ? 'bg-primary-100 text-primary-600'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  whileHover={{ x: 4 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Icon size={20} className="flex-shrink-0" />
                  <span className="text-sm font-medium flex-1 text-left">{item.label}</span>

                  {/* Badge */}
                  {item.badge > 0 && (
                    <motion.span
                      className="inline-flex items-center justify-center min-w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full"
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      {item.badge}
                    </motion.span>
                  )}

                  {/* Active indicator */}
                  {isActive && (
                    <motion.div
                      className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary-600 rounded-l-full"
                      layoutId="activeIndicator"
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                </motion.button>
              )
            })}
          </nav>

          {/* Footer Section */}
          <div className="px-4 py-6 border-t border-gray-100 space-y-3">
            <motion.button
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-red-50 hover:text-red-600 rounded-lg transition-all font-medium text-sm"
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.98 }}
            >
              <LogOut size={20} />
              <span>Logout</span>
            </motion.button>

            {/* Version Info */}
            <div className="text-center text-xs text-gray-400 py-2">
              <p>H&S Booking v1.0</p>
            </div>
          </div>
        </div>
      </motion.aside>

      {/* Spacer for desktop */}
      <div className="hidden md:block w-64 flex-shrink-0" />
    </>
  )
}
