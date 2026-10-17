import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Printer, X } from 'lucide-react'
import { apiFetch } from '../../api'
import './PaymentReceipt.css'

const dateTimeInManila = (value) => {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not available'
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(date)
}

const formatAmount = (value, currency = 'PHP') => (
  `${currency} ${new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0)}`
)

export default function PaymentReceipt({ paymentId, token, onClose }) {
  const dialogRef = useRef(null)
  const [receipt, setReceipt] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    dialogRef.current?.focus()
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = dialogRef.current?.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      if (!focusable?.length) {
        event.preventDefault()
        dialogRef.current?.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  useEffect(() => {
    let active = true
    apiFetch(`/api/payments/${encodeURIComponent(paymentId)}/receipt`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((data) => {
        if (active) setReceipt(data)
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || 'Unable to load this receipt.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [paymentId, token])

  return (
    <div className="payment-receipt-backdrop fixed inset-0 z-[100] overflow-y-auto bg-slate-950/80 p-3 sm:p-6">
      <section
        id="payment-receipt-print"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-receipt-title"
        tabIndex={-1}
        className="mx-auto my-3 w-full max-w-2xl rounded-xl border border-slate-300 bg-white p-5 text-slate-950 shadow-2xl outline-none focus-visible:ring-4 focus-visible:ring-blue-500 sm:my-8 sm:p-8"
      >
        <div className="payment-receipt-no-print mb-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!receipt}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white outline-none hover:bg-slate-700 focus-visible:ring-4 focus-visible:ring-blue-500 disabled:opacity-50"
          >
            <Printer size={18} aria-hidden="true" />
            Print / Save as PDF
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close receipt"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-400 text-slate-900 outline-none hover:bg-slate-100 focus-visible:ring-4 focus-visible:ring-blue-500"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {loading ? (
          <p role="status" className="py-10 text-center text-base text-slate-600">Loading receipt…</p>
        ) : error ? (
          <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-base text-red-900">{error}</p>
        ) : receipt ? (
          <article className="payment-receipt-document space-y-6">
            <header className="border-b border-slate-300 pb-5 text-center">
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-slate-600">H&amp;S Booking</p>
              <h2 id="payment-receipt-title" className="mt-2 text-2xl font-bold text-slate-950">Payment receipt</h2>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-green-700 bg-green-50 px-3 py-1.5 text-sm font-semibold text-green-900">
                <CheckCircle2 size={18} aria-hidden="true" />
                Verified by driver
              </div>
            </header>

            <div className="rounded-xl border border-slate-300 bg-slate-50 p-4 text-center sm:p-6">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">Reference number</p>
              <p className="mt-2 break-all text-2xl font-extrabold tracking-wide text-slate-950 sm:text-3xl">
                {receipt.referenceNo || 'Unavailable'}
              </p>
              <p className="mt-4 text-sm text-slate-600">Amount paid</p>
              <p className="mt-1 text-3xl font-bold text-slate-950">{formatAmount(receipt.amount, receipt.currency)}</p>
            </div>

            <dl className="grid grid-cols-1 gap-4 text-base sm:grid-cols-2">
              <ReceiptField label="Payment method" value={receipt.method === 'cash' ? 'Cash' : 'Payment'} />
              <ReceiptField label="Date and time (Asia/Manila)" value={dateTimeInManila(receipt.verifiedAt)} />
              <ReceiptField label="Parent" value={receipt.parentName || 'Not available'} />
              <ReceiptField label="Driver" value={receipt.driverName || 'Not available'} />
              {receipt.plateNumber && <ReceiptField label="Plate number" value={receipt.plateNumber} />}
              {!receipt.trips?.length && receipt.studentNames?.length > 0 && (
                <ReceiptField label="Students" value={receipt.studentNames.join(', ')} />
              )}
              {!receipt.trips?.length && receipt.schoolName && <ReceiptField label="School" value={receipt.schoolName} />}
            </dl>

            {!!receipt.trips?.length && (
              <section className="space-y-3" aria-labelledby="receipt-trips-title">
                <h3 id="receipt-trips-title" className="text-lg font-semibold text-slate-950">Trips covered</h3>
                <ul className="space-y-3">
                  {receipt.trips.map((trip, index) => (
                    <li key={`${trip.date || 'trip'}-${index}`} className="rounded-lg border border-slate-300 bg-white p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="break-words font-semibold text-slate-950">{trip.schoolName || 'School not listed'}</p>
                          {trip.studentNames?.length > 0 && (
                            <p className="mt-1 break-words text-sm text-slate-700">{trip.studentNames.join(', ')}</p>
                          )}
                          <p className="mt-1 text-sm text-slate-600">{dateTimeInManila(trip.date)}</p>
                        </div>
                        <p className="font-semibold text-slate-950">{formatAmount(trip.fare, receipt.currency)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="flex justify-between gap-3 border-t border-slate-300 pt-3 text-base font-bold text-slate-950">
                  <span>Total</span>
                  <span>{formatAmount(receipt.total ?? receipt.amount, receipt.currency)}</span>
                </div>
              </section>
            )}

            <p className="border-t border-slate-300 pt-4 text-center text-sm leading-relaxed text-slate-700">
              This reference number can be verified in the app.
            </p>
          </article>
        ) : null}
      </section>
    </div>
  )
}

function ReceiptField({ label, value }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm font-semibold text-slate-600">{label}</dt>
      <dd className="mt-1 break-words font-medium text-slate-950">{value}</dd>
    </div>
  )
}
