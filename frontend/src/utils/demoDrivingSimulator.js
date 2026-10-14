/**
 * Demo Driving Simulator
 * Simulates realistic vehicle movement for demo/presentation purposes
 * Works completely offline with no external GPS required
 */

/**
 * Demo route with realistic coordinates for Metro Manila area
 */
const DEMO_ROUTES = {
	CITY_CENTER: {
		name: 'City Center Route',
		waypoints: [
			[14.5995, 120.9842], // Start: Makati
			[14.6015, 120.9835],
			[14.6035, 120.9828],
			[14.6055, 120.9820],
			[14.6075, 120.9815],
			[14.6091, 120.9824], // End: BGC
		],
		speed: 40, // km/h
		duration: 180, // seconds (3 minutes)
	},
	METRO_ROUTE: {
		name: 'Metro Route',
		waypoints: [
			[14.6652, 121.0413], // Start: Quezon City
			[14.6600, 121.0400],
			[14.6550, 121.0350],
			[14.6500, 121.0320],
			[14.6400, 121.0280],
			[14.5965, 121.0258], // End: Makati
		],
		speed: 40,
		duration: 300, // 5 minutes
	},
	SUBURBS: {
		name: 'Suburbs Route',
		waypoints: [
			[14.7749, 121.0625], // Start: North area
			[14.7700, 121.0600],
			[14.7650, 121.0580],
			[14.7600, 121.0560],
			[14.7550, 121.0540],
			[14.8500, 121.0500], // End: Further north
		],
		speed: 50,
		duration: 420, // 7 minutes
	},
}

/**
 * Calculate bearing (heading) between two points
 * Returns angle in degrees (0-360)
 */
function calculateBearing(from, to) {
	const lat1 = (from[0] * Math.PI) / 180
	const lon1 = (from[1] * Math.PI) / 180
	const lat2 = (to[0] * Math.PI) / 180
	const lon2 = (to[1] * Math.PI) / 180

	const dLon = lon2 - lon1

	const y = Math.sin(dLon) * Math.cos(lat2)
	const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)

	const bearing = Math.atan2(y, x)
	const bearingDegrees = ((bearing * 180) / Math.PI + 360) % 360

	return bearingDegrees
}

/**
 * Calculate distance between two lat/lon points
 * Returns distance in degrees (for interpolation)
 */
function calculateDistance(from, to) {
	const latDiff = to[0] - from[0]
	const lonDiff = to[1] - from[1]
	return Math.sqrt(latDiff * latDiff + lonDiff * lonDiff)
}

/**
 * Interpolate position between two points
 * @param {Array} from - Starting [lat, lon]
 * @param {Array} to - Ending [lat, lon]
 * @param {number} t - Progress (0-1)
 */
function interpolatePosition(from, to, t) {
	const lat = from[0] + (to[0] - from[0]) * t
	const lon = from[1] + (to[1] - from[1]) * t
	return [lat, lon]
}

/**
 * Get realistic status based on trip progress
 */
function getStatusForProgress(progress) {
	if (progress < 0.1) return 'Searching for driver'
	if (progress < 0.25) return 'Driver Accepted'
	if (progress < 0.4) return 'Driver On The Way'
	if (progress < 0.6) return 'Arrived at Pickup'
	if (progress < 0.85) return 'In Transit to School'
	if (progress < 0.98) return 'Near Destination'
	return 'Arrived at School'
}

/**
 * Demo Driving Simulator Class
 */
class DemoDrivingSimulator {
	constructor(onPositionUpdate, onStatusUpdate, onRouteProgressUpdate) {
		this.onPositionUpdate = onPositionUpdate
		this.onStatusUpdate = onStatusUpdate
		this.onRouteProgressUpdate = onRouteProgressUpdate

		this.currentRoute = null
		this.currentWaypoint = 0
		this.elapsedTime = 0
		this.isRunning = false
		this.isPaused = false
		this.intervalId = null

		this.currentPosition = null
		this.currentHeading = 0
		this.currentStatus = 'Searching for driver'
		this.progress = 0 // 0-1
	}

	/**
	 * Start demo with specified route
	 */
	start(routeKey = 'CITY_CENTER') {
		if (this.isRunning) return

		this.currentRoute = DEMO_ROUTES[routeKey]
		if (!this.currentRoute) {
			console.error('Invalid route key:', routeKey)
			return
		}

		this.currentWaypoint = 0
		this.elapsedTime = 0
		this.isRunning = true
		this.isPaused = false
		this.currentPosition = [...this.currentRoute.waypoints[0]]

		console.log(`🚗 Starting demo route: ${this.currentRoute.name}`)

		// Update every 500ms for smooth movement
		this.intervalId = setInterval(() => this.tick(), 500)
	}

	/**
	 * Update position each tick
	 */
	tick() {
		if (!this.isRunning || this.isPaused || !this.currentRoute) return

		this.elapsedTime += 0.5 // 500ms = 0.5 seconds

		const waypoints = this.currentRoute.waypoints
		const totalDistance = this.calculateTotalDistance(waypoints)
		const distancePerSecond = totalDistance / this.currentRoute.duration

		// Calculate how far we've traveled
		const distanceTraveled = distancePerSecond * this.elapsedTime

		// Find current position on route
		let accumulatedDistance = 0
		this.currentWaypoint = 0

		for (let i = 0; i < waypoints.length - 1; i++) {
			const segmentDistance = calculateDistance(waypoints[i], waypoints[i + 1])

			if (accumulatedDistance + segmentDistance >= distanceTraveled) {
				// We're on this segment
				this.currentWaypoint = i
				const segmentProgress = (distanceTraveled - accumulatedDistance) / segmentDistance

				// Interpolate position
				this.currentPosition = interpolatePosition(waypoints[i], waypoints[i + 1], segmentProgress)

				// Calculate heading to next waypoint
				this.currentHeading = calculateBearing(waypoints[i], waypoints[i + 1])

				break
			}

			accumulatedDistance += segmentDistance
		}

		// Calculate overall progress
		this.progress = Math.min(this.elapsedTime / this.currentRoute.duration, 1)

		// Update status
		const newStatus = getStatusForProgress(this.progress)
		if (newStatus !== this.currentStatus) {
			this.currentStatus = newStatus
			this.onStatusUpdate?.(newStatus)
		}

		// Notify listeners
		this.onPositionUpdate?.({
			position: this.currentPosition,
			heading: this.currentHeading,
			status: this.currentStatus,
			progress: this.progress,
		})

		this.onRouteProgressUpdate?.(this.progress, this.currentWaypoint)

		// Check if completed
		if (this.progress >= 1) {
			this.stop()
			console.log('✅ Route completed')
		}
	}

	/**
	 * Calculate total distance of route
	 */
	calculateTotalDistance(waypoints) {
		let total = 0
		for (let i = 0; i < waypoints.length - 1; i++) {
			total += calculateDistance(waypoints[i], waypoints[i + 1])
		}
		return total
	}

	/**
	 * Pause simulation
	 */
	pause() {
		if (!this.isRunning) return
		this.isPaused = true
		console.log('⏸ Demo paused')
	}

	/**
	 * Resume simulation
	 */
	resume() {
		if (!this.isRunning) return
		this.isPaused = false
		console.log('▶ Demo resumed')
	}

	/**
	 * Stop and reset simulation
	 */
	stop() {
		this.isRunning = false
		this.isPaused = false

		if (this.intervalId) {
			clearInterval(this.intervalId)
			this.intervalId = null
		}

		this.currentWaypoint = 0
		this.elapsedTime = 0
		this.progress = 0
		this.currentStatus = 'Searching for driver'

		console.log('🛑 Demo stopped')
	}

	/**
	 * Get current state
	 */
	getState() {
		return {
			isRunning: this.isRunning,
			isPaused: this.isPaused,
			currentRoute: this.currentRoute?.name || null,
			position: this.currentPosition,
			heading: this.currentHeading,
			status: this.currentStatus,
			progress: this.progress,
			elapsedTime: this.elapsedTime,
			totalDuration: this.currentRoute?.duration || 0,
		}
	}

	/**
	 * Get available routes
	 */
	static getAvailableRoutes() {
		return Object.keys(DEMO_ROUTES).map((key) => ({
			key,
			name: DEMO_ROUTES[key].name,
			duration: DEMO_ROUTES[key].duration,
		}))
	}

	/**
	 * Get route by key
	 */
	static getRoute(key) {
		return DEMO_ROUTES[key]
	}
}

export { DemoDrivingSimulator, DEMO_ROUTES, calculateBearing, calculateDistance, interpolatePosition }
