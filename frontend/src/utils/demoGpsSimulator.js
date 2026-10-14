/**
 * Demo GPS Simulator - Provides realistic simulated GPS movement for demo purposes
 * Perfect for final defense presentation without real GPS data
 */

// Demo route: Makati to BGC (realistic Philippines route)
export const DEMO_ROUTES = {
	makati_to_bgc: {
		name: 'Makati to BGC',
		pickup: [14.5574, 121.0331], // Makati
		destination: [14.5547, 121.0451], // BGC
		// Simulated waypoints along route
		waypoints: [
			[14.5574, 121.0331],
			[14.5568, 121.0355],
			[14.5560, 121.0378],
			[14.5550, 121.0400],
			[14.5542, 121.0420],
			[14.5535, 121.0435],
			[14.5530, 121.0445],
			[14.5527, 121.0451],
		],
		estimatedDurationMs: 15000, // 15 seconds for demo (realistic: ~5 mins)
		description: 'Downtown Makati to BGC',
	},
	bgc_to_ortigas: {
		name: 'BGC to Ortigas',
		pickup: [14.5547, 121.0451], // BGC
		destination: [14.5995, 121.0277], // Ortigas
		waypoints: [
			[14.5547, 121.0451],
			[14.5600, 121.0400],
			[14.5650, 121.0380],
			[14.5700, 121.0350],
			[14.5750, 121.0320],
			[14.5800, 121.0300],
			[14.5850, 121.0285],
			[14.5920, 121.0280],
			[14.5995, 121.0277],
		],
		estimatedDurationMs: 20000, // 20 seconds for demo (realistic: ~10 mins)
		description: 'BGC to Ortigas Center',
	},
	manila_circle: {
		name: 'Manila Urban Loop',
		pickup: [14.5995, 120.9842], // Default center
		destination: [14.5995, 120.9842], // Returns to start
		waypoints: [
			[14.5995, 120.9842],
			[14.6050, 120.9850],
			[14.6100, 120.9840],
			[14.6120, 120.9780],
			[14.6080, 120.9720],
			[14.6000, 120.9700],
			[14.5920, 120.9740],
			[14.5880, 120.9820],
			[14.5920, 120.9880],
			[14.5995, 120.9842],
		],
		estimatedDurationMs: 25000, // 25 seconds for demo loop
		description: 'Urban delivery loop',
	},
}

/**
 * Calculate heading (bearing) between two points
 * Returns angle in degrees (0-360)
 */
export function calculateHeading(from, to) {
	const dLon = (to[1] - from[1]) * Math.cos((from[0] * Math.PI) / 180)
	const dLat = to[0] - from[0]
	const heading = (Math.atan2(dLon, dLat) * 180) / Math.PI
	return (heading + 360) % 360
}

/**
 * Interpolate position between two points
 * t: 0 to 1 (progress along route)
 */
export function interpolatePosition(from, to, t) {
	const clampedT = Math.max(0, Math.min(1, t))
	return [
		from[0] + (to[0] - from[0]) * clampedT,
		from[1] + (to[1] - from[1]) * clampedT,
	]
}

/**
 * Calculate distance between two lat/lng points (in km)
 * Using haversine formula
 */
export function calculateDistance(from, to) {
	const R = 6371 // Earth's radius in km
	const dLat = ((to[0] - from[0]) * Math.PI) / 180
	const dLon = ((to[1] - from[1]) * Math.PI) / 180
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos((from[0] * Math.PI) / 180) *
			Math.cos((to[0] * Math.PI) / 180) *
			Math.sin(dLon / 2) *
			Math.sin(dLon / 2)
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
	return R * c
}

/**
 * GPS Simulator Class - Manages realistic simulated GPS movement
 */
export class GpsSimulator {
	constructor(route, options = {}) {
		this.route = route
		this.isRunning = false
		this.currentIndex = 0
		this.currentProgress = 0 // 0 to 1 for current segment
		this.startTime = null
		this.pausedTime = 0
		this.listeners = {
			onPositionUpdate: options.onPositionUpdate || (() => {}),
			onHeadingUpdate: options.onHeadingUpdate || (() => {}),
			onRouteProgress: options.onRouteProgress || (() => {}),
			onTripComplete: options.onTripComplete || (() => {}),
			onError: options.onError || (() => {}),
		}
		this.speed = options.speed || 1 // Speed multiplier
		this.updateInterval = options.updateInterval || 100 // ms between updates
		this.intervalId = null
		this.lastKnownPosition = route.waypoints[0]
		this.lastKnownHeading = 0
	}

	/**
	 * Start simulated GPS movement
	 */
	start() {
		if (this.isRunning) return
		this.isRunning = true
		this.startTime = Date.now() - this.pausedTime
		this.currentIndex = 0
		this.currentProgress = 0

		console.log('[GpsSimulator] Starting movement simulation:', this.route.name)

		this.intervalId = setInterval(() => {
			try {
				this._updatePosition()
			} catch (error) {
				console.error('[GpsSimulator] Error during position update:', error)
				this.listeners.onError(error)
			}
		}, this.updateInterval)
	}

	/**
	 * Pause simulated movement
	 */
	pause() {
		if (!this.isRunning) return
		this.isRunning = false
		this.pausedTime = Date.now() - this.startTime
		clearInterval(this.intervalId)
		console.log('[GpsSimulator] Movement paused')
	}

	/**
	 * Resume from pause
	 */
	resume() {
		if (this.isRunning) return
		this.start()
		console.log('[GpsSimulator] Movement resumed')
	}

	/**
	 * Stop and reset simulation
	 */
	stop() {
		this.isRunning = false
		this.pausedTime = 0
		this.startTime = null
		this.currentIndex = 0
		this.currentProgress = 0
		clearInterval(this.intervalId)
		console.log('[GpsSimulator] Movement stopped and reset')
	}

	/**
	 * Jump to specific progress (0 to 1)
	 */
	seekToProgress(progress) {
		const clampedProgress = Math.max(0, Math.min(1, progress))
		const totalSegments = this.route.waypoints.length - 1

		this.currentIndex = Math.floor(clampedProgress * totalSegments)
		this.currentProgress = (clampedProgress * totalSegments) % 1

		if (this.isRunning) {
			this.startTime = Date.now() - clampedProgress * this.route.estimatedDurationMs * this.speed
			this.pausedTime = 0
		}

		this._updatePosition()
	}

	/**
	 * Internal position update logic
	 */
	_updatePosition() {
		if (!this.isRunning) return

		const elapsedTime = Date.now() - this.startTime
		const totalDuration = this.route.estimatedDurationMs / this.speed
		const overallProgress = Math.min(1, elapsedTime / totalDuration)

		const waypoints = this.route.waypoints
		const totalSegments = waypoints.length - 1
		const segmentProgress = overallProgress * totalSegments

		this.currentIndex = Math.floor(segmentProgress)
		this.currentProgress = segmentProgress % 1

		// Check if route is complete
		if (this.currentIndex >= totalSegments) {
			this.currentIndex = totalSegments - 1
			this.currentProgress = 1
			const lastPosition = waypoints[waypoints.length - 1]
			this.lastKnownPosition = lastPosition
			this.listeners.onPositionUpdate(lastPosition)
			this.listeners.onRouteProgress({ progress: 1, segment: this.currentIndex, totalSegments })
			this.stop()
			this.listeners.onTripComplete()
			return
		}

		// Interpolate current position
		const currentWaypoint = waypoints[this.currentIndex]
		const nextWaypoint = waypoints[this.currentIndex + 1]
		const position = interpolatePosition(currentWaypoint, nextWaypoint, this.currentProgress)

		// Calculate heading
		const heading = calculateHeading(this.lastKnownPosition || currentWaypoint, nextWaypoint)

		this.lastKnownPosition = position
		this.lastKnownHeading = heading

		// Emit updates
		this.listeners.onPositionUpdate(position)
		this.listeners.onHeadingUpdate(heading)
		this.listeners.onRouteProgress({
			progress: overallProgress,
			segment: this.currentIndex,
			totalSegments,
			currentWaypoint: currentWaypoint,
			nextWaypoint: nextWaypoint,
			segmentProgress: this.currentProgress,
		})
	}

	/**
	 * Get current simulated position
	 */
	getCurrentPosition() {
		return this.lastKnownPosition
	}

	/**
	 * Get current heading
	 */
	getCurrentHeading() {
		return this.lastKnownHeading
	}

	/**
	 * Get overall trip progress (0 to 1)
	 */
	getTripProgress() {
		if (!this.isRunning) return this.currentProgress
		const elapsedTime = Date.now() - this.startTime
		const totalDuration = this.route.estimatedDurationMs / this.speed
		return Math.min(1, elapsedTime / totalDuration)
	}

	/**
	 * Set speed multiplier
	 */
	setSpeed(speed) {
		const wasRunning = this.isRunning
		if (wasRunning) this.pause()

		this.speed = Math.max(0.1, speed)

		if (wasRunning) this.resume()
	}

	/**
	 * Estimate remaining time in milliseconds
	 */
	getEstimatedRemainingTime() {
		const progress = this.getTripProgress()
		const remainingFraction = 1 - progress
		return (this.route.estimatedDurationMs / this.speed) * remainingFraction
	}

	/**
	 * Get route information
	 */
	getRouteInfo() {
		return {
			name: this.route.name,
			description: this.route.description,
			pickup: this.route.pickup,
			destination: this.route.destination,
			estimatedDurationMs: this.route.estimatedDurationMs,
			actualDurationMs: this.route.estimatedDurationMs / this.speed,
			totalDistance: this._calculateRouteTotalDistance(),
		}
	}

	/**
	 * Calculate total route distance
	 */
	_calculateRouteTotalDistance() {
		let total = 0
		const waypoints = this.route.waypoints
		for (let i = 0; i < waypoints.length - 1; i++) {
			total += calculateDistance(waypoints[i], waypoints[i + 1])
		}
		return total
	}
}

/**
 * Calculate trip status based on progress
 */
export function getTripStatus(progress) {
	if (progress < 0.1) return 'Driver on the way'
	if (progress < 0.4) return 'Near pickup location'
	if (progress < 0.5) return 'Student picked up'
	if (progress < 0.9) return 'En route to destination'
	if (progress < 1) return 'Near destination'
	return 'Arrived at destination'
}

/**
 * Calculate ETA in human-readable format
 */
export function formatETA(remainingMs) {
	if (remainingMs <= 0) return 'Arriving now'
	const minutes = Math.ceil(remainingMs / 60000)
	if (minutes < 1) return '< 1 min'
	if (minutes === 1) return '1 min'
	return `${minutes} mins`
}
