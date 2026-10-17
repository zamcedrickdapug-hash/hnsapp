import { useCallback, useEffect, useRef, useState } from 'react'
import { CircleCheck, CircleX, Clock3, RefreshCw } from 'lucide-react'
import { apiFetch } from '../../api'
import PaymentReceipt from '../payments/PaymentReceipt'
import PaymentReferenceVerifier from '../payments/PaymentReferenceVerifier'

const ACTIVE_REQUEST_STATUSES = ['accepted', 'arrived', 'picked_up', 'arrived_at_school', 'completed']

const formatMoney = (amount, currency = 'PHP') => new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency,
}).format(Number(amount) || 0)

const requestId = (request) => String(request?._id || '')

export default function PaymentLedgerPanel({ role, token, user }) {
  const [payments, setPayments] = useState([])
  const [summary, setSummary] = useState({})
  const [nextCursor, setNextCursor] = useState(null)
  const [requests, setRequests] = useState([])
  const [selectedRequestId, setSelectedRequestId] = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [externalRef, setExternalRef] = useState('')
  const [note, setNote] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [actionLoading, setActionLoading] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [receiptPaymentId, setReceiptPaymentId] = useState(null)
  const receiptTriggerRef = useRef(null)

  const loadPayments = useCallback(async (before, append = false) => {
    if (append) setLoadingMore(true)
    else setLoading(true)
    try {
      const endpoint = role === 'parent'
        ? `/api/payments/mine${before ? `?before=${encodeURIComponent(before)}` : ''}`
        : `/api/payments/driver?status=${encodeURIComponent(statusFilter)}${before ? `&before=${encodeURIComponent(before)}` : ''}`
      const response = await apiFetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setPayments((current) => append ? [...current, ...response.payments] : response.payments)
      setSummary(response.summary)
      setNextCursor(response.nextCursor)
    } catch (loadError) {
      setError(loadError.message || 'Unable to load payments.')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [role, statusFilter, token])

  const loadRequests = useCallback(async () => {
    try {
      const endpoint = role === 'parent'
        ? '/api/parents/van-requests'
        : '/api/drivers/requests'
      const response = await apiFetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const ownRequests = (response.requests || []).filter((request) => (
        role === 'parent'
          ? Boolean(request.driver?._id || request.driver)
          : String(request.driver?._id || request.driver || '') === String(user?._id || user?.id || '')
            && ACTIVE_REQUEST_STATUSES.includes(request.status)
      ))
      setRequests(ownRequests)
      setSelectedRequestId((current) => (
        ownRequests.some((request) => requestId(request) === current)
          ? current
          : requestId(ownRequests[0])
      ))
    } catch (loadError) {
      setError(loadError.message || 'Unable to load assigned requests.')
    }
  }, [role, token, user])

  const refresh = useCallback(async (clearError = true) => {
    if (clearError) setError('')
    await Promise.all([loadPayments(), loadRequests()])
  }, [loadPayments, loadRequests])

  useEffect(() => {
    refresh()
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh()
    }, 30_000)
    return () => window.clearInterval(intervalId)
  }, [refresh])

  const runAction = async (key, action, successMessage) => {
    setActionLoading(key)
    setError('')
    setMessage('')
    try {
      await action()
      setMessage(successMessage)
    } catch (actionError) {
      setError(actionError.message || 'The payment action could not be completed.')
    } finally {
      await refresh(false)
      setActionLoading('')
    }
  }

  const submitPayment = async (event) => {
    event.preventDefault()
    const formAmount = Number(amount)
    const body = role === 'parent'
      ? {
          vanRequestId: selectedRequestId,
          amount: formAmount,
          method,
          ...(method === 'gcash' ? { externalRef: externalRef.trim() } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
        }
      : {
          vanRequestId: selectedRequestId,
          amount: formAmount,
          ...(note.trim() ? { note: note.trim() } : {}),
        }
    await runAction('submit', async () => {
      await apiFetch(role === 'parent' ? '/api/payments' : '/api/payments/driver/record-cash', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      setAmount('')
      setExternalRef('')
      setNote('')
    }, role === 'parent' ? 'Payment submitted for driver verification.' : 'Cash payment recorded and verified.')
  }

  const reviewPayment = (payment, action) => runAction(
    `${action}-${payment._id}`,
    async () => {
      const body = action === 'reject' ? { rejectReason: 'Payment could not be confirmed.' } : {}
      await apiFetch(`/api/payments/${payment._id}/${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
    },
    action === 'verify' ? 'Payment verified.' : 'Payment rejected.'
  )

  const closeReceipt = useCallback(() => {
    setReceiptPaymentId(null)
    window.requestAnimationFrame(() => receiptTriggerRef.current?.focus())
  }, [])

  return (
    <section className="space-y-6" aria-labelledby="payments-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="payments-heading" className="text-xl font-semibold text-on-dark-primary">Payments</h2>
          <p className="mt-1 text-sm text-on-dark-label">Manual payment tracking and verification. No payment gateway is used.</p>
        </div>
        <button
          type="button"
          onClick={() => refresh()}
          disabled={loading || loadingMore || Boolean(actionLoading)}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-500 px-4 text-sm font-medium text-on-dark-primary outline-none hover:bg-white/10 focus-visible:ring-4 focus-visible:ring-blue-400 disabled:opacity-60"
        >
          <RefreshCw size={16} aria-hidden="true" className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      {message && <p role="status" className="rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">{message}</p>}

      <PaymentReferenceVerifier token={token} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {role === 'parent' ? (
          <>
            <SummaryCard label="Completed trips" value={summary.completedTrips ?? 0} />
            <SummaryCard label="Total fees" value={formatMoney(summary.totalFees)} />
            <SummaryCard label="Verified payments" value={formatMoney(summary.totalVerified)} />
            <SummaryCard label="Outstanding balance" value={formatMoney(summary.outstanding)} />
          </>
        ) : (
          <>
            <SummaryCard label="Pending payments" value={summary.pendingCount ?? 0} />
            <SummaryCard label="Pending amount" value={formatMoney(summary.pendingAmount)} />
            <SummaryCard label="Verified today" value={summary.verifiedToday ?? 0} />
            <SummaryCard label="Verified total" value={formatMoney(summary.verifiedTotal)} />
          </>
        )}
      </div>

      <form onSubmit={submitPayment} className="space-y-4 rounded-xl border border-white/10 bg-slate-900/40 p-4">
        <h3 className="font-semibold text-on-dark-primary">{role === 'parent' ? 'Submit a payment' : 'Record cash received'}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm text-on-dark-label">
            <span>{role === 'parent' ? 'Assigned trip' : 'Active or completed trip'}</span>
            <select
              required
              value={selectedRequestId}
              onChange={(event) => setSelectedRequestId(event.target.value)}
              className="min-h-11 w-full rounded-lg border border-slate-500 bg-slate-950 px-3 text-base text-on-dark-primary outline-none focus-visible:ring-4 focus-visible:ring-blue-400"
            >
              <option value="">Select a trip</option>
              {requests.map((request) => (
                <option key={request._id} value={request._id}>
                  {request.studentName || 'Trip'}{request.schoolName ? ` - ${request.schoolName}` : ''}
                  {role === 'parent' && request.driver?.fullName ? ` (${request.driver.fullName})` : ''}
                </option>
              ))}
            </select>
            {requests.length === 0 && (
              <span className="block text-xs text-on-dark-label">
                {role === 'parent'
                  ? 'A trip with an assigned driver is required to submit a payment.'
                  : 'No active or completed trips are assigned to this driver.'}
              </span>
            )}
          </label>
          <label className="space-y-1 text-sm text-on-dark-label">
            <span>Amount (PHP)</span>
            <input
              type="number"
              min="0.01"
              max="50000"
              step="0.01"
              required
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="min-h-11 w-full rounded-lg border border-slate-500 bg-slate-950 px-3 text-base text-on-dark-primary outline-none focus-visible:ring-4 focus-visible:ring-blue-400"
            />
          </label>
          {role === 'parent' && (
            <>
              <label className="space-y-1 text-sm text-on-dark-label">
                <span>Payment method</span>
                <select
                  value={method}
                  onChange={(event) => setMethod(event.target.value)}
                  className="min-h-11 w-full rounded-lg border border-slate-500 bg-slate-950 px-3 text-base text-on-dark-primary outline-none focus-visible:ring-4 focus-visible:ring-blue-400"
                >
                  <option value="cash">Cash</option>
                  <option value="gcash">GCash</option>
                </select>
              </label>
              {method === 'gcash' && (
                <label className="space-y-1 text-sm text-on-dark-label">
                  <span>GCash reference</span>
                  <input
                    required
                    maxLength="40"
                    value={externalRef}
                    onChange={(event) => setExternalRef(event.target.value)}
                    className="min-h-11 w-full rounded-lg border border-slate-500 bg-slate-950 px-3 text-base text-on-dark-primary outline-none focus-visible:ring-4 focus-visible:ring-blue-400"
                  />
                </label>
              )}
            </>
          )}
          <label className="space-y-1 text-sm text-on-dark-label sm:col-span-2">
            <span>Note (optional)</span>
            <input
              maxLength="200"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="min-h-11 w-full rounded-lg border border-slate-500 bg-slate-950 px-3 text-base text-on-dark-primary outline-none focus-visible:ring-4 focus-visible:ring-blue-400"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={!selectedRequestId || !amount || Boolean(actionLoading)}
          className="min-h-11 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white outline-none hover:bg-blue-700 focus-visible:ring-4 focus-visible:ring-blue-300 disabled:opacity-60"
        >
          {actionLoading === 'submit' ? 'Saving…' : role === 'parent' ? 'Submit payment' : 'Record and verify cash'}
        </button>
      </form>

      <div className="rounded-xl border border-white/10 bg-slate-900/40">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4">
          <h3 className="font-semibold text-on-dark-primary">Payment ledger</h3>
          {role === 'driver' && (
            <label className="flex items-center gap-2 text-sm text-on-dark-label">
              Status
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="min-h-11 rounded-lg border border-slate-500 bg-slate-950 px-2 text-base text-on-dark-primary outline-none focus-visible:ring-4 focus-visible:ring-blue-400"
              >
                {['all', 'pending', 'verified', 'rejected'].map((status) => (
                  <option key={status} value={status}>{status[0].toUpperCase() + status.slice(1)}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        {loading && payments.length === 0 ? (
          <p className="p-4 text-sm text-on-dark-label">Loading payments…</p>
        ) : payments.length === 0 ? (
          <p className="p-4 text-sm text-on-dark-label">No payments to show.</p>
        ) : (
          <ul className="divide-y divide-white/10">
            {payments.map((payment) => (
              <li key={payment._id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-medium text-on-dark-primary">
                    {formatMoney(payment.amount, payment.currency)} · {payment.method.toUpperCase()}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-300">
                    <PaymentStatus status={payment.status} />
                    {payment.referenceNo ? ` · ${payment.referenceNo}` : ''}
                    {payment.createdAt ? ` · ${new Date(payment.createdAt).toLocaleString()}` : ''}
                  </p>
                  {payment.rejectReason && <p className="mt-1 text-sm text-red-300">{payment.rejectReason}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {payment.status === 'verified' && (
                    <button
                      type="button"
                      onClick={(event) => {
                        receiptTriggerRef.current = event.currentTarget
                        setReceiptPaymentId(payment._id)
                      }}
                      className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-white outline-none focus-visible:ring-4 focus-visible:ring-blue-400"
                    >
                      View receipt
                    </button>
                  )}
                  {role === 'driver' && payment.status === 'pending' && (
                    <>
                    <button
                      type="button"
                      onClick={() => reviewPayment(payment, 'verify')}
                      disabled={Boolean(actionLoading)}
                      className="min-h-11 rounded-lg bg-green-700 px-3 text-sm font-medium text-white outline-none focus-visible:ring-4 focus-visible:ring-green-300 disabled:opacity-60"
                    >
                      {actionLoading === `verify-${payment._id}` ? 'Verifying…' : 'Verify'}
                    </button>
                    <button
                      type="button"
                      onClick={() => reviewPayment(payment, 'reject')}
                      disabled={Boolean(actionLoading)}
                      className="min-h-11 rounded-lg border border-red-400 px-3 text-sm font-medium text-red-200 outline-none focus-visible:ring-4 focus-visible:ring-red-300 disabled:opacity-60"
                    >
                      {actionLoading === `reject-${payment._id}` ? 'Rejecting…' : 'Reject'}
                    </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {nextCursor && (
          <div className="border-t border-white/10 p-4">
            <button
              type="button"
              onClick={() => loadPayments(nextCursor, true)}
              disabled={loadingMore}
              className="min-h-11 rounded-lg border border-slate-500 px-4 text-sm font-medium text-on-dark-primary outline-none focus-visible:ring-4 focus-visible:ring-blue-400 disabled:opacity-60"
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}
      </div>
      {receiptPaymentId && (
        <PaymentReceipt paymentId={receiptPaymentId} token={token} onClose={closeReceipt} />
      )}
    </section>
  )
}

function PaymentStatus({ status }) {
  const Icon = status === 'verified' ? CircleCheck : status === 'rejected' ? CircleX : Clock3
  const label = status ? status[0].toUpperCase() + status.slice(1) : 'Pending'
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-500 bg-slate-900 px-2.5 py-1 text-sm font-medium text-white">
      <Icon size={16} aria-hidden="true" />
      {label}
    </span>
  )
}

function SummaryCard({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
      <p className="text-sm text-on-dark-label">{label}</p>
      <p className="mt-2 text-lg font-semibold text-on-dark-primary">{value}</p>
    </div>
  )
}
