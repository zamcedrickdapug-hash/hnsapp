/**
 * Trip Safety Controller
 * 
 * PURPOSE:
 * Handles HTTP requests for real-time trip safety monitoring
 * - GPS event processing
 * - Alert management
 * - Emergency SOS handling
 * - Admin alert endpoints
 */

const TripSafetyService = require('../services/tripSafetyService');
const { ALERT_STATUS, ALERT_SEVERITY } = require('../models/TripSafetyAlert');

class TripSafetyController {
  /**
   * POST /api/trip-safety/gps-event
   * Process GPS event from vehicle tracker
   * Called frequently (every 5-30 seconds)
   */
  static async processGPSEvent(req, res) {
    try {
      const { tripId, driverId, vehicleId, gpsData } = req.body;

      if (!tripId || !driverId || !vehicleId || !gpsData) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: tripId, driverId, vehicleId, gpsData',
        });
      }

      // Process in background (don't wait for completion)
      TripSafetyService.processGPSEvent(tripId, driverId, vehicleId, gpsData).catch((error) => {
        console.error('Error processing GPS event:', error);
      });

      // Return immediately
      res.json({
        success: true,
        message: 'GPS event received and queued for processing',
      });
    } catch (error) {
      console.error('Error in GPS event handler:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * POST /api/trip-safety/speed-violation
   * Report speed violation
   */
  static async reportSpeedViolation(req, res) {
    try {
      const { tripId, driverId, vehicleId, speed, speedLimit } = req.body;

      if (!tripId || !driverId || !vehicleId || !speed || !speedLimit) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields',
        });
      }

      // Get trip
      const TripAssignment = require('../models/TripAssignment');
      const trip = await TripAssignment.findById(tripId);
      if (!trip) {
        return res.status(404).json({
          success: false,
          message: 'Trip not found',
        });
      }

      const alert = await TripSafetyService.checkSpeedViolation(
        tripId,
        driverId,
        vehicleId,
        speed,
        trip
      );

      res.json({
        success: true,
        message: 'Speed violation recorded',
        data: alert,
      });
    } catch (error) {
      console.error('Error reporting speed violation:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * POST /api/trip-safety/route-deviation
   * Report route deviation
   */
  static async reportRouteDeviation(req, res) {
    try {
      const { tripId, driverId, vehicleId, latitude, longitude, deviation } = req.body;

      if (!tripId || !driverId || !vehicleId || !latitude || !longitude || deviation === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields',
        });
      }

      const TripAssignment = require('../models/TripAssignment');
      const trip = await TripAssignment.findById(tripId);
      if (!trip) {
        return res.status(404).json({
          success: false,
          message: 'Trip not found',
        });
      }

      const alert = await TripSafetyService.checkRouteDeviation(
        tripId,
        driverId,
        latitude,
        longitude,
        trip
      );

      res.json({
        success: true,
        message: 'Route deviation recorded',
        data: alert,
      });
    } catch (error) {
      console.error('Error reporting route deviation:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * POST /api/trip-safety/emergency-sos
   * Handle emergency SOS from driver or parent
   * CRITICAL: Immediate admin notification
   */
  static async handleEmergencySOS(req, res) {
    try {
      const { tripId, driverId, vehicleId, emergencyType = 'driver_panic' } = req.body;

      if (!tripId || !driverId || !vehicleId) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: tripId, driverId, vehicleId',
        });
      }

      const alert = await TripSafetyService.handleEmergencySOS(
        tripId,
        driverId,
        vehicleId,
        emergencyType
      );

      res.status(201).json({
        success: true,
        message: 'EMERGENCY SOS - IMMEDIATE ADMIN NOTIFICATION SENT',
        data: alert,
      });
    } catch (error) {
      console.error('Error handling emergency SOS:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * POST /api/trip-safety/geofence-violation
   * Report geofence violation
   */
  static async reportGeofenceViolation(req, res) {
    try {
      const { tripId, driverId, vehicleId, geofenceType, geofenceName, location } = req.body;

      if (!tripId || !driverId || !vehicleId || !geofenceType || !geofenceName) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields',
        });
      }

      const alert = await TripSafetyService.handleGeofenceViolation(
        tripId,
        driverId,
        vehicleId,
        geofenceType,
        geofenceName,
        location
      );

      res.json({
        success: true,
        message: 'Geofence violation recorded',
        data: alert,
      });
    } catch (error) {
      console.error('Error reporting geofence violation:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * GET /api/trip-safety/trip/:tripId/alerts
   * Get active safety alerts for a trip
   */
  static async getTripAlerts(req, res) {
    try {
      const { tripId } = req.params;

      const alerts = await TripSafetyService.getTripActiveAlerts(tripId);

      res.json({
        success: true,
        data: alerts,
        count: alerts.length,
      });
    } catch (error) {
      console.error('Error getting trip alerts:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * GET /api/trip-safety/admin/critical-alerts
   * Admin: Get critical unacknowledged alerts
   */
  static async getCriticalAlerts(req, res) {
    try {
      const alerts = await TripSafetyService.getCriticalUnacknowledgedAlerts();

      res.json({
        success: true,
        data: alerts,
        count: alerts.length,
      });
    } catch (error) {
      console.error('Error getting critical alerts:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * POST /api/trip-safety/alert/:alertId/acknowledge
   * Admin: Acknowledge alert
   */
  static async acknowledgeAlert(req, res) {
    try {
      const { alertId } = req.params;
      const adminId = req.user._id;
      const { notes } = req.body;

      const alert = await TripSafetyService.acknowledgeAlert(alertId, adminId, notes);

      res.json({
        success: true,
        message: 'Alert acknowledged',
        data: alert,
      });
    } catch (error) {
      console.error('Error acknowledging alert:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * POST /api/trip-safety/alert/:alertId/resolve
   * Admin: Resolve alert
   */
  static async resolveAlert(req, res) {
    try {
      const { alertId } = req.params;
      const adminId = req.user._id;
      const { resolutionNotes } = req.body;

      const alert = await TripSafetyService.resolveAlert(alertId, adminId, resolutionNotes);

      res.json({
        success: true,
        message: 'Alert resolved',
        data: alert,
      });
    } catch (error) {
      console.error('Error resolving alert:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * GET /api/trip-safety/admin/summary
   * Admin: Get safety alerts summary for dashboard
   */
  static async getSafetyAlertsSummary(req, res) {
    try {
      const summary = await TripSafetyService.getSafetyAlertsSummary();

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      console.error('Error getting safety alerts summary:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

module.exports = TripSafetyController;
