import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, CircleCheck, CircleX, Clock3, RefreshCw } from 'lucide-react'
import { apiFetch } from '../../api'

const STATUSES = ['pending', 'verified', 'rejected']

const formatMoney = (amount, currency = 'PHP') => new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(Number(amount) || 0)

const dateTimeInManila = (value) => {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not available'
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(date)
}

export default function AdminPaymentsPanel({ token }) {
  const [overview, setOverview] = useState(null)
  const [audit, setAudit] = useState([])
  const [nextCursor, setNextCursor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')

  const loadPayments = useCallback(async (before, append = false) => {
    if (append) setLoadingMore(true)
    else setLoading(true)
    setError('')
    try {
      const [overviewResponse, auditResponse] = await Promise.all([
        apiFetch('/api/payments/admin/overview', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        apiFetch(`/api/payments/admin/audit?limit=20${before ? `&before=${encodeURIComponent(before)}` : ''}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ])
      setOverview(overviewResponse)
      setAudit((current) => append ? [...current, ...auditResponse.audit] : auditResponse.audit)
      setNextCursor(auditResponse.nextCursor)
    } catch (loadError) {
      setError(loadError.message || 'Unable to load payment records.')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [token])

  useEffect(() => {
    loadPayments()
  }, [loadPayments])

  return (
    <section className="space-y-6 text-slate-950" aria-labelledby="admin-payments-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="admin-payments-title" className="text-xl font-semibold text-slate-900">Payments</h2>
          <p className="mt-1 text-sm text-slate-600">Read-only payment totals, recent activity, and audit trail.</p>
        </div>
        <button
          type="button"
          onClick={() => loadPayments()}
          disabled={loading || loadingMore}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-500 bg-white px-4 text-sm font-semibold text-slate-900 outline-none hover:bg-slate-100 focus-visible:ring-4 focus-visible:ring-blue-300 disabled:opacity-60"
        >
          <RefreshCw size={18} aria-hidden="true" className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          <p className="flex items-center gap-2"><AlertCircle size={18} aria-hidden="true" />{error}</p>
          <button
            type="button"
            onClick={() => loadPayments()}
            className="min-h-11 rounded-lg border border-red-500 px-4 font-semibold outline-none hover:bg-red-100 focus-visible:ring-4 focus-visible:ring-red-300"
          >
            Retry
          </button>
        </div>
      )}

      <section aria-labelledby="payment-totals-title" className="space-y-3">
        <h3 id="payment-totals-title" className="text-lg font-semibold text-slate-900">Totals by status</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {STATUSES.map((status) => (
            <div key={status} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <StatusChip status={status} />
              <p className="mt-3 text-sm text-slate-600">Count</p>
              <p className="text-xl font-semibold text-slate-900">{overview?.totals?.[status]?.count ?? 0}</p>
              <p className="mt-2 text-sm text-slate-600">Amount</p>
              <p className="text-lg font-semibold text-slate-900">{formatMoney(overview?.totals?.[status]?.amount)}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="recent-payments-title" className="space-y-3">
        <h3 id="recent-payments-title" className="text-lg font-semibold text-slate-900">Recent payments</h3>
        {loading && !overview ? (
          <p role="status" className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Loading recent payments…</p>
        ) : !overview?.recentPayments?.length ? (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">No payments to show.</p>
        ) : (
          <>
            <ul className="space-y-3 md:hidden">
              {overview.recentPayments.map((payment, index) => (
                <li key={`${payment.referenceNo || 'unverified'}-${payment.createdAt}-${index}`} className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <StatusChip status={payment.status} />
                    <span className="text-sm font-semibold text-slate-900">{formatMoney(payment.amount, payment.currency)}</span>
                  </div>
                  <p className="break-all text-sm text-slate-700">{payment.referenceNo || 'No reference yet'}</p>
                  <p className="text-sm text-slate-600">{payment.method.toUpperCase()} · {dateTimeInManila(payment.createdAt)}</p>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Reference</th>
                    <th className="px-4 py-3 font-semibold">Amount</th>
                    <th className="px-4 py-3 font-semibold">Method</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Created (Asia/Manila)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {overview.recentPayments.map((payment, index) => (
                    <tr key={`${payment.referenceNo || 'unverified'}-${payment.createdAt}-${index}`}>
                      <td className="max-w-56 break-all px-4 py-3 text-slate-800">{payment.referenceNo || 'No reference yet'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-900">{formatMoney(payment.amount, payment.currency)}</td>
                      <td className="px-4 py-3 text-slate-700">{payment.method.toUpperCase()}</td>
                      <td className="px-4 py-3"><StatusChip status={payment.status} /></td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">{dateTimeInManila(payment.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section aria-labelledby="payment-audit-title" className="space-y-3">
        <div>
          <h3 id="payment-audit-title" className="text-lg font-semibold text-slate-900">Audit trail</h3>
          <p className="text-sm text-slate-600">Append-only records of payment submissions and status transitions.</p>
        </div>
        {loading && audit.length === 0 ? (
          <p role="status" className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Loading audit trail…</p>
        ) : audit.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">No audit entries to show.</p>
        ) : (
          <ol className="space-y-3">
            {audit.map((entry) => (
              <li key={entry._id} className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900">{entry.action.replaceAll('_', ' ')}</p>
                  <p className="text-sm text-slate-600">{dateTimeInManila(entry.at)} (Asia/Manila)</p>
                </div>
                <div className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                  <p className="break-all text-slate-700">Reference: {entry.referenceNo || 'Not assigned'}</p>
                  <p className="text-slate-700">Amount: {formatMoney(entry.amount)}</p>
                  <p className="text-slate-700">Actor role: {entry.actorRole}</p>
                  <p className="break-words text-slate-700">
                    Status: {entry.fromStatus || '—'} → {entry.toStatus}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
        {nextCursor && (
          <button
            type="button"
            onClick={() => loadPayments(nextCursor, true)}
            disabled={loadingMore}
            className="min-h-11 rounded-lg border border-slate-500 bg-white px-4 text-sm font-semibold text-slate-900 outline-none hover:bg-slate-100 focus-visible:ring-4 focus-visible:ring-blue-300 disabled:opacity-60"
          >
            {loadingMore ? 'Loading…' : 'Load more audit entries'}
          </button>
        )}
      </section>
    </section>
  )
}

function StatusChip({ status }) {
  const displayStatus = STATUSES.includes(status) ? status : 'pending'
  const Icon = displayStatus === 'verified'
    ? CircleCheck
    : displayStatus === 'rejected'
      ? CircleX
      : Clock3
  const classes = displayStatus === 'verified'
    ? 'border-green-300 bg-green-50 text-green-900'
    : displayStatus === 'rejected'
      ? 'border-red-300 bg-red-50 text-red-900'
      : 'border-amber-300 bg-amber-50 text-amber-950'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm font-semibold capitalize ${classes}`}>
      <Icon size={16} aria-hidden="true" />
      {displayStatus}
    </span>
  )
}
