const mongoose = require('mongoose');

/**
 * DriverLocation Model
 * Historical tracking of driver GPS locations for trip playback and analytics
 */
const driverLocationSchema = new mongoose.Schema(
  {
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VanRequest',
      index: true,
    },
    // GPS coordinates
    latitude: {
      type: Number,
      required: true,
    },
    longitude: {
      type: Number,
      required: true,
    },
    // Movement info
    speed: {
      type: Number,
      default: 0,
      min: 0,
    },
    heading: {
      type: Number,
      min: 0,
      max: 360,
    },
    accuracy: {
      type: Number,
      min: 0,
    },
    altitude: Number,
    // Timestamp of location capture
    recordedAt: {
      type: Date,
      default: Date.now,
      // Index defined at schema level with TTL (see below)
    },
  },
  {
    timestamps: false,
  }
);

// TTL index - automatically delete locations after 30 days
// ✅ Single source of truth for recordedAt index with expireAfterSeconds
driverLocationSchema.index({ recordedAt: 1 }, { expireAfterSeconds: 2592000 });
driverLocationSchema.index({ driverId: 1, recordedAt: -1 });
driverLocationSchema.index({ requestId: 1, recordedAt: 1 });

module.exports = mongoose.model('DriverLocation', driverLocationSchema);
