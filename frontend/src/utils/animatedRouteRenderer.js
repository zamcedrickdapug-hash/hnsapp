/**
 * Animated Route Visualization
 * Creates gradient and animated progress visualization for GPS routes
 * Shows passed route in one color, remaining route in another
 */

export class AnimatedRouteRenderer {
	/**
	 * Create a layered route visualization
	 * Shows progress along a route with animated effects
	 */
	static createAnimatedRouteLayer(routeCoordinates, currentProgress = 0) {
		if (!Array.isArray(routeCoordinates) || routeCoordinates.length < 2) {
			return null
		}

		const totalDistance = this.calculateTotalDistance(routeCoordinates)
		const passedDistance = totalDistance * currentProgress

		const { passedCoordinates, remainingCoordinates } = this.splitRouteByProgress(
			routeCoordinates,
			passedDistance,
		)

		return {
			passed: {
				type: 'Feature',
				properties: { type: 'passed' },
				geometry: {
					type: 'LineString',
					coordinates: passedCoordinates,
				},
			},
			remaining: {
				type: 'Feature',
				properties: { type: 'remaining' },
				geometry: {
					type: 'LineString',
					coordinates: remainingCoordinates,
				},
			},
		}
	}

	/**
	 * Calculate total distance of a route (in degrees)
	 */
	static calculateTotalDistance(coordinates) {
		if (!Array.isArray(coordinates) || coordinates.length < 2) return 0

		let totalDistance = 0
		for (let i = 0; i < coordinates.length - 1; i++) {
			totalDistance += this.haversineDistance(coordinates[i], coordinates[i + 1])
		}
		return totalDistance
	}

	/**
	 * Haversine distance between two coordinates (in meters)
	 */
	static haversineDistance([lat1, lon1], [lat2, lon2]) {
		const R = 6371000 // Earth's radius in meters
		const φ1 = (lat1 * Math.PI) / 180
		const φ2 = (lat2 * Math.PI) / 180
		const Δφ = ((lat2 - lat1) * Math.PI) / 180
		const Δλ = ((lon2 - lon1) * Math.PI) / 180

		const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
			Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

		return R * c
	}

	/**
	 * Split a route into passed and remaining segments
	 */
	static splitRouteByProgress(coordinates, passedDistance) {
		const passedCoordinates = []
		const remainingCoordinates = []
		let currentDistance = 0
		let foundSplit = false

		for (let i = 0; i < coordinates.length; i++) {
			const coord = coordinates[i]

			if (!foundSplit) {
				passedCoordinates.push(coord)

				if (i < coordinates.length - 1) {
					const nextCoord = coordinates[i + 1]
					const segmentDistance = this.haversineDistance(coord, nextCoord)

					if (currentDistance + segmentDistance >= passedDistance) {
						// Found the split point
						const ratio = (passedDistance - currentDistance) / segmentDistance
						const splitCoord = this.interpolateCoordinate(coord, nextCoord, ratio)
						passedCoordinates.push(splitCoord)
						remainingCoordinates.push(splitCoord)
						foundSplit = true
					}

					currentDistance += segmentDistance
				}
			} else {
				remainingCoordinates.push(coord)
			}
		}

		// Ensure we have at least 2 coordinates in each segment
		if (passedCoordinates.length < 2) {
			passedCoordinates.push(coordinates[0])
		}
		if (remainingCoordinates.length < 2) {
			remainingCoordinates.push(coordinates[coordinates.length - 1])
		}

		return { passedCoordinates, remainingCoordinates }
	}

	/**
	 * Interpolate between two coordinates
	 */
	static interpolateCoordinate([lat1, lon1], [lat2, lon2], ratio) {
		return [
			lat1 + (lat2 - lat1) * ratio,
			lon1 + (lon2 - lon1) * ratio,
		]
	}

	/**
	 * Get route layer styles for maplibre
	 */
	static getRouteLayers() {
		return {
			passed: {
				id: 'route-passed',
				type: 'line',
				paint: {
					'line-color': '#10b981', // Green for passed
					'line-width': 5,
					'line-opacity': 0.9,
				},
				layout: {
					'line-join': 'round',
					'line-cap': 'round',
				},
			},
			passedGlow: {
				id: 'route-passed-glow',
				type: 'line',
				paint: {
					'line-color': '#10b981',
					'line-width': 8,
					'line-opacity': 0.3,
					'line-blur': 2,
				},
				layout: {
					'line-join': 'round',
					'line-cap': 'round',
				},
			},
			remaining: {
				id: 'route-remaining',
				type: 'line',
				paint: {
					'line-color': '#52a3ff', // Blue for remaining
					'line-width': 5,
					'line-opacity': 0.8,
					'line-dasharray': [4, 4], // Dashed line
				},
				layout: {
					'line-join': 'round',
					'line-cap': 'round',
				},
			},
			remainingGlow: {
				id: 'route-remaining-glow',
				type: 'line',
				paint: {
					'line-color': '#52a3ff',
					'line-width': 8,
					'line-opacity': 0.2,
					'line-blur': 2,
				},
				layout: {
					'line-join': 'round',
					'line-cap': 'round',
				},
			},
		}
	}
}

export default AnimatedRouteRenderer
