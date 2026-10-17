import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, RotateCw } from 'lucide-react'
import { apiFetch } from '../../api'
import { EmptyState } from './AdminUI'

const ranges = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
]

const formatNumber = (value, maximumFractionDigits = 0) => new Intl.NumberFormat('en-PH', {
  maximumFractionDigits,
}).format(Number(value) || 0)

const formatMoney = (amount, currency = 'PHP') => (
  `${currency} ${formatNumber(amount, 2)}`
)

const tripColors = {
  completed: '#166534',
  cancelled: '#991b1b',
  accepted: '#1d4ed8',
  searching: '#475569',
  arrived: '#6d28d9',
  picked_up: '#0369a1',
  arrived_at_school: '#0f766e',
}

function fillDays(days, range) {
  const count = Number(range.replace('d', ''))
  const todayParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const today = Object.fromEntries(todayParts.map(({ type, value }) => [type, value]))
  const currentDay = new Date(Date.UTC(Number(today.year), Number(today.month) - 1, Number(today.day)))
  const lookup = new Map(days.map((day) => [day.date, day.count]))

  return Array.from({ length: count }, (_, index) => {
    const day = new Date(currentDay.getTime() - ((count - index - 1) * 24 * 60 * 60 * 1000))
    const date = [
      day.getUTCFullYear(),
      String(day.getUTCMonth() + 1).padStart(2, '0'),
      String(day.getUTCDate()).padStart(2, '0'),
    ].join('-')
    return { date, count: lookup.get(date) || 0 }
  })
}

export default function AdminAnalyticsSection({ token }) {
  const [range, setRange] = useState('30d')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tableView, setTableView] = useState({ trips: false, registrations: false })

  const loadAnalytics = useCallback(async (selectedRange = range) => {
    setLoading(true)
    setError('')
    try {
      const response = await apiFetch(`/api/admin/analytics/summary?range=${selectedRange}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setData(response)
    } catch (loadError) {
      setError(loadError.message || 'Unable to load analytics.')
    } finally {
      setLoading(false)
    }
  }, [range, token])

  useEffect(() => {
    loadAnalytics(range)
  }, [loadAnalytics, range])

  const tripsByDay = data ? fillDays(data.tripsPerDay || [], range) : []
  const registrationsByDay = data ? fillDays(
    [...(data.registrationsPerDay || []).reduce((map, item) => {
      map.set(item.date, (map.get(item.date) || 0) + item.count)
      return map
    }, new Map())].map(([date, count]) => ({ date, count })),
    range,
  ) : []
  const registrationRoles = [...new Set((data?.registrationsPerDay || []).map((item) => item.role))]
  const maxTripsByStatus = Math.max(1, ...(data?.tripsByStatus || []).map((item) => item.count))
  const maxSchoolTrips = Math.max(1, ...(data?.topSchools || []).map((item) => item.count))
  const totalRegistrations = (data?.registrationsPerDay || []).reduce((total, item) => total + item.count, 0)
  const { summary = {}, collections = {}, approvals = {} } = data || {}

  return (
    <section className="admin-section admin-analytics" aria-label="Analytics">
      <div className="admin-analytics__controls">
        <label>
          Date range
          <select value={range} onChange={(event) => setRange(event.target.value)}>
            {ranges.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <button type="button" className="admin-button admin-button--secondary" onClick={() => loadAnalytics()} disabled={loading}>
          <RefreshCw size={17} aria-hidden="true" className={loading ? 'admin-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="admin-inline-result admin-inline-result--error" role="alert">
          <span>{error}</span>
          <button type="button" className="admin-button admin-button--secondary" onClick={() => loadAnalytics()}>
            <RotateCw size={17} aria-hidden="true" /> Retry
          </button>
        </div>
      )}

      {loading && !data ? (
        <div className="admin-analytics-skeleton" aria-label="Loading analytics">
          {Array.from({ length: 6 }, (_, index) => <div key={index} />)}
        </div>
      ) : data ? (
        <>
          <div className="admin-analytics-kpis">
            {[
              ['Trips', formatNumber(summary.totalTrips), 'Trips created in range'],
              ['Completed', formatNumber(summary.completedTrips), `${formatNumber((summary.completedRate || 0) * 100, 1)}% of trips`],
              ['Cancelled', formatNumber(summary.cancelledTrips), `${formatNumber((summary.cancelledRate || 0) * 100, 1)}% of trips`],
              ['Active drivers', formatNumber(summary.activeDrivers), 'Approved, active accounts'],
              ['Approvals pending', formatNumber(approvals.pending), 'Current applications'],
              ['Applications reviewing', formatNumber(approvals.reviewing), 'Currently under review'],
              ['New registrations', formatNumber(totalRegistrations), `Parents and drivers - ${range}`],
            ].map(([label, value, detail]) => (
              <article className="admin-analytics-kpi" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{detail}</small>
              </article>
            ))}
          </div>

          <section className="admin-analytics-card" aria-labelledby="trips-chart-title">
            <header>
              <div><h3 id="trips-chart-title">Trips per day</h3><p>Trip requests by Manila calendar day.</p></div>
              <button type="button" className="admin-button admin-button--secondary" onClick={() => setTableView((current) => ({ ...current, trips: !current.trips }))}>
                {tableView.trips ? 'View chart' : 'View as table'}
              </button>
            </header>
            {tripsByDay.every((day) => day.count === 0) ? <EmptyState>No trips in this period.</EmptyState> : tableView.trips ? (
              <DayTable days={tripsByDay} label="Trips" />
            ) : (
              <BarChart days={tripsByDay} label="Trips" color="#1d4ed8" />
            )}
          </section>

          <div className="admin-analytics-grid">
            <section className="admin-analytics-card" aria-labelledby="status-breakdown-title">
              <header><div><h3 id="status-breakdown-title">Trip status breakdown</h3><p>Status counts for the selected range.</p></div></header>
              {!data.tripsByStatus.length ? <EmptyState>No trip statuses to show.</EmptyState> : (
                <ul className="admin-status-breakdown">
                  {data.tripsByStatus.map(({ status, count }) => (
                    <li key={status}>
                      <div><span>{status.replaceAll('_', ' ')}</span><strong>{formatNumber(count)}</strong></div>
                      <span className="admin-status-breakdown__track">
                        <span style={{ width: `${(count / maxTripsByStatus) * 100}%`, backgroundColor: tripColors[status] || '#475569' }} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="admin-analytics-card" aria-labelledby="top-schools-title">
              <header><div><h3 id="top-schools-title">Top schools</h3><p>Ranked by trip count.</p></div></header>
              {!data.topSchools.length ? <EmptyState>No school trip data to show.</EmptyState> : (
                <ol className="admin-top-schools">
                  {data.topSchools.map(({ school, count }) => (
                    <li key={school}>
                      <span>{school}</span>
                      <span className="admin-top-schools__count" style={{ width: `${Math.max(14, (count / maxSchoolTrips) * 100)}%` }}>{formatNumber(count)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>

          <section className="admin-analytics-card" aria-labelledby="registrations-chart-title">
            <header>
              <div><h3 id="registrations-chart-title">Registrations per day</h3><p>New parent and driver accounts by Manila calendar day.</p></div>
              <button type="button" className="admin-button admin-button--secondary" onClick={() => setTableView((current) => ({ ...current, registrations: !current.registrations }))}>
                {tableView.registrations ? 'View chart' : 'View as table'}
              </button>
            </header>
            {registrationsByDay.every((day) => day.count === 0) ? <EmptyState>No registrations in this period.</EmptyState> : tableView.registrations ? (
              <DayTable days={registrationsByDay} label="Registrations" />
            ) : (
              <BarChart days={registrationsByDay} label="Registrations" color="#166534" />
            )}
            {registrationRoles.length > 0 && (
              <p className="admin-analytics-note">Includes {registrationRoles.join(' and ')} registrations only.</p>
            )}
          </section>

          <section className="admin-analytics-card" aria-labelledby="collections-title">
            <header><div><h3 id="collections-title">Collections summary</h3><p>Billable trip fares by recorded collection status for {range}.</p></div></header>
            <div className="admin-collections-grid">
              <Metric label="Total billable fares" value={formatMoney(collections.total, collections.currency)} />
              <Metric label="Average fare" value={formatMoney(collections.averageFare, collections.currency)} />
              <Metric label="Collected" value={formatMoney(collections.collected, collections.currency)} />
              <Metric label="Outstanding" value={formatMoney(collections.outstanding, collections.currency)} />
              <Metric
                label="Average booking-to-completion"
                value={summary.averageMinutesToCompletion == null
                  ? 'Not tracked yet'
                  : `${formatNumber(summary.averageMinutesToCompletion, 1)} minutes`}
              />
            </div>
            {collections.truncated && (
              <p className="admin-analytics-note" role="status">
                Only the most recent 5,000 billable trips are included; these totals are partial.
              </p>
            )}
          </section>
        </>
      ) : (
        <EmptyState>Analytics data is not available.</EmptyState>
      )}
    </section>
  )
}

function Metric({ label, value }) {
  return <article><span>{label}</span><strong>{value}</strong></article>
}

function BarChart({ days, label, color }) {
  const maximum = Math.max(1, ...days.map((day) => day.count))
  return (
    <div className="admin-bar-chart" role="img" aria-label={`${label} per day bar chart. Use View as table for exact values.`}>
      {days.map((day) => (
        <div className="admin-bar-chart__column" key={day.date} title={`${day.date}: ${day.count} ${label.toLowerCase()}`}>
          <span className="admin-bar-chart__value">{day.count || ''}</span>
          <span className="admin-bar-chart__bar" style={{ height: `${Math.max(day.count ? 5 : 0, (day.count / maximum) * 100)}%`, backgroundColor: color }} />
          <span className="admin-bar-chart__date">{day.date.slice(5)}</span>
        </div>
      ))}
    </div>
  )
}

function DayTable({ days, label }) {
  return (
    <div className="admin-day-table-wrap">
      <table className="admin-day-table">
        <thead><tr><th>Manila date</th><th>{label}</th></tr></thead>
        <tbody>{days.map((day) => <tr key={day.date}><td>{day.date}</td><td>{formatNumber(day.count)}</td></tr>)}</tbody>
      </table>
    </div>
  )
}
