/**
 * Trip Assignment Model
 * Manages transportation trips with route feasibility, optimization, and safety tracking
 * 
 * PURPOSE:
 * - Track complete trip lifecycle from booking to completion
 * - Store route data and pickup sequences
 * - Monitor trip status and safety events
 * - Calculate feasibility and efficiency metrics
 * 
 * TRANSPORTATION LOGIC:
 * - Validates route feasibility (distance, time, radius constraints)
 * - Maintains optimized pickup sequence for efficiency
 * - Tracks estimated arrival times and actual performance
 * - Records all safety events and status transitions
 * 
 * SAFETY IMPACT:
 * - Requires parent approval before trip starts
 * - Tracks QR-based pickup verification
 * - Records all safety events and incidents
 * - Enables emergency SOS responses
 * - Monitors speed and driver behavior
 * 
 * SCALABILITY:
 * - Indexed by trip status for quick filtering
 * - Supports bulk trip queries by school/driver/date
 * - Historical archival for analytics and auditing
 */

const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema(
  {
    latitude: {
      type: Number,
      min: -90,
      max: 90,
      required: true,
    },
    longitude: {
      type: Number,
      min: -180,
      max: 180,
      required: true,
    },
    address: {
      type: String,
      trim: true,
    },
    accuracy: Number,
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const pickupPointSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    studentName: {
      type: String,
      trim: true,
      required: true,
    },
    pickupLocation: {
      type: locationSchema,
      required: true,
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    emergencyContact: {
      phone: String,
      name: String,
    },
    sequence: {
      type: Number,
      required: true,
    },
    estimatedArrivalTime: Date,
    actualPickupTime: Date,
    qrVerificationCode: {
      type: String,
      trim: true,
      sparse: true,
    },
    qrVerifiedAt: {
      type: Date,
      default: null,
    },
    pickupStatus: {
      type: String,
      enum: ['pending', 'confirmed_by_parent', 'arrived', 'picked_up', 'no_show', 'rescheduled'],
      default: 'pending',
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const routeMetricsSchema = new mongoose.Schema(
  {
    totalDistance: {
      type: Number, // in kilometers
      default: 0,
    },
    estimatedDuration: {
      type: Number, // in minutes
      default: 0,
    },
    actualDuration: {
      type: Number, // in minutes
      default: null,
    },
    averageSpeed: {
      type: Number, // in km/h
      default: 0,
    },
    maxSpeed: {
      type: Number, // in km/h
      default: 0,
    },
    distanceToSchool: {
      type: Number, // in kilometers
      default: 0,
    },
    estimatedSchoolArrivalTime: Date,
    actualSchoolArrivalTime: Date,
  },
  { _id: false }
);

const safetyEventSchema = new mongoose.Schema(
  {
    timestamp: {
      type: Date,
      default: Date.now,
    },
    eventType: {
      type: String,
      enum: [
        'speed_alert',
        'harsh_braking',
        'harsh_acceleration',
        'sharp_turn',
        'sos_activated',
        'emergency_contact_called',
        'route_deviation',
        'delay_alert',
        'driver_distracted',
        'other',
      ],
      required: true,
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'low',
    },
    description: {
      type: String,
      trim: true,
    },
    location: locationSchema,
    actionTaken: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const tripAssignmentSchema = new mongoose.Schema(
  {
    // Trip identification
    tripNumber: {
      type: String,
      unique: true,
      index: true,
      required: true,
    },
    
    // Trip participants
    operatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
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
      required: true,
      index: true,
    },
    
    // Trip scope
    schoolId: {
      type: String,
      trim: true,
      index: true,
    },
    
    schoolName: {
      type: String,
      trim: true,
      required: true,
    },
    
    schoolLocation: locationSchema,
    
    tripType: {
      type: String,
      enum: ['pickup', 'dropoff', 'round_trip', 'custom'],
      default: 'pickup',
    },
    
    // Route and optimization
    pickupPoints: [pickupPointSchema],
    
    optimizedSequence: [Number], // Indices of optimized pickup order
    
    routeMetrics: {
      type: routeMetricsSchema,
      default: () => ({}),
    },
    
    // Feasibility validation
    isFeasible: {
      type: Boolean,
      default: false,
    },
    
    feasibilityReasons: [
      {
        type: String,
        enum: [
          'acceptable_distance',
          'acceptable_time',
          'vehicle_capacity_ok',
          'route_clustered_well',
          'driver_available',
          'route_exceeds_max_radius',
          'route_exceeds_max_delay',
          'vehicle_capacity_exceeded',
          'driver_unavailable',
          'insufficient_route_clustering',
        ],
      },
    ],
    
    // Safety checks
    parentApprovalRequired: {
      type: Boolean,
      default: true,
    },
    
    parentApprovedAt: {
      type: Date,
      default: null,
    },
    
    parentApprovalExpiry: {
      type: Date,
      default: null,
    },
    
    safetyChecksPassed: {
      type: Boolean,
      default: false,
    },
    
    safetyEvents: [safetyEventSchema],
    
    // Trip status
    status: {
      type: String,
      enum: [
        'pending_approval', // Waiting for parent approval
        'approved', // Parent approved
        'searching', // Searching for driver (legacy - not used in new system)
        'assigned', // Driver assigned
        'confirmed', // Driver confirmed
        'in_progress', // Trip started
        'in_transit_to_school', // Driving to school
        'arrived_at_school', // Arrived at destination
        'completed', // Trip completed
        'cancelled', // Trip cancelled
        'failed', // Trip failed
      ],
      default: 'pending_approval',
      index: true,
    },
    
    statusHistory: [
      {
        status: String,
        timestamp: {
          type: Date,
          default: Date.now,
        },
        reason: String,
      },
    ],
    
    // Trip timeline
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    
    assignedAt: {
      type: Date,
      default: null,
    },
    
    confirmedAt: {
      type: Date,
      default: null,
    },
    
    startedAt: {
      type: Date,
      default: null,
    },
    
    completedAt: {
      type: Date,
      default: null,
    },
    
    cancelledAt: {
      type: Date,
      default: null,
    },
    
    cancellationReason: {
      type: String,
      trim: true,
      default: null,
    },
    
    // GPS tracking
    gpsTrackingActive: {
      type: Boolean,
      default: false,
    },
    
    locationUpdates: [
      {
        latitude: Number,
        longitude: Number,
        speed: Number,
        heading: Number,
        accuracy: Number,
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    
    // Real-time status
    driverCurrentLocation: locationSchema,
    
    lastLocationUpdateAt: {
      type: Date,
      default: null,
    },
    
    // SOS and emergency
    sosActivatedAt: {
      type: Date,
      default: null,
    },
    
    emergencyContactsNotified: [
      {
        parentId: mongoose.Schema.Types.ObjectId,
        notifiedAt: Date,
        contactMethod: String,
      },
    ],
    
    // Quality metrics
    parentRating: {
      type: Number,
      min: 1,
      max: 5,
      default: null,
    },
    
    parentFeedback: {
      type: String,
      trim: true,
      default: null,
    },
    
    driverPerformanceScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    
    // Notes and documentation
    notes: {
      type: String,
      trim: true,
    },
    
    internalNotes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    indexes: [
      { operatorId: 1, createdAt: -1 },
      { driverId: 1, status: 1 },
      { vehicleId: 1, status: 1 },
      { schoolId: 1, startedAt: 1 },
      { status: 1, startedAt: -1 },
      { tripNumber: 1 },
      { 'pickupPoints.parentId': 1 },
      { 'driverCurrentLocation.coordinates': '2dsphere' },
    ],
  }
);

// Update status history on status change
tripAssignmentSchema.pre('save', function (next) {
  if (this.isModified('status') && this.status) {
    if (!this.statusHistory) {
      this.statusHistory = [];
    }
    
    const lastStatus = this.statusHistory[this.statusHistory.length - 1];
    if (!lastStatus || lastStatus.status !== this.status) {
      this.statusHistory.push({
        status: this.status,
        timestamp: new Date(),
      });
    }
  }
  next();
});

// Methods for trip management
tripAssignmentSchema.methods.canAcceptMoreStudents = function (count = 1) {
  const currentStudents = this.pickupPoints.length;
  const vehicle = this.vehicleId; // In real usage, populate this first
  return currentStudents + count <= 50; // Default limit, should validate against vehicle
};

tripAssignmentSchema.methods.updateStatus = function (newStatus, reason = '') {
  this.status = newStatus;
  this.statusHistory.push({
    status: newStatus,
    timestamp: new Date(),
    reason,
  });
  return this;
};

tripAssignmentSchema.methods.activateSOS = function () {
  this.sosActivatedAt = new Date();
  this.safetyEvents.push({
    eventType: 'sos_activated',
    severity: 'critical',
    timestamp: new Date(),
  });
  return this;
};

tripAssignmentSchema.methods.recordSafetyEvent = function (eventType, severity, description, location) {
  this.safetyEvents.push({
    eventType,
    severity,
    description,
    location,
    timestamp: new Date(),
  });
  return this;
};

const TripAssignment = mongoose.model('TripAssignment', tripAssignmentSchema);

module.exports = TripAssignment;
