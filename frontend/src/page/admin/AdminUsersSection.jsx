import { useMemo } from 'react'

const roleOptions = ['all', 'parent', 'driver', 'admin']
const statusOptions = ['all', 'pending', 'reviewing', 'approved', 'declined']
const accountStateOptions = ['all', 'active', 'suspended', 'banned']

function formatDate(dateValue) {
  if (!dateValue) {
    return 'N/A'
  }

  return new Date(dateValue).toLocaleString()
}

export default function AdminUsersSection({
  users,
  loading,
  error,
  actioningId,
  filters,
  onFilterChange,
  onRefresh,
  onUpdateState,
  onDeleteUser,
}) {
  const summary = useMemo(() => {
    const total = users.length
    const active = users.filter((user) => user.accountState === 'active').length
    const suspended = users.filter((user) => user.accountState === 'suspended').length
    const banned = users.filter((user) => user.accountState === 'banned').length

    return {
      total,
      active,
      suspended,
      banned,
    }
  }, [users])

  return (
    <section className="admin-section admin-users-section">
      <div className="admin-toolbar-card">
        <div>
          <h2>Users Management</h2>
          <p>Manage all user accounts, including suspend, ban, activate, and delete actions.</p>
        </div>

        <button type="button" onClick={onRefresh} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh Users'}
        </button>
      </div>

      <div className="admin-filter-grid">
        <label>
          Role
          <select value={filters.role} onChange={(event) => onFilterChange('role', event.target.value)}>
            {roleOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label>
          Verification Status
          <select value={filters.status} onChange={(event) => onFilterChange('status', event.target.value)}>
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label>
          Account State
          <select
            value={filters.accountState}
            onChange={(event) => onFilterChange('accountState', event.target.value)}
          >
            {accountStateOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="summary-grid users-summary-grid">
        <article>
          <span>Total</span>
          <strong>{summary.total}</strong>
        </article>
        <article>
          <span>Active</span>
          <strong>{summary.active}</strong>
        </article>
        <article>
          <span>Suspended</span>
          <strong>{summary.suspended}</strong>
        </article>
        <article>
          <span>Banned</span>
          <strong>{summary.banned}</strong>
        </article>
      </div>

      {error ? <p className="feedback error">{error}</p> : null}
      {loading ? <p className="feedback">Loading users...</p> : null}
      {!loading && users.length === 0 ? <p className="feedback">No users found.</p> : null}

      <div className="admin-users-grid">
        {users.map((user) => (
          <article className="registration-card user-card" key={user.id}>
            <header>
              <h3>{user.fullName}</h3>
              <span className={`status-badge ${user.status}`}>{user.status}</span>
            </header>

            <div className="details-grid">
              <p>
                <strong>Role:</strong> {user.role}
              </p>
              <p>
                <strong>Email:</strong> {user.email}
              </p>
              <p>
                <strong>Phone:</strong> {user.phone || 'N/A'}
              </p>
              <p>
                <strong>Account State:</strong> {user.accountState || 'active'}
              </p>
              <p>
                <strong>Created:</strong> {formatDate(user.createdAt)}
              </p>
            </div>

            <div className="button-row user-actions">
              <button
                type="button"
                disabled={actioningId === user.id || user.role === 'admin' || user.accountState === 'suspended'}
                onClick={() => onUpdateState(user.id, 'suspended')}
              >
                Suspend
              </button>

              <button
                type="button"
                disabled={actioningId === user.id || user.role === 'admin' || user.accountState === 'banned'}
                className="decline"
                onClick={() => onUpdateState(user.id, 'banned')}
              >
                Ban
              </button>

              <button
                type="button"
                disabled={actioningId === user.id || user.role === 'admin' || user.accountState === 'active'}
                className="approve"
                onClick={() => onUpdateState(user.id, 'active')}
              >
                Activate
              </button>

              <button
                type="button"
                disabled={actioningId === user.id || user.role === 'admin'}
                className="delete"
                onClick={() => onDeleteUser(user.id)}
              >
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
