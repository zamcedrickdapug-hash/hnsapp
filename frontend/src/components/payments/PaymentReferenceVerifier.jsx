import { useState } from 'react'
import { BadgeCheck, Search, TriangleAlert } from 'lucide-react'
import { apiFetch } from '../../api'

const REFERENCE_PATTERN = /^HNS-\d{8}-[A-Z0-9]{6}$/

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

const formatAmount = (amount, currency = 'PHP') => (
  `${currency} ${new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0)}`
)

export default function PaymentReferenceVerifier({ token }) {
  const [referenceNo, setReferenceNo] = useState('')
  const [result, setResult] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const verify = async (event) => {
    event.preventDefault()
    const normalizedReference = referenceNo.trim().toUpperCase()
    setReferenceNo(normalizedReference)
    setResult(null)
    setNotFound(false)
    setError('')
    if (!REFERENCE_PATTERN.test(normalizedReference)) {
      setError('Enter a reference in the format HNS-YYYYMMDD-XXXXXX.')
      return
    }

    setLoading(true)
    try {
      setResult(await apiFetch(`/api/payments/verify/${encodeURIComponent(normalizedReference)}`, {
        headers: { Authorization: `Bearer ${token}` },
      }))
    } catch (requestError) {
      if (requestError.status === 404) setNotFound(true)
      else setError(requestError.message || 'Unable to verify this reference. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 text-slate-900 shadow-sm" aria-labelledby="reference-verifier-title">
      <div>
        <h3 id="reference-verifier-title" className="text-lg font-semibold text-slate-900">Check a receipt</h3>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Check that a receipt from this app is genuine. Enter the reference number printed on the receipt
          (HNS-YYYYMMDD-XXXXXX). This is not your GCash reference number.
        </p>
      </div>
      <form onSubmit={verify} className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <label className="sr-only" htmlFor="payment-reference-input">Receipt reference number</label>
        <input
          id="payment-reference-input"
          type="text"
          value={referenceNo}
          onChange={(event) => {
            setReferenceNo(event.target.value.toUpperCase())
            setResult(null)
            setNotFound(false)
            setError('')
          }}
          placeholder="HNS-YYYYMMDD-XXXXXX"
          maxLength={20}
          autoCapitalize="characters"
          autoComplete="off"
          className="block min-h-11 w-full min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-base leading-6 text-slate-900 placeholder:text-slate-500 outline-none focus-visible:border-blue-600 focus-visible:ring-4 focus-visible:ring-blue-200 sm:w-auto"
        />
        <button
          type="submit"
          disabled={loading || !referenceNo.trim()}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white outline-none hover:bg-blue-800 focus-visible:ring-4 focus-visible:ring-blue-300 disabled:cursor-not-allowed disabled:bg-slate-400 sm:w-auto"
        >
          <Search size={18} aria-hidden="true" />
          {loading ? 'Checking…' : 'Check receipt'}
        </button>
      </form>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          <TriangleAlert size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}
      {notFound && (
        <p role="status" className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          <TriangleAlert size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
          Reference not found or not verified.
        </p>
      )}
      {result?.valid && (
        <div role="status" className="space-y-2 rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-950">
          <p className="flex items-center gap-2 font-semibold">
            <BadgeCheck size={19} aria-hidden="true" />
            Valid verified payment
          </p>
          <p>Status: {result.status}</p>
          <p>Amount: {formatAmount(result.amount, result.currency)}</p>
          <p>Verified: {dateTimeInManila(result.verifiedAt)} (Asia/Manila)</p>
        </div>
      )}
    </section>
  )
}
