const mongoose = require('mongoose');

/**
 * DriverStats Model
 * Aggregated statistics for driver analytics and performance tracking
 */
const driverStatsSchema = new mongoose.Schema(
  {
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    // Trip statistics
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
    // Time statistics
    totalDrivingTime: {
      type: Number,
      default: 0, // in minutes
    },
    totalIdleTime: {
      type: Number,
      default: 0, // in minutes
    },
    // Distance statistics
    totalDistance: {
      type: Number,
      default: 0, // in kilometers
    },
    // Performance metrics
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
    cancellationRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    // Weekly breakdown
    weeklyStats: [
      {
        week: String,
        trips: Number,
        distance: Number,
        drivingTime: Number,
      },
    ],
    // Monthly breakdown
    monthlyStats: [
      {
        month: String,
        trips: Number,
        distance: Number,
        drivingTime: Number,
        earnings: Number,
      },
    ],
    // Last updated
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('DriverStats', driverStatsSchema);
