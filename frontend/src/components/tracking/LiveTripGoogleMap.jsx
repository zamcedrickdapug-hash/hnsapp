import { useEffect, useMemo, useRef } from 'react'
import { APIProvider, Map, AdvancedMarker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps'

const DEFAULT_CENTER = { lat: 14.5994, lng: 120.9842 }

// Tumatanggap ng [lat, lng]; ibinabalik ang null kung hindi valid
const toPoint = (p) => {
  if (!Array.isArray(p)) return null
  const lat = Number(p[0])
  const lng = Number(p[1])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

// Sa una, kasya ang van at target. Pagkatapos, susundan lang ng mapa ang van kapag lumabas ito sa view.
function FollowVan({ van, target }) {
  const map = useMap()
  const fitted = useRef(false)

  useEffect(() => {
    if (!map || !van) return
    if (!fitted.current && target) {
      const bounds = new window.google.maps.LatLngBounds()
      bounds.extend(van)
      bounds.extend(target)
      map.fitBounds(bounds, 60)
      fitted.current = true
      return
    }
    const bounds = map.getBounds()
    if (!bounds || !bounds.contains(van)) map.panTo(van)
  }, [map, van?.lat, van?.lng, target?.lat, target?.lng])

  return null
}

// Iginuguhit ang planned route na galing sa backend (walang dagdag na Google API call)
function PlannedRoute({ path }) {
  const map = useMap()
  const lineRef = useRef(null)

  useEffect(() => {
    if (!map) return
    if (!lineRef.current) {
      lineRef.current = new window.google.maps.Polyline({
        strokeColor: '#3b82f6',
        strokeOpacity: 0.85,
        strokeWeight: 5,
        map,
      })
    }
    lineRef.current.setPath(path)
  }, [map, path])

  useEffect(() => () => lineRef.current?.setMap(null), [])
  return null
}

// Ruta sa kalsada (Directions API) kapag walang planned route.
// Kapag pumalya, tuwid na linya na lang.
function DirectionsRoute({ origin, destination }) {
  const map = useMap()
  const routesLib = useMapsLibrary('routes')
  const rendererRef = useRef(null)
  const fallbackRef = useRef(null)
  const lastRequest = useRef(0)

  useEffect(() => {
    if (!map || !routesLib || !origin || !destination) return
    const now = Date.now()
    if (rendererRef.current && now - lastRequest.current < 15000) return // limitahan ang requests
    lastRequest.current = now

    if (!rendererRef.current) {
      rendererRef.current = new routesLib.DirectionsRenderer({
        map,
        suppressMarkers: true,
        preserveViewport: true,
        polylineOptions: { strokeColor: '#3b82f6', strokeWeight: 5, strokeOpacity: 0.85 },
      })
    }

    new routesLib.DirectionsService().route(
      { origin, destination, travelMode: 'DRIVING' },
      (result, status) => {
        if (status === 'OK') {
          fallbackRef.current?.setMap(null)
          fallbackRef.current = null
          rendererRef.current.setDirections(result)
        } else {
          rendererRef.current.setDirections({ routes: [] })
          if (!fallbackRef.current) {
            fallbackRef.current = new window.google.maps.Polyline({
              strokeColor: '#3b82f6',
              strokeOpacity: 0.7,
              strokeWeight: 4,
              map,
            })
          }
          fallbackRef.current.setPath([origin, destination])
        }
      },
    )
  }, [map, routesLib, origin?.lat, origin?.lng, destination?.lat, destination?.lng])

  useEffect(() => () => {
    rendererRef.current?.setMap(null)
    fallbackRef.current?.setMap(null)
  }, [])

  return null
}

export default function LiveTripGoogleMap({
  center,
  vanPosition,
  pickupPosition,
  pickupPositions = [],
  plannedRoute = [],
  showRoute = false,
  routeMode = 'road', // pinanatili para tugma sa lumang props
  height = 360,
}) {
  const van = toPoint(vanPosition)
  const target = toPoint(pickupPosition)
  const mapCenter = toPoint(center)

  const pins = useMemo(
    () =>
      (pickupPositions || [])
        .map((pin) => ({ id: pin.id, label: pin.label, point: toPoint(pin.position) }))
        .filter((pin) => pin.point),
    [pickupPositions],
  )

  const plannedPath = useMemo(
    () => (plannedRoute || []).map(toPoint).filter(Boolean),
    [plannedRoute],
  )

  // Iwasan ang duplicate na marker kung ang target ay isa nang pickup pin
  const targetIsPin = target && pins.some((p) => p.point.lat === target.lat && p.point.lng === target.lng)

  return (
    <div style={{ width: '100%', height, borderRadius: 12, overflow: 'hidden' }}>
      <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}>
        <Map
          style={{ width: '100%', height: '100%' }}
          defaultCenter={van || mapCenter || target || DEFAULT_CENTER}
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

          {pins.map((pin) => (
            <AdvancedMarker key={pin.id} position={pin.point} title="Pickup">
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: '#10b981',
                  border: '2px solid #fff',
                  color: '#fff',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                }}
              >
                {pin.label}
              </div>
            </AdvancedMarker>
          ))}

          {target && !targetIsPin && <AdvancedMarker position={target} title="Destination" />}

          {van && <FollowVan van={van} target={target} />}

          {plannedPath.length > 1 ? (
            <PlannedRoute path={plannedPath} />
          ) : (
            showRoute && van && target && <DirectionsRoute origin={van} destination={target} />
          )}
        </Map>
      </APIProvider>
    </div>
  )
}