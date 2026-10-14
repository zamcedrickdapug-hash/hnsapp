/**
 * Trip Safety Alert Model
 * 
 * PURPOSE:
 * Real-time monitoring of trip safety events including:
 * - Speed violations
 * - Route deviations
 * - Geofence violations
 * - Emergency SOS alerts
 * 
 * BUSINESS LOGIC:
 * - Automatic alert generation from GPS events
 * - Severity-based escalation
 * - Admin notification for critical alerts
 * - Parent notification for certain events
 * - Alert history for analytics
 * 
 * REAL-WORLD APPLICATION:
 * Similar to Grab/Uber safety alerts where unusual driver behavior triggers notifications.
 * Critical for child safety - enables rapid response to dangerous situations.
 * 
 * SCALABILITY:
 * - High-volume writes (multiple alerts per trip)
 * - Indexed by trip and severity for quick retrieval
 * - TTL index for automatic cleanup of old alerts
 * - Ready for time-series database if needed
 */

const mongoose = require('mongoose');

/**
 * Alert Types
 */
const ALERT_TYPES = {
  SPEED_VIOLATION: 'speed_violation', // Driver exceeding speed limit
  ROUTE_DEVIATION: 'route_deviation', // Left planned route by > X km
  GEOFENCE_VIOLATION: 'geofence_violation', // Left pickup/school zone unexpectedly
  HARSH_BRAKING: 'harsh_braking', // Sudden deceleration detected
  HARSH_ACCELERATION: 'harsh_acceleration', // Rapid acceleration
  SHARP_TURN: 'sharp_turn', // Excessive cornering
  EXTENDED_IDLING: 'extended_idling', // Vehicle idling > 5 minutes
  ENGINE_OFF: 'engine_off', // Engine turned off during trip
  GPS_SIGNAL_LOST: 'gps_signal_lost', // Loss of GPS signal
  EMERGENCY_SOS: 'emergency_sos', // Driver panic button pressed
  PARENT_PANIC: 'parent_panic', // Parent triggered emergency
  VEHICLE_MALFUNCTION: 'vehicle_malfunction', // Vehicle issues detected
};

/**
 * Alert Severity
 */
const ALERT_SEVERITY = {
  INFO: 'info', // Informational only
  WARNING: 'warning', // Needs attention
  URGENT: 'urgent', // Immediate action required
  CRITICAL: 'critical', // Safety emergency
};

/**
 * Alert Status
 */
const ALERT_STATUS = {
  ACTIVE: 'active', // Alert is ongoing
  RESOLVED: 'resolved', // Alert resolved
  ACKNOWLEDGED: 'acknowledged', // Admin acknowledged
  FALSE_ALARM: 'false_alarm', // Dismissed
};

const tripSafetyAlertSchema = new mongoose.Schema(
  {
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TripAssignment',
      required: true,
      index: true,
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
    },
    // Alert Details
    alertType: {
      type: String,
      enum: Object.values(ALERT_TYPES),
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: Object.values(ALERT_SEVERITY),
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(ALERT_STATUS),
      default: ALERT_STATUS.ACTIVE,
    },
    // Alert Metrics (varies by type)
    metrics: {
      speed: {
        current: Number,
        limit: Number,
        excess: Number, // How much over limit
      },
      location: {
        latitude: Number,
        longitude: Number,
        timestamp: Date,
      },
      routeDeviation: {
        plannedLocation: {
          latitude: Number,
          longitude: Number,
        },
        actualLocation: {
          latitude: Number,
          longitude: Number,
        },
        deviationKm: Number,
      },
      geofence: {
        geofenceType: String, // 'pickup', 'school', 'route'
        geofenceName: String,
        timeOutside: Number, // seconds
      },
      acceleration: {
        gForce: Number,
        threshold: Number,
      },
      idlingDuration: Number, // seconds
    },
    // Description
    title: String,
    description: String,
    recommendedAction: String,
    // Evidence
    gpsSnapshot: {
      latitude: Number,
      longitude: Number,
      accuracy: Number,
      heading: Number,
      altitude: Number,
    },
    dashcamUrl: String, // If available
    // Notifications
    adminNotified: {
      type: Boolean,
      default: false,
    },
    adminNotifiedAt: Date,
    parentNotified: {
      type: Boolean,
      default: false,
    },
    parentNotifiedAt: Date,
    driverNotified: {
      type: Boolean,
      default: false,
    },
    driverNotifiedAt: Date,
    // Response
    adminAcknowledgedAt: Date,
    acknowledgedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    adminNotes: String,
    resolvedAt: Date,
    resolutionNotes: String,
    // Escalation
    escalated: {
      type: Boolean,
      default: false,
    },
    escalatedTo: String, // e.g., 'law_enforcement', 'school'
    escalationReason: String,
    // Related Incident Report
    incidentReportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'IncidentReport',
    },
    // Soft delete
    deletedAt: Date,
  },
  { timestamps: true }
);

// TTL Index: Auto-delete info alerts after 30 days (if resolved)
tripSafetyAlertSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: 30 * 24 * 60 * 60,
    partialFilterExpression: { severity: 'info', status: 'resolved' },
  }
);

// Performance Indexes
tripSafetyAlertSchema.index({ tripId: 1, alertType: 1 });
tripSafetyAlertSchema.index({ driverId: 1, severity: 1, createdAt: -1 });
tripSafetyAlertSchema.index({ status: 'active', severity: 1 });
tripSafetyAlertSchema.index({ adminNotified: false, severity: { $in: ['urgent', 'critical'] } });
tripSafetyAlertSchema.index({ deletedAt: 1 });

// Virtuals
tripSafetyAlertSchema.virtual('minutesSinceAlert').get(function () {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60));
});

tripSafetyAlertSchema.virtual('isUnresolved').get(function () {
  return this.status === ALERT_STATUS.ACTIVE || this.status === ALERT_STATUS.ACKNOWLEDGED;
});

tripSafetyAlertSchema.virtual('requiresImmediateAction').get(function () {
  return this.severity === ALERT_SEVERITY.CRITICAL && !this.adminAcknowledgedAt;
});

tripSafetyAlertSchema.set('toJSON', { virtuals: true });
tripSafetyAlertSchema.set('toObject', { virtuals: true });

// Middleware: Auto-notify admin on critical alerts
tripSafetyAlertSchema.post('save', async function (doc) {
  if (doc.severity === ALERT_SEVERITY.CRITICAL && !doc.adminNotified) {
    try {
      // Trigger immediate admin notification (via Socket.IO or push)
      const { getIo } = require('../socket');
      const io = getIo();
      io.to('admin_room').emit('critical_safety_alert', {
        alertId: doc._id,
        tripId: doc.tripId,
        driverId: doc.driverId,
        alertType: doc.alertType,
        severity: doc.severity,
        title: doc.title,
        createdAt: doc.createdAt,
      });

      // Update notification status
      doc.adminNotified = true;
      doc.adminNotifiedAt = new Date();
      await doc.save();
    } catch (error) {
      console.error('Error sending admin notification:', error);
    }
  }
});

const TripSafetyAlert = mongoose.model('TripSafetyAlert', tripSafetyAlertSchema);

module.exports = {
  TripSafetyAlert,
  ALERT_TYPES,
  ALERT_SEVERITY,
  ALERT_STATUS,
};
