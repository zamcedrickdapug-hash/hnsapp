/**
 * DashboardLayout Component
 * =========================
 * Main layout wrapper for all dashboard pages
 * Combines DashboardSidebar, DashboardHeader, and content area
 * 
 * Architecture Decision:
 * - Single layout component used by all dashboard pages
 * - Replaces scattered layout logic across DriverDashboard, ParentDashboard, admin.jsx
 * - Provides consistent responsive behavior
 * - Manages overall dashboard structure
 * 
 * Usage in dashboards:
 * <DashboardLayout
 *   role="driver"
 *   userName="John Doe"
 *   currentPage="dashboard"
 *   onNavigate={handleNavigate}
 *   onLogout={handleLogout}
 *   pageTitle="Driver Dashboard"
 * >
 *   Dashboard content goes here
 * </DashboardLayout>
 * 
 * Benefits:
 * - Eliminates 600+ lines of layout code per dashboard
 * - Consistent UX across all dashboards
 * - Easy to maintain
 * - Easy to add new dashboards
 */

import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import DashboardSidebar from './DashboardSidebar'
import DashboardHeader from './DashboardHeader'
import MobileBottomNav from './MobileBottomNav'
import { useNotifications } from '../../context/NotificationContext'

/**
 * DashboardLayout Component
 * Main layout wrapper for all dashboards
 * 
 * @param {Object} props
 * @param {string} props.role - User role (driver, parent, admin)
 * @param {string} props.userName - User name
 * @param {string} props.currentPage - Current active page/section
 * @param {Function} props.onNavigate - Callback when navigating to different page
 * @param {Function} props.onLogout - Callback for logout
 * @param {string} props.pageTitle - Title shown in header
 * @param {string} props.pageDescription - Subtitle/description in header
 * @param {React.ReactNode} props.children - Dashboard content
 * @param {number} props.notificationCount - Number of notifications to show
 * @param {Function} props.onNotificationClick - Callback for notification click
 * @param {Object} props.badgeValues - Dynamic badge values (e.g., newRequestCount)
 * @param {React.ReactNode} props.topBar - Custom top bar content (optional)
 * @param {string} props.contentClassName - Additional classes for content area
 */
function DashboardLayout({
  role = 'parent',
  userName = 'User',
  currentPage = 'dashboard',
  onNavigate = () => {},
  onLogout = () => {},
  pageTitle = 'Dashboard',
  pageDescription = '',
  children,
  notificationCount = 0,
  onNotificationClick = () => {},
  badgeValues = {},
  topBar = null,
  contentClassName = '',
}) {
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false)
  const { unreadCount: unreadNotificationCount } = useNotifications()

  const handleNotificationClick = useCallback(() => {
    setNotificationPanelOpen((prev) => !prev)
    onNotificationClick?.()
  }, [onNotificationClick])

  return (
    <div className="dashboard-layout-shell flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <DashboardSidebar
        role={role}
        currentPage={currentPage}
        onNavigate={onNavigate}
        onLogout={onLogout}
        userName={userName}
        badgeValues={badgeValues}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <DashboardHeader
          title={pageTitle}
          userName={userName}
          notificationCount={notificationCount}
          onNotificationClick={handleNotificationClick}
          onLogout={onLogout}
        />

        {/* Custom Top Bar (optional) */}
        {topBar && <div className="border-b border-gray-200">{topBar}</div>}

        {/* Scrollable Content */}
        <main className="dashboard-main-scroll flex-1 overflow-y-auto overflow-x-hidden">
          <motion.div
            className={`w-full h-full ${contentClassName}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            {/* Mobile Safe Area Padding */}
            <div className="dashboard-mobile-content p-4 md:p-8">
              {children}
            </div>
          </motion.div>
        </main>
      </div>

      {/* Notification Panel (optional - if you want a side panel) */}
      {notificationPanelOpen && (
        <motion.aside
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          className="w-96 bg-white border-l border-gray-200 hidden lg:flex flex-col"
        >
          {/* Notification panel content here */}
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900">Notifications</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <p className="text-gray-500 text-center py-8">No notifications</p>
          </div>
        </motion.aside>
      )}

      <MobileBottomNav
        role={role}
        currentPage={currentPage}
        onNavigate={onNavigate}
        onLogout={onLogout}
        badgeValues={badgeValues}
        notificationUnreadCount={unreadNotificationCount}
      />
    </div>
  )
}

export default DashboardLayout
