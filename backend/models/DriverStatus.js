const mongoose = require('mongoose');

/**
 * DriverStatus Model
 * Tracks real-time driver status, location, and availability
 */
const driverStatusSchema = new mongoose.Schema(
  {
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    // Status: 'online', 'offline', 'on-trip', 'idle'
    status: {
      type: String,
      enum: ['online', 'offline', 'on-trip', 'idle'],
      default: 'offline',
    },
    // GPS tracking
    currentLocation: {
      latitude: Number,
      longitude: Number,
      accuracy: Number,
      timestamp: Date,
    },
    // Live trip tracking
    activeRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VanRequest',
      default: null,
    },
    // Vehicle info
    vehicleType: {
      type: String,
      default: 'School Service Van',
    },
    plateNumber: String,
    // Availability
    isOnline: {
      type: Boolean,
      default: false,
    },
    gpsEnabled: {
      type: Boolean,
      default: false,
    },
    lastLocationUpdate: Date,
    lastStatusUpdate: Date,
    // Connection info
    socketId: String,
    ipAddress: String,
    // Statistics
    totalTrips: {
      type: Number,
      default: 0,
    },
    completedTrips: {
      type: Number,
      default: 0,
    },
    cancelledTrips: {
      type: Number,
      default: 0,
    },
    // Rating
    averageRating: {
      type: Number,
      default: 5,
      min: 0,
      max: 5,
    },
    totalRatings: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
driverStatusSchema.index({ status: 1, isOnline: 1 });
driverStatusSchema.index({ lastLocationUpdate: 1 });

module.exports = mongoose.model('DriverStatus', driverStatusSchema);
