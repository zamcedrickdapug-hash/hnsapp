/**
 * Trip Safety Service
 * 
 * PURPOSE:
 * Real-time trip safety monitoring including:
 * - Speed violation detection
 * - Route deviation detection
 * - Geofence violation detection
 * - Emergency SOS handling
 * - Automatic admin alerts for critical events
 * 
 * ARCHITECTURE:
 * Real-time GPS event processing
 * Scalability: High-frequency writes optimized with batch operations
 * 
 * REAL-WORLD: Triggers automatically from GPS events in real-time
 * Similar to Grab/Uber driver monitoring systems
 */

const { TripSafetyAlert, ALERT_TYPES, ALERT_SEVERITY, ALERT_STATUS } = require('../models/TripSafetyAlert');
const TripAssignment = require('../models/TripAssignment');
const { getIo } = require('../socket');

/**
 * Trip Safety Configuration
 * These should be moved to a config file or database
 */
const SAFETY_CONFIG = {
  SPEED_LIMITS: {
    residential: 30, // km/h
    arterial: 50,
    highway: 80,
  },
  DEVIATION_THRESHOLD_KM: 2.0, // Alert if > 2km off route
  IDLING_TIMEOUT_MINUTES: 5,
  GPS_SIGNAL_TIMEOUT_SECONDS: 30,
};

class TripSafetyService {
  /**
   * Process GPS event from driver vehicle
   * Called every few seconds from GPS tracking system
   */
  static async processGPSEvent(tripId, driverId, vehicleId, gpsData) {
    try {
      const { latitude, longitude, speed, heading, accuracy, timestamp } = gpsData;

      // Get trip details
      const trip = await TripAssignment.findById(tripId).populate('pickupPoints schoolLocation');
      if (!trip) return;

      // Check for speed violations
      if (speed) {
        await this.checkSpeedViolation(tripId, driverId, vehicleId, speed, trip);
      }

      // Check for route deviations
      if (latitude && longitude) {
        await this.checkRouteDeviation(tripId, driverId, latitude, longitude, trip);
      }
    } catch (error) {
      console.error('Error processing GPS event:', error);
    }
  }

  /**
   * Detect speed violations
   */
  static async checkSpeedViolation(tripId, driverId, vehicleId, speed, trip) {
    try {
      // Determine applicable speed limit based on time/location
      const speedLimit = SAFETY_CONFIG.SPEED_LIMITS.residential; // Default to residential
      const excess = speed - speedLimit;

      // Only alert if significantly over limit (buffer for sensor inaccuracy)
      if (excess > 5) {
        // Check if we already have an active speed violation alert
        const existingAlert = await TripSafetyAlert.findOne({
          tripId,
          alertType: ALERT_TYPES.SPEED_VIOLATION,
          status: ALERT_STATUS.ACTIVE,
          createdAt: { $gt: new Date(Date.now() - 5 * 60 * 1000) }, // Last 5 minutes
        });

        if (!existingAlert) {
          await this.createAlert({
            tripId,
            driverId,
            vehicleId,
            alertType: ALERT_TYPES.SPEED_VIOLATION,
            severity: excess > 15 ? ALERT_SEVERITY.URGENT : ALERT_SEVERITY.WARNING,
            title: `Speed Violation: ${speed} km/h (Limit: ${speedLimit} km/h)`,
            description: `Driver exceeded speed limit by ${Math.round(excess)} km/h`,
            metrics: {
              speed: {
                current: speed,
                limit: speedLimit,
                excess: Math.round(excess),
              },
            },
            recommendedAction: 'Monitor driver behavior. If excessive, contact driver to slow down.',
          });
        }
      }
    } catch (error) {
      console.error('Error checking speed violation:', error);
    }
  }

  /**
   * Detect route deviations
   */
  static async checkRouteDeviation(tripId, driverId, latitude, longitude, trip) {
    try {
      if (!trip.routePath || trip.routePath.length === 0) return;

      // Find closest point on planned route
      const closestDistance = this.distanceToRoute(
        { latitude, longitude },
        trip.routePath
      );

      if (closestDistance > SAFETY_CONFIG.DEVIATION_THRESHOLD_KM) {
        // Check if we already have active deviation alert
        const existingAlert = await TripSafetyAlert.findOne({
          tripId,
          alertType: ALERT_TYPES.ROUTE_DEVIATION,
          status: ALERT_STATUS.ACTIVE,
        });

        if (!existingAlert) {
          await this.createAlert({
            tripId,
            driverId,
            vehicleId: trip.vehicleId,
            alertType: ALERT_TYPES.ROUTE_DEVIATION,
            severity: closestDistance > 5 ? ALERT_SEVERITY.URGENT : ALERT_SEVERITY.WARNING,
            title: `Route Deviation: ${closestDistance.toFixed(1)} km off route`,
            description: `Driver has deviated ${closestDistance.toFixed(1)} km from planned route`,
            metrics: {
              location: {
                latitude,
                longitude,
                timestamp: new Date(),
              },
              routeDeviation: {
                plannedLocation: trip.routePath[0],
                actualLocation: { latitude, longitude },
                deviationKm: closestDistance,
              },
            },
            recommendedAction: 'Verify driver intention. Contact if necessary to ensure correct route.',
          });
        }
      }
    } catch (error) {
      console.error('Error checking route deviation:', error);
    }
  }

  /**
   * Handle emergency SOS from driver or parent
   */
  static async handleEmergencySOS(tripId, driverId, vehicleId, emergencyType = 'driver_panic') {
    try {
      const alert = await this.createAlert({
        tripId,
        driverId,
        vehicleId,
        alertType: ALERT_TYPES.EMERGENCY_SOS,
        severity: ALERT_SEVERITY.CRITICAL,
        title: 'EMERGENCY SOS ACTIVATED',
        description: `Emergency signal triggered - ${emergencyType}`,
        recommendedAction: 'IMMEDIATE ACTION REQUIRED. Contact driver and dispatch emergency services if needed.',
      });

      // Immediately notify all admins
      const io = getIo();
      io.to('admin_room').emit('emergency_sos', {
        alertId: alert._id,
        tripId,
        driverId,
        timestamp: new Date(),
        severity: ALERT_SEVERITY.CRITICAL,
      });

      return alert;
    } catch (error) {
      console.error('Error handling emergency SOS:', error);
      throw error;
    }
  }

  /**
   * Handle geofence violation (left pickup/school zone unexpectedly)
   */
  static async handleGeofenceViolation(tripId, driverId, vehicleId, geofenceType, geofenceName, location) {
    try {
      const alert = await this.createAlert({
        tripId,
        driverId,
        vehicleId,
        alertType: ALERT_TYPES.GEOFENCE_VIOLATION,
        severity: ALERT_SEVERITY.URGENT,
        title: `Geofence Violation: Left ${geofenceName}`,
        description: `Vehicle exited ${geofenceType} zone: ${geofenceName}`,
        metrics: {
          geofence: {
            geofenceType,
            geofenceName,
          },
          location,
        },
        recommendedAction: 'Verify driver has valid reason to leave zone. Check trip status.',
      });

      return alert;
    } catch (error) {
      console.error('Error handling geofence violation:', error);
      throw error;
    }
  }

  /**
   * Detect harsh braking (sudden deceleration)
   */
  static async detectHarshBraking(tripId, driverId, vehicleId, gForce) {
    try {
      if (gForce > 0.5) {
        // Threshold for harsh braking
        const alert = await this.createAlert({
          tripId,
          driverId,
          vehicleId,
          alertType: ALERT_TYPES.HARSH_BRAKING,
          severity: gForce > 0.7 ? ALERT_SEVERITY.WARNING : ALERT_SEVERITY.INFO,
          title: `Harsh Braking Detected: ${gForce.toFixed(2)}G`,
          description: `Sudden deceleration detected - potential safety concern`,
          metrics: {
            acceleration: {
              gForce,
              threshold: 0.5,
            },
          },
        });

        return alert;
      }
    } catch (error) {
      console.error('Error detecting harsh braking:', error);
    }
  }

  /**
   * Detect extended idling (engine running, no movement)
   */
  static async detectExtendedIdling(tripId, driverId, vehicleId, idlingDurationSeconds) {
    try {
      if (idlingDurationSeconds > SAFETY_CONFIG.IDLING_TIMEOUT_MINUTES * 60) {
        const alert = await this.createAlert({
          tripId,
          driverId,
          vehicleId,
          alertType: ALERT_TYPES.EXTENDED_IDLING,
          severity: ALERT_SEVERITY.INFO,
          title: `Extended Idling: ${Math.floor(idlingDurationSeconds / 60)} minutes`,
          description: `Vehicle has been idle for extended period`,
          metrics: {
            idlingDuration: idlingDurationSeconds,
          },
          recommendedAction: 'Check if driver is waiting for pickup/dropoff. Monitor fuel consumption.',
        });

        return alert;
      }
    } catch (error) {
      console.error('Error detecting extended idling:', error);
    }
  }

  /**
   * Get active alerts for trip
   */
  static async getTripActiveAlerts(tripId) {
    try {
      const alerts = await TripSafetyAlert.find({
        tripId,
        status: ALERT_STATUS.ACTIVE,
      }).sort({ createdAt: -1 });

      return alerts;
    } catch (error) {
      console.error('Error getting trip alerts:', error);
      throw error;
    }
  }

  /**
   * Get critical unacknowledged alerts for admin dashboard
   */
  static async getCriticalUnacknowledgedAlerts() {
    try {
      const alerts = await TripSafetyAlert.find({
        severity: ALERT_SEVERITY.CRITICAL,
        status: ALERT_STATUS.ACTIVE,
        adminAcknowledgedAt: null,
      })
        .populate('driverId', 'name phone')
        .populate('tripId', 'pickupPoints schoolLocation')
        .sort({ createdAt: -1 })
        .limit(100);

      return alerts;
    } catch (error) {
      console.error('Error getting critical alerts:', error);
      throw error;
    }
  }

  /**
   * Acknowledge alert (admin action)
   */
  static async acknowledgeAlert(alertId, adminId, notes = null) {
    try {
      const alert = await TripSafetyAlert.findByIdAndUpdate(
        alertId,
        {
          status: ALERT_STATUS.ACKNOWLEDGED,
          adminAcknowledgedAt: new Date(),
          acknowledgedBy: adminId,
          adminNotes: notes,
        },
        { returnDocument: 'after' }
      );

      return alert;
    } catch (error) {
      console.error('Error acknowledging alert:', error);
      throw error;
    }
  }

  /**
   * Resolve alert (admin action)
   */
  static async resolveAlert(alertId, adminId, resolutionNotes = null) {
    try {
      const alert = await TripSafetyAlert.findByIdAndUpdate(
        alertId,
        {
          status: ALERT_STATUS.RESOLVED,
          resolvedAt: new Date(),
          resolutionNotes,
        },
        { returnDocument: 'after' }
      );

      return alert;
    } catch (error) {
      console.error('Error resolving alert:', error);
      throw error;
    }
  }

  /**
   * Get safety alerts summary for dashboard
   */
  static async getSafetyAlertsSummary() {
    try {
      const stats = await TripSafetyAlert.aggregate([
        {
          $facet: {
            bySeverity: [
              {
                $match: { status: ALERT_STATUS.ACTIVE },
              },
              {
                $group: {
                  _id: '$severity',
                  count: { $sum: 1 },
                },
              },
            ],
            byType: [
              {
                $match: { createdAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
              },
              {
                $group: {
                  _id: '$alertType',
                  count: { $sum: 1 },
                },
              },
            ],
            total: [
              {
                $match: { status: ALERT_STATUS.ACTIVE },
              },
              {
                $count: 'count',
              },
            ],
          },
        },
      ]);

      return {
        bySeverity: stats[0].bySeverity,
        byType: stats[0].byType,
        totalActive: stats[0].total[0]?.count || 0,
      };
    } catch (error) {
      console.error('Error getting safety alerts summary:', error);
      throw error;
    }
  }

  // ========== HELPER METHODS ==========

  static async createAlert(alertData) {
    try {
      const alert = new TripSafetyAlert({
        ...alertData,
        status: ALERT_STATUS.ACTIVE,
      });

      await alert.save();

      // Broadcast to admins if critical
      if (alertData.severity === ALERT_SEVERITY.CRITICAL) {
        const io = getIo();
        io.to('admin_room').emit('critical_safety_alert', {
          alertId: alert._id,
          tripId: alert.tripId,
          driverId: alert.driverId,
          severity: alert.severity,
          title: alert.title,
        });
      }

      return alert;
    } catch (error) {
      console.error('Error creating alert:', error);
      throw error;
    }
  }

  /**
   * Calculate minimum distance from point to line (route)
   * Uses point-to-line distance formula
   */
  static distanceToRoute(point, routePath) {
    if (!routePath || routePath.length === 0) return 0;

    let minDistance = Infinity;

    for (let i = 0; i < routePath.length - 1; i++) {
      const p1 = routePath[i];
      const p2 = routePath[i + 1];

      const distance = this.pointToLineDistance(point, p1, p2);
      minDistance = Math.min(minDistance, distance);
    }

    return minDistance;
  }

  /**
   * Calculate distance from point to line segment
   * Using Haversine formula for lat/lng coordinates
   */
  static pointToLineDistance(point, lineStart, lineEnd) {
    // Simplified: just use distance to nearest endpoint
    const dist1 = this.haversineDistance(point, lineStart);
    const dist2 = this.haversineDistance(point, lineEnd);
    return Math.min(dist1, dist2);
  }

  /**
   * Haversine formula: calculate distance between two lat/lng coordinates
   * Returns distance in kilometers
   */
  static haversineDistance(point1, point2) {
    const R = 6371; // Earth radius in km

    const lat1 = (point1.latitude * Math.PI) / 180;
    const lat2 = (point2.latitude * Math.PI) / 180;
    const deltaLat = ((point2.latitude - point1.latitude) * Math.PI) / 180;
    const deltaLng = ((point2.longitude - point1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}

module.exports = TripSafetyService;
