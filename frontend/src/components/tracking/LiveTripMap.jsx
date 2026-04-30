import { useEffect, useMemo, useRef, useState } from 'react'
import MapGL, { Layer, Marker, Popup, Source } from 'react-map-gl/maplibre'
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
const OSRM_REQUEST_TIMEOUT_MS = 8000
const ROUTE_REQUEST_DEBOUNCE_MS = 2000
const ENABLE_OSRM_NEAREST_SNAP = false
const MIN_ROUTE_DISTANCE_DEGREES = 0.00005
const MIN_REAL_ROUTE_POINTS = 5

let osrmBackoffUntil = 0
const requestCache = new Map()

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
	if (!isValidLatLng(first) || !isValidLatLng(second)) {
		return false
	}

	const latDiff = Math.abs(Number(first[0]) - Number(second[0]))
	const lngDiff = Math.abs(Number(first[1]) - Number(second[1]))

	return latDiff <= MIN_ROUTE_DISTANCE_DEGREES && lngDiff <= MIN_ROUTE_DISTANCE_DEGREES
}

function buildGridFallbackPath(pickupPosition, vanPosition) {
	if (!isValidLatLng(pickupPosition) || !isValidLatLng(vanPosition)) {
		return []
	}

	const pickupLat = Number(pickupPosition[0])
	const pickupLng = Number(pickupPosition[1])
	const vanLat = Number(vanPosition[0])
	const vanLng = Number(vanPosition[1])

	const latDelta = Math.abs(vanLat - pickupLat)
	const lngDelta = Math.abs(vanLng - pickupLng)

	if (latDelta <= 0.00004 || lngDelta <= 0.00004) {
		return [toLngLat(pickupPosition), toLngLat(vanPosition)]
	}

	if (lngDelta >= latDelta) {
		return [
			[pickupLng, pickupLat],
			[vanLng, pickupLat],
			[vanLng, vanLat],
		]
	}

	return [
		[pickupLng, pickupLat],
		[pickupLng, vanLat],
		[vanLng, vanLat],
	]
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

async function fetchWithTimeout(endpoint, signal, options = {}) {
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
			markOsrmUnavailable()
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

async function fetchRoadPathViaBackend(pickupPosition, vanPosition, signal, maxRetries = 5) {
	if (isSameRoutePoint(pickupPosition, vanPosition)) {
		return []
	}

	const pickupLat = Number(pickupPosition[0])
	const pickupLng = Number(pickupPosition[1])
	const vanLat = Number(vanPosition[0])
	const vanLng = Number(vanPosition[1])

	const cacheKey = `${pickupLat.toFixed(5)},${pickupLng.toFixed(5)},${vanLat.toFixed(5)},${vanLng.toFixed(5)}`

	if (requestCache.has(cacheKey)) {
		return requestCache.get(cacheKey)
	}

	const requestPromise = (async () => {
		for (let attempt = 0; attempt < maxRetries; attempt++) {
			if (signal?.aborted) {
				throw new Error('Request aborted')
			}

			try {
				const response = await fetchWithTimeout('/api/routing/route', signal, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						start: [pickupLat, pickupLng],
						end: [vanLat, vanLng],
					}),
				})

				if (!response.ok) {
					if (response.status === 429) {
						markOsrmRateLimited()
						if (attempt < maxRetries - 1) {
							const waitTime = Math.min(30000, 3000 * Math.pow(1.5, attempt))
							await new Promise(resolve => setTimeout(resolve, waitTime))
							continue
						}
						throw createRateLimitError()
					}

					if (response.status >= 500) {
						markOsrmUnavailable()
						if (attempt < maxRetries - 1) {
							const waitTime = 2000 * (attempt + 1)
							await new Promise(resolve => setTimeout(resolve, waitTime))
							continue
						}
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
			} catch (error) {
				if (attempt === maxRetries - 1) {
					throw error
				}
				if (isServiceUnavailableError(error) || error?.message?.includes('timed out')) {
					const waitTime = 2000 * (attempt + 1)
					await new Promise(resolve => setTimeout(resolve, waitTime))
				} else if (!isRateLimitError(error)) {
					throw error
				}
			}
		}
	})()

	requestCache.set(cacheKey, requestPromise)

	requestPromise.finally(() => {
		setTimeout(() => requestCache.delete(cacheKey), 2000)
	})

	return requestPromise
}

async function fetchRoadPath(pickupPosition, vanPosition, signal) {
	for (let backendAttempt = 0; backendAttempt < 2; backendAttempt++) {
		try {
			const backendPath = await fetchRoadPathViaBackend(pickupPosition, vanPosition, signal)
			if (backendPath.length > 1) {
				return backendPath
			}
		} catch (error) {
			if (signal?.aborted) {
				throw error
			}
			if (backendAttempt < 1 && isRateLimitError(error)) {
				await new Promise(resolve => setTimeout(resolve, 15000))
				continue
			}
		}
	}

	for (const profile of OSRM_PROFILES) {
		try {
			const path = await fetchRoadPathByProfile(pickupPosition, vanPosition, profile, signal)

			if (path.length > 1) {
				return path
			}
		} catch (error) {
			if (isRateLimitError(error) || isServiceUnavailableError(error)) {
				break
			}
		}
	}

	throw new Error('No road-aligned route available')
}

export default function LiveTripMap({
	center,
	pickupPosition,
	vanPosition,
	plannedRoute = [],
	showRoute = false,
	routeMode = 'road',
	height = 320,
	className = '',
	requestId = null,
}) {
	const mapRef = useRef(null)
	const hasAutoFramedRef = useRef(false)
	const userHasAdjustedCameraRef = useRef(false)
	const debounceTimerRef = useRef(null)
	const [isMapLoaded, setIsMapLoaded] = useState(false)
	const [showPickupPopup, setShowPickupPopup] = useState(false)
	const [showVanPopup, setShowVanPopup] = useState(false)
	const [snappedVanPosition, setSnappedVanPosition] = useState(null)
	const [routePath, setRoutePath] = useState([])
	const [isRouteLoading, setIsRouteLoading] = useState(false)
	const [isRouteFallback, setIsRouteFallback] = useState(false)
	const [isCachedRoute, setIsCachedRoute] = useState(false)

	const validPoints = useMemo(() => {
		const points = []
		if (isValidLatLng(pickupPosition)) {
			points.push(pickupPosition)
		}
		if (isValidLatLng(snappedVanPosition)) {
			points.push(snappedVanPosition)
		} else if (isValidLatLng(vanPosition)) {
			points.push(vanPosition)
		}
		return points
	}, [pickupPosition, snappedVanPosition, vanPosition])

	const effectiveVanPosition = isValidLatLng(snappedVanPosition) ? snappedVanPosition : vanPosition

	const plannedRouteGeoJson = useMemo(() => {
		if (!showRoute || !Array.isArray(plannedRoute) || plannedRoute.length < 2) {
			return null
		}

		const coordinates = plannedRoute
			.filter((point) => isValidLatLng(point))
			.map((point) => toLngLat(point))

		if (coordinates.length < 2) {
			return null
		}

		return {
			type: 'Feature',
			properties: {},
			geometry: {
				type: 'LineString',
				coordinates,
			},
		}
	}, [plannedRoute, showRoute])

	const routeGeoJson = useMemo(() => {
		if (plannedRouteGeoJson) {
			return plannedRouteGeoJson
		}

		if (!showRoute || routePath.length < 2) {
			return null
		}

		return {
			type: 'Feature',
			properties: {},
			geometry: {
				type: 'LineString',
				coordinates: routePath,
			},
		}
	}, [plannedRouteGeoJson, routePath, showRoute])

	const routeLayerStyle = useMemo(() => {
		if (!isRouteFallback) {
			return ROUTE_LAYER_STYLE
		}

		return {
			...ROUTE_LAYER_STYLE,
			paint: {
				...ROUTE_LAYER_STYLE.paint,
				'line-dasharray': [2, 1.5],
			},
		}
	}, [isRouteFallback])

	const routeBoundsPoints = useMemo(() => {
		if (!Array.isArray(plannedRoute) || plannedRoute.length === 0) {
			return []
		}

		const first = plannedRoute[0]
		const last = plannedRoute[plannedRoute.length - 1]
		const points = []

		if (isValidLatLng(first)) {
			points.push(first)
		}

		if (isValidLatLng(last)) {
			points.push(last)
		}

		return points
	}, [plannedRoute])

	const boundsPoints = useMemo(() => [...validPoints, ...routeBoundsPoints], [routeBoundsPoints, validPoints])

	const mapCenter = Array.isArray(center) ? center : boundsPoints[0] || DEFAULT_CENTER
	const initialViewState = useMemo(
		() => ({ latitude: mapCenter[0], longitude: mapCenter[1], zoom: DEFAULT_ZOOM }),
		[mapCenter],
	)

	// FIX 1: Reset cached route flag and path whenever positions change so road
	// recalculation is never permanently blocked by a stale cached straight line.
	useEffect(() => {
		setIsCachedRoute(false)
		setRoutePath([])
	}, [pickupPosition, vanPosition])

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
					if (isRateLimitError(error) || isServiceUnavailableError(error)) {
						break
					}
				}
			}

			if (!resolved) {
				setSnappedVanPosition(vanPosition)
			}
		}

		resolveSnappedPosition()

		return () => {
			abortController.abort()
		}
	}, [routeMode, vanPosition])

	// FIX 2: Only trust a saved route if it has enough points to be a real road
	// path. A 2-point saved straight-line fallback will be ignored and
	// recalculated fresh.
	useEffect(() => {
		if (!requestId) {
			return undefined
		}

		const loadSavedRoute = async () => {
			try {
				const response = await fetch(`/api/routing/saved/${requestId}`)
				if (response.ok) {
					const data = await response.json()
					if (
						data.route?.coordinates &&
						Array.isArray(data.route.coordinates) &&
						data.route.coordinates.length >= MIN_REAL_ROUTE_POINTS
					) {
						setRoutePath(data.route.coordinates)
						setIsCachedRoute(true)
						setIsRouteLoading(false)
					}
				}
			} catch (error) {
				// Silently fail - will recalculate if needed
			}
		}

		loadSavedRoute()
	}, [requestId])

	useEffect(() => {
		if (!showRoute) {
			setRoutePath([])
			setIsRouteLoading(false)
			setIsRouteFallback(false)
			return undefined
		}

		if (plannedRouteGeoJson) {
			setRoutePath([])
			setIsRouteLoading(false)
			setIsRouteFallback(false)
			return undefined
		}

		// FIX 3: Only skip recalculation if the cached route is a real road path
		// (enough points). If positions changed, isCachedRoute is already false
		// due to FIX 1 so this guard will not block recalculation.
		if (isCachedRoute && routePath.length >= MIN_REAL_ROUTE_POINTS) {
			setIsRouteLoading(false)
			setIsRouteFallback(false)
			return undefined
		}

		if (!isValidLatLng(pickupPosition) || !isValidLatLng(effectiveVanPosition)) {
			setRoutePath([])
			setIsRouteLoading(false)
			setIsRouteFallback(false)
			return undefined
		}

		if (isSameRoutePoint(pickupPosition, effectiveVanPosition)) {
			setRoutePath([])
			setIsRouteLoading(false)
			setIsRouteFallback(false)
			return undefined
		}

		if (routeMode !== 'road') {
			setRoutePath([])
			setIsRouteLoading(false)
			setIsRouteFallback(false)
			return undefined
		}

		if (debounceTimerRef.current) {
			clearTimeout(debounceTimerRef.current)
		}

		debounceTimerRef.current = setTimeout(() => {
			const abortController = new AbortController()
			setIsRouteLoading(true)
			setIsRouteFallback(false)

			fetchRoadPath(pickupPosition, effectiveVanPosition, abortController.signal)
				.then(async (path) => {
					if (path && path.length > 1) {
						setRoutePath(path)
						setIsRouteFallback(false)

						// FIX 4: Only save routes that are real road paths, not
						// straight-line fallbacks, so the cache is never poisoned.
						if (requestId && path.length >= MIN_REAL_ROUTE_POINTS) {
							try {
								await fetch(`/api/routing/save/${requestId}`, {
									method: 'POST',
									headers: { 'Content-Type': 'application/json' },
									body: JSON.stringify({
										coordinates: path,
										distance: 0,
										duration: 0,
										profile: 'driving',
									}),
								})
							} catch (error) {
								// Silently fail - route is already displayed
							}
						}
					}
					setIsRouteLoading(false)
				})
				.catch((error) => {
					console.warn('Route calculation failed, will retry:', error?.message)
					setIsRouteLoading(false)
				})
		}, ROUTE_REQUEST_DEBOUNCE_MS)

		return () => {
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current)
			}
		}
	}, [effectiveVanPosition, pickupPosition, plannedRouteGeoJson, routeMode, showRoute, isCachedRoute, routePath.length, requestId])

	useEffect(() => {
		if (!isMapLoaded || !mapRef.current) {
			return
		}

		mapRef.current.resize()

		if (userHasAdjustedCameraRef.current) {
			return
		}

		if (boundsPoints.length === 0) {
			return
		}

		if (boundsPoints.length === 1) {
			const target = boundsPoints[0]
			mapRef.current.flyTo({ center: toLngLat(target), zoom: 15, duration: 900 })
			hasAutoFramedRef.current = true
			return
		}

		const latitudes = boundsPoints.map((point) => point[0])
		const longitudes = boundsPoints.map((point) => point[1])
		const southWest = [Math.min(...longitudes), Math.min(...latitudes)]
		const northEast = [Math.max(...longitudes), Math.max(...latitudes)]

		mapRef.current.fitBounds([southWest, northEast], {
			padding: 58,
			maxZoom: 16,
			duration: 900,
		})

		hasAutoFramedRef.current = true
	}, [boundsPoints, isMapLoaded])

	return (
		<div className={`trip-map ${className}`.trim()} style={{ height }}>
			<MapGL
				ref={mapRef}
				mapLib={maplibregl}
				mapStyle={MAP_STYLE}
				initialViewState={initialViewState}
				onLoad={() => setIsMapLoaded(true)}
				onDragStart={() => {
					if (hasAutoFramedRef.current) {
						userHasAdjustedCameraRef.current = true
					}
				}}
				onZoomStart={() => {
					if (hasAutoFramedRef.current) {
						userHasAdjustedCameraRef.current = true
					}
				}}
				onRotateStart={() => {
					if (hasAutoFramedRef.current) {
						userHasAdjustedCameraRef.current = true
					}
				}}
				attributionControl={true}
				reuseMaps={true}
				className="trip-map__container"
			>
				{routeGeoJson ? (
					<Source id="trip-route-source" type="geojson" data={routeGeoJson}>
						<Layer {...routeLayerStyle} />
					</Source>
				) : null}

				{isValidLatLng(pickupPosition) ? (
					<Marker latitude={pickupPosition[0]} longitude={pickupPosition[1]} anchor="center">
						<button type="button" className="trip-map-marker trip-map-marker--pickup" onClick={() => setShowPickupPopup((current) => !current)}>
							<span>P</span>
						</button>
					</Marker>
				) : null}

				{showPickupPopup && isValidLatLng(pickupPosition) ? (
					<Popup
						latitude={pickupPosition[0]}
						longitude={pickupPosition[1]}
						anchor="top"
						closeButton={false}
						onClose={() => setShowPickupPopup(false)}
					>
						Pickup request location
					</Popup>
				) : null}

				{isValidLatLng(effectiveVanPosition) ? (
					<Marker latitude={effectiveVanPosition[0]} longitude={effectiveVanPosition[1]} anchor="center">
						<button type="button" className="trip-map-marker trip-map-marker--van" onClick={() => setShowVanPopup((current) => !current)}>
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
			</MapGL>

			{showRoute && isRouteLoading ? <div className="trip-map__status">Refreshing road route...</div> : null}
			{showRoute && !isRouteLoading && isRouteFallback ? (
				<div className="trip-map__status">Road routing unavailable, showing fallback guide line.</div>
			) : null}
		</div>
	)
}