import { useCallback, useEffect, useRef, useState } from 'react'
import { BadgeCheck, CircleCheck, CircleX, Clock3, RefreshCw, TriangleAlert } from 'lucide-react'
import { apiFetch } from '../../api'
import PaymentReceipt from '../payments/PaymentReceipt'
import PaymentReferenceVerifier from '../payments/PaymentReferenceVerifier'

const MAX_TRIPS_PER_PAYMENT = 20

const formatMoney = (amount, currency = 'PHP') => (
  `${currency} ${new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0)}`
)

const dateTimeInManila = (value) => {
  if (!value) return 'Date unavailable'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeZone: 'Asia/Manila',
  }).format(date)
}

const tripIdsForPayment = (payment) => (
  payment.tripSummary || []
)

const getTripLabel = (trip) => {
  const students = trip.studentNames?.filter(Boolean).join(', ')
  return [trip.schoolName || 'School not listed', students].filter(Boolean).join(' · ')
}

const getErrorMessage = (error) => {
  const message = error?.message || 'The payment action could not be completed.'
  return /one driver at a time/i.test(message)
    ? `${message} Select trips for one driver only.`
    : message
}

export default function PaymentLedgerPanel({ role, token }) {
  const isParent = role === 'parent'
  const [payments, setPayments] = useState([])
  const [summary, setSummary] = useState({})
  const [billableTrips, setBillableTrips] = useState([])
  const [collectibleTrips, setCollectibleTrips] = useState([])
  const [nextCursor, setNextCursor] = useState(null)
  const [selectedTripIds, setSelectedTripIds] = useState([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [actionLoading, setActionLoading] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [rejectingPayment, setRejectingPayment] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [singleCashTripId, setSingleCashTripId] = useState(null)
  const [receiptPaymentId, setReceiptPaymentId] = useState(null)
  const [availableReceiptPaymentId, setAvailableReceiptPaymentId] = useState(null)
  const receiptTriggerRef = useRef(null)

  const loadPayments = useCallback(async (before, append = false) => {
    if (append) setLoadingMore(true)
    else setLoading(true)
    try {
      const endpoint = isParent
        ? `/api/payments/mine${before ? `?before=${encodeURIComponent(before)}` : ''}`
        : `/api/payments/driver?status=${encodeURIComponent(statusFilter)}${before ? `&before=${encodeURIComponent(before)}` : ''}`
      const response = await apiFetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const sortedPayments = isParent
        ? response.payments
        : [...response.payments].sort((left, right) => (
            (left.status === 'pending' ? 0 : 1) - (right.status === 'pending' ? 0 : 1)
          ))
      setPayments((current) => append ? [...current, ...sortedPayments] : sortedPayments)
      setSummary(response.summary || {})
      setNextCursor(response.nextCursor || null)
      if (isParent) {
        const trips = response.billableTrips || []
        setBillableTrips(trips)
        setSelectedTripIds((current) => current.filter((id) => (
          trips.some((trip) => trip.requestId === id && trip.paymentStatus === 'unpaid')
        )))
      } else {
        const trips = response.collectibleTrips || []
        setCollectibleTrips(trips)
        setSelectedTripIds((current) => current.filter((id) => trips.some((trip) => trip.requestId === id)))
      }
      setError('')
    } catch (loadError) {
      setError(getErrorMessage(loadError))
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [isParent, statusFilter, token])

  const refresh = useCallback(async (clearMessage = false) => {
    if (clearMessage) {
      setMessage('')
      setAvailableReceiptPaymentId(null)
    }
    await loadPayments()
  }, [loadPayments])

  useEffect(() => {
    refresh()
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh()
    }, 30_000)
    return () => window.clearInterval(intervalId)
  }, [refresh])

  const selectableTrips = collectibleTrips
  const selectedTrips = selectableTrips.filter((trip) => selectedTripIds.includes(trip.requestId))
  const selectedAmount = selectedTrips.reduce((total, trip) => total + Number(trip.fare || 0), 0)

  const toggleTrip = (tripId) => {
    setSelectedTripIds((current) => current.includes(tripId)
      ? current.filter((id) => id !== tripId)
      : current.length < MAX_TRIPS_PER_PAYMENT ? [...current, tripId] : current)
    setConfirming(false)
  }

  const selectAll = () => {
    setSelectedTripIds(selectableTrips.slice(0, MAX_TRIPS_PER_PAYMENT).map((trip) => trip.requestId))
    setConfirming(false)
  }

  const submitSelectedCash = async (event) => {
    event.preventDefault()
    if (!selectedTripIds.length || actionLoading) return
    if (!confirming) {
      setConfirming(true)
      return
    }

    setActionLoading('submit')
    setError('')
    setMessage('')
    setAvailableReceiptPaymentId(null)
    try {
      const response = await apiFetch('/api/payments/driver/record-cash', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ vanRequestIds: selectedTripIds }),
      })
      setAvailableReceiptPaymentId(response.payment?._id || null)
      setSelectedTripIds([])
      setConfirming(false)
      setMessage('Cash recorded successfully.')
    } catch (actionError) {
      setError(getErrorMessage(actionError))
    } finally {
      await loadPayments()
      setActionLoading('')
    }
  }

  const reviewPayment = async (payment, action, reason = '') => {
    const key = `${action}-${payment._id}`
    setActionLoading(key)
    setError('')
    setMessage('')
    setAvailableReceiptPaymentId(null)
    try {
      await apiFetch(`/api/payments/${encodeURIComponent(payment._id)}/${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        ...(action === 'reject' ? { body: JSON.stringify({ rejectReason: reason }) } : {}),
      })
      setMessage(action === 'verify' ? 'Payment verified.' : 'Payment rejected.')
      setRejectingPayment(null)
      setRejectReason('')
    } catch (actionError) {
      setError(getErrorMessage(actionError))
    } finally {
      await loadPayments()
      setActionLoading('')
    }
  }

  const recordSingleCash = async (trip) => {
    setActionLoading(`cash-${trip.requestId}`)
    setError('')
    setMessage('')
    setAvailableReceiptPaymentId(null)
    try {
      const response = await apiFetch('/api/payments/driver/record-cash', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ vanRequestIds: [trip.requestId] }),
      })
      setAvailableReceiptPaymentId(response.payment?._id || null)
      setMessage('Cash recorded successfully.')
      setSingleCashTripId(null)
      setConfirming(false)
      setSelectedTripIds((current) => current.filter((id) => id !== trip.requestId))
    } catch (actionError) {
      setError(getErrorMessage(actionError))
    } finally {
      await loadPayments()
      setActionLoading('')
    }
  }

  const closeReceipt = useCallback(() => {
    setReceiptPaymentId(null)
    window.requestAnimationFrame(() => receiptTriggerRef.current?.focus())
  }, [])

  return (
    <section className="space-y-6 pb-24 text-slate-900" aria-labelledby="payments-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="payments-heading" className="text-xl font-semibold text-slate-900">
            {isParent ? 'Payments' : 'Collections'}
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            {isParent
              ? 'Pay completed trip fares in cash directly to your driver.'
              : 'Review parent payments and record cash collected for completed trips.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => refresh(true)}
          disabled={loading || loadingMore || Boolean(actionLoading)}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 outline-none hover:bg-slate-50 focus-visible:ring-4 focus-visible:ring-blue-300 disabled:cursor-not-allowed disabled:bg-slate-100"
        >
          <RefreshCw size={17} aria-hidden="true" className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && <MessageBox type="error" message={error} onRetry={() => refresh(true)} />}
      {message && (
        <MessageBox
          type="success"
          message={message}
          action={availableReceiptPaymentId ? (
            <button
              type="button"
              onClick={(event) => {
                receiptTriggerRef.current = event.currentTarget
                setReceiptPaymentId(availableReceiptPaymentId)
              }}
              className={secondaryButtonClasses}
            >
              View receipt
            </button>
          ) : null}
        />
      )}
      {isParent ? (
        <ParentLedger
          summary={summary}
          trips={billableTrips}
          payments={payments}
          loading={loading}
          nextCursor={nextCursor}
          loadingMore={loadingMore}
          loadMore={() => loadPayments(nextCursor, true)}
          openReceipt={(payment, event) => {
            receiptTriggerRef.current = event.currentTarget
            setReceiptPaymentId(payment._id)
          }}
        />
      ) : (
        <DriverLedger
          summary={summary}
          payments={payments}
          trips={collectibleTrips}
          selectedTripIds={selectedTripIds}
          selectedTrips={selectedTrips}
          selectedAmount={selectedAmount}
          toggleTrip={toggleTrip}
          selectAll={selectAll}
          submitSelectedCash={submitSelectedCash}
          confirming={confirming}
          cancelConfirm={() => setConfirming(false)}
          sending={actionLoading === 'submit'}
          statusFilter={statusFilter}
          setStatusFilter={(next) => {
            setStatusFilter(next)
            setNextCursor(null)
          }}
          loading={loading}
          nextCursor={nextCursor}
          loadingMore={loadingMore}
          loadMore={() => loadPayments(nextCursor, true)}
          reviewPayment={reviewPayment}
          actionLoading={actionLoading}
          rejectingPayment={rejectingPayment}
          setRejectingPayment={setRejectingPayment}
          rejectReason={rejectReason}
          setRejectReason={setRejectReason}
          singleCashTripId={singleCashTripId}
          setSingleCashTripId={setSingleCashTripId}
          recordSingleCash={recordSingleCash}
          openReceipt={(payment, event) => {
            receiptTriggerRef.current = event.currentTarget
            setReceiptPaymentId(payment._id)
          }}
        />
      )}

      <details className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <summary className="min-h-11 cursor-pointer py-2 text-base font-semibold text-slate-900 outline-none focus-visible:ring-4 focus-visible:ring-blue-200">
          Check a receipt
        </summary>
        <div className="pt-3">
          <PaymentReferenceVerifier token={token} />
        </div>
      </details>

      {receiptPaymentId && (
        <PaymentReceipt paymentId={receiptPaymentId} token={token} onClose={closeReceipt} />
      )}
    </section>
  )
}

function ParentLedger({
  summary,
  trips,
  payments,
  loading,
  nextCursor,
  loadingMore,
  loadMore,
  openReceipt,
}) {
  return (
    <>
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-slate-800">
        <p className="font-semibold text-slate-900">Pay in cash.</p>
        <p>Hand the fare to your driver when they pick up or drop off your child. Your driver will record it here and you will get a receipt.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Billable trips" value={summary.billableTrips ?? 0} />
        <SummaryCard label="Total fees" value={formatMoney(summary.totalFees)} />
        <SummaryCard label="Paid" value={formatMoney(summary.paid)} />
        <SummaryCard label="Outstanding" value={formatMoney(summary.outstanding)} />
        {Number(summary.awaiting) > 0 && (
          <SummaryCard label="Awaiting verification" value={formatMoney(summary.awaiting)} />
        )}
      </div>

      <section className="space-y-4" aria-labelledby="trips-to-pay-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 id="trips-to-pay-title" className="text-lg font-semibold text-slate-900">Trips to pay</h3>
            <p className="text-sm text-slate-600">Completed trip fares and payment status.</p>
          </div>
        </div>
        {loading && !trips.length ? (
          <PanelMessage>Loading billable trips…</PanelMessage>
        ) : trips.length === 0 ? (
          <PanelMessage>No completed billable trips yet.</PanelMessage>
        ) : (
          <ul className="grid min-w-0 gap-3 lg:grid-cols-2">
            {trips.map((trip) => (
              <li key={trip.requestId} className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <StatusChip status={trip.paymentStatus === 'unpaid' ? 'unpaid' : 'verified'} />
                    <p className="text-base font-semibold text-slate-900">{formatMoney(trip.fare)}</p>
                  </div>
                  <p className="mt-2 text-sm font-medium text-slate-900">{trip.schoolName || 'School not listed'}</p>
                  {!!trip.studentNames?.length && <p className="mt-1 break-words text-sm text-slate-700">{trip.studentNames.join(', ')}</p>}
                  <p className="mt-2 text-sm text-slate-600">
                    {dateTimeInManila(trip.date)} · {trip.distanceKm == null ? 'Distance unavailable' : `${Number(trip.distanceKm).toFixed(2)} km`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <PaymentHistory
        payments={payments}
        role="parent"
        loading={loading}
        nextCursor={nextCursor}
        loadingMore={loadingMore}
        loadMore={loadMore}
        openReceipt={openReceipt}
      />
    </>
  )
}

function DriverLedger({
  summary,
  payments,
  trips,
  selectedTripIds,
  selectedTrips,
  selectedAmount,
  toggleTrip,
  selectAll,
  submitSelectedCash,
  confirming,
  cancelConfirm,
  sending,
  statusFilter,
  setStatusFilter,
  loading,
  nextCursor,
  loadingMore,
  loadMore,
  reviewPayment,
  actionLoading,
  rejectingPayment,
  setRejectingPayment,
  rejectReason,
  setRejectReason,
  singleCashTripId,
  setSingleCashTripId,
  recordSingleCash,
  openReceipt,
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Collected today"
          value={`${summary.verifiedToday ?? 0} ${summary.verifiedToday === 1 ? 'payment' : 'payments'}`}
        />
        <SummaryCard label="Collected total" value={formatMoney(summary.verifiedTotal)} />
        <SummaryCard label="Not yet collected" value={formatMoney(summary.uncollectedAmount)} />
        {Number(summary.pendingCount) > 0 && (
          <SummaryCard label="Awaiting verification" value={summary.pendingCount} />
        )}
      </div>

      <section className="space-y-4" aria-labelledby="trips-to-collect-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 id="trips-to-collect-title" className="text-lg font-semibold text-slate-900">Trips to collect</h3>
            <p className="text-sm text-slate-600">Record cash received for completed trips.</p>
          </div>
          <button type="button" onClick={selectAll} disabled={!trips.length || Boolean(actionLoading)} className={secondaryButtonClasses}>
            Select all unpaid
          </button>
        </div>
        {loading && !trips.length ? (
          <PanelMessage>Loading collectible trips…</PanelMessage>
        ) : trips.length === 0 ? (
          <PanelMessage>No trips to collect yet. Completed trips appear here.</PanelMessage>
        ) : (
          <ul className="grid min-w-0 gap-3 lg:grid-cols-2">
            {trips.map((trip) => (
              <li key={trip.requestId} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <TripCheckbox
                  trip={trip}
                  checked={selectedTripIds.includes(trip.requestId)}
                  onChange={() => toggleTrip(trip.requestId)}
                />
                {singleCashTripId === trip.requestId ? (
                  <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
                    <p className="text-sm font-semibold leading-6 text-slate-900">
                      Record {formatMoney(trip.fare)} cash received for this trip?
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={Boolean(actionLoading)}
                        onClick={() => recordSingleCash(trip)}
                        className={primaryButtonClasses}
                      >
                        {actionLoading === `cash-${trip.requestId}` ? 'Recording…' : 'Confirm cash received'}
                      </button>
                      <button type="button" onClick={() => setSingleCashTripId(null)} className={secondaryButtonClasses}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={Boolean(actionLoading)}
                    onClick={() => {
                      setConfirming(false)
                      setSingleCashTripId(trip.requestId)
                    }}
                    className={secondaryButtonClasses}
                  >
                    Cash received
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {trips.length > 0 && <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm font-semibold text-slate-700">{selectedTrips.length} trips selected</p>
          <p className="text-lg font-bold text-slate-900">{formatMoney(selectedAmount)}</p>
        </div>}
        {selectedTrips.length > 0 && <form onSubmit={submitSelectedCash} className="space-y-3">
          {confirming ? (
            <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <p className="text-base font-semibold text-slate-900">
                Record {formatMoney(selectedAmount)} cash received for {selectedTrips.length} trips?
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={sending || !selectedTrips.length} className={primaryButtonClasses}>
                  {sending ? 'Recording…' : 'Confirm cash received'}
                </button>
                <button type="button" onClick={cancelConfirm} className={secondaryButtonClasses}>Back</button>
              </div>
            </div>
          ) : (
            <button type="submit" disabled={sending || !selectedTrips.length} className={primaryButtonClasses}>
              Record selected cash
            </button>
          )}
        </form>}
      </section>

      <section className="space-y-3" aria-labelledby="pending-payments-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 id="pending-payments-title" className="text-lg font-semibold text-slate-900">Payment history</h3>
          <div className="flex flex-wrap gap-2" aria-label="Filter payments by status">
            {['all', 'pending', 'verified', 'rejected'].map((status) => (
              <button
                key={status}
                type="button"
                aria-pressed={statusFilter === status}
                onClick={() => setStatusFilter(status)}
                className={`min-h-11 rounded-full border px-3 text-sm font-semibold capitalize outline-none focus-visible:ring-4 focus-visible:ring-blue-300 ${
                  statusFilter === status
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
        <PaymentHistory
          payments={payments}
          role="driver"
          loading={loading}
          nextCursor={nextCursor}
          loadingMore={loadingMore}
          loadMore={loadMore}
          openReceipt={openReceipt}
          reviewPayment={reviewPayment}
          actionLoading={actionLoading}
          rejectingPayment={rejectingPayment}
          setRejectingPayment={setRejectingPayment}
          rejectReason={rejectReason}
          setRejectReason={setRejectReason}
        />
      </section>
    </>
  )
}

function PaymentHistory({
  payments,
  role,
  loading,
  nextCursor,
  loadingMore,
  loadMore,
  openReceipt,
  reviewPayment,
  actionLoading,
  rejectingPayment,
  setRejectingPayment,
  rejectReason,
  setRejectReason,
}) {
  return (
    <section className="space-y-3" aria-labelledby={`${role}-payment-history-title`}>
      <h3 id={`${role}-payment-history-title`} className="text-lg font-semibold text-slate-900">Payment history</h3>
      {loading && !payments.length ? (
        <PanelMessage>Loading payments…</PanelMessage>
      ) : payments.length === 0 ? (
        <PanelMessage>
          {role === 'driver' ? 'No payments yet. Parents pay completed trips here.' : 'No payment history yet.'}
        </PanelMessage>
      ) : (
        <ul className="space-y-3">
          {payments.map((payment) => (
            <li key={payment._id} className="min-w-0 space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <StatusChip status={payment.status} />
                  <p className="mt-2 text-lg font-semibold text-slate-900">{formatMoney(payment.amount, payment.currency)}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {payment.method === 'cash' ? 'Cash' : 'Payment'} · {dateTimeInManila(payment.createdAt)}
                  </p>
                  {payment.referenceNo && (
                    <p className="mt-1 break-all text-sm font-medium text-slate-700">Reference: {payment.referenceNo}</p>
                  )}
                  {payment.parentName && <p className="mt-1 text-sm text-slate-700">Parent: {payment.parentName}</p>}
                  {payment.rejectReason && (
                    <p className="mt-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                      Rejection reason: {payment.rejectReason}
                    </p>
                  )}
                </div>
                {payment.status === 'verified' && (
                  <button
                    type="button"
                    onClick={(event) => openReceipt(payment, event)}
                    className={secondaryButtonClasses}
                  >
                    View receipt
                  </button>
                )}
              </div>
              {!!tripIdsForPayment(payment).length && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-700">Trips covered</p>
                  <ul className="mt-2 space-y-2">
                    {tripIdsForPayment(payment).map((trip, index) => (
                      <li key={`${payment._id}-${index}`} className="flex flex-wrap justify-between gap-2 text-sm text-slate-700">
                        <span className="min-w-0 break-words">{getTripLabel(trip)} · {dateTimeInManila(trip.date)}</span>
                        <span className="font-semibold text-slate-900">{formatMoney(trip.fare, payment.currency)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {role === 'driver' && payment.status === 'pending' && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={Boolean(actionLoading)}
                    onClick={() => reviewPayment(payment, 'verify')}
                    className={primaryButtonClasses}
                  >
                    {actionLoading === `verify-${payment._id}` ? 'Verifying…' : 'Verify payment'}
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(actionLoading)}
                    onClick={() => {
                      setRejectingPayment(payment._id)
                      setRejectReason('')
                    }}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-red-300 bg-white px-4 text-sm font-semibold text-red-800 outline-none hover:bg-red-50 focus-visible:ring-4 focus-visible:ring-red-300 disabled:bg-slate-100"
                  >
                    <CircleX size={17} aria-hidden="true" />
                    Reject
                  </button>
                </div>
              )}
              {role === 'driver' && rejectingPayment === payment._id && (
                <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4">
                  <label className="block space-y-1 text-sm font-medium text-red-950">
                    <span>Reason for rejection</span>
                    <input
                      autoFocus
                      maxLength={200}
                      required
                      value={rejectReason}
                      onChange={(event) => setRejectReason(event.target.value)}
                      className={inputClasses}
                    />
                  </label>
                  <p className="text-sm text-red-900">Confirm that this payment cannot be matched before rejecting it.</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!rejectReason.trim() || Boolean(actionLoading)}
                      onClick={() => reviewPayment(payment, 'reject', rejectReason.trim())}
                      className="min-h-11 rounded-lg bg-red-700 px-4 text-sm font-semibold text-white outline-none hover:bg-red-800 focus-visible:ring-4 focus-visible:ring-red-300 disabled:bg-slate-400"
                    >
                      {actionLoading === `reject-${payment._id}` ? 'Rejecting…' : 'Confirm reject'}
                    </button>
                    <button type="button" onClick={() => setRejectingPayment(null)} className={secondaryButtonClasses}>Cancel</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {nextCursor && (
        <button type="button" onClick={loadMore} disabled={loadingMore} className={secondaryButtonClasses}>
          {loadingMore ? 'Loading…' : 'Load more'}
        </button>
      )}
    </section>
  )
}

function TripCheckbox({ trip, checked, onChange }) {
  return (
    <div className="min-w-0">
      <label className="flex min-h-11 items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          aria-label={`Select trip ${getTripLabel(trip)}`}
          className="mt-0.5 h-6 w-6 shrink-0 rounded border-slate-300 text-blue-700 focus-visible:ring-4 focus-visible:ring-blue-300"
        />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-start justify-between gap-2">
            <span className="text-sm font-semibold text-slate-900">{trip.schoolName || 'School not listed'}</span>
            <span className="text-sm font-semibold text-slate-900">{formatMoney(trip.fare)}</span>
          </span>
          {!!trip.studentNames?.length && <span className="mt-1 block break-words text-sm text-slate-700">{trip.studentNames.join(', ')}</span>}
          <span className="mt-1 block text-sm text-slate-600">{dateTimeInManila(trip.date)}</span>
        </span>
      </label>
    </div>
  )
}

function SummaryCard({ label, value }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-2 break-words text-lg font-bold text-slate-900">{value}</p>
    </div>
  )
}

function StatusChip({ status }) {
  const verified = status === 'verified'
  const rejected = status === 'rejected'
  const unpaid = status === 'unpaid'
  const Icon = verified || unpaid ? (unpaid ? Clock3 : CircleCheck) : rejected ? CircleX : Clock3
  const label = unpaid ? 'Unpaid' : status === 'pending' ? 'Awaiting verification' : verified ? 'Paid' : rejected ? 'Rejected' : 'Pending'
  const styles = rejected
    ? 'border-red-300 bg-red-50 text-red-900'
    : verified
      ? 'border-green-300 bg-green-50 text-green-900'
      : 'border-amber-300 bg-amber-50 text-amber-950'
  return (
    <span className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm font-semibold ${styles}`}>
      <Icon size={16} aria-hidden="true" />
      {label}
    </span>
  )
}

function PanelMessage({ children }) {
  return <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600">{children}</p>
}

function MessageBox({ type, message, onRetry, action }) {
  const error = type === 'error'
  return (
    <div
      role={error ? 'alert' : 'status'}
      className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4 text-sm leading-6 ${
        error ? 'border-red-300 bg-red-50 text-red-900' : 'border-green-300 bg-green-50 text-green-900'
      }`}
    >
      <p className="flex min-w-0 items-start gap-2">
        {error ? <TriangleAlert size={18} aria-hidden="true" className="mt-1 shrink-0" /> : <BadgeCheck size={18} aria-hidden="true" className="mt-1 shrink-0" />}
        <span className="break-words">{message}</span>
      </p>
      {(onRetry || action) && (
        <div className="flex flex-wrap gap-2">
          {action}
          {onRetry && (
            <button type="button" onClick={onRetry} className={secondaryButtonClasses}>
              Retry
            </button>
          )}
        </div>
      )}
    </div>
  )
}

const inputClasses = 'min-h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 placeholder:text-slate-500 outline-none focus-visible:border-blue-600 focus-visible:ring-4 focus-visible:ring-blue-200'
const primaryButtonClasses = 'inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white outline-none hover:bg-blue-800 focus-visible:ring-4 focus-visible:ring-blue-300 disabled:cursor-not-allowed disabled:bg-slate-400'
const secondaryButtonClasses = 'inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 outline-none hover:bg-slate-50 focus-visible:ring-4 focus-visible:ring-blue-300 disabled:cursor-not-allowed disabled:bg-slate-100'
