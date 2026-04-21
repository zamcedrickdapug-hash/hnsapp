import { useCallback, useEffect, useMemo, useState } from 'react'
import { io } from 'socket.io-client'
import { apiFetch } from '../../api'
import AdminApplySection from './AdminApplySection'
import AdminDashboardSection from './AdminDashboardSection'
import AdminUsersSection from './AdminUsersSection'
import AdminSidenavbar from './sidenavbar'
import './admin.scss'

const defaultUserFilters = {
  role: 'all',
  status: 'all',
  accountState: 'all',
}

export default function AdminPanel({ token, user, onLogout }) {
  const [activeSection, setActiveSection] = useState('dashboard')
  const [socketConnected, setSocketConnected] = useState(false)

  const [registrations, setRegistrations] = useState([])
  const [statusFilter, setStatusFilter] = useState('pending')
  const [declineReasons, setDeclineReasons] = useState({})
  const [registrationLoading, setRegistrationLoading] = useState(false)
  const [registrationError, setRegistrationError] = useState('')
  const [registrationActioningId, setRegistrationActioningId] = useState('')

  const [users, setUsers] = useState([])
  const [userFilters, setUserFilters] = useState(defaultUserFilters)
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersError, setUsersError] = useState('')
  const [usersActioningId, setUsersActioningId] = useState('')

  const [locations, setLocations] = useState([])
  const [locationsLoading, setLocationsLoading] = useState(false)
  const [locationsError, setLocationsError] = useState('')

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

  const loadRegistrations = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) {
        setRegistrationLoading(true)
      }

      setRegistrationError('')

      try {
        const response = await apiFetch(`/api/admin/registrations?status=${statusFilter}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        setRegistrations(response.registrations || [])
      } catch (requestError) {
        setRegistrationError(requestError.message || 'Unable to load registrations.')
      } finally {
        if (!silent) {
          setRegistrationLoading(false)
        }
      }
    },
    [statusFilter, token],
  )

  const loadUsers = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) {
        setUsersLoading(true)
      }

      setUsersError('')

      try {
        const searchParams = new URLSearchParams({
          role: userFilters.role,
          status: userFilters.status,
          accountState: userFilters.accountState,
        })

        const response = await apiFetch(`/api/admin/users?${searchParams.toString()}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        setUsers(response.users || [])
      } catch (requestError) {
        setUsersError(requestError.message || 'Unable to load users list.')
      } finally {
        if (!silent) {
          setUsersLoading(false)
        }
      }
    },
    [token, userFilters],
  )

  const loadDriverLocations = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) {
        setLocationsLoading(true)
      }

      setLocationsError('')

      try {
        const response = await apiFetch('/api/admin/driver-locations', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        setLocations(response.locations || [])
      } catch (requestError) {
        setLocationsError(requestError.message || 'Unable to load driver locations.')
      } finally {
        if (!silent) {
          setLocationsLoading(false)
        }
      }
    },
    [token],
  )

  useEffect(() => {
    if (activeSection !== 'apply') {
      return
    }

    loadRegistrations()
  }, [activeSection, loadRegistrations])

  useEffect(() => {
    if (activeSection !== 'users') {
      return
    }

    loadUsers()
  }, [activeSection, loadUsers])

  useEffect(() => {
    if (activeSection !== 'dashboard') {
      return undefined
    }

    loadDriverLocations()

    const intervalId = window.setInterval(() => {
      loadDriverLocations({ silent: true })
    }, 20000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [activeSection, loadDriverLocations])

  useEffect(() => {
    if (!token || activeSection !== 'dashboard') {
      return undefined
    }

    const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin
    const socket = io(socketUrl, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
    })

    const handleConnect = () => setSocketConnected(true)
    const handleDisconnect = () => setSocketConnected(false)

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)

    socket.on('driver:location-updated', (payload) => {
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
    })

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.disconnect()
    }
  }, [activeSection, token])

  const handleUpdateRegistrationStatus = async (registrationId, nextStatus) => {
    setRegistrationActioningId(registrationId)
    setRegistrationError('')

    try {
      const body = {
        status: nextStatus,
      }

      if (nextStatus === 'declined') {
        body.reason = declineReasons[registrationId] || ''
      }

      await apiFetch(`/api/admin/registrations/${registrationId}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })

      await loadRegistrations({ silent: true })
    } catch (requestError) {
      setRegistrationError(requestError.message || 'Unable to update account status.')
    } finally {
      setRegistrationActioningId('')
    }
  }

  const handlePreviewValidId = async (registrationId) => {
    setRegistrationError('')

    try {
      const response = await fetch(`/api/admin/registrations/${registrationId}/id-document`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
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
    } catch (requestError) {
      setRegistrationError(requestError.message || 'Unable to preview uploaded valid ID.')
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
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ accountState: nextAccountState }),
      })

      await Promise.all([loadUsers({ silent: true }), loadDriverLocations({ silent: true })])
    } catch (requestError) {
      setUsersError(requestError.message || 'Unable to update account state.')
    } finally {
      setUsersActioningId('')
    }
  }

  const handleDeleteUser = async (userId) => {
    const shouldDelete = window.confirm('Are you sure you want to permanently delete this account?')

    if (!shouldDelete) {
      return
    }

    setUsersActioningId(userId)
    setUsersError('')

    try {
      await apiFetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      await Promise.all([loadUsers({ silent: true }), loadDriverLocations({ silent: true })])
    } catch (requestError) {
      setUsersError(requestError.message || 'Unable to delete user account.')
    } finally {
      setUsersActioningId('')
    }
  }

  return (
    <section className="admin-layout">
      <AdminSidenavbar
        user={user}
        activeSection={activeSection}
        onChangeSection={setActiveSection}
        onLogout={onLogout}
      />

      <div className="admin-content">
        <header className="admin-content__head">
          <div>
            <h1>Admin Console</h1>
            <p>
              {activeSection === 'dashboard'
                ? 'Live map and operational overview of drivers.'
                : activeSection === 'users'
                  ? 'Moderate and manage all user accounts.'
                  : 'Review and approve or decline account applications.'}
            </p>
          </div>
        </header>

        {activeSection === 'dashboard' ? (
          <AdminDashboardSection
            locations={locations}
            loading={locationsLoading}
            error={locationsError}
            onRefresh={() => loadDriverLocations()}
            socketConnected={socketConnected}
          />
        ) : null}

        {activeSection === 'users' ? (
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
        ) : null}

        {activeSection === 'apply' ? (
          <>
            <div className="summary-grid apply-summary-grid">
              <article>
                <span>Total</span>
                <strong>{registrationSummary.total}</strong>
              </article>
              <article>
                <span>Pending</span>
                <strong>{registrationSummary.pending}</strong>
              </article>
              <article>
                <span>Reviewing</span>
                <strong>{registrationSummary.reviewing}</strong>
              </article>
              <article>
                <span>Approved</span>
                <strong>{registrationSummary.approved}</strong>
              </article>
              <article>
                <span>Declined</span>
                <strong>{registrationSummary.declined}</strong>
              </article>
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
          </>
        ) : null}
      </div>
    </section>
  )
}
