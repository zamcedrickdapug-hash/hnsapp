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
import { BarChart3, Clock3, Settings } from 'lucide-react'
import { apiFetch, resolveApiUrl } from '../../api'
import { useSocket, useSocketEvent } from '../../hooks/useSocket'
import { DashboardLayout } from '../../components/dashboard'
import { AdminStatsCards } from '../../components/dashboard/admin'
import HelpSupport from '../../components/common/HelpSupport'
import AdminApplySection from './AdminApplySection'
import AdminDashboardSection from './AdminDashboardSection'
import AdminUsersSection from './AdminUsersSection'
import { StatusBadge } from './AdminUI'
import AdminPaymentsPanel from '../../components/payments/AdminPaymentsPanel'
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
  const adminSocketOptions = useMemo(() => ({ auth: { token, scope: 'admin' } }), [token])
  const { socket } = useSocket(token, adminSocketOptions)

  // ====== UI STATE ======
  const [activeSection, setActiveSection] = useState('dashboard')
  const [socketConnected, setSocketConnected] = useState(false)

  // ====== REGISTRATION STATE ======
  const [registrations, setRegistrations] = useState([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [declineReasons, setDeclineReasons] = useState({})
  const [registrationLoading, setRegistrationLoading] = useState(false)
  const [registrationError, setRegistrationError] = useState('')
  const [registrationNotice, setRegistrationNotice] = useState('')
  const [registrationActioningId, setRegistrationActioningId] = useState('')

  // ====== USER STATE ======
  const [users, setUsers] = useState([])
  const [userFilters, setUserFilters] = useState(defaultUserFilters)
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersError, setUsersError] = useState('')
  const [usersNotice, setUsersNotice] = useState('')
  const [usersActioningId, setUsersActioningId] = useState('')

  // ====== ISSUE STATE ======
  const [issues, setIssues] = useState([])
  const [issuesLoading, setIssuesLoading] = useState(false)
  const [issuesError, setIssuesError] = useState('')
  const [issueActioningId, setIssueActioningId] = useState('')
  const [recentPayments, setRecentPayments] = useState([])
  const [paymentActivityError, setPaymentActivityError] = useState('')
  const [paymentActivityLoading, setPaymentActivityLoading] = useState(true)

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
        if ((item.accountState || 'active') === 'active') acc.active += 1
        if (item.status === 'approved' && (item.accountState || 'active') === 'active') acc.approved += 1
        if (item.accountState === 'suspended') acc.suspended += 1
        if (item.role === 'driver' && item.status === 'approved' && (item.accountState || 'active') === 'active') acc.activeDrivers += 1
        return acc
      },
      { total: 0, driver: 0, parent: 0, admin: 0, active: 0, activeDrivers: 0, approved: 0, suspended: 0 },
    )
  }, [users])

  // ====== API CALLS ======

  const loadRegistrations = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setRegistrationLoading(true)
      setRegistrationError('')

      try {
        const response = await apiFetch('/api/admin/registrations?status=all', {
          headers: { Authorization: `Bearer ${token}` },
        })
        setRegistrations(response.registrations || [])
      } catch (error) {
        setRegistrationError(error.message || 'Unable to load registrations.')
      } finally {
        if (!silent) setRegistrationLoading(false)
      }
    },
    [token],
  )

  const loadUsers = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setUsersLoading(true)
      setUsersError('')

      try {
        const searchParams = new URLSearchParams({
          role: 'all',
          status: 'all',
          accountState: 'all',
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
    [token],
  )

  const loadPaymentActivity = useCallback(async () => {
    setPaymentActivityLoading(true)
    setPaymentActivityError('')
    try {
      const response = await apiFetch('/api/payments/admin/overview', {
        headers: { Authorization: `Bearer ${token}` },
      })
      setRecentPayments(response.recentPayments || [])
    } catch (error) {
      setPaymentActivityError(error.message || 'Unable to load payment activity.')
    } finally {
      setPaymentActivityLoading(false)
    }
  }, [token])

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

  const loadIssues = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setIssuesLoading(true)
    setIssuesError('')

    try {
      const response = await apiFetch('/api/issues', {
        headers: { Authorization: `Bearer ${token}` },
      })
      setIssues(response.issues || [])
    } catch (error) {
      setIssuesError(error.message || 'Unable to load issue reports.')
    } finally {
      if (!silent) setIssuesLoading(false)
    }
  }, [token])

  const handleUpdateIssueStatus = async (issueId, status) => {
    setIssueActioningId(issueId)
    setIssuesError('')

    try {
      await apiFetch(`/api/issues/${issueId}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      })
      await loadIssues({ silent: true })
    } catch (error) {
      setIssuesError(error.message || 'Unable to update issue status.')
    } finally {
      setIssueActioningId('')
    }
  }

  // ====== EFFECTS ======

  useEffect(() => {
    if (activeSection === 'applications') {
      loadRegistrations()
    }
  }, [activeSection, loadRegistrations])

  useEffect(() => {
    if (activeSection === 'users') {
      loadUsers()
    }
  }, [activeSection, loadUsers])

  useEffect(() => {
    if (activeSection === 'issues') {
      loadIssues()
    }
  }, [activeSection, loadIssues])

  useEffect(() => {
    if (activeSection !== 'dashboard') return

    loadRegistrations()
    loadUsers()
    loadDriverLocations()
    loadIssues()
    loadPaymentActivity()

    const intervalId = window.setInterval(() => {
      loadDriverLocations({ silent: true })
    }, 20000)

    return () => window.clearInterval(intervalId)
  }, [activeSection, loadDriverLocations, loadIssues, loadPaymentActivity, loadRegistrations, loadUsers])

  // Update socket connection state
  useEffect(() => {
    if (!socket) {
      setSocketConnected(false)
      return undefined
    }

    const handleConnect = () => {
      setSocketConnected(true)
      console.info('[ADMIN] Socket connected.')
    }
    const handleDisconnect = (reason) => {
      setSocketConnected(false)
      console.info('[ADMIN] Socket disconnected:', reason)
    }
    const handleConnectError = (error) => {
      setSocketConnected(false)
      console.warn('[ADMIN] Socket connection failed:', error?.message || 'Unknown connection error.')
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('connect_error', handleConnectError)
    setSocketConnected(socket.connected)

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('connect_error', handleConnectError)
    }
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
    setRegistrationNotice('')

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

      await Promise.all([
        loadRegistrations({ silent: true }),
        loadUsers({ silent: true, filters: defaultUserFilters }),
      ])
      setRegistrationNotice(`Application status updated to ${nextStatus}.`)
    } catch (error) {
      setRegistrationError(error.message || 'Unable to update account status.')
    } finally {
      setRegistrationActioningId('')
    }
  }

  const handlePreviewValidId = async (registrationId) => {
    setRegistrationError('')

    try {
      const response = await fetch(resolveApiUrl(`/api/admin/registrations/${registrationId}/id-document`), {
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
    setUsersNotice('')

    try {
      await apiFetch(`/api/admin/users/${userId}/account-state`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ accountState: nextAccountState }),
      })

      await Promise.all([loadUsers({ silent: true }), loadDriverLocations({ silent: true })])
      setUsersNotice(`Account state updated to ${nextAccountState}.`)
    } catch (error) {
      setUsersError(error.message || 'Unable to update account state.')
    } finally {
      setUsersActioningId('')
    }
  }

  const handleDeleteUser = async (userId) => {
    setUsersActioningId(userId)
    setUsersError('')
    setUsersNotice('')

    try {
      await apiFetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      await Promise.all([loadUsers({ silent: true }), loadDriverLocations({ silent: true })])
      setUsersNotice('User account deleted.')
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
      userName={user.name || user.fullName || 'Admin'}
      currentPage={activeSection}
      onNavigate={setActiveSection}
      onLogout={onLogout}
      pageTitle={{
        dashboard: 'Admin Dashboard',
        users: 'User Management',
        applications: 'Applications',
        issues: 'Issues',
        payments: 'Payments',
        analytics: 'Analytics',
        settings: 'System Settings',
        help: 'Help & Support',
      }[activeSection] || 'Admin Dashboard'}
      pageDescription={{
        dashboard: 'Overview / Live operations and system health',
        users: 'Management / User accounts and access',
        applications: 'Management / Application review',
        issues: 'Management / User-submitted reports',
        payments: 'Management / Payment totals and audit records',
        analytics: 'System / Analytics and reports',
        settings: 'System / Configuration and policies',
        help: 'System / Help and support',
      }[activeSection] || ''}
    >
      {/* Dashboard Section */}
      {activeSection === 'dashboard' && (
        <div className="space-y-6">
          <AdminStatsCards
            stats={[
              { label: 'Total users', value: usersSummary.total, detail: 'Including admin accounts', icon: 'users' },
              { label: 'Pending approvals', value: registrationSummary.pending + registrationSummary.reviewing, detail: `${registrationSummary.pending} pending · ${registrationSummary.reviewing} reviewing`, icon: 'pending' },
              { label: 'Approved users', value: usersSummary.approved, detail: 'Approved and active accounts', icon: 'approved' },
              { label: 'Active drivers', value: usersSummary.activeDrivers, detail: 'Approved driver accounts', icon: 'drivers' },
              ...(!issuesError ? [{ label: 'Open issues', value: issues.filter((issue) => ['pending', 'reviewing'].includes(issue.status || 'pending')).length, detail: 'Pending or reviewing', icon: 'issues' }] : []),
              { label: 'System alerts', value: [locationsError, registrationError, usersError, issuesError, paymentActivityError].filter(Boolean).length, detail: 'Current service warnings', icon: 'alerts' },
            ]}
            isLoading={locationsLoading || registrationLoading || usersLoading || issuesLoading || paymentActivityLoading}
          />
          {registrationError || usersError ? (
            <p className="feedback error" role="alert">{registrationError || usersError}</p>
          ) : null}

          <AdminDashboardSection
            locations={locations}
            loading={locationsLoading}
            error={locationsError}
            onRefresh={() => loadDriverLocations()}
            socketConnected={socketConnected}
            pendingApplications={registrations.filter((item) => ['pending', 'reviewing'].includes(item.status))}
            recentPayments={recentPayments}
            activityLoading={registrationLoading || paymentActivityLoading}
            activityError={paymentActivityError}
            onReviewApplications={() => setActiveSection('applications')}
          />
        </div>
      )}

      {/* Users Section */}
      {activeSection === 'users' && (
        <div className="space-y-6">
          <AdminUsersSection
            users={users}
            loading={usersLoading}
            error={usersError}
            notice={usersNotice}
            actioningId={usersActioningId}
            filters={userFilters}
            signedInUserId={user.id || user._id || user.userId}
            onFilterChange={handleUserFilterChange}
            onRefresh={() => loadUsers()}
            onUpdateState={handleUpdateAccountState}
            onDeleteUser={handleDeleteUser}
          />
        </div>
      )}

      {/* Registrations Section */}
      {activeSection === 'applications' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <AdminApplySection
            registrations={registrations}
            statusFilter={statusFilter}
            declineReasons={declineReasons}
            notice={registrationNotice}
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
        </div>
      )}

      {activeSection === 'issues' && (
        <AdminIssuesSection
          issues={issues}
          loading={issuesLoading}
          error={issuesError}
          actioningId={issueActioningId}
          onRefresh={() => loadIssues()}
          onUpdateStatus={handleUpdateIssueStatus}
        />
      )}

      {activeSection === 'payments' && (
        <AdminPaymentsPanel token={token} />
      )}

      {activeSection === 'analytics' && (
        <ComingSoonSection
          Icon={BarChart3}
          title="Analytics"
          description="Not available yet"
        />
      )}

      {activeSection === 'settings' && (
        <ComingSoonSection
          Icon={Settings}
          title="System Settings"
          description="Not available yet"
        />
      )}

      {activeSection === 'help' && <HelpSupport role="admin" />}
    </DashboardLayout>
  )
}

const issueStatuses = ['pending', 'reviewing', 'resolved', 'closed']

function formatIssueDate(dateValue) {
  if (!dateValue) return 'N/A'
  const date = new Date(dateValue)
  return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleString()
}

function AdminIssuesSection({ issues, loading, error, actioningId, onRefresh, onUpdateStatus }) {
  const [selectedStatuses, setSelectedStatuses] = useState({})

  return (
    <section className="admin-section admin-issues-section" aria-labelledby="issues-heading">
      <div className="admin-toolbar-card">
        <div>
          <h2 id="issues-heading">Issue Reports</h2>
          <p>Review and update reports submitted by users.</p>
        </div>
        <button type="button" onClick={onRefresh} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh Issues'}
        </button>
      </div>

      {error ? <p className="feedback error" role="alert">{error}</p> : null}
      {loading ? <p className="feedback" role="status">Loading issue reports...</p> : null}
      {!loading && !error && issues.length === 0 ? (
        <p className="feedback admin-empty-state">No issue reports yet.</p>
      ) : null}

      {!loading && issues.length > 0 ? (
        <div className="admin-issues-list">
          {issues.map((issue) => {
            const reporter = issue.parentId
            const reporterName = typeof reporter === 'object'
              ? reporter?.fullName || reporter?.email || 'Unknown reporter'
              : 'Unknown reporter'
            const currentStatus = issue.status || 'pending'

            return (
              <article className="admin-issue-card" key={issue._id || issue.id}>
                <div className="admin-issue-card__header">
                  <div>
                    <h3>{reporterName}</h3>
                    {typeof reporter === 'object' && reporter?.email ? <p>{reporter.email}</p> : null}
                  </div>
                  <StatusBadge status={currentStatus} />
                </div>

                <dl className="admin-issue-card__details">
                  <div>
                    <dt>Category</dt>
                    <dd>{issue.category || 'N/A'}</dd>
                  </div>
                  <div>
                    <dt>Reported</dt>
                    <dd>{formatIssueDate(issue.createdAt)}</dd>
                  </div>
                </dl>
                <p className="admin-issue-card__description">{issue.description || 'No description provided.'}</p>

                <div className="admin-issue-card__actions">
                  <label>
                    Status
                    <select
                      value={selectedStatuses[issue._id] || currentStatus}
                      onChange={(event) => setSelectedStatuses((current) => ({
                        ...current,
                        [issue._id]: event.target.value,
                      }))}
                      disabled={actioningId === issue._id}
                    >
                      {issueStatuses.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => onUpdateStatus(issue._id, selectedStatuses[issue._id] || currentStatus)}
                    disabled={actioningId === issue._id || (selectedStatuses[issue._id] || currentStatus) === currentStatus}
                  >
                    {actioningId === issue._id ? 'Saving...' : 'Update status'}
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}

function ComingSoonSection({ Icon, title, description }) {
  return (
    <section className="admin-coming-soon" aria-labelledby="coming-soon-heading">
      <Icon size={32} aria-hidden="true" />
      <h2 id="coming-soon-heading">{title}</h2>
      <p>{description}</p>
      <span><Clock3 size={16} aria-hidden="true" /> Coming soon</span>
    </section>
  )
}
