import { useEffect, useMemo, useRef, useState } from 'react'
import Map, { Marker, Popup } from 'react-map-gl/maplibre'
import maplibregl from 'maplibre-gl'
import '../../components/tracking/maplibre-gl.css'

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json'

function formatDate(dateValue) {
  if (!dateValue) {
    return 'N/A'
  }

  return new Date(dateValue).toLocaleString()
}

export default function AdminDashboardSection({ locations, loading, error, onRefresh }) {
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

  return (
    <section className="admin-section admin-dashboard-section">
      <div className="admin-toolbar-card">
        <div>
          <h2>Driver World Map</h2>
          <p>Track real-time location of all active drivers and inspect trip context.</p>
        </div>

        <button type="button" onClick={onRefresh} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh Map'}
        </button>
      </div>

      <div className="summary-grid">
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
      {loading ? <p className="feedback">Loading driver locations...</p> : null}

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
    </section>
  )
}
