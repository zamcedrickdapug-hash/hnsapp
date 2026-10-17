import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch } from '../../../api'
import './DriverTripHistory.scss'

const STATUS_FILTERS = [
	{ value: 'all', label: 'All' },
	{ value: 'completed', label: 'Completed' },
	{ value: 'cancelled', label: 'Cancelled' },
]

const RANGE_OPTIONS = [
	{ value: 'all', label: 'All time' },
	{ value: 'today', label: 'Today' },
	{ value: '7d', label: 'Last 7 days' },
	{ value: '30d', label: 'Last 30 days' },
]

const EMPTY_SUMMARY = {
	completed: 0,
	thisWeek: 0,
	cancelled: 0,
	studentsTransported: 0,
}

const formatDateTime = (value) => {
	if (!value) return 'Not recorded'
	const date = new Date(value)
	return Number.isNaN(date.getTime())
		? 'Not recorded'
		: date.toLocaleString([], {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
		})
}

const authHeaders = (token) => ({ Authorization: `Bearer ${token}` })

export default function DriverTripHistory({ token, onMessageParent }) {
	const [status, setStatus] = useState('all')
	const [range, setRange] = useState('all')
	const [trips, setTrips] = useState([])
	const [summary, setSummary] = useState(EMPTY_SUMMARY)
	const [expandedTripId, setExpandedTripId] = useState(null)
	const [nextCursor, setNextCursor] = useState(null)
	const [hasMore, setHasMore] = useState(false)
	const [loading, setLoading] = useState(true)
	const [loadingMore, setLoadingMore] = useState(false)
	const [error, setError] = useState('')
	const [retryCount, setRetryCount] = useState(0)
	const loadSequence = useRef(0)

	useEffect(() => {
		const sequence = ++loadSequence.current
		let current = true
		setLoading(true)
		setError('')
		setTrips([])
		setNextCursor(null)
		setHasMore(false)
		setLoadingMore(false)

		const query = new URLSearchParams({ status, range, limit: '20' })
		apiFetch(`/api/drivers/trips/history?${query}`, { headers: authHeaders(token) })
			.then((response) => {
				if (!current || sequence !== loadSequence.current) return
				setTrips(response.trips || [])
				setSummary(response.summary || EMPTY_SUMMARY)
				setNextCursor(response.nextCursor || null)
				setHasMore(Boolean(response.hasMore))
			})
			.catch((requestError) => {
				if (current && sequence === loadSequence.current) {
					setError(requestError.message || 'Unable to load trip history.')
				}
			})
			.finally(() => {
				if (current && sequence === loadSequence.current) setLoading(false)
			})

		return () => {
			current = false
		}
	}, [token, status, range, retryCount])

	const loadMore = useCallback(async () => {
		if (!nextCursor || loadingMore) return
		const sequence = loadSequence.current
		setLoadingMore(true)
		setError('')
		try {
			const query = new URLSearchParams({ status, range, limit: '20', before: nextCursor })
			const response = await apiFetch(`/api/drivers/trips/history?${query}`, {
				headers: authHeaders(token),
			})
			if (sequence !== loadSequence.current) return
			setTrips((currentTrips) => [...currentTrips, ...(response.trips || [])])
			setNextCursor(response.nextCursor || null)
			setHasMore(Boolean(response.hasMore))
		} catch (requestError) {
			if (sequence === loadSequence.current) {
				setError(requestError.message || 'Unable to load more trips.')
			}
		} finally {
			if (sequence === loadSequence.current) setLoadingMore(false)
		}
	}, [loadingMore, nextCursor, range, status, token])

	return (
		<section className="driver-trip-history" aria-labelledby="driver-trip-history-title">
			<header className="driver-trip-history__header">
				<h1 id="driver-trip-history-title">Trip History</h1>
				<p>Review completed and cancelled trips assigned to you.</p>
			</header>

			<div className="driver-trip-history__summary" aria-label="Trip history summary">
				<SummaryCard label="Completed" value={summary.completed} variant="completed" />
				<SummaryCard label="This week" value={summary.thisWeek} variant="week" />
				<SummaryCard label="Cancelled" value={summary.cancelled} variant="cancelled" />
				<SummaryCard label="Students transported" value={summary.studentsTransported} variant="students" />
			</div>

			<div className="driver-trip-history__filters">
				<div className="driver-trip-history__status-filters" role="group" aria-label="Filter trips by status">
					{STATUS_FILTERS.map((filter) => (
						<button
							key={filter.value}
							type="button"
							className={status === filter.value ? 'is-selected' : ''}
							aria-pressed={status === filter.value}
							onClick={() => setStatus(filter.value)}
						>
							{filter.label}
						</button>
					))}
				</div>
				<label className="driver-trip-history__range">
					<span>Date range</span>
					<select value={range} onChange={(event) => setRange(event.target.value)}>
						{RANGE_OPTIONS.map((option) => (
							<option key={option.value} value={option.value}>{option.label}</option>
						))}
					</select>
				</label>
			</div>

			{error && (
				<div className="driver-trip-history__error" role="alert">
					<p>{error}</p>
					<button type="button" onClick={() => setRetryCount((count) => count + 1)}>Retry</button>
				</div>
			)}

			{loading ? (
				<p className="driver-trip-history__message" role="status">Loading trip history...</p>
			) : trips.length ? (
				<>
					<div className="driver-trip-history__list">
						{trips.map((trip) => {
							const expanded = expandedTripId === trip.requestId
							return (
								<article className="driver-trip-history__trip" key={trip.requestId}>
									<div className="driver-trip-history__trip-main">
										<span className={`driver-trip-history__status driver-trip-history__status--${trip.status}`}>
											{trip.status === 'completed' ? 'Completed' : 'Cancelled'}
										</span>
										<div className="driver-trip-history__trip-info">
											<h2>{trip.schoolName || 'School not recorded'}</h2>
											<p>{trip.studentNames?.length ? trip.studentNames.join(', ') : 'Student not recorded'}</p>
											<p>Parent: {trip.parentName || 'Not recorded'}</p>
											<p>{formatDateTime(trip.createdAt)}</p>
										</div>
										<div className="driver-trip-history__trip-metrics">
											<span>Duration</span>
											<strong>{trip.durationMinutes == null ? '—' : `${trip.durationMinutes} min`}</strong>
										</div>
										<button
											type="button"
											className="driver-trip-history__expand"
											aria-label={`${expanded ? 'Hide' : 'Show'} trip details for ${trip.schoolName || 'trip'}`}
											aria-expanded={expanded}
											onClick={() => setExpandedTripId(expanded ? null : trip.requestId)}
										>
											{expanded ? 'Hide details' : 'Details'}
										</button>
									</div>
									{expanded && (
										<div className="driver-trip-history__details">
											<Detail label="Pickup time" value={formatDateTime(trip.acceptedAt)} />
											<Detail label="Picked up" value={formatDateTime(trip.pickedUpAt)} />
											<Detail label="Arrived at school" value={formatDateTime(trip.arrivedAtSchoolAt)} />
											<Detail label="Completed" value={formatDateTime(trip.completedAt)} />
											{trip.hasChat && (
												<button
													type="button"
													className="driver-trip-history__message-parent"
													onClick={() => onMessageParent?.(trip.requestId)}
												>
													Message parent
												</button>
											)}
										</div>
									)}
								</article>
							)
						})}
					</div>
					{hasMore && (
						<button
							type="button"
							className="driver-trip-history__load-more"
							onClick={loadMore}
							disabled={loadingMore}
						>
							{loadingMore ? 'Loading...' : 'Load more'}
						</button>
					)}
				</>
			) : !error ? (
				<p className="driver-trip-history__message">
					No finished trips yet. Completed and cancelled trips will appear here.
				</p>
			) : null}
		</section>
	)
}

function SummaryCard({ label, value, variant }) {
	return (
		<div className={`driver-trip-history__summary-card driver-trip-history__summary-card--${variant}`}>
			<strong>{value ?? 0}</strong>
			<span>{label}</span>
		</div>
	)
}

function Detail({ label, value }) {
	return (
		<div className="driver-trip-history__detail">
			<span>{label}</span>
			<strong>{value}</strong>
		</div>
	)
}
