import { useCallback, useEffect, useRef, useState } from 'react'
import { BadgeCheck, CircleCheck, CircleX, Clock3, RefreshCw, TriangleAlert } from 'lucide-react'
import { apiFetch } from '../../api'
import { paymentInfo } from '../../config/paymentInfo'
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

const hasPaymentValue = (value) => (
  typeof value === 'string'
  && value.trim().length > 0
  && !/(placeholder|your|todo|tbd)/i.test(value)
)

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
  const [externalRef, setExternalRef] = useState('')
  const [note, setNote] = useState('')
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
    if (clearMessage) setMessage('')
    await loadPayments()
  }, [loadPayments])

  useEffect(() => {
    refresh()
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh()
    }, 30_000)
    return () => window.clearInterval(intervalId)
  }, [refresh])

  const selectableTrips = isParent
    ? billableTrips.filter((trip) => trip.paymentStatus === 'unpaid')
    : collectibleTrips
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

  const submitPayment = async (event) => {
    event.preventDefault()
    if (!selectedTripIds.length || actionLoading) return
    if (!confirming) {
      setConfirming(true)
      return
    }

    setActionLoading('submit')
    setError('')
    setMessage('')
    try {
      const body = isParent
        ? {
            vanRequestIds: selectedTripIds,
            method: 'gcash',
            externalRef: externalRef.trim(),
            ...(note.trim() ? { note: note.trim() } : {}),
          }
        : {
            vanRequestIds: selectedTripIds,
            ...(note.trim() ? { note: note.trim() } : {}),
          }
      await apiFetch(isParent ? '/api/payments' : '/api/payments/driver/record-cash', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      setSelectedTripIds([])
      setExternalRef('')
      setNote('')
      setConfirming(false)
      setMessage(isParent ? 'Payment submitted to your driver for verification.' : 'Cash payment recorded and verified.')
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
    try {
      await apiFetch('/api/payments/driver/record-cash', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ vanRequestIds: [trip.requestId] }),
      })
      setMessage('Cash payment recorded and verified.')
      setSingleCashTripId(null)
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
              ? 'Pay completed trips directly to your driver. No payment gateway is used.'
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
      {message && <MessageBox type="success" message={message} />}
      {isParent ? (
        <ParentLedger
          summary={summary}
          trips={billableTrips}
          selectableTrips={selectableTrips}
          selectedTripIds={selectedTripIds}
          selectedTrips={selectedTrips}
          selectedAmount={selectedAmount}
          externalRef={externalRef}
          setExternalRef={setExternalRef}
          note={note}
          setNote={setNote}
          toggleTrip={toggleTrip}
          selectAll={selectAll}
          submitPayment={submitPayment}
          confirming={confirming}
          cancelConfirm={() => setConfirming(false)}
          sending={actionLoading === 'submit'}
          payments={payments}
          loading={loading}
          nextCursor={nextCursor}
          loadingMore={loadingMore}
          loadMore={() => loadPayments(nextCursor, true)}
          openReceipt={(payment, event) => {
            receiptTriggerRef.current = event.currentTarget
            setReceiptPaymentId(payment._id)
          }}
          paymentInfo={paymentInfo}
        />
      ) : (
        <DriverLedger
          summary={summary}
          payments={payments}
          trips={collectibleTrips}
          selectedTripIds={selectedTripIds}
          selectedTrips={selectedTrips}
          selectedAmount={selectedAmount}
          note={note}
          setNote={setNote}
          toggleTrip={toggleTrip}
          selectAll={selectAll}
          submitPayment={submitPayment}
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
  selectableTrips,
  selectedTripIds,
  selectedTrips,
  selectedAmount,
  externalRef,
  setExternalRef,
  note,
  setNote,
  toggleTrip,
  selectAll,
  submitPayment,
  confirming,
  cancelConfirm,
  sending,
  payments,
  loading,
  nextCursor,
  loadingMore,
  loadMore,
  openReceipt,
  paymentInfo: info,
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Billable trips" value={summary.billableTrips ?? 0} />
        <SummaryCard label="Total fees" value={formatMoney(summary.totalFees)} />
        <SummaryCard label="Paid" value={formatMoney(summary.paid)} />
        <SummaryCard label="Awaiting verification" value={formatMoney(summary.awaiting)} />
        <SummaryCard label="Outstanding" value={formatMoney(summary.outstanding)} />
      </div>

      <section className="space-y-4" aria-labelledby="trips-to-pay-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 id="trips-to-pay-title" className="text-lg font-semibold text-slate-900">Trips to pay</h3>
            <p className="text-sm text-slate-600">Select up to {MAX_TRIPS_PER_PAYMENT} unpaid trips for one driver.</p>
          </div>
          <button
            type="button"
            onClick={selectAll}
            disabled={!selectableTrips.length}
            className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none hover:bg-slate-50 focus-visible:ring-4 focus-visible:ring-blue-300 disabled:cursor-not-allowed disabled:bg-slate-100"
          >
            Select all unpaid
          </button>
        </div>
        {loading && !trips.length ? (
          <PanelMessage>Loading billable trips…</PanelMessage>
        ) : trips.length === 0 ? (
          <PanelMessage>No completed billable trips yet.</PanelMessage>
        ) : (
          <ul className="grid min-w-0 gap-3 lg:grid-cols-2">
            {trips.map((trip) => (
              <li key={trip.requestId} className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  {trip.paymentStatus === 'unpaid' ? (
                    <label className="flex h-11 w-11 shrink-0 items-start justify-start pt-1" aria-label={`Select trip ${getTripLabel(trip)}`}>
                      <input
                        type="checkbox"
                        checked={selectedTripIds.includes(trip.requestId)}
                        onChange={() => toggleTrip(trip.requestId)}
                        className="h-6 w-6 rounded border-slate-300 text-blue-700 focus-visible:ring-4 focus-visible:ring-blue-300"
                      />
                    </label>
                  ) : <span className="w-6 shrink-0" aria-hidden="true" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <StatusChip status={trip.paymentStatus === 'pending' ? 'pending' : trip.paymentStatus === 'paid' ? 'verified' : 'unpaid'} />
                      <p className="text-base font-semibold text-slate-900">{formatMoney(trip.fare)}</p>
                    </div>
                    <p className="mt-2 text-sm font-medium text-slate-900">{trip.schoolName || 'School not listed'}</p>
                    {!!trip.studentNames?.length && <p className="mt-1 break-words text-sm text-slate-700">{trip.studentNames.join(', ')}</p>}
                    <p className="mt-2 text-sm text-slate-600">
                      {dateTimeInManila(trip.date)} · {trip.distanceKm == null ? 'Distance unavailable' : `${Number(trip.distanceKm).toFixed(2)} km`}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="sticky bottom-[calc(64px+var(--safe-area-inset-bottom))] z-10 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white p-3 shadow-lg">
          <p className="text-sm font-semibold text-slate-900">{selectedTrips.length} trips selected</p>
          <p className="text-base font-bold text-slate-900">{formatMoney(selectedAmount)}</p>
        </div>
      </section>

      <form onSubmit={submitPayment} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Submit payment</h3>
        <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h4 className="text-base font-semibold text-slate-900">How to pay</h4>
          <ol className="list-inside list-decimal space-y-1 text-sm leading-6 text-slate-700">
            <li>
              Pay the fare of your selected trips to your driver by GCash:{' '}
              {hasPaymentValue(info.gcashAccountName) && hasPaymentValue(info.gcashNumber)
                ? `${info.gcashAccountName} · ${info.gcashNumber}`
                : 'Ask your driver for payment details.'}
            </li>
            <li>Copy the reference number from your GCash receipt.</li>
            <li>Enter that reference number here and submit.</li>
            <li>Your driver confirms the payment, and you get a receipt.</li>
          </ol>
          <p className="text-sm font-medium leading-6 text-slate-800">
            Paying cash? Hand the fare to your driver. They will record it and you will get a receipt.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm font-medium text-slate-700 sm:col-span-2">
            <span>GCash reference number</span>
            <input
              required
              maxLength={40}
              value={externalRef}
              onChange={(event) => setExternalRef(event.target.value)}
              className={inputClasses}
              placeholder="Reference number from your GCash receipt"
              aria-describedby="gcash-reference-hint"
            />
            <span id="gcash-reference-hint" className="block text-sm font-normal text-slate-600">
              Find this on your GCash receipt (usually 13 digits).
            </span>
          </label>
          <label className="space-y-1 text-sm font-medium text-slate-700 sm:col-span-2">
            <span>Note (optional)</span>
            <input
              maxLength={200}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className={inputClasses}
            />
          </label>
        </div>
        {confirming ? (
          <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-4" role="group" aria-label="Confirm payment">
            <p className="text-base font-semibold text-slate-900">
              Submit {formatMoney(selectedAmount)} for {selectedTrips.length} trips to your driver?
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={sending || !selectedTrips.length} className={primaryButtonClasses}>
                {sending ? 'Submitting…' : 'Confirm and submit'}
              </button>
              <button type="button" onClick={cancelConfirm} className={secondaryButtonClasses}>Back</button>
            </div>
          </div>
        ) : (
          <button type="submit" disabled={sending || !selectedTrips.length || !externalRef.trim()} className={primaryButtonClasses}>
            Continue to confirmation
          </button>
        )}
        <p className="text-sm leading-6 text-slate-600">
          How fares work: first 2 km is PHP 50, then PHP 10 per additional km, rounded up to PHP 5, based on pickup-to-school distance.
        </p>
      </form>

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
  note,
  setNote,
  toggleTrip,
  selectAll,
  submitPayment,
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
        <SummaryCard label="Awaiting verification" value={summary.pendingCount ?? 0} />
        <SummaryCard
          label="Collected today"
          value={`${summary.verifiedToday ?? 0} ${summary.verifiedToday === 1 ? 'payment' : 'payments'}`}
        />
        <SummaryCard label="Collected total" value={formatMoney(summary.verifiedTotal)} />
        <SummaryCard label="Not yet collected" value={formatMoney(summary.uncollectedAmount)} />
      </div>

      <section className="space-y-3" aria-labelledby="pending-payments-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 id="pending-payments-title" className="text-lg font-semibold text-slate-900">Pending payments</h3>
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
        {payments.some((payment) => payment.status === 'pending' && payment.method === 'gcash') && (
          <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm leading-6 text-slate-800">
            Check your GCash app for this reference and amount before you verify.
          </p>
        )}
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

      <section className="space-y-4" aria-labelledby="record-cash-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 id="record-cash-title" className="text-lg font-semibold text-slate-900">Trips to collect</h3>
            <p className="text-sm text-slate-600">Choose completed, unpaid trips assigned to you.</p>
          </div>
          <button type="button" onClick={selectAll} disabled={!trips.length} className={secondaryButtonClasses}>
            Select all unpaid
          </button>
        </div>
        {loading && !trips.length ? (
          <PanelMessage>Loading collectible trips…</PanelMessage>
        ) : trips.length === 0 ? (
          <PanelMessage>No completed unpaid trips are available to collect.</PanelMessage>
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
                    onClick={() => setSingleCashTripId(trip.requestId)}
                    className={secondaryButtonClasses}
                  >
                    Cash received
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm font-semibold text-slate-700">{selectedTrips.length} trips selected</p>
          <p className="text-lg font-bold text-slate-900">{formatMoney(selectedAmount)}</p>
        </div>
        <form onSubmit={submitPayment} className="space-y-4">
          <label className="block space-y-1 text-sm font-medium text-slate-700">
            <span>Note (optional)</span>
            <input maxLength={200} value={note} onChange={(event) => setNote(event.target.value)} className={inputClasses} />
          </label>
          {confirming ? (
            <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <p className="text-base font-semibold text-slate-900">
                Record {formatMoney(selectedAmount)} cash for {selectedTrips.length} trips?
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
              Continue to confirmation
            </button>
          )}
        </form>
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
                    {payment.method?.toUpperCase() || 'Payment'} · {dateTimeInManila(payment.createdAt)}
                  </p>
                  {payment.referenceNo && (
                    <p className="mt-1 break-all text-sm font-medium text-slate-700">Reference: {payment.referenceNo}</p>
                  )}
                  {payment.parentName && <p className="mt-1 text-sm text-slate-700">Parent: {payment.parentName}</p>}
                  {payment.externalRef && <p className="mt-1 break-all text-sm text-slate-700">GCash reference: {payment.externalRef}</p>}
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

function MessageBox({ type, message, onRetry }) {
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
      {onRetry && (
        <button type="button" onClick={onRetry} className={secondaryButtonClasses}>
          Retry
        </button>
      )}
    </div>
  )
}

const inputClasses = 'min-h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 placeholder:text-slate-500 outline-none focus-visible:border-blue-600 focus-visible:ring-4 focus-visible:ring-blue-200'
const primaryButtonClasses = 'inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white outline-none hover:bg-blue-800 focus-visible:ring-4 focus-visible:ring-blue-300 disabled:cursor-not-allowed disabled:bg-slate-400'
const secondaryButtonClasses = 'inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 outline-none hover:bg-slate-50 focus-visible:ring-4 focus-visible:ring-blue-300 disabled:cursor-not-allowed disabled:bg-slate-100'
