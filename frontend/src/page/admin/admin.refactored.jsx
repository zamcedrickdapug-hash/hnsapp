/**
 * AdminPanel Component - REFACTORED
 * ==================================
 * Admin dashboard using unified enterprise architecture (DashboardLayout)
 * 
 * Architecture:
 * ✅ Uses DashboardLayout wrapper (unified with Driver/Parent dashboards)
 * ✅ Modular section components (AdminDashboardSection, AdminUsersSection, AdminApplySection)
 * ✅ Feature-specific stats (AdminStatsCards)
 * ✅ Preserves all original business logic
 * ✅ Maintains backward compatibility
 * ✅ Professional code organization
 * 
 * Benefits Over Old Architecture:
 * - Removed AdminSidenavbar dependency
 * - Unified layout with other dashboards
 * - Consistent responsive behavior
 * - Easier to maintain and extend
 * - Scalable for additional admin features
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { apiFetch } from '../../api'
import { useSocket, useSocketEvent } from '../../hooks/useSocket'
import { DashboardLayout } from '../../components/dashboard'
import { AdminStatsCards } from '../../components/dashboard/admin/AdminStatsCards'
import AdminApplySection from './AdminApplySection'
import AdminDashboardSection from './AdminDashboardSection'
import AdminUsersSection from './AdminUsersSection'
import './admin.scss'

// Default filters configuration
const defaultUserFilters = {
  role: 'all',
  status: 'all',
  accountState: 'all',
}

/**
 * Main AdminPanel Component
 * Professional modular architecture maintaining all business logic
 */
export default function AdminPanel({ token, user, onLogout }) {
  // ====== SOCKET CONNECTION ======
  const shouldConnectSocket = true // Admin always needs real-time updates
  const { socket } = useSocket(shouldConnectSocket ? token : null)

  // ====== UI STATE ======
  const [activeSection, setActiveSection] = useState('dashboard')
  const [socketConnected, setSocketConnected] = useState(false)

  // ====== REGISTRATION STATE ======
  const [registrations, setRegistrations] = useState([])
  const [statusFilter, setStatusFilter] = useState('pending')
  const [declineReasons, setDeclineReasons] = useState({})
  const [registrationLoading, setRegistrationLoading] = useState(false)
  const [registrationError, setRegistrationError] = useState('')
  const [registrationActioningId, setRegistrationActioningId] = useState('')

  // ====== USER STATE ======
  const [users, setUsers] = useState([])
  const [userFilters, setUserFilters] = useState(defaultUserFilters)
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersError, setUsersError] = useState('')
  const [usersActioningId, setUsersActioningId] = useState('')

  // ====== LOCATION STATE ======
  const [locations, setLocations] = useState([])
  const [locationsLoading, setLocationsLoading] = useState(false)
  const [locationsError, setLocationsError] = useState('')

  // ====== COMPUTED VALUES ======
  const registrationSummary = useMemo(() => {
    return registrations.reduce(
      (acc, item) => {
        acc.total += 1
        if (item.status in acc) {
          acc[item.status] += 1
        }
        return acc
      },
      {
        total: 0,
        pending: 0,
        reviewing: 0,
        approved: 0,
        declined: 0,
      },
    )
  }, [registrations])

  const usersSummary = useMemo(() => {
    return users.reduce(
      (acc, item) => {
        acc.total += 1
        acc[item.role] = (acc[item.role] || 0) + 1
        if (item.accountState === 'active') acc.active += 1
        if (item.accountState === 'suspended') acc.suspended += 1
        return acc
      },
      { total: 0, driver: 0, parent: 0, admin: 0, active: 0, suspended: 0 },
    )
  }, [users])

  // ====== API CALLS ======

  const loadRegistrations = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setRegistrationLoading(true)
      setRegistrationError('')

      try {
        const response = await apiFetch(`/api/admin/registrations?status=${statusFilter}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        setRegistrations(response.registrations || [])
      } catch (error) {
        setRegistrationError(error.message || 'Unable to load registrations.')
      } finally {
        if (!silent) setRegistrationLoading(false)
      }
    },
    [statusFilter, token],
  )

  const loadUsers = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setUsersLoading(true)
      setUsersError('')

      try {
        const searchParams = new URLSearchParams({
          role: userFilters.role,
          status: userFilters.status,
          accountState: userFilters.accountState,
        })

        const response = await apiFetch(`/api/admin/users?${searchParams.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        setUsers(response.users || [])
      } catch (error) {
        setUsersError(error.message || 'Unable to load users list.')
      } finally {
        if (!silent) setUsersLoading(false)
      }
    },
    [token, userFilters],
  )

  const loadDriverLocations = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLocationsLoading(true)
      setLocationsError('')

      try {
        const response = await apiFetch('/api/admin/driver-locations', {
          headers: { Authorization: `Bearer ${token}` },
        })
        setLocations(response.locations || [])
      } catch (error) {
        setLocationsError(error.message || 'Unable to load driver locations.')
      } finally {
        if (!silent) setLocationsLoading(false)
      }
    },
    [token],
  )

  // ====== EFFECTS ======

  useEffect(() => {
    if (activeSection === 'apply') {
      loadRegistrations()
    }
  }, [activeSection, loadRegistrations])

  useEffect(() => {
    if (activeSection === 'users') {
      loadUsers()
    }
  }, [activeSection, loadUsers])

  useEffect(() => {
    if (activeSection !== 'dashboard') return

    loadDriverLocations()

    const intervalId = window.setInterval(() => {
      loadDriverLocations({ silent: true })
    }, 20000)

    return () => window.clearInterval(intervalId)
  }, [activeSection, loadDriverLocations])

  // Update socket connection state
  useEffect(() => {
    setSocketConnected(socket?.connected || false)
  }, [socket])

  // ====== SOCKET EVENTS ======

  const handleDriverLocationUpdated = useCallback((payload) => {
    const driverId = String(payload?.driverId || '')
    const location = payload?.location
    if (!driverId || !location) return

    setLocations((current) => {
      const next = Array.isArray(current) ? [...current] : []
      const index = next.findIndex((item) => String(item.driverId) === driverId)
      const patch = {
        driverId,
        ...(payload?.requestId ? { requestId: String(payload.requestId) } : {}),
        ...(payload?.tripStatus ? { tripStatus: payload.tripStatus } : {}),
        location,
      }

      if (index >= 0) {
        next[index] = { ...next[index], ...patch }
        return next
      }

      return next
    })
  }, [])

  useSocketEvent(socket, 'driver:location-updated', handleDriverLocationUpdated, [
    handleDriverLocationUpdated,
  ])

  // ====== EVENT HANDLERS ======

  const handleUpdateRegistrationStatus = async (registrationId, nextStatus) => {
    setRegistrationActioningId(registrationId)
    setRegistrationError('')

    try {
      const body = { status: nextStatus }
      if (nextStatus === 'declined') {
        body.reason = declineReasons[registrationId] || ''
      }

      await apiFetch(`/api/admin/registrations/${registrationId}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })

      await loadRegistrations({ silent: true })
    } catch (error) {
      setRegistrationError(error.message || 'Unable to update account status.')
    } finally {
      setRegistrationActioningId('')
    }
  }

  const handlePreviewValidId = async (registrationId) => {
    setRegistrationError('')

    try {
      const response = await fetch(`/api/admin/registrations/${registrationId}/id-document`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        throw new Error('Unable to preview uploaded valid ID.')
      }

      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      window.open(blobUrl, '_blank', 'noopener,noreferrer')

      window.setTimeout(() => {
        URL.revokeObjectURL(blobUrl)
      }, 15000)
    } catch (error) {
      setRegistrationError(error.message || 'Unable to preview uploaded valid ID.')
    }
  }

  const handleUserFilterChange = (key, value) => {
    setUserFilters((current) => ({
      ...current,
      [key]: value,
    }))
  }

  const handleUpdateAccountState = async (userId, nextAccountState) => {
    setUsersActioningId(userId)
    setUsersError('')

    try {
      await apiFetch(`/api/admin/users/${userId}/account-state`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ accountState: nextAccountState }),
      })

      await Promise.all([loadUsers({ silent: true }), loadDriverLocations({ silent: true })])
    } catch (error) {
      setUsersError(error.message || 'Unable to update account state.')
    } finally {
      setUsersActioningId('')
    }
  }

  const handleDeleteUser = async (userId) => {
    const shouldDelete = window.confirm('Are you sure you want to permanently delete this account?')
    if (!shouldDelete) return

    setUsersActioningId(userId)
    setUsersError('')

    try {
      await apiFetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      await Promise.all([loadUsers({ silent: true }), loadDriverLocations({ silent: true })])
    } catch (error) {
      setUsersError(error.message || 'Unable to delete user account.')
    } finally {
      setUsersActioningId('')
    }
  }

  // ====== RENDER ======

  return (
    <DashboardLayout
      role="admin"
      userName={user.name || 'Admin'}
      currentPage={activeSection}
      onNavigate={setActiveSection}
      onLogout={onLogout}
      pageTitle={
        activeSection === 'dashboard'
          ? 'Admin Dashboard'
          : activeSection === 'users'
            ? 'User Management'
            : 'Registrations'
      }
      pageDescription={
        activeSection === 'dashboard'
          ? 'Live map and operational overview of drivers.'
          : activeSection === 'users'
            ? 'Moderate and manage all user accounts.'
            : 'Review and approve or decline account applications.'
      }
    >
      {/* Dashboard Section */}
      {activeSection === 'dashboard' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          <AdminStatsCards
            totalRegistrations={registrationSummary.total}
            pendingApprovals={registrationSummary.pending}
            approvedUsers={usersSummary.active}
            systemAlerts={0}
            isLoading={locationsLoading}
          />

          <AdminDashboardSection
            locations={locations}
            loading={locationsLoading}
            error={locationsError}
            onRefresh={() => loadDriverLocations()}
            socketConnected={socketConnected}
          />
        </motion.div>
      )}

      {/* Users Section */}
      {activeSection === 'users' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          <AdminUsersSection
            users={users}
            loading={usersLoading}
            error={usersError}
            actioningId={usersActioningId}
            filters={userFilters}
            onFilterChange={handleUserFilterChange}
            onRefresh={() => loadUsers()}
            onUpdateState={handleUpdateAccountState}
            onDeleteUser={handleDeleteUser}
          />
        </motion.div>
      )}

      {/* Registrations Section */}
      {activeSection === 'apply' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { label: 'Total', value: registrationSummary.total },
              { label: 'Pending', value: registrationSummary.pending },
              { label: 'Reviewing', value: registrationSummary.reviewing },
              { label: 'Approved', value: registrationSummary.approved },
              { label: 'Declined', value: registrationSummary.declined },
            ].map((item, idx) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-white rounded-lg border border-gray-200 p-4"
              >
                <p className="text-xs font-medium text-gray-600">{item.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{item.value}</p>
              </motion.div>
            ))}
          </div>

          <AdminApplySection
            registrations={registrations}
            statusFilter={statusFilter}
            declineReasons={declineReasons}
            loading={registrationLoading}
            error={registrationError}
            actioningId={registrationActioningId}
            onStatusFilterChange={setStatusFilter}
            onRefresh={() => loadRegistrations()}
            onDeclineReasonChange={(registrationId, value) =>
              setDeclineReasons((current) => ({
                ...current,
                [registrationId]: value,
              }))
            }
            onUpdateStatus={handleUpdateRegistrationStatus}
            onPreviewValidId={handlePreviewValidId}
          />
        </motion.div>
      )}
    </DashboardLayout>
  )
}
