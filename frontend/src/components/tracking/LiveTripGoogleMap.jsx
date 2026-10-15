import { useEffect, useRef } from 'react'
import { APIProvider, AdvancedMarker, Map, useMap, useMapsLibrary } from '@vis.gl/react-google-maps'

const DEFAULT_CENTER = { lat: 14.5994, lng: 120.9842 }

const toPoint = (point) => {
  const coordinates = Array.isArray(point)
    ? point
    : [point?.lat ?? point?.latitude, point?.lng ?? point?.longitude]
  if (
    coordinates.length < 2 ||
    coordinates[0] === null ||
    coordinates[0] === undefined ||
    coordinates[1] === null ||
    coordinates[1] === undefined
  ) {
    return null
  }

  const [lat, lng] = coordinates.map(Number)
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    ? { lat, lng }
    : null
}

function FollowVan({ van, target }) {
  const map = useMap()
  const fitted = useRef(false)

  useEffect(() => {
    if (!map || !van) return

    if (target && !fitted.current) {
      const bounds = new window.google.maps.LatLngBounds()
      bounds.extend(van)
      bounds.extend(target)
      map.fitBounds(bounds, 60)
      fitted.current = true
      return
    }

    map.panTo(van)
  }, [map, van?.lat, van?.lng, target?.lat, target?.lng])

  return null
}

function Route({ origin, destination, mode }) {
  const map = useMap()
  const routesLibrary = useMapsLibrary('routes')
  const rendererRef = useRef(null)
  const fallbackRef = useRef(null)
  const lastRequestRef = useRef(0)

  useEffect(() => {
    if (!map || !routesLibrary || !origin || !destination) return
    if (Date.now() - lastRequestRef.current < 15000 && rendererRef.current) return

    lastRequestRef.current = Date.now()
    if (!rendererRef.current) {
      rendererRef.current = new routesLibrary.DirectionsRenderer({
        map,
        suppressMarkers: true,
        preserveViewport: true,
        polylineOptions: { strokeColor: '#3b82f6', strokeWeight: 5, strokeOpacity: 0.85 },
      })
    }

    new routesLibrary.DirectionsService().route(
      {
        origin,
        destination,
        travelMode: mode === 'walking' ? 'WALKING' : 'DRIVING',
      },
      (result, status) => {
        if (status === 'OK' && result) {
          fallbackRef.current?.setMap(null)
          rendererRef.current?.setDirections(result)
          return
        }

        rendererRef.current?.setDirections({ routes: [] })
        if (!fallbackRef.current) {
          fallbackRef.current = new window.google.maps.Polyline({
            strokeColor: '#3b82f6',
            strokeOpacity: 0.7,
            strokeWeight: 4,
            map,
          })
        }
        fallbackRef.current.setPath([origin, destination])
      },
    )
  }, [map, routesLibrary, origin?.lat, origin?.lng, destination?.lat, destination?.lng, mode])

  useEffect(
    () => () => {
      rendererRef.current?.setMap(null)
      fallbackRef.current?.setMap(null)
    },
    [],
  )

  return null
}

export default function LiveTripGoogleMap({
  vanPosition,
  pickupPosition,
  showRoute = false,
  routeMode = 'road',
  height = 360,
}) {
  const van = toPoint(vanPosition)
  const target = toPoint(pickupPosition)
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

  if (!apiKey) {
    return (
      <div role="status" style={{ minHeight: height, display: 'grid', placeItems: 'center' }}>
        Google Maps is not configured. Set VITE_GOOGLE_MAPS_API_KEY to enable the trip map.
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height, borderRadius: 12, overflow: 'hidden' }}>
      <APIProvider apiKey={apiKey}>
        <Map
          style={{ width: '100%', height: '100%' }}
          defaultCenter={van || target || DEFAULT_CENTER}
          defaultZoom={15}
          mapId="DEMO_MAP_ID"
          gestureHandling="greedy"
          disableDefaultUI
        >
          {van && (
            <AdvancedMarker position={van} title="Van">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="16" r="14" fill="#3b82f6" stroke="#1e40af" strokeWidth="2" />
                <path d="M16 6 L21 17 L16 14 L11 17 Z" fill="white" />
              </svg>
            </AdvancedMarker>
          )}
          {target && <AdvancedMarker position={target} title="Pickup / School" />}
          {van && <FollowVan van={van} target={target} />}
          {showRoute && van && target && <Route origin={van} destination={target} mode={routeMode} />}
        </Map>
      </APIProvider>
    </div>
  )
}
