/**
 * Dashboard Navigation Configuration
 * =====================================
 * Centralized navigation structure for all dashboard roles
 * Eliminates duplicate navigation logic across DriverDashboard, ParentDashboard, AdminDashboard
 * 
 * Architecture Decision:
 * - Single source of truth for all navigation items
 * - Role-based filtering at component level
 * - Icon configuration for Framer Motion animations
 * - URL paths for React Router integration
 */

import {
  LayoutDashboard,
  MapPin,
  Clock,
  Settings,
  Bell,
  CreditCard,
  Users,
  FileCheck,
  BarChart3,
  AlertTriangle,
  MessageSquare,
  HelpCircle,
} from 'lucide-react'

/**
 * DRIVER DASHBOARD NAVIGATION
 * Navigation structure for driver role
 */
export const DRIVER_NAVIGATION = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    path: '/driver/dashboard',
    description: 'Overview and active trips',
    color: 'from-blue-500 to-blue-600',
  },
  {
    id: 'requests',
    label: 'Trip Requests',
    icon: Clock,
    path: '/driver/requests',
    description: 'Incoming booking requests',
    color: 'from-purple-500 to-purple-600',
    badge: 'newRequestCount', // Key for dynamic badge value
  },
  {
    id: 'messages',
    label: 'Messages',
    icon: MessageSquare,
    path: '/driver/messages',
    description: 'Conversations with parents',
    color: 'from-pink-500 to-pink-600',
    badge: 'unreadMessageCount',
  },
  {
    id: 'trips',
    label: 'Trip History',
    icon: MapPin,
    path: '/driver/trips',
    description: 'Completed and past trips',
    color: 'from-green-500 to-green-600',
  },
  {
    id: 'payments',
    label: 'Payments',
    icon: CreditCard,
    path: '/driver/payments',
    description: 'Verify submitted payments and record cash',
    color: 'from-yellow-500 to-yellow-600',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    path: '/driver/settings',
    description: 'Profile and preferences',
    color: 'from-gray-500 to-gray-600',
  },
]

/**
 * PARENT DASHBOARD NAVIGATION
 * Navigation structure for parent role
 */
export const PARENT_NAVIGATION = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    path: '/parent/dashboard',
    description: 'Overview and active trips',
    color: 'from-blue-500 to-blue-600',
  },
  {
    id: 'trips',
    label: 'Trip History',
    icon: MapPin,
    path: '/parent/trips',
    description: 'View past bookings and receipts',
    color: 'from-cyan-500 to-cyan-600',
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: Bell,
    path: '/parent/notifications',
    description: 'Trip alerts and updates',
    color: 'from-orange-500 to-orange-600',
  },
  {
    id: 'messages',
    label: 'Messages',
    icon: MessageSquare,
    path: '/parent/messages',
    description: 'Communication with drivers',
    color: 'from-pink-500 to-pink-600',
    badge: 'unreadMessageCount',
  },
  {
    id: 'payments',
    label: 'Payments',
    icon: CreditCard,
    path: '/parent/payments',
    description: 'Billing and invoices',
    color: 'from-yellow-500 to-yellow-600',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    path: '/parent/settings',
    description: 'Profile and preferences',
    color: 'from-gray-500 to-gray-600',
  },
]

/**
 * ADMIN DASHBOARD NAVIGATION
 * Navigation structure for admin role
 */
export const ADMIN_NAVIGATION = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    path: '/admin/dashboard',
    description: 'System overview and analytics',
    color: 'from-blue-500 to-blue-600',
  },
  {
    id: 'users',
    label: 'Users',
    icon: Users,
    path: '/admin/users',
    description: 'Manage drivers and parents',
    color: 'from-purple-500 to-purple-600',
  },
  {
    id: 'applications',
    label: 'Applications',
    icon: FileCheck,
    path: '/admin/applications',
    description: 'Review driver applications',
    color: 'from-green-500 to-green-600',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: BarChart3,
    path: '/admin/analytics',
    description: 'System metrics and reports',
    color: 'from-indigo-500 to-indigo-600',
  },
  {
    id: 'issues',
    label: 'Issues',
    icon: AlertTriangle,
    path: '/admin/issues',
    description: 'Support tickets and reports',
    color: 'from-red-500 to-red-600',
  },
  {
    id: 'settings',
    label: 'System Settings',
    icon: Settings,
    path: '/admin/settings',
    description: 'Configuration and policies',
    color: 'from-gray-500 to-gray-600',
  },
]

/**
 * Get navigation config by role
 * @param {string} role - User role (driver, parent, admin)
 * @returns {Array} Navigation items for the role
 */
export const getNavigationByRole = (role) => {
  const roleMap = {
    driver: DRIVER_NAVIGATION,
    parent: PARENT_NAVIGATION,
    admin: ADMIN_NAVIGATION,
  }
  return roleMap[role?.toLowerCase()] || PARENT_NAVIGATION
}

/**
 * SECONDARY MENU ITEMS (bottom of sidebar)
 * Common items for all roles
 */
export const SECONDARY_NAVIGATION = [
  {
    id: 'help',
    label: 'Help & Support',
    icon: HelpCircle,
    path: '/help',
    description: 'FAQs, contact details, and safety information',
    color: 'from-teal-500 to-teal-600',
  },
]

export const MOBILE_PRIMARY_NAVIGATION = {
  parent: ['dashboard', 'trips', 'messages', 'notifications'],
  driver: ['dashboard', 'requests', 'messages', 'trips'],
  admin: ['dashboard', 'users', 'applications', 'issues'],
}

/**
 * Dashboard config constants
 */
export const DASHBOARD_CONFIG = {
  SIDEBAR_WIDTH_DESKTOP: 280,
  SIDEBAR_WIDTH_MOBILE: 256,
  HEADER_HEIGHT: 80,
  ANIMATION_DURATION: 0.3,
  ANIMATION_DELAY: 0.05,
}
