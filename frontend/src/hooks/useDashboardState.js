/**
 * useDashboardState Hook
 * =====================
 * Centralized UI state management for all dashboards
 * Handles sidebar, notifications, modals, and loading states
 * 
 * Architecture Decision:
 * - Single hook for all dashboard UI state
 * - Eliminates useState duplication across 3 dashboards
 * - Provides reusable state management logic
 * - Easy to test and mock
 * 
 * Benefits:
 * - Consistent UI state across all dashboards
 * - Easier to add new UI features
 * - Reduced component complexity
 * - Improved maintainability
 */

import { useState, useCallback } from 'react'

/**
 * useDashboardState Hook
 * Manages all dashboard UI state in one place
 * 
 * @returns {Object} Dashboard state and state setters
 */
export function useDashboardState() {
  // ============================================
  // SIDEBAR & NAVIGATION STATE
  // ============================================
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev)
  }, [])

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false)
  }, [])

  const openSidebar = useCallback(() => {
    setSidebarOpen(true)
  }, [])

  // ============================================
  // NOTIFICATION PANEL STATE
  // ============================================
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false)

  const toggleNotificationPanel = useCallback(() => {
    setNotificationPanelOpen((prev) => !prev)
  }, [])

  const closeNotificationPanel = useCallback(() => {
    setNotificationPanelOpen(false)
  }, [])

  // ============================================
  // MODAL STATES (generic for any modal)
  // ============================================
  const [modalsOpen, setModalsOpen] = useState({
    profile: false,
    settings: false,
    confirm: false,
    receipt: false,
    reportIssue: false,
    custom: false,
  })

  const openModal = useCallback((modalName) => {
    setModalsOpen((prev) => ({
      ...prev,
      [modalName]: true,
    }))
  }, [])

  const closeModal = useCallback((modalName) => {
    setModalsOpen((prev) => ({
      ...prev,
      [modalName]: false,
    }))
  }, [])

  const closeAllModals = useCallback(() => {
    setModalsOpen({
      profile: false,
      settings: false,
      confirm: false,
      receipt: false,
      reportIssue: false,
      custom: false,
    })
  }, [])

  // ============================================
  // LOADING STATE
  // ============================================
  const [isLoading, setIsLoading] = useState(false)

  // ============================================
  // ERROR STATE
  // ============================================
  const [error, setError] = useState(null)

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // ============================================
  // ACTIVE PAGE/SECTION STATE
  // ============================================
  const [activePage, setActivePage] = useState('dashboard')

  // ============================================
  // EXPANDED MENU ITEMS (for sub-navigation)
  // ============================================
  const [expandedMenus, setExpandedMenus] = useState({})

  const toggleMenuExpand = useCallback((menuId) => {
    setExpandedMenus((prev) => ({
      ...prev,
      [menuId]: !prev[menuId],
    }))
  }, [])

  // ============================================
  // SEARCH/FILTER STATE
  // ============================================
  const [searchQuery, setSearchQuery] = useState('')
  const [filterActive, setFilterActive] = useState(false)

  // ============================================
  // TOAST/NOTIFICATION TOAST STATE
  // ============================================
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = Date.now()
    const toast = { id, message, type }
    setToasts((prev) => [...prev, toast])

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, duration)
    }

    return id
  }, [])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // ============================================
  // CONFIRMATION DIALOG STATE
  // ============================================
  const [confirmDialog, setConfirmDialog] = useState(null)

  const showConfirm = useCallback((title, message, onConfirm, onCancel) => {
    setConfirmDialog({
      title,
      message,
      onConfirm,
      onCancel,
    })
  }, [])

  const hideConfirm = useCallback(() => {
    setConfirmDialog(null)
  }, [])

  // ============================================
  // RETURN OBJECT WITH ALL STATE & SETTERS
  // ============================================
  return {
    // Sidebar
    sidebarOpen,
    setSidebarOpen,
    toggleSidebar,
    closeSidebar,
    openSidebar,

    // Notification Panel
    notificationPanelOpen,
    setNotificationPanelOpen,
    toggleNotificationPanel,
    closeNotificationPanel,

    // Modals
    modalsOpen,
    openModal,
    closeModal,
    closeAllModals,

    // Loading & Error
    isLoading,
    setIsLoading,
    error,
    setError,
    clearError,

    // Active Page
    activePage,
    setActivePage,

    // Expanded Menus
    expandedMenus,
    toggleMenuExpand,

    // Search & Filter
    searchQuery,
    setSearchQuery,
    filterActive,
    setFilterActive,

    // Toast Notifications
    toasts,
    addToast,
    removeToast,

    // Confirmation Dialog
    confirmDialog,
    showConfirm,
    hideConfirm,
  }
}

export default useDashboardState
