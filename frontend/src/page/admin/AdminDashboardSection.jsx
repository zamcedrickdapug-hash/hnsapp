import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Clock3 } from 'lucide-react'
import Map, { Marker, Popup } from 'react-map-gl/maplibre'
import maplibregl from 'maplibre-gl'
import '../../components/tracking/maplibre-gl.css'
import { EmptyState, StatusBadge } from './AdminUI'

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json'

function formatDate(dateValue) {
  if (!dateValue) {
    return 'N/A'
  }

  return new Date(dateValue).toLocaleString()
}

export default function AdminDashboardSection({
  locations,
  loading,
  error,
  onRefresh,
  socketConnected = false,
  pendingApplications = [],
  recentPayments = [],
  activityLoading = false,
  activityError = '',
  onReviewApplications,
}) {
  const mapRef = useRef(null)
  const [selectedLocationId, setSelectedLocationId] = useState('')

  const selectedLocation = useMemo(
    () => locations.find((item) => String(item.driverId) === String(selectedLocationId)) || null,
    [locations, selectedLocationId],
  )

  const mapStats = useMemo(() => {
    const totalLocated = locations.length
    const onTrip = locations.filter((item) => item.tripStatus === 'accepted').length
    const flagged = locations.filter((item) => item.accountState !== 'active').length

    return {
      totalLocated,
      onTrip,
      flagged,
    }
  }, [locations])

  useEffect(() => {
    if (!mapRef.current || locations.length === 0) {
      return
    }

    const mapInstance = mapRef.current.getMap?.()
    if (!mapInstance) {
      return
    }

    if (locations.length === 1) {
      const first = locations[0]
      mapInstance.flyTo({
        center: [first.location.longitude, first.location.latitude],
        zoom: 14,
        duration: 800,
      })
      return
    }

    const latitudes = locations.map((item) => Number(item.location.latitude))
    const longitudes = locations.map((item) => Number(item.location.longitude))

    const southWest = [Math.min(...longitudes), Math.min(...latitudes)]
    const northEast = [Math.max(...longitudes), Math.max(...latitudes)]

    mapInstance.fitBounds([southWest, northEast], {
      padding: 62,
      duration: 900,
      maxZoom: 15,
    })
  }, [locations])

  const recentActivity = useMemo(() => [
    ...pendingApplications.map((application) => ({
      type: 'application',
      id: `application-${application.id}`,
      title: `${application.fullName || 'Applicant'} · ${application.role || 'User'} application`,
      date: application.createdAt,
      status: application.status,
    })),
    ...recentPayments.map((payment, index) => ({
      type: 'payment',
      id: `payment-${payment.referenceNo || payment.createdAt}-${index}`,
      title: `Payment · ${payment.currency || 'PHP'} ${Number(payment.amount || 0).toFixed(2)}`,
      date: payment.createdAt,
      status: payment.status,
    })),
  ].sort((left, right) => new Date(right.date || 0) - new Date(left.date || 0)).slice(0, 8), [pendingApplications, recentPayments])

  return (
    <section className="admin-section admin-dashboard-section">
      <section className="admin-needs-attention" aria-labelledby="admin-needs-attention-title">
        <header>
          <div>
            <h2 id="admin-needs-attention-title">Needs attention</h2>
            <p>Applications waiting for an admin decision.</p>
          </div>
          <button type="button" className="admin-button admin-button--secondary" onClick={onReviewApplications}>
            Review applications <ArrowRight size={17} aria-hidden="true" />
          </button>
        </header>
        {!pendingApplications.length ? (
          <EmptyState>No applications need review.</EmptyState>
        ) : (
          <ul className="admin-attention-list">
            {pendingApplications.slice(0, 5).map((application) => (
              <li key={application.id}>
                <div>
                  <strong>{application.fullName || 'Applicant name unavailable'}</strong>
                  <span>{application.role || 'User'} · Submitted {formatDate(application.createdAt)}</span>
                </div>
                <StatusBadge status={application.status} />
                <button type="button" className="admin-button admin-button--primary" onClick={onReviewApplications}>Review</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="admin-toolbar-card admin-map-toolbar">
        <div>
          <h2>Driver map</h2>
          <p>Track real-time location of all active drivers and inspect trip context.</p>
        </div>
        <div className="admin-map-toolbar__actions">
          <StatusBadge
            status={socketConnected ? 'active' : 'declined'}
            label={`Live: ${socketConnected ? 'Connected' : 'Disconnected'}`}
          />
          <button type="button" className="admin-button admin-button--secondary" onClick={onRefresh} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh Map'}
          </button>
        </div>
      </div>

      <div className="admin-map-stats">
        <article>
          <span>Located Drivers</span>
          <strong>{mapStats.totalLocated}</strong>
        </article>
        <article>
          <span>Drivers On Trip</span>
          <strong>{mapStats.onTrip}</strong>
        </article>
        <article>
          <span>Flagged Accounts</span>
          <strong>{mapStats.flagged}</strong>
        </article>
        <article>
          <span>Active Accounts</span>
          <strong>{Math.max(mapStats.totalLocated - mapStats.flagged, 0)}</strong>
        </article>
        <article>
          <span>Last Refresh</span>
          <strong>{formatDate(new Date())}</strong>
        </article>
      </div>

      {error ? <p className="feedback error">{error}</p> : null}
      {loading ? <p className="admin-inline-result" role="status">Loading driver locations…</p> : null}

      <div className="admin-map-card">
        <div className="admin-map-card__canvas">
          <Map
            ref={mapRef}
            mapLib={maplibregl}
            mapStyle={MAP_STYLE}
            initialViewState={{ latitude: 15, longitude: 121, zoom: 4 }}
            attributionControl={true}
            reuseMaps={true}
          >
            {locations.map((item) => (
              <Marker
                key={item.driverId}
                latitude={Number(item.location.latitude)}
                longitude={Number(item.location.longitude)}
                anchor="center"
              >
                <button
                  type="button"
                  className={`admin-driver-marker ${item.accountState || 'active'}`}
                  onClick={() => setSelectedLocationId(String(item.driverId))}
                >
                  <span>{item.driverName?.slice(0, 1)?.toUpperCase() || 'D'}</span>
                </button>
              </Marker>
            ))}

            {selectedLocation ? (
              <Popup
                latitude={Number(selectedLocation.location.latitude)}
                longitude={Number(selectedLocation.location.longitude)}
                anchor="top"
                closeButton={false}
                onClose={() => setSelectedLocationId('')}
              >
                <div className="admin-driver-popup">
                  <p><strong>{selectedLocation.driverName}</strong></p>
                  <p>Trip: {selectedLocation.tripStatus || 'N/A'}</p>
                  <p>Vehicle: {selectedLocation.vehicleType || 'N/A'}</p>
                  <p>Plate: {selectedLocation.plateNumber || 'N/A'}</p>
                  <p>Updated: {formatDate(selectedLocation.location.updatedAt)}</p>
                </div>
              </Popup>
            ) : null}
          </Map>
        </div>

        {!loading && locations.length === 0 ? (
          <p className="feedback">No live driver location available yet.</p>
        ) : null}
      </div>

      <section className="admin-recent-activity" aria-labelledby="admin-recent-activity-title">
        <header>
          <div>
            <h2 id="admin-recent-activity-title">Recent activity</h2>
            <p>Latest payments and application submissions.</p>
          </div>
          <Clock3 size={19} aria-hidden="true" />
        </header>
        {activityError ? (
          <p className="admin-inline-result admin-inline-result--error" role="alert">{activityError}</p>
        ) : activityLoading ? (
          <p className="admin-inline-result" role="status">Loading recent activity…</p>
        ) : recentActivity.length === 0 ? (
          <EmptyState>No recent activity to show.</EmptyState>
        ) : (
          <ul className="admin-activity-list">
            {recentActivity.map((activity) => (
              <li key={activity.id}>
                <div><strong>{activity.title}</strong><span>{formatDate(activity.date)}</span></div>
                <StatusBadge status={activity.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  )
}
