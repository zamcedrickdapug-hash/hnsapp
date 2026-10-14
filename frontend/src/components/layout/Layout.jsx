import { useState } from 'react'
import { motion } from 'framer-motion'
import Sidebar from './Sidebar'

export default function Layout({
  role = 'parent',
  userName = 'User',
  currentPage = 'dashboard',
  onNavigate = () => {},
  onLogout = () => {},
  children,
  pageTitle = 'Dashboard',
  pageDescription = '',
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleNavigate = (pageId) => {
    onNavigate(pageId)
    setSidebarOpen(false)
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        role={role}
        userName={userName}
        currentPage={currentPage}
        onNavigate={handleNavigate}
        onLogout={onLogout}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="hidden md:flex h-20 bg-white border-b border-gray-200 items-center px-8 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{pageTitle}</h1>
            {pageDescription && (
              <p className="text-sm text-gray-600 mt-1">{pageDescription}</p>
            )}
          </div>
        </header>

        {/* Scrollable Content Area */}
        <main className="flex-1 overflow-y-auto">
          <motion.div
            className="md:p-8 p-4 pb-20 md:pb-8"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            {/* Mobile Header */}
            <div className="md:hidden mb-6">
              <h1 className="text-2xl font-bold text-gray-900">{pageTitle}</h1>
              {pageDescription && (
                <p className="text-sm text-gray-600 mt-1">{pageDescription}</p>
              )}
            </div>

            {/* Page Content */}
            {children}
          </motion.div>
        </main>
      </div>

      {/* Mobile Safe Area for FAB Button */}
      <div className="md:hidden fixed bottom-20 right-0 w-full h-6 pointer-events-none" />
    </div>
  )
}
