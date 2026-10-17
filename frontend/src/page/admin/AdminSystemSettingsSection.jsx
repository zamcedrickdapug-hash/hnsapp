import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, RotateCw } from 'lucide-react'
import { apiFetch } from '../../api'
import { EmptyState, StatusBadge } from './AdminUI'

const featureLabels = [
  ['googleMapsKeyPresent', 'Google Maps'],
  ['firebaseConfigured', 'Firebase'],
  ['emailServiceConfigured', 'Email service'],
]

const settingLabels = [
  ['baseFare', 'Base fare', (value, currency) => `${currency} ${value}`],
  ['baseKm', 'Base distance', (value) => `${value} km`],
  ['perKm', 'Rate per additional kilometer', (value, currency) => `${currency} ${value}`],
  ['roundTo', 'Fare rounding increment', (value, currency) => `${currency} ${value}`],
  ['minFare', 'Minimum fare', (value, currency) => `${currency} ${value}`],
  ['maxFare', 'Maximum fare', (value, currency) => `${currency} ${value}`],
  ['roadFactor', 'Road distance factor', (value) => value],
  ['billingStartDate', 'Billing start date', (value) => {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime())
      ? 'Not available'
      : new Intl.DateTimeFormat('en-PH', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Manila',
      }).format(parsed)
  }],
  ['currency', 'Currency', (value) => value],
]

const formatUptime = (uptimeSeconds) => {
  const totalMinutes = Math.floor((Number(uptimeSeconds) || 0) / 60)
  const days = Math.floor(totalMinutes / (24 * 60))
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60)
  const minutes = totalMinutes % 60
  return [
    ...(days ? [`${days}d`] : []),
    ...(hours ? [`${hours}h`] : []),
    ...(minutes || (!days && !hours) ? [`${minutes}m`] : []),
  ].join(' ')
}

export default function AdminSystemSettingsSection({ token }) {
  const [health, setHealth] = useState(null)
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadSettings = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const headers = { Authorization: `Bearer ${token}` }
      const [healthResponse, configResponse] = await Promise.all([
        apiFetch('/api/admin/analytics/health', { headers }),
        apiFetch('/api/admin/analytics/config', { headers }),
      ])
      setHealth(healthResponse)
      setConfig(configResponse)
    } catch (loadError) {
      setError(loadError.message || 'Unable to load system information.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  const services = health ? [
    { label: 'Database', configured: health.databaseConnected, optional: false },
    { label: 'Socket Server', configured: health.socketServerRunning, optional: false },
    ...featureLabels.map(([key, label]) => ({
      label,
      configured: health.features?.[key],
      optional: true,
    })),
  ] : []

  return (
    <section className="admin-section admin-system-settings" aria-label="System Settings">
      <div className="admin-settings__actions">
        <button type="button" className="admin-button admin-button--secondary" onClick={loadSettings} disabled={loading}>
          <RefreshCw size={17} aria-hidden="true" className={loading ? 'admin-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="admin-inline-result admin-inline-result--error" role="alert">
          <span>{error}</span>
          <button type="button" className="admin-button admin-button--secondary" onClick={loadSettings}>
            <RotateCw size={17} aria-hidden="true" /> Retry
          </button>
        </div>
      )}

      {loading && !health ? (
        <div className="admin-analytics-skeleton" aria-label="Loading system information">
          {Array.from({ length: 3 }, (_, index) => <div key={index} />)}
        </div>
      ) : (
        <div className="admin-settings-grid">
          <section className="admin-settings-card" aria-labelledby="system-status-title">
            <h3 id="system-status-title">System status</h3>
            {health ? (
              <>
                <ul className="admin-system-status-list">
                  {services.map(({ label, configured, optional }) => (
                    <li key={label}>
                      <span>{label}</span>
                      <StatusBadge
                        status={configured ? 'active' : optional ? 'warning' : 'declined'}
                        label={configured ? 'Available' : optional ? 'Not configured' : 'Unavailable'}
                      />
                    </li>
                  ))}
                </ul>
                <dl className="admin-settings-details">
                  <div><dt>Server time (Manila)</dt><dd>{health.serverTime}</dd></div>
                  <div><dt>Uptime</dt><dd>{formatUptime(health.uptimeSeconds)}</dd></div>
                  <div><dt>Node.js</dt><dd>{health.nodeVersion}</dd></div>
                </dl>
              </>
            ) : !loading ? <EmptyState>System status is not available.</EmptyState> : null}
          </section>

          <section className="admin-settings-card" aria-labelledby="business-rules-title">
            <h3 id="business-rules-title">Business rules</h3>
            <p className="admin-settings-card__description">Set in code by the owner. These values cannot be edited here.</p>
            {config ? (
              <dl className="admin-settings-details">
                {settingLabels.map(([key, label, format]) => (
                  <div key={key}>
                    <dt>{label}</dt>
                    <dd>{format(config[key], config.currency)}</dd>
                  </div>
                ))}
              </dl>
            ) : !loading ? <EmptyState>Business rules are not available.</EmptyState> : null}
          </section>

          <section className="admin-settings-card" aria-labelledby="roles-access-title">
            <h3 id="roles-access-title">Roles and access</h3>
            <dl className="admin-settings-details admin-settings-details--roles">
              <div><dt>Admin</dt><dd>Manage accounts and applications, review payments and issues, and view operational reports.</dd></div>
              <div><dt>Driver</dt><dd>Manage assigned trips and record cash received for completed trips.</dd></div>
              <div><dt>Parent</dt><dd>Request trips, view trip and payment status, and access receipts.</dd></div>
            </dl>
          </section>

          <section className="admin-settings-card" aria-labelledby="about-system-title">
            <h3 id="about-system-title">About</h3>
            <dl className="admin-settings-details">
              <div><dt>Application</dt><dd>HNSApp</dd></div>
              <div><dt>Environment</dt><dd>{health?.environment || 'Not available'}</dd></div>
            </dl>
          </section>
        </div>
      )}
    </section>
  )
}
