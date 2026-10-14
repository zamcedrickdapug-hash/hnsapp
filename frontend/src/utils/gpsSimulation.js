/**
 * GPS Simulation Engine
 * Provides realistic vehicle movement simulation for demo/presentation mode
 * Supports smooth interpolation, heading calculation, and realistic travel timing
 */

export const GPS_SIMULATION_CONFIG = {
	// Movement speed in degrees per second (adjust for desired travel speed)
	SPEED_MULTIPLIER: 1.5,
	// How often to update position (milliseconds)
	UPDATE_INTERVAL: 200,
	// Smoothing factor for direction changes (0-1)
	HEADING_SMOOTHING: 0.15,
	// Radius for "arrived" detection (in degrees, approximately)
	ARRIVED_THRESHOLD_DEGREES: 0.0015, // roughly 150 meters at equator
	// Demo statuses
	STATUSES: {
		IDLE: 'idle',
		EN_ROUTE_TO_PICKUP: 'En route to pickup',
		NEAR_PICKUP: 'Near pickup location',
		PICKED_UP: 'Student picked up',
		EN_ROUTE_TO_DESTINATION: 'En route to destination',
		NEAR_DESTINATION: 'Near destination',
		ARRIVED: 'Arrived',
	},
}

/**
 * Calculate heading (bearing) between two coordinates
 * @param {Array} from - [latitude, longitude]
 * @param {Array} to - [latitude, longitude]
 * @returns {number} Bearing in degrees (0-360)
 */
export function calculateHeading(from, to) {
	if (!Array.isArray(from) || !Array.isArray(to)) return 0

	const [lat1, lon1] = [from[0] * Math.PI / 180, from[1] * Math.PI / 180]
	const [lat2, lon2] = [to[0] * Math.PI / 180, to[1] * Math.PI / 180]

	const y = Math.sin(lon2 - lon1) * Math.cos(lat2)
	const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1)
	const bearing = Math.atan2(y, x) * 180 / Math.PI

	return (bearing + 360) % 360
}

/**
 * Calculate distance between two coordinates (in degrees)
 * @param {Array} from - [latitude, longitude]
 * @param {Array} to - [latitude, longitude]
 * @returns {number} Distance in degrees
 */
export function calculateDistance(from, to) {
	if (!Array.isArray(from) || !Array.isArray(to)) return 0

	const [lat1, lon1] = from
	const [lat2, lon2] = to

	// Simple Euclidean distance (adequate for nearby locations)
	return Math.sqrt(Math.pow(lat2 - lat1, 2) + Math.pow(lon2 - lon1, 2))
}

/**
 * Interpolate between two positions
 * @param {Array} from - [latitude, longitude]
 * @param {Array} to - [latitude, longitude]
 * @param {number} t - Interpolation factor (0-1)
 * @returns {Array} Interpolated position [latitude, longitude]
 */
export function interpolatePosition(from, to, t) {
	if (!Array.isArray(from) || !Array.isArray(to)) return from

	const clamped = Math.max(0, Math.min(1, t))
	return [
		from[0] + (to[0] - from[0]) * clamped,
		from[1] + (to[1] - from[1]) * clamped,
	]
}

/**
 * Smooth interpolation using easing function (ease-in-out)
 * @param {number} t - Interpolation factor (0-1)
 * @returns {number} Eased interpolation factor
 */
function easeInOutQuad(t) {
	return t < 0.5 ? 2 * t * t : -1 + 4 * t - 2 * t * t
}

/**
 * GPS Simulation instance
 * Manages realistic vehicle movement along a route
 */
export class GPSSimulator {
	constructor(config = {}) {
		this.config = { ...GPS_SIMULATION_CONFIG, ...config }
		this.route = []
		this.currentPositionIndex = 0
		this.positionProgress = 0 // 0-1 between currentPositionIndex and next
		this.currentPosition = null
		this.currentHeading = 0
		this.isMoving = false
		this.startTime = null
		this.lastUpdateTime = null
		this.onPositionUpdate = null
		this.onStatusChange = null
		this.animationFrameId = null
		this.status = this.config.STATUSES.IDLE
		this.pickupLocation = null
		this.destinationLocation = null
		this.hasPickedUp = false
	}

	/**
	 * Initialize simulation with a route and locations
	 */
	initialize(route, pickupLocation, destinationLocation) {
		if (!Array.isArray(route) || route.length < 2) {
			console.warn('[GPSSimulator] Invalid route provided')
			return false
		}

		this.route = route.map((pos) => {
			if (Array.isArray(pos) && pos.length >= 2) {
				return [Number(pos[0]), Number(pos[1])]
			}
			return null
		}).filter(Boolean)

		if (this.route.length < 2) {
			console.warn('[GPSSimulator] Insufficient valid route points')
			return false
		}

		this.pickupLocation = pickupLocation
		this.destinationLocation = destinationLocation
		this.currentPositionIndex = 0
		this.positionProgress = 0
		this.currentPosition = this.route[0]
		this.currentHeading = 0
		this.hasPickedUp = false

		this.setStatus(this.config.STATUSES.EN_ROUTE_TO_PICKUP)
		return true
	}

	/**
	 * Start the simulation
	 */
	start() {
		if (this.isMoving) return

		this.isMoving = true
		this.startTime = Date.now()
		this.lastUpdateTime = this.startTime
		this.updatePosition()
	}

	/**
	 * Stop the simulation
	 */
	stop() {
		this.isMoving = false
		if (this.animationFrameId) {
			cancelAnimationFrame(this.animationFrameId)
			this.animationFrameId = null
		}
	}

	/**
	 * Pause and resume
	 */
	pause() {
		this.stop()
	}

	resume() {
		this.start()
	}

	/**
	 * Update position along the route
	 */
	updatePosition() {
		if (!this.isMoving || !this.route || this.route.length < 2) return

		const now = Date.now()
		const deltaTime = (now - this.lastUpdateTime) / 1000 // seconds
		this.lastUpdateTime = now

		// Calculate progress increment based on speed
		const distanceBetweenPoints = calculateDistance(
			this.route[this.currentPositionIndex],
			this.route[this.currentPositionIndex + 1],
		)

		if (distanceBetweenPoints > 0) {
			// Speed in degrees per second
			const speedDps = this.config.SPEED_MULTIPLIER * 0.0003
			const increment = (speedDps * deltaTime) / distanceBetweenPoints
			this.positionProgress += increment
		}

		// Move to next segment if progress exceeds 1
		while (this.positionProgress > 1 && this.currentPositionIndex < this.route.length - 2) {
			this.positionProgress = 0
			this.currentPositionIndex += 1
		}

		// Check if reached end of route
		if (this.currentPositionIndex >= this.route.length - 1) {
			this.positionProgress = 1
			this.isMoving = false
			this.setStatus(this.config.STATUSES.ARRIVED)
		}

		// Interpolate current position
		const from = this.route[this.currentPositionIndex]
		const to = this.route[this.currentPositionIndex + 1] || from
		const easedProgress = easeInOutQuad(Math.min(this.positionProgress, 1))
		this.currentPosition = interpolatePosition(from, to, easedProgress)

		// Calculate heading
		const nextHeading = calculateHeading(from, to)
		this.currentHeading = this.smoothHeading(this.currentHeading, nextHeading)

		// Update status based on proximity to waypoints
		this.updateStatus()

		// Notify listeners
		if (this.onPositionUpdate) {
			this.onPositionUpdate({
				position: this.currentPosition,
				heading: this.currentHeading,
				isMoving: this.isMoving,
				progress: (this.currentPositionIndex + this.positionProgress) / (this.route.length - 1),
				status: this.status,
			})
		}

		// Schedule next update
		if (this.isMoving) {
			this.animationFrameId = requestAnimationFrame(() => this.updatePosition())
		}
	}

	/**
	 * Smooth heading changes to avoid jittering
	 */
	smoothHeading(current, target) {
		let diff = target - current

		// Handle wrap-around at 0/360
		if (diff > 180) diff -= 360
		if (diff < -180) diff += 360

		return current + diff * this.config.HEADING_SMOOTHING
	}

	/**
	 * Update trip status based on location
	 */
	updateStatus() {
		if (!this.currentPosition) return

		// Check if near pickup
		if (
			!this.hasPickedUp &&
			this.pickupLocation &&
			calculateDistance(this.currentPosition, this.pickupLocation) < this.config.ARRIVED_THRESHOLD_DEGREES
		) {
			this.setStatus(this.config.STATUSES.NEAR_PICKUP)
		}

		// Check if picked up (in demo, we auto-pick-up when near)
		if (!this.hasPickedUp && this.status === this.config.STATUSES.NEAR_PICKUP && Math.random() < 0.02) {
			this.hasPickedUp = true
			this.setStatus(this.config.STATUSES.PICKED_UP)
		}

		// Update status based on route progress
		if (this.hasPickedUp && this.status !== this.config.STATUSES.ARRIVED) {
			if (
				this.destinationLocation &&
				calculateDistance(this.currentPosition, this.destinationLocation) < this.config.ARRIVED_THRESHOLD_DEGREES * 2
			) {
				this.setStatus(this.config.STATUSES.NEAR_DESTINATION)
			} else if (this.hasPickedUp && !this.status.includes('destination')) {
				this.setStatus(this.config.STATUSES.EN_ROUTE_TO_DESTINATION)
			}
		}
	}

	/**
	 * Set trip status with notification
	 */
	setStatus(newStatus) {
		if (this.status !== newStatus) {
			this.status = newStatus
			if (this.onStatusChange) {
				this.onStatusChange(newStatus)
			}
		}
	}

	/**
	 * Get current simulation state
	 */
	getState() {
		return {
			position: this.currentPosition,
			heading: this.currentHeading,
			isMoving: this.isMoving,
			status: this.status,
			progress: this.currentPositionIndex / (this.route.length - 1),
			hasPickedUp: this.hasPickedUp,
		}
	}

	/**
	 * Reset simulation
	 */
	reset() {
		this.stop()
		this.route = []
		this.currentPositionIndex = 0
		this.positionProgress = 0
		this.currentPosition = null
		this.currentHeading = 0
		this.hasPickedUp = false
		this.status = this.config.STATUSES.IDLE
	}
}

export default GPSSimulator
