import { useEffect, useMemo, useRef, useState } from 'react'
import Map, { Layer, Marker, Popup, Source } from 'react-map-gl/maplibre'
import maplibregl from 'maplibre-gl'
import './maplibre-gl.css'
import './LiveTripMap.css'

const DEFAULT_CENTER = [14.5995, 120.9842]
const DEFAULT_ZOOM = 14
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json'
const OSRM_PROFILES = ['driving']
const ROUTE_LAYER_ID = 'trip-road-route'
const OSRM_RATE_LIMIT_COOLDOWN_MS = 60000
const OSRM_UNAVAILABLE_COOLDOWN_MS = 120000
const OSRM_REQUEST_TIMEOUT_MS = 10000
const ROUTE_REQUEST_DEBOUNCE_MS = 800
const ROUTE_REQUEST_DEBOUNCE_FIRST_MS = 0
const ENABLE_OSRM_NEAREST_SNAP = false
const MIN_ROUTE_DISTANCE_DEGREES = 0.00005

// Use globalThis.Map to avoid conflict with react-map-gl's Map import
const requestCache = new globalThis.Map()

let osrmBackoffUntil = 0

const ROUTE_LAYER_STYLE = {
	id: ROUTE_LAYER_ID,
	type: 'line',
	paint: {
		'line-color': '#52a3ff',
		'line-width': 5,
		'line-opacity': 0.82,
	},
}

function isValidLatLng(position) {
	return (
		Array.isArray(position) &&
		position.length >= 2 &&
		Number.isFinite(Number(position[0])) &&
		Number.isFinite(Number(position[1]))
	)
}

function toLngLat(position) {
	return [Number(position[1]), Number(position[0])]
}

function isSameRoutePoint(first, second) {
	if (!isValidLatLng(first) || !isValidLatLng(second)) return false
	const latDiff = Math.abs(Number(first[0]) - Number(second[0]))
	const lngDiff = Math.abs(Number(first[1]) - Number(second[1]))
	return latDiff <= MIN_ROUTE_DISTANCE_DEGREES && lngDiff <= MIN_ROUTE_DISTANCE_DEGREES
}

function createRateLimitError() {
	const error = new Error('OSRM rate limited')
	error.code = 'OSRM_RATE_LIMIT'
	return error
}

function createServiceUnavailableError() {
	const error = new Error('OSRM temporarily unavailable')
	error.code = 'OSRM_UNAVAILABLE'
	return error
}

function isRateLimitError(error) {
	return error?.code === 'OSRM_RATE_LIMIT'
}

function isServiceUnavailableError(error) {
	return error?.code === 'OSRM_UNAVAILABLE'
}

function throwIfOsrmBackoffActive() {
	if (Date.now() < osrmBackoffUntil) {
		throw createServiceUnavailableError()
	}
}

function markOsrmRateLimited() {
	osrmBackoffUntil = Date.now() + OSRM_RATE_LIMIT_COOLDOWN_MS
}

function markOsrmUnavailable() {
	osrmBackoffUntil = Math.max(osrmBackoffUntil, Date.now() + OSRM_UNAVAILABLE_COOLDOWN_MS)
}

// skipOsrmMark = true for backend calls so a backend failure does NOT
// poison the osrmBackoffUntil flag and block the direct OSRM fallback.
async function fetchWithTimeout(endpoint, signal, options = {}, skipOsrmMark = false) {
	const timeoutController = new AbortController()
	const timeoutId = setTimeout(() => timeoutController.abort(), OSRM_REQUEST_TIMEOUT_MS)

	const abortOnParentSignal = () => timeoutController.abort()
	if (signal) {
		signal.addEventListener('abort', abortOnParentSignal, { once: true })
	}

	try {
		return await fetch(endpoint, { ...options, signal: timeoutController.signal })
	} catch (error) {
		if (error?.name === 'AbortError' || error instanceof TypeError) {
			if (!skipOsrmMark) markOsrmUnavailable()
			throw createServiceUnavailableError()
		}
		throw error
	} finally {
		clearTimeout(timeoutId)
		if (signal) {
			signal.removeEventListener('abort', abortOnParentSignal)
		}
	}
}

async function snapToRoad(position, profile, signal) {
	throwIfOsrmBackoffActive()
	const latitude = position[0]
	const longitude = position[1]
	const endpoint = `https://router.project-osrm.org/nearest/v1/${profile}/${longitude},${latitude}?number=1`
	const response = await fetchWithTimeout(endpoint, signal)

	if (response.status === 429) {
		markOsrmRateLimited()
		throw createRateLimitError()
	}
	if (!response.ok) {
		if (response.status >= 500) {
			markOsrmUnavailable()
			throw createServiceUnavailableError()
		}
		throw new Error('Nearest road lookup failed')
	}

	const payload = await response.json()
	const snapped = payload?.waypoints?.[0]?.location
	if (!Array.isArray(snapped) || snapped.length < 2) {
		throw new Error('No snapped road point')
	}
	return [snapped[1], snapped[0]]
}

async function fetchRoadPathByProfile(pickupPosition, vanPosition, profile, signal) {
	throwIfOsrmBackoffActive()

	const pickupLat = Number(pickupPosition[0])
	const pickupLng = Number(pickupPosition[1])
	const vanLat = Number(vanPosition[0])
	const vanLng = Number(vanPosition[1])

	const endpoint = `https://router.project-osrm.org/route/v1/${profile}/${pickupLng},${pickupLat};${vanLng},${vanLat}?overview=full&geometries=geojson`
	const response = await fetchWithTimeout(endpoint, signal)

	if (response.status === 429) {
		markOsrmRateLimited()
		throw createRateLimitError()
	}
	if (!response.ok) {
		if (response.status >= 500) {
			markOsrmUnavailable()
			throw createServiceUnavailableError()
		}
		throw new Error('Routing service unavailable')
	}

	const payload = await response.json()
	const coordinates = payload?.routes?.[0]?.geometry?.coordinates
	if (!Array.isArray(coordinates) || coordinates.length === 0) {
		throw new Error('No route geometry returned')
	}

	return coordinates
		.filter((point) => Array.isArray(point) && point.length >= 2)
		.map(([longitude, latitude]) => [Number(longitude), Number(latitude)])
}

async function fetchRoadPathViaBackend(pickupPosition, vanPosition, signal) {
	if (isSameRoutePoint(pickupPosition, vanPosition)) return []

	const pickupLat = Number(pickupPosition[0])
	const pickupLng = Number(pickupPosition[1])
	const vanLat = Number(vanPosition[0])
	const vanLng = Number(vanPosition[1])

	// Deduplicate in-flight requests for the same coordinates
	const cacheKey = `${pickupLat.toFixed(5)},${pickupLng.toFixed(5)},${vanLat.toFixed(5)},${vanLng.toFixed(5)}`
	if (requestCache.has(cacheKey)) {
		return requestCache.get(cacheKey)
	}

	const promise = (async () => {
		// skipOsrmMark = true: a backend network failure must NOT set osrmBackoffUntil,
		// otherwise the direct OSRM fallback below gets incorrectly blocked.
		const response = await fetchWithTimeout(
			'/api/routing/route',
			signal,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					start: [pickupLat, pickupLng],
					end: [vanLat, vanLng],
				}),
			},
			true, // skipOsrmMark
		)

		if (!response.ok) {
			if (response.status === 429) {
				markOsrmRateLimited()
				throw createRateLimitError()
			}
			if (response.status >= 500) {
				markOsrmUnavailable()
				throw createServiceUnavailableError()
			}
			throw new Error('Backend routing request failed')
		}

		const payload = await response.json()
		const coordinates = payload?.route?.coordinates
		if (!Array.isArray(coordinates) || coordinates.length < 2) {
			throw new Error('No route geometry returned from backend')
		}

		return coordinates
			.filter((point) => Array.isArray(point) && point.length >= 2)
			.map(([longitude, latitude]) => [Number(longitude), Number(latitude)])
	})()

	requestCache.set(cacheKey, promise)
	promise.finally(() => {
		setTimeout(() => requestCache.delete(cacheKey), 5000)
	})

	return promise
}

async function fetchRoadPath(pickupPosition, vanPosition, signal) {
	// Try backend first (single attempt — no spam retries)
	try {
		const backendPath = await fetchRoadPathViaBackend(pickupPosition, vanPosition, signal)
		if (backendPath.length > 1) return backendPath
	} catch (error) {
		if (signal?.aborted) throw error
		// If rate limited, don't fall through to direct OSRM — both share the same upstream
		if (isRateLimitError(error) || isServiceUnavailableError(error)) {
			throw error
		}
		// Any other backend error (404, bad JSON, etc.) → fall through to direct OSRM
		console.warn('Backend routing failed, trying direct OSRM:', error?.message)
	}

	// Try direct OSRM only if backend failed for a non-rate-limit reason
	for (const profile of OSRM_PROFILES) {
		try {
			const path = await fetchRoadPathByProfile(pickupPosition, vanPosition, profile, signal)
			if (path.length > 1) return path
		} catch (error) {
			if (isRateLimitError(error) || isServiceUnavailableError(error)) break
		}
	}

	throw new Error('No road-aligned route available')
}

export default function LiveTripMap({
	center,
	pickupPosition,
	pickupPositions = null,
	vanPosition,
	plannedRoute = [],
	showRoute = false,
	routeMode = 'road',
	height = 320,
	className = '',
}) {
	const mapRef = useRef(null)
	const hasAutoFramedRef = useRef(false)
	const userHasAdjustedCameraRef = useRef(false)
	const debounceTimerRef = useRef(null)
	const [isMapLoaded, setIsMapLoaded] = useState(false)
	const [showPickupPopup, setShowPickupPopup] = useState(false)
	const [showVanPopup, setShowVanPopup] = useState(false)
	const [activePickupPopupId, setActivePickupPopupId] = useState('')
	const [snappedVanPosition, setSnappedVanPosition] = useState(null)
	const [routePath, setRoutePath] = useState([])
	const [isRouteLoading, setIsRouteLoading] = useState(false)

	const normalizedPickupPins = useMemo(() => {
		if (!Array.isArray(pickupPositions) || pickupPositions.length === 0) {
			return isValidLatLng(pickupPosition) ? [{ id: 'pickup', position: pickupPosition, label: 'P' }] : []
		}

		return pickupPositions
			.map((item) => {
				const position = item?.position
				if (!isValidLatLng(position)) return null
				return {
					id: String(item?.id || ''),
					position,
					label: String(item?.label || 'P'),
				}
			})
			.filter((item) => item && item.id)
	}, [pickupPosition, pickupPositions])

	const validPoints = useMemo(() => {
		const points = []
		normalizedPickupPins.forEach((pin) => points.push(pin.position))
		if (isValidLatLng(snappedVanPosition)) {
			points.push(snappedVanPosition)
		} else if (isValidLatLng(vanPosition)) {
			points.push(vanPosition)
		}
		return points
	}, [normalizedPickupPins, snappedVanPosition, vanPosition])

	const effectiveVanPosition = isValidLatLng(snappedVanPosition) ? snappedVanPosition : vanPosition

	const plannedRouteGeoJson = useMemo(() => {
		if (!showRoute || !Array.isArray(plannedRoute) || plannedRoute.length < 2) return null
		const coordinates = plannedRoute
			.filter((point) => isValidLatLng(point))
			.map((point) => toLngLat(point))
		if (coordinates.length < 2) return null
		return {
			type: 'Feature',
			properties: {},
			geometry: { type: 'LineString', coordinates },
		}
	}, [plannedRoute, showRoute])

	const routeGeoJson = useMemo(() => {
		if (plannedRouteGeoJson) return plannedRouteGeoJson
		if (!showRoute || routePath.length < 2) return null
		return {
			type: 'Feature',
			properties: {},
			geometry: { type: 'LineString', coordinates: routePath },
		}
	}, [plannedRouteGeoJson, routePath, showRoute])

	const routeBoundsPoints = useMemo(() => {
		if (!Array.isArray(plannedRoute) || plannedRoute.length === 0) return []
		const first = plannedRoute[0]
		const last = plannedRoute[plannedRoute.length - 1]
		const points = []
		if (isValidLatLng(first)) points.push(first)
		if (isValidLatLng(last)) points.push(last)
		return points
	}, [plannedRoute])

	const boundsPoints = useMemo(
		() => [...validPoints, ...routeBoundsPoints],
		[routeBoundsPoints, validPoints],
	)

	const mapCenter = Array.isArray(center) ? center : boundsPoints[0] || DEFAULT_CENTER
	const initialViewState = useMemo(
		() => ({ latitude: mapCenter[0], longitude: mapCenter[1], zoom: DEFAULT_ZOOM }),
		[mapCenter],
	)

	useEffect(() => {
		if (!isValidLatLng(vanPosition) || routeMode !== 'road' || !ENABLE_OSRM_NEAREST_SNAP) {
			setSnappedVanPosition(vanPosition)
			return undefined
		}

		const abortController = new AbortController()
		let resolved = false

		const resolveSnappedPosition = async () => {
			for (const profile of OSRM_PROFILES) {
				try {
					const snapped = await snapToRoad(vanPosition, profile, abortController.signal)
					if (!resolved) {
						setSnappedVanPosition(snapped)
						resolved = true
					}
					return
				} catch (error) {
					if (isRateLimitError(error) || isServiceUnavailableError(error)) break
				}
			}
			if (!resolved) setSnappedVanPosition(vanPosition)
		}

		resolveSnappedPosition()
		return () => abortController.abort()
	}, [routeMode, vanPosition])

	useEffect(() => {
		if (debounceTimerRef.current) {
			clearTimeout(debounceTimerRef.current)
		}

		if (!showRoute || plannedRouteGeoJson) {
			setIsRouteLoading(false)
			return undefined
		}

		if (
			!isValidLatLng(pickupPosition) ||
			!isValidLatLng(effectiveVanPosition) ||
			isSameRoutePoint(pickupPosition, effectiveVanPosition) ||
			routeMode !== 'road'
		) {
			setRoutePath([])
			setIsRouteLoading(false)
			return undefined
		}

		// Skip debounce on first fetch (routePath is empty) so the route
		// appears immediately when GPS positions first become available.
		const delay = routePath.length === 0 ? ROUTE_REQUEST_DEBOUNCE_FIRST_MS : ROUTE_REQUEST_DEBOUNCE_MS

		debounceTimerRef.current = setTimeout(() => {
			const abortController = new AbortController()
			setIsRouteLoading(true)

			fetchRoadPath(pickupPosition, effectiveVanPosition, abortController.signal)
				.then((path) => {
					if (path && path.length > 1) {
						setRoutePath(path)
					}
					setIsRouteLoading(false)
				})
				.catch((error) => {
					if (!abortController.signal.aborted) {
						console.warn('Route fetch failed, keeping previous route:', error?.message)
					}
					setIsRouteLoading(false)
				})

			return () => abortController.abort()
		}, delay)

		return () => {
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current)
			}
		}
	}, [effectiveVanPosition, pickupPosition, plannedRouteGeoJson, routeMode, routePath.length, showRoute])

	useEffect(() => {
		if (!isMapLoaded || !mapRef.current) return

		mapRef.current.resize()

		if (userHasAdjustedCameraRef.current || boundsPoints.length === 0) return

		if (boundsPoints.length === 1) {
			mapRef.current.flyTo({ center: toLngLat(boundsPoints[0]), zoom: 15, duration: 900 })
			hasAutoFramedRef.current = true
			return
		}

		const latitudes = boundsPoints.map((point) => point[0])
		const longitudes = boundsPoints.map((point) => point[1])
		mapRef.current.fitBounds(
			[
				[Math.min(...longitudes), Math.min(...latitudes)],
				[Math.max(...longitudes), Math.max(...latitudes)],
			],
			{ padding: 58, maxZoom: 16, duration: 900 },
		)
		hasAutoFramedRef.current = true
	}, [boundsPoints, isMapLoaded])

	return (
		<div className={`trip-map ${className}`.trim()} style={{ height }}>
			<Map
				ref={mapRef}
				mapLib={maplibregl}
				mapStyle={MAP_STYLE}
				initialViewState={initialViewState}
				onLoad={() => setIsMapLoaded(true)}
				onDragStart={() => { if (hasAutoFramedRef.current) userHasAdjustedCameraRef.current = true }}
				onZoomStart={() => { if (hasAutoFramedRef.current) userHasAdjustedCameraRef.current = true }}
				onRotateStart={() => { if (hasAutoFramedRef.current) userHasAdjustedCameraRef.current = true }}
				attributionControl={true}
				reuseMaps={true}
				className="trip-map__container"
			>
				{routeGeoJson ? (
					<Source id="trip-route-source" type="geojson" data={routeGeoJson}>
						<Layer {...ROUTE_LAYER_STYLE} />
					</Source>
				) : null}

				{normalizedPickupPins.map((pin) => (
					<Marker
						key={pin.id}
						latitude={pin.position[0]}
						longitude={pin.position[1]}
						anchor="center"
					>
						<button
							type="button"
							className="trip-map-marker trip-map-marker--pickup"
							onClick={() => {
								setShowPickupPopup(false)
								setActivePickupPopupId((current) => (current === pin.id ? '' : pin.id))
							}}
						>
							<span>{pin.label}</span>
						</button>
					</Marker>
				))}

				{activePickupPopupId
					? (() => {
							const pin = normalizedPickupPins.find((item) => item.id === activePickupPopupId)
							if (!pin) return null
							return (
								<Popup
									latitude={pin.position[0]}
									longitude={pin.position[1]}
									anchor="top"
									closeButton={false}
									onClose={() => setActivePickupPopupId('')}
								>
									Pickup request location
								</Popup>
							)
					  })()
					: null}

				{isValidLatLng(effectiveVanPosition) ? (
					<Marker latitude={effectiveVanPosition[0]} longitude={effectiveVanPosition[1]} anchor="center">
						<button
							type="button"
							className="trip-map-marker trip-map-marker--van"
							onClick={() => setShowVanPopup((current) => !current)}
						>
							<span>V</span>
						</button>
					</Marker>
				) : null}

				{showVanPopup && isValidLatLng(effectiveVanPosition) ? (
					<Popup
						latitude={effectiveVanPosition[0]}
						longitude={effectiveVanPosition[1]}
						anchor="top"
						closeButton={false}
						onClose={() => setShowVanPopup(false)}
					>
						Driver live location
					</Popup>
				) : null}
			</Map>

			{showRoute && isRouteLoading ? (
				<div className="trip-map__status">Refreshing road route...</div>
			) : null}
		</div>
	)
}
