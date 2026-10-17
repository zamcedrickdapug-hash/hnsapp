import { useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { ConfirmDialog, EmptyState, StatusBadge, TableLoading } from './AdminUI'

const statusOptions = ['pending', 'reviewing', 'approved', 'declined', 'all']

function formatDate(dateValue) {
  if (!dateValue) return 'Not available'
  const date = new Date(dateValue)
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleString()
}

function bytesToReadable(size) {
  if (!size) return 'File size unavailable'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = size
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`
}

export default function AdminApplySection({
  registrations,
  statusFilter,
  declineReasons,
  notice,
  loading,
  error,
  actioningId,
  onStatusFilterChange,
  onRefresh,
  onDeclineReasonChange,
  onUpdateStatus,
  onPreviewValidId,
}) {
  const [confirmAction, setConfirmAction] = useState(null)
  const actionTriggerRef = useRef(null)
  const counts = Object.fromEntries(statusOptions.map((status) => [
    status,
    status === 'all' ? registrations.length : registrations.filter((item) => item.status === status).length,
  ]))
  const filteredRegistrations = statusFilter === 'all'
    ? registrations
    : registrations.filter((registration) => registration.status === statusFilter)

  const confirmDecision = async () => {
    if (!confirmAction) return
    const { registration, status } = confirmAction
    setConfirmAction(null)
    await onUpdateStatus(registration.id, status)
  }

  return (
    <section className="admin-section admin-apply-section" aria-labelledby="admin-applications-title">
      <div className="admin-toolbar-card">
        <div>
          <h2 id="admin-applications-title">Applications</h2>
          <p>Review applicant details and submitted documents.</p>
        </div>
        <button type="button" className="admin-button admin-button--secondary" onClick={onRefresh} disabled={loading}>
          <RefreshCw size={17} aria-hidden="true" className={loading ? 'admin-spin' : ''} />
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {notice && <p className="admin-inline-result admin-inline-result--success" role="status">{notice}</p>}
      <div className="admin-application-tabs" role="group" aria-label="Filter applications by status">
        {statusOptions.map((status) => (
          <button
            key={status}
            type="button"
            aria-pressed={statusFilter === status}
            className={statusFilter === status ? 'is-active' : ''}
            onClick={() => onStatusFilterChange(status)}
          >
            {status[0].toUpperCase() + status.slice(1)} <span>{counts[status]}</span>
          </button>
        ))}
      </div>

      {error && <p className="admin-inline-result admin-inline-result--error" role="alert">{error}</p>}
      {loading && <TableLoading label="Loading applications…" />}
      {!loading && filteredRegistrations.length === 0 && (
        <EmptyState>{statusFilter === 'all' ? 'No applications yet.' : `No ${statusFilter} applications.`}</EmptyState>
      )}

      <div className="admin-application-list">
        {!loading && filteredRegistrations.map((registration) => {
          const hasValidId = Boolean(registration.validId?.originalName || registration.validId?.path || registration.validId?.url)
          const canReview = registration.status === 'pending'
          const canDecide = ['pending', 'reviewing'].includes(registration.status)
          const declineReason = registration.declineReason || registration.rejectionReason || registration.reason
          return (
            <article className="admin-application-card" key={registration.id}>
              <header className="admin-application-card__header">
                <div>
                  <h3>{registration.fullName || 'Applicant name unavailable'}</h3>
                  <p>{registration.role} · Submitted {formatDate(registration.createdAt)}</p>
                </div>
                <StatusBadge status={registration.status} />
              </header>

              <dl className="admin-application-details">
                <div><dt>Email</dt><dd>{registration.email || 'Not available'}</dd></div>
                <div><dt>Phone</dt><dd>{registration.phone || 'Not available'}</dd></div>
                <div><dt>Address</dt><dd>{registration.homeAddress || 'Not available'}</dd></div>
              </dl>

              {registration.role === 'parent' ? (
                <section className="admin-application-info" aria-label="Student information">
                  <h4>Student information</h4>
                  <dl className="admin-application-details">
                    <div><dt>Student</dt><dd>{registration.student?.fullName || 'Not available'}</dd></div>
                    <div><dt>Age / grade</dt><dd>{registration.student?.age ?? 'Not available'} / {registration.student?.gradeLevel || 'Not available'}</dd></div>
                    <div><dt>School</dt><dd>{registration.student?.schoolName || 'Not available'}</dd></div>
                  </dl>
                </section>
              ) : (
                <section className="admin-application-info" aria-label="Driver information">
                  <h4>Driver information</h4>
                  <dl className="admin-application-details">
                    <div><dt>License</dt><dd>{registration.driver?.licenseNumber || 'Not available'}</dd></div>
                    <div><dt>Vehicle</dt><dd>{registration.driver?.vehicleType || 'Not available'} · {registration.driver?.vehicleColor || 'Not available'}</dd></div>
                    <div><dt>Plate</dt><dd>{registration.driver?.plateNumber || 'Not available'}</dd></div>
                    <div><dt>School</dt><dd>{registration.schoolName || registration.driver?.schoolName || 'Not provided'}</dd></div>
                  </dl>
                </section>
              )}

              <div className="admin-application-id">
                <div>
                  <p><strong>Valid ID</strong>{hasValidId ? ` · ${registration.validId.originalName} (${bytesToReadable(registration.validId.size)})` : ''}</p>
                </div>
                <button
                  type="button"
                  className="admin-button admin-button--secondary"
                  disabled={!hasValidId}
                  title={!hasValidId ? 'No ID uploaded' : 'Preview uploaded valid ID'}
                  onClick={() => onPreviewValidId(registration.id)}
                >
                  {hasValidId ? 'Valid ID' : 'No ID uploaded'}
                </button>
              </div>

              {registration.status === 'declined' && declineReason && (
                <p className="admin-decline-reason"><strong>Decline reason:</strong> {declineReason}</p>
              )}
              {['approved', 'declined'].includes(registration.status) && (
                <p className="admin-decision">Decision: <StatusBadge status={registration.status} /></p>
              )}

              {canDecide && (
                <div className="admin-application-actions">
                  <label>
                    Decline reason <span>(optional)</span>
                    <textarea
                      rows={3}
                      value={declineReasons[registration.id] || ''}
                      onChange={(event) => onDeclineReasonChange(registration.id, event.target.value)}
                      placeholder="Add a reason to include with the decision"
                    />
                  </label>
                  <div className="admin-button-row">
                    {canReview && (
                      <button
                        type="button"
                        className="admin-button admin-button--secondary"
                        disabled={actioningId === registration.id}
                        onClick={() => onUpdateStatus(registration.id, 'reviewing')}
                      >
                        Set Reviewing
                      </button>
                    )}
                    <button
                      type="button"
                      className="admin-button admin-button--primary"
                      disabled={actioningId === registration.id}
                      onClick={(event) => {
                        actionTriggerRef.current = event.currentTarget
                        setConfirmAction({ registration, status: 'approved' })
                      }}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="admin-button admin-button--danger"
                      disabled={actioningId === registration.id}
                      onClick={(event) => {
                        actionTriggerRef.current = event.currentTarget
                        setConfirmAction({ registration, status: 'declined' })
                      }}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              )}
            </article>
          )
        })}
      </div>

      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmAction?.status === 'approved' ? 'Approve application?' : 'Decline application?'}
        confirmLabel={confirmAction?.status === 'approved' ? 'Approve' : 'Decline'}
        returnFocusRef={actionTriggerRef}
        onClose={() => setConfirmAction(null)}
        onConfirm={confirmDecision}
      >
        {confirmAction && (
          <p>
            {confirmAction.status === 'approved' ? 'Approve' : 'Decline'} the application from{' '}
            <strong>{confirmAction.registration.fullName}</strong>?
            {confirmAction.status === 'declined' && declineReasons[confirmAction.registration.id]?.trim()
              ? ` The decline reason will be: ${declineReasons[confirmAction.registration.id].trim()}`
              : ''}
          </p>
        )}
      </ConfirmDialog>
    </section>
  )
}
