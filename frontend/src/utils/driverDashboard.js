/**
 * Driver Dashboard Utilities
 * ==========================
 * Extracted formatting, calculation, and helper functions
 * Keeps business logic separate from React components
 * 
 * Architecture Decision:
 * - Pure functions (no side effects)
 * - Reusable across dashboard and components
 * - Easy to unit test
 * - Improves component readability
 */

/**
 * Format date to readable string
 * @param {string|Date} dateValue - Date to format
 * @returns {string} Formatted date string
 */
export function formatDate(dateValue) {
  if (!dateValue) {
    return 'N/A'
  }
  return new Date(dateValue).toLocaleString()
}

/**
 * Get CSS class for status label
 * @param {string} status - Trip status
 * @returns {string} CSS class name
 */
export function getStatusLabelClass(status) {
  const statusMap = {
    accepted: 'active',
    completed: 'completed',
    cancelled: 'cancelled',
  }
  return statusMap[status] || 'pending'
}

/**
 * Get status badge color
 * @param {string} status - Trip status
 * @returns {object} Color configuration
 */
export function getStatusColor(status) {
  const colorMap = {
    accepted: { bg: 'bg-green-100', text: 'text-green-800', badge: 'bg-green-500' },
    completed: { bg: 'bg-blue-100', text: 'text-blue-800', badge: 'bg-blue-500' },
    cancelled: { bg: 'bg-red-100', text: 'text-red-800', badge: 'bg-red-500' },
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', badge: 'bg-yellow-500' },
  }
  return colorMap[status] || colorMap.pending
}

/**
 * Format location object to readable string
 * @param {object} location - Location object {latitude, longitude}
 * @returns {string} Formatted coordinates
 */
export function formatLocation(location) {
  if (!location || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) {
    return 'No location available'
  }
  return `${Number(location.latitude).toFixed(6)}, ${Number(location.longitude).toFixed(6)}`
}

/**
 * Build Google Maps link from location
 * @param {object} location - Location object
 * @returns {string} Google Maps URL
 */
export function buildMapLink(location) {
  if (!location || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) {
    return ''
  }
  return `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`
}

/**
 * Convert location object to [lat, lng] array
 * @param {object} location - Location object
 * @returns {array|null} [latitude, longitude] or null if invalid
 */
export function asLatLng(location) {
  const latitude = Number(location?.latitude)
  const longitude = Number(location?.longitude)

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null
  }

  return [latitude, longitude]
}

/**
 * Calculate distance between two coordinates in meters (Haversine formula)
 * @param {array} first - [latitude, longitude]
 * @param {array} second - [latitude, longitude]
 * @returns {number} Distance in meters
 */
export function distanceInMeters(first, second) {
  if (!Array.isArray(first) || !Array.isArray(second) || first.length < 2 || second.length < 2) {
    return Infinity
  }

  const lat1 = Number(first[0])
  const lon1 = Number(first[1])
  const lat2 = Number(second[0])
  const lon2 = Number(second[1])

  if (![lat1, lon1, lat2, lon2].every((value) => Number.isFinite(value))) {
    return Infinity
  }

  const R = 6371000 // Earth radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)

  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Check if driver has arrived (within radius)
 * @param {array} driverLocation - [lat, lng]
 * @param {array} destinationLocation - [lat, lng]
 * @param {number} radiusMeters - Arrival radius threshold
 * @returns {boolean} True if arrived
 */
export function hasArrived(driverLocation, destinationLocation, radiusMeters = 60) {
  const distance = distanceInMeters(driverLocation, destinationLocation)
  return distance <= radiusMeters
}

/**
 * Play notification sound
 * Uses Web Audio API to create a simple beep
 */
export function playNotificationSound() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.frequency.value = 800
    oscillator.type = 'sine'

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.5)
  } catch (error) {
    // Silently fail if audio context not available
    console.debug('Audio notification failed:', error.message)
  }
}

/**
 * Show browser notification
 * @param {string} title - Notification title
 * @param {object} options - Notification options
 */
export function showBrowserNotification(title, options = {}) {
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        icon: '/manifest.webmanifest',
        badge: '/favicon.ico',
        ...options,
      })
    }
  } catch (error) {
    console.debug('Browser notification failed:', error.message)
  }
}

/**
 * Format currency
 * @param {number} amount - Amount in cents
 * @returns {string} Formatted currency
 */
export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount / 100)
}

/**
 * Calculate trip duration in minutes
 * @param {Date|string} startTime - Start time
 * @param {Date|string} endTime - End time
 * @returns {number} Duration in minutes
 */
export function calculateDuration(startTime, endTime) {
  if (!startTime || !endTime) return 0
  const start = new Date(startTime).getTime()
  const end = new Date(endTime).getTime()
  return Math.round((end - start) / 60000)
}
