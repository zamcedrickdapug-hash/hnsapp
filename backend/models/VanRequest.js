const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema(
  {
    latitude: {
      type: Number,
      min: -90,
      max: 90,
    },
    longitude: {
      type: Number,
      min: -180,
      max: 180,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const requesterLocationSchema = new mongoose.Schema(
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
    accuracy: {
      type: Number,
      min: 0,
    },
    capturedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const vanRequestSchema = new mongoose.Schema(
  {
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    studentName: {
      type: String,
      trim: true,
      required: true,
    },
    gradeSection: {
      type: String,
      trim: true,
      default: '',
    },
    schoolName: {
      type: String,
      trim: true,
      default: '',
    },
    pickupZone: {
      type: String,
      trim: true,
      required: true,
    },
    emergencyContact: {
      type: String,
      trim: true,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['searching', 'accepted', 'cancelled', 'completed'],
      default: 'searching',
      index: true,
    },
    liveLocation: {
      type: locationSchema,
      default: null,
    },
    requesterLocation: {
      type: requesterLocationSchema,
      default: null,
    },
    routeCoordinates: {
      type: [[Number]],
      default: null,
    },
    routeMetadata: {
      distance: {
        type: Number,
        default: null,
      },
      duration: {
        type: Number,
        default: null,
      },
      profile: {
        type: String,
        default: null,
      },
      calculatedAt: {
        type: Date,
        default: null,
      },
    },
    acceptedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const VanRequest = mongoose.model('VanRequest', vanRequestSchema);

module.exports = VanRequest;
