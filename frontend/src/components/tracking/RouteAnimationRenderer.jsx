/**
 * Route Animation Renderer
 * Creates animated polylines showing route progress
 */

import { Source, Layer } from 'react-map-gl/maplibre'

/**
 * Calculate total distance between waypoints
 */
function calculateTotalDistance(coordinates) {
	let total = 0
	for (let i = 0; i < coordinates.length - 1; i++) {
		const [lat1, lon1] = coordinates[i]
		const [lat2, lon2] = coordinates[i + 1]

		const R = 6371 // Earth's radius in km
		const dLat = ((lat2 - lat1) * Math.PI) / 180
		const dLon = ((lon2 - lon1) * Math.PI) / 180
		const a =
			Math.sin(dLat / 2) * Math.sin(dLat / 2) +
			Math.cos((lat1 * Math.PI) / 180) *
				Math.cos((lat2 * Math.PI) / 180) *
				Math.sin(dLon / 2) *
				Math.sin(dLon / 2)
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
		total += R * c
	}
	return total
}

/**
 * Split route at a specific progress percentage
 * Returns { passed, remaining }
 */
function splitRouteByProgress(coordinates, progress) {
	if (!coordinates || coordinates.length < 2) {
		return { passed: [], remaining: coordinates }
	}

	if (progress <= 0) {
		return { passed: [], remaining: coordinates }
	}

	if (progress >= 1) {
		return { passed: coordinates, remaining: [] }
	}

	const totalDistance = calculateTotalDistance(coordinates)
	const targetDistance = totalDistance * progress

	let accumulatedDistance = 0
	const passed = []
	const remaining = []

	for (let i = 0; i < coordinates.length; i++) {
		if (i === 0) {
			passed.push(coordinates[i])
			continue
		}

		const [lat1, lon1] = coordinates[i - 1]
		const [lat2, lon2] = coordinates[i]

		const R = 6371
		const dLat = ((lat2 - lat1) * Math.PI) / 180
		const dLon = ((lon2 - lon1) * Math.PI) / 180
		const a =
			Math.sin(dLat / 2) * Math.sin(dLat / 2) +
			Math.cos((lat1 * Math.PI) / 180) *
				Math.cos((lat2 * Math.PI) / 180) *
				Math.sin(dLon / 2) *
				Math.sin(dLon / 2)
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
		const segmentDistance = R * c

		if (accumulatedDistance + segmentDistance <= targetDistance) {
			passed.push(coordinates[i])
			accumulatedDistance += segmentDistance
		} else {
			// We're on this segment - interpolate the position
			const segmentProgress = (targetDistance - accumulatedDistance) / segmentDistance

			const interpLat = lat1 + (lat2 - lat1) * segmentProgress
			const interpLon = lon1 + (lon2 - lon1) * segmentProgress

			passed.push([interpLat, interpLon])

			// Add remaining coordinates
			remaining.push([interpLat, interpLon])
			for (let j = i; j < coordinates.length; j++) {
				remaining.push(coordinates[j])
			}
			break
		}
	}

	return { passed, remaining }
}

/**
 * Route Animation Renderer Component
 */
function RouteAnimationRenderer({ routeCoordinates, progress = 0, routeId = 'animated-route' }) {
	if (!routeCoordinates || routeCoordinates.length < 2) {
		return null
	}

	const { passed, remaining } = splitRouteByProgress(routeCoordinates, progress)

	return (
		<>
			{/* Passed route (green) */}
			{passed.length >= 2 && (
				<Source
					id={`${routeId}-passed-source`}
					type='geojson'
					data={{
						type: 'FeatureCollection',
						features: [
							{
								type: 'Feature',
								geometry: {
									type: 'LineString',
									coordinates: passed.map(([lat, lon]) => [lon, lat]),
								},
							},
						],
					}}
				>
					{/* Green glow layer (underneath) */}
					<Layer
						id={`${routeId}-passed-glow`}
						type='line'
						paint={{
							'line-color': '#10b981',
							'line-width': 10,
							'line-opacity': 0.2,
							'line-blur': 4,
						}}
					/>

					{/* Green line (main) */}
					<Layer
						id={`${routeId}-passed-line`}
						type='line'
						paint={{
							'line-color': '#10b981',
							'line-width': 4,
							'line-opacity': 0.9,
							'line-cap': 'round',
							'line-join': 'round',
						}}
					/>
				</Source>
			)}

			{/* Remaining route (blue) */}
			{remaining.length >= 2 && (
				<Source
					id={`${routeId}-remaining-source`}
					type='geojson'
					data={{
						type: 'FeatureCollection',
						features: [
							{
								type: 'Feature',
								geometry: {
									type: 'LineString',
									coordinates: remaining.map(([lat, lon]) => [lon, lat]),
								},
							},
						],
					}}
				>
					{/* Blue glow layer (underneath) */}
					<Layer
						id={`${routeId}-remaining-glow`}
						type='line'
						paint={{
							'line-color': '#52a3ff',
							'line-width': 10,
							'line-opacity': 0.15,
							'line-blur': 4,
						}}
					/>

					{/* Blue dashed line (main) */}
					<Layer
						id={`${routeId}-remaining-line`}
						type='line'
						paint={{
							'line-color': '#52a3ff',
							'line-width': 4,
							'line-opacity': 0.7,
							'line-dasharray': [3, 3],
							'line-cap': 'round',
							'line-join': 'round',
						}}
					/>
				</Source>
			)}
		</>
	)
}

export { RouteAnimationRenderer, splitRouteByProgress, calculateTotalDistance }
