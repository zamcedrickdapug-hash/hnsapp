/**
 * Trip Safety Routes
 * 
 * Real-time trip safety monitoring endpoints
 * - GPS event processing
 * - Alert management
 * - Emergency SOS handling
 * - Admin alert endpoints
 */

const express = require('express');
const router = express.Router();
const TripSafetyController = require('../controllers/tripSafetyController');
const { requireAdmin, requireDriver, requireAuth } = require('../middleware/auth');

/**
 * GPS EVENT PROCESSING
 * Called frequently from mobile apps and vehicle trackers
 */

// Process GPS event (real-time tracking)
router.post('/gps-event', requireAuth, TripSafetyController.processGPSEvent);

/**
 * SAFETY ALERT REPORTING
 */

// Report speed violation
router.post('/speed-violation', requireDriver, TripSafetyController.reportSpeedViolation);

// Report route deviation
router.post('/route-deviation', requireDriver, TripSafetyController.reportRouteDeviation);

// Report geofence violation
router.post('/geofence-violation', requireDriver, TripSafetyController.reportGeofenceViolation);

// Emergency SOS (CRITICAL)
router.post('/emergency-sos', requireAuth, TripSafetyController.handleEmergencySOS);

/**
 * PUBLIC ENDPOINTS (authenticated)
 */

// Get active alerts for a trip
router.get('/trip/:tripId/alerts', requireAuth, TripSafetyController.getTripAlerts);

/**
 * ADMIN ENDPOINTS
 * All require admin role
 */

// Get critical unacknowledged alerts
router.get('/admin/critical-alerts', requireAdmin, TripSafetyController.getCriticalAlerts);

// Get safety alerts summary
router.get('/admin/summary', requireAdmin, TripSafetyController.getSafetyAlertsSummary);

// Acknowledge alert
router.post('/alert/:alertId/acknowledge', requireAdmin, TripSafetyController.acknowledgeAlert);

// Resolve alert
router.post('/alert/:alertId/resolve', requireAdmin, TripSafetyController.resolveAlert);

module.exports = router;
