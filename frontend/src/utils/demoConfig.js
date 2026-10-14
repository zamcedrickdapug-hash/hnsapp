/**
 * Demo Configuration and Utilities
 * Provides stable demo mode settings and fallback coordinates
 */

export const DEMO_CONFIG = {
	// Enable demo mode globally
	DEMO_MODE_ENABLED: import.meta.env.VITE_DEMO_MODE === 'true',

	// Demo routes for different scenarios
	DEMO_SCENARIOS: {
		CITY_CENTER: {
			name: 'City Center Route',
			pickup: [14.5995, 120.9842], // Manila
			destination: [14.6091, 120.9824],
			route: [
				[14.5995, 120.9842],
				[14.6005, 120.9850],
				[14.6015, 120.9860],
				[14.6025, 120.9870],
				[14.6035, 120.9875],
				[14.6050, 120.9820],
				[14.6070, 120.9825],
				[14.6091, 120.9824],
			],
		},
		METRO_ROUTE: {
			name: 'Metro Area Route',
			pickup: [14.6652, 121.0413], // Makati
			destination: [14.5965, 121.0258],
			route: [
				[14.6652, 121.0413],
				[14.6600, 121.0390],
				[14.6550, 121.0360],
				[14.6500, 121.0340],
				[14.6400, 121.0320],
				[14.6300, 121.0300],
				[14.6100, 121.0280],
				[14.5965, 121.0258],
			],
		},
		SUBURBS: {
			name: 'Suburban Route',
			pickup: [14.7749, 121.0625], // Quezon City
			destination: [14.8500, 121.0500],
			route: [
				[14.7749, 121.0625],
				[14.7800, 121.0600],
				[14.7900, 121.0580],
				[14.8050, 121.0560],
				[14.8200, 121.0540],
				[14.8350, 121.0520],
				[14.8500, 121.0500],
			],
		},
	},

	// Default fallback coordinates
	FALLBACK_COORDINATES: {
		DEFAULT_CENTER: [14.5995, 120.9842],
		PICKUP_DEFAULT: [14.5995, 120.9842],
		DESTINATION_DEFAULT: [14.6091, 120.9824],
	},

	// Demo mode speeds and timings
	TIMING: {
		// Total demo trip duration in seconds
		DEMO_TRIP_DURATION: 180, // 3 minutes for quick demo
		// Update interval in milliseconds
		POSITION_UPDATE_INTERVAL: 200,
		// Animation durations
		MAP_ANIMATION_DURATION: 900,
		STATUS_UPDATE_INTERVAL: 2000,
	},

	// Demo mode features
	FEATURES: {
		// Show demo mode indicator
		SHOW_DEMO_INDICATOR: true,
		// Auto-loop the demo route
		AUTO_LOOP_ROUTE: true,
		// Show route progress percentage
		SHOW_PROGRESS_PERCENTAGE: true,
		// Enable vehicle heading rotation
		ENABLE_HEADING_ROTATION: true,
		// Show ETA predictions
		SHOW_ETA: true,
		// Animate route line with progress
		ANIMATE_ROUTE_PROGRESS: true,
	},

	// Offline mode settings
	OFFLINE: {
		// Use cached coordinates when GPS fails
		USE_FALLBACK_COORDINATES: true,
		// Cache demo routes
		CACHE_DEMO_ROUTES: true,
		// Auto-use demo mode if no GPS
		AUTO_DEMO_ON_NO_GPS: true,
	},

	// Performance settings
	PERFORMANCE: {
		// Maximum position update frequency (ms)
		MIN_UPDATE_INTERVAL: 100,
		// Smooth animation
		ANIMATION_ENABLED: true,
		// Throttle map updates
		THROTTLE_MAP_UPDATES: true,
		// Max markers on map
		MAX_MARKERS: 50,
	},
}

/**
 * Generate a demo route starting from current location
 */
export function generateDemoRoute(startLocation, direction = 'northeast') {
	if (!Array.isArray(startLocation) || startLocation.length < 2) {
		startLocation = DEMO_CONFIG.FALLBACK_COORDINATES.DEFAULT_CENTER
	}

	const [lat, lon] = startLocation
	const step = 0.01 // roughly 1.1 km per step

	let route = [[lat, lon]]
	let currentLat = lat
	let currentLon = lon

	// Generate a simple route in the specified direction
	for (let i = 0; i < 8; i++) {
		switch (direction.toLowerCase()) {
			case 'northeast':
				currentLat += step
				currentLon += step
				break
			case 'northwest':
				currentLat += step
				currentLon -= step
				break
			case 'southeast':
				currentLat -= step
				currentLon += step
				break
			case 'southwest':
				currentLat -= step
				currentLon -= step
				break
			case 'north':
				currentLat += step
				break
			case 'south':
				currentLat -= step
				break
			case 'east':
				currentLon += step
				break
			case 'west':
				currentLon -= step
				break
			default:
				currentLat += step * 0.7
				currentLon += step * 0.7
		}

		route.push([currentLat, currentLon])
	}

	return route
}

/**
 * Get a safe demo scenario
 */
export function getDemoScenario(scenarioKey = 'CITY_CENTER') {
	return DEMO_CONFIG.DEMO_SCENARIOS[scenarioKey] || DEMO_CONFIG.DEMO_SCENARIOS.CITY_CENTER
}

/**
 * Create a stable demo trip with fallback handling
 */
export function createDemoTrip(customRoute = null, customPickup = null, customDestination = null) {
	const scenario = getDemoScenario('CITY_CENTER')

	return {
		route: customRoute || scenario.route,
		pickupLocation: customPickup || scenario.pickup,
		destinationLocation: customDestination || scenario.destination,
		tripId: `demo_${Date.now()}`,
		isDemoMode: true,
		isOfflineMode: false,
		createdAt: new Date().toISOString(),
	}
}

/**
 * Calculate realistic ETA based on route
 */
export function calculateEstimatedETA(currentProgress, totalDistance = 8) {
	// Assume average speed of 40 km/h in demo
	const remainingDistance = totalDistance * (1 - currentProgress)
	const speedKmh = 40
	const timeMinutes = (remainingDistance / speedKmh) * 60

	return {
		minutes: Math.ceil(timeMinutes),
		seconds: Math.round(timeMinutes * 60),
		distance: remainingDistance.toFixed(2),
	}
}

/**
 * Format ETA for display
 */
export function formatETA(etaObject) {
	if (!etaObject) return 'Calculating...'
	const { minutes } = etaObject
	if (minutes <= 0) return 'Arriving now'
	if (minutes === 1) return '1 minute away'
	return `${minutes} minutes away`
}

/**
 * Check if system is running in demo mode
 */
export function isDemoMode() {
	return DEMO_CONFIG.DEMO_MODE_ENABLED === true
}

/**
 * Get demo status messages
 */
export const DEMO_STATUSES = {
	IDLE: 'Waiting for trip...',
	STARTING: 'Starting demo trip...',
	EN_ROUTE_PICKUP: 'En route to pickup location',
	NEAR_PICKUP: 'Approaching pickup location',
	ARRIVING_PICKUP: 'Arrived at pickup',
	PICKED_UP: 'Student picked up',
	EN_ROUTE_DEST: 'En route to destination',
	NEAR_DEST: 'Approaching destination',
	ARRIVED: 'Arrived at destination',
	COMPLETED: 'Trip completed',
	ERROR: 'Demo error - check console',
}

export default DEMO_CONFIG
