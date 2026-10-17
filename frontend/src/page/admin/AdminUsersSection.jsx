import { useMemo, useRef, useState } from 'react'
import { Download, MoreVertical, Search } from 'lucide-react'
import { ConfirmDialog, EmptyState, StatusBadge, TableLoading } from './AdminUI'

const PAGE_SIZE = 10
const roleOptions = ['all', 'parent', 'driver', 'admin']
const statusOptions = ['all', 'pending', 'reviewing', 'approved', 'declined']
const accountStateOptions = ['all', 'active', 'suspended', 'banned']

function formatDate(dateValue) {
  if (!dateValue) return 'Not available'
  const date = new Date(dateValue)
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleDateString()
}

function normalizedPhone(value) {
  return String(value || '').replace(/\D/g, '')
}

function csvValue(value) {
  const text = String(value ?? '')
  const safeText = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text
  return `"${safeText.replaceAll('"', '""')}"`
}

export default function AdminUsersSection({
  users,
  loading,
  error,
  notice,
  actioningId,
  filters,
  signedInUserId,
  onFilterChange,
  onRefresh,
  onUpdateState,
  onDeleteUser,
}) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [confirmAction, setConfirmAction] = useState(null)
  const actionTriggerRef = useRef(null)

  const duplicatePhones = useMemo(() => {
    const counts = new Map()
    users.forEach((user) => {
      const phone = normalizedPhone(user.phone)
      if (phone) counts.set(phone, (counts.get(phone) || 0) + 1)
    })
    return new Set([...counts].filter(([, count]) => count > 1).map(([phone]) => phone))
  }, [users])

  const matchingUsers = useMemo(() => {
    const query = search.trim().toLowerCase()
    return users.filter((user) => {
      const matchesSearch = !query || [user.fullName, user.email, user.phone]
        .some((value) => String(value || '').toLowerCase().includes(query))
      return matchesSearch
        && (filters.role === 'all' || user.role === filters.role)
        && (filters.status === 'all' || user.status === filters.status)
        && (filters.accountState === 'all' || (user.accountState || 'active') === filters.accountState)
    })
  }, [filters.accountState, filters.role, filters.status, search, users])

  const pageCount = Math.max(1, Math.ceil(matchingUsers.length / PAGE_SIZE))
  const visibleUsers = matchingUsers.slice((Math.min(page, pageCount) - 1) * PAGE_SIZE, Math.min(page, pageCount) * PAGE_SIZE)
  const summary = useMemo(() => ({
    total: users.length,
    active: users.filter((user) => (user.accountState || 'active') === 'active').length,
    suspended: users.filter((user) => user.accountState === 'suspended').length,
    banned: users.filter((user) => user.accountState === 'banned').length,
  }), [users])

  const updateFilter = (key, value) => {
    setPage(1)
    onFilterChange(key, value)
  }

  const setSearchValue = (value) => {
    setPage(1)
    setSearch(value)
  }

  const exportCsv = () => {
    const rows = [
      ['Name', 'Role', 'Email', 'Account state', 'Created date'],
      ...matchingUsers.map((user) => [
        user.fullName,
        user.role,
        user.email,
        user.accountState || 'active',
        formatDate(user.createdAt),
      ]),
    ]
    const csv = rows.map((row) => row.map(csvValue).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'admin-users.csv'
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const executeConfirmedAction = async () => {
    if (!confirmAction) return
    const { user, action } = confirmAction
    setConfirmAction(null)
    if (action === 'delete') await onDeleteUser(user.id)
    else await onUpdateState(user.id, 'banned')
  }

  return (
    <section className="admin-section admin-users-section" aria-labelledby="admin-users-title">
      <div className="admin-toolbar-card">
        <div>
          <h2 id="admin-users-title">Users</h2>
          <p>Manage user accounts, verification, and account access.</p>
        </div>
        <button type="button" className="admin-button admin-button--secondary" onClick={onRefresh} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh users'}
        </button>
      </div>

      <div className="admin-summary-grid users-summary-grid">
        {[
          ['Total', summary.total, 'Including admin accounts'],
          ['Active', summary.active, 'Accounts with access'],
          ['Suspended', summary.suspended, 'Temporarily restricted'],
          ['Banned', summary.banned, 'Access revoked'],
        ].map(([label, value, detail]) => (
          <article className="admin-summary-card" key={label}>
            <span>{label}</span><strong>{value}</strong><small>{detail}</small>
          </article>
        ))}
      </div>

      <div className="admin-user-controls">
        <label className="admin-search-field">
          <span>Search users</span>
          <span className="admin-search-field__input">
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Name, email, or phone"
            />
          </span>
        </label>
        <label>
          Role
          <select value={filters.role} onChange={(event) => updateFilter('role', event.target.value)}>
            {roleOptions.map((option) => <option key={option} value={option}>{option === 'all' ? 'All roles' : option}</option>)}
          </select>
        </label>
        <label>
          Verification
          <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
            {statusOptions.map((option) => <option key={option} value={option}>{option === 'all' ? 'All statuses' : option}</option>)}
          </select>
        </label>
        <label>
          Account state
          <select value={filters.accountState} onChange={(event) => updateFilter('accountState', event.target.value)}>
            {accountStateOptions.map((option) => <option key={option} value={option}>{option === 'all' ? 'All states' : option}</option>)}
          </select>
        </label>
        <button type="button" className="admin-button admin-button--secondary admin-csv-button" onClick={exportCsv} disabled={!matchingUsers.length}>
          <Download size={17} aria-hidden="true" /> Export CSV
        </button>
      </div>

      {notice && <p className="admin-inline-result admin-inline-result--success" role="status">{notice}</p>}
      {error && <p className="admin-inline-result admin-inline-result--error" role="alert">{error}</p>}
      {loading && <TableLoading label="Loading users…" />}
      {!loading && !matchingUsers.length && <EmptyState>No users match these filters.</EmptyState>}

      {!loading && matchingUsers.length > 0 && (
        <>
          <div className="admin-users-table-wrap">
            <table className="admin-users-table">
              <thead>
                <tr>
                  <th>Name</th><th>Role</th><th>Email</th><th>Phone</th><th>Status</th>
                  <th>Account state</th><th>Created</th><th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {visibleUsers.map((user) => {
                  const accountState = user.accountState || 'active'
                  const isAdmin = user.role === 'admin'
                  const isSignedInUser = String(user.id) === String(signedInUserId)
                  const protectedAdmin = isAdmin || isSignedInUser
                  const phoneKey = normalizedPhone(user.phone)
                  return (
                    <tr key={user.id}>
                      <td data-label="Name" className="admin-user-name">
                        <span>{user.fullName || 'Name unavailable'}</span>
                        {phoneKey && duplicatePhones.has(phoneKey) && <StatusBadge status="warning" label="Possible duplicate" />}
                      </td>
                      <td data-label="Role"><StatusBadge status="neutral" label={user.role} /></td>
                      <td data-label="Email" className="admin-break-word">{user.email || 'Not available'}</td>
                      <td data-label="Phone" className="admin-break-word">{user.phone || 'Not available'}</td>
                      <td data-label="Status"><StatusBadge status={user.status} /></td>
                      <td data-label="Account state"><StatusBadge status={accountState} /></td>
                      <td data-label="Created">{formatDate(user.createdAt)}</td>
                      <td data-label="Actions" className="admin-user-actions-cell">
                        <details className="admin-row-menu">
                          <summary ref={actionTriggerRef} aria-label={`Actions for ${user.fullName || 'user'}`}>
                            <MoreVertical size={20} aria-hidden="true" />
                          </summary>
                          <div className="admin-row-menu__items">
                            {accountState !== 'active' && (
                              <button type="button" onClick={() => onUpdateState(user.id, 'active')} disabled={actioningId === user.id}>
                                Activate
                              </button>
                            )}
                            {!protectedAdmin && accountState === 'active' && (
                              <button type="button" onClick={() => onUpdateState(user.id, 'suspended')} disabled={actioningId === user.id}>
                                Suspend
                              </button>
                            )}
                            {!protectedAdmin && accountState !== 'banned' && (
                              <button
                                type="button"
                                disabled={actioningId === user.id}
                                onClick={(event) => {
                                  actionTriggerRef.current = event.currentTarget.closest('details')?.querySelector('summary')
                                  setConfirmAction({ user, action: 'ban' })
                                }}
                              >
                                Ban
                              </button>
                            )}
                            {!isAdmin && (
                              <button
                                type="button"
                                className="is-danger"
                                disabled={actioningId === user.id}
                                onClick={(event) => {
                                  actionTriggerRef.current = event.currentTarget.closest('details')?.querySelector('summary')
                                  setConfirmAction({ user, action: 'delete' })
                                }}
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </details>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="admin-pagination">
            <span>Showing {Math.min(matchingUsers.length, (Math.min(page, pageCount) - 1) * PAGE_SIZE + 1)}–{Math.min(matchingUsers.length, Math.min(page, pageCount) * PAGE_SIZE)} of {matchingUsers.length}</span>
            <div>
              <button type="button" className="admin-button admin-button--secondary" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>Previous</button>
              <span>Page {Math.min(page, pageCount)} of {pageCount}</span>
              <button type="button" className="admin-button admin-button--secondary" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page >= pageCount}>Next</button>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmAction?.action === 'delete' ? 'Delete user account?' : 'Ban user account?'}
        returnFocusRef={actionTriggerRef}
        confirmLabel={confirmAction?.action === 'delete' ? 'Delete account' : 'Ban account'}
        requireText={confirmAction?.action === 'delete' ? 'DELETE' : undefined}
        onClose={() => setConfirmAction(null)}
        onConfirm={executeConfirmedAction}
      >
        {confirmAction && (
          <p>
            {confirmAction.action === 'delete'
              ? <>Permanently delete <strong>{confirmAction.user.fullName}</strong>? This removes the account and cannot be undone.</>
              : <>Ban <strong>{confirmAction.user.fullName}</strong>? This prevents the account from accessing the service.</>}
          </p>
        )}
      </ConfirmDialog>
    </section>
  )
}
