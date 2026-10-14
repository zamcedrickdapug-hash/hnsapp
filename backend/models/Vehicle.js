/**
 * Vehicle Model
 * Manages different vehicle types for transportation operations
 * Supports: Sedan (3 seats), MPV (5 seats), Van (10-15 seats), Mini Bus (20+ seats)
 * 
 * PURPOSE:
 * - Define vehicle capacity and type constraints
 * - Track vehicle availability and maintenance status
 * - Manage seat allocation and prevent overbooking
 * - Link vehicles to drivers for assignment operations
 * 
 * SAFETY IMPACT:
 * - Enforces maximum capacity to ensure safe travel
 * - Tracks vehicle maintenance for safety compliance
 * - Prevents unsafe assignments
 * 
 * SCALABILITY:
 * - Indexed by operator and status for quick queries
 * - Supports fleet-wide vehicle management
 * - Can handle thousands of vehicles across multiple operators
 */

const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema(
  {
    // Vehicle identification
    plateNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
      index: true,
    },
    
    // Vehicle classification
    vehicleType: {
      type: String,
      enum: ['sedan', 'mpv', 'van', 'minibus'],
      required: true,
      index: true,
    },
    
    // Capacity constraints
    seatCapacity: {
      type: Number,
      required: true,
      min: 3,
      max: 50,
    },
    
    // Current occupancy
    currentPassengers: {
      type: Number,
      default: 0,
      min: 0,
    },
    
    // Vehicle identification and registration
    vin: {
      type: String,
      trim: true,
      sparse: true,
    },
    
    manufacturer: {
      type: String,
      trim: true,
    },
    
    model: {
      type: String,
      trim: true,
    },
    
    yearManufactured: {
      type: Number,
      min: 2000,
      max: new Date().getFullYear(),
    },
    
    color: {
      type: String,
      trim: true,
    },
    
    // Operator information
    operatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    
    // Currently assigned driver
    assignedDriver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      sparse: true,
    },
    
    // Vehicle status management
    status: {
      type: String,
      enum: ['available', 'assigned', 'maintenance', 'inactive', 'offline'],
      default: 'available',
      index: true,
    },
    
    // Availability tracking
    isAvailable: {
      type: Boolean,
      default: true,
      index: true,
    },
    
    // Current location
    currentLocation: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        sparse: true,
      },
      address: {
        type: String,
        trim: true,
      },
      updatedAt: {
        type: Date,
        default: Date.now,
      },
    },
    
    // Fuel/battery management
    fuelLevel: {
      type: Number,
      min: 0,
      max: 100,
      default: 100,
    },
    
    fuelType: {
      type: String,
      enum: ['gasoline', 'diesel', 'hybrid', 'electric'],
      default: 'gasoline',
    },
    
    // Maintenance tracking
    lastMaintenanceDate: {
      type: Date,
      default: null,
    },
    
    nextMaintenanceDate: {
      type: Date,
      default: null,
    },
    
    maintenanceHistory: [
      {
        date: {
          type: Date,
          default: Date.now,
        },
        type: {
          type: String,
          enum: ['preventive', 'repair', 'inspection', 'other'],
        },
        description: {
          type: String,
          trim: true,
        },
        cost: Number,
      },
    ],
    
    // Safety and compliance
    licenseExpiry: {
      type: Date,
      required: true,
    },
    
    insurancePolicyNumber: {
      type: String,
      trim: true,
    },
    
    insuranceExpiry: {
      type: Date,
    },
    
    lastInspectionDate: {
      type: Date,
    },
    
    nextInspectionDate: {
      type: Date,
    },
    
    // Equipment
    hasGPSTracker: {
      type: Boolean,
      default: true,
    },
    
    gpsDeviceId: {
      type: String,
      trim: true,
      sparse: true,
    },
    
    hasSOS: {
      type: Boolean,
      default: true,
    },
    
    hasChildSeatBelts: {
      type: Boolean,
      default: true,
    },
    
    hasFirstAidKit: {
      type: Boolean,
      default: true,
    },
    
    hasExtinguisher: {
      type: Boolean,
      default: true,
    },
    
    // Operational constraints
    maxTravelRadius: {
      type: Number, // in kilometers
      default: 50,
    },
    
    maxEstimatedDelay: {
      type: Number, // in minutes
      default: 15,
    },
    
    // Active trips
    activeTrips: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TripAssignment',
      },
    ],
    
    // Statistics
    totalTripsCompleted: {
      type: Number,
      default: 0,
    },
    
    totalDistanceTraveled: {
      type: Number, // in kilometers
      default: 0,
    },
    
    averageRating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },
    
    // Operational hours
    operatingHours: {
      startTime: {
        type: String, // HH:MM format
        default: '06:00',
      },
      endTime: {
        type: String, // HH:MM format
        default: '18:00',
      },
    },
    
    // Contact and emergency
    emergencyContact: {
      name: String,
      phone: String,
    },
  },
  {
    timestamps: true,
    indexes: [
      { operatorId: 1, status: 1 },
      { plateNumber: 1 },
      { assignedDriver: 1 },
      { 'currentLocation.coordinates': '2dsphere' }, // Geospatial index for location queries
    ],
  }
);

// Calculate available seats
vehicleSchema.virtual('availableSeats').get(function () {
  return this.seatCapacity - this.currentPassengers;
});

// Check if vehicle can accept more passengers
vehicleSchema.methods.canAcceptPassengers = function (count = 1) {
  return this.availableSeats >= count && this.isAvailable;
};

// Update passenger count
vehicleSchema.methods.addPassengers = function (count) {
  if (!this.canAcceptPassengers(count)) {
    throw new Error(`Vehicle does not have capacity for ${count} passengers`);
  }
  this.currentPassengers += count;
  return this.currentPassengers;
};

// Remove passengers
vehicleSchema.methods.removePassengers = function (count) {
  this.currentPassengers = Math.max(0, this.currentPassengers - count);
  return this.currentPassengers;
};

// Update vehicle status
vehicleSchema.methods.setStatus = function (status) {
  this.status = status;
  this.isAvailable = status === 'available';
  return this;
};

// GeoJSON support for location queries
vehicleSchema.pre('save', function (next) {
  if (this.currentLocation?.coordinates) {
    // Ensure geospatial coordinates are [longitude, latitude]
    if (!Array.isArray(this.currentLocation.coordinates)) {
      this.currentLocation.coordinates = [
        this.currentLocation.coordinates.longitude || 0,
        this.currentLocation.coordinates.latitude || 0,
      ];
    }
  }
  next();
});

const Vehicle = mongoose.model('Vehicle', vehicleSchema);

module.exports = Vehicle;
