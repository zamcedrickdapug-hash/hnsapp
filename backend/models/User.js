const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'reviewing', 'approved', 'declined'],
      required: true,
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const studentSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      trim: true,
    },
    age: {
      type: Number,
      min: 3,
      max: 25,
    },
    gradeLevel: {
      type: String,
      trim: true,
    },
    studentNumber: {
      type: String,
      trim: true,
    },
    schoolName: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const driverSchema = new mongoose.Schema(
  {
    licenseNumber: {
      type: String,
      trim: true,
    },
    licenseExpiry: {
      type: Date,
    },
    vehicleType: {
      type: String,
      trim: true,
    },
    plateNumber: {
      type: String,
      trim: true,
    },
    yearsOfExperience: {
      type: Number,
      min: 0,
      max: 60,
    },
  },
  { _id: false }
);

const validIdSchema = new mongoose.Schema(
  {
    originalName: {
      type: String,
      required: true,
      trim: true,
    },
    filename: {
      type: String,
      required: true,
      trim: true,
    },
    path: {
      type: String,
      required: true,
      trim: true,
    },
    mimeType: {
      type: String,
      required: true,
      trim: true,
    },
    size: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  { _id: false }
);

const pushSubscriptionSchema = new mongoose.Schema(
  {
    endpoint: {
      type: String,
      required: true,
      trim: true,
    },
    expirationTime: {
      type: Number,
      default: null,
    },
    keys: {
      auth: {
        type: String,
        required: true,
        trim: true,
      },
      p256dh: {
        type: String,
        required: true,
        trim: true,
      },
    },
    userAgent: {
      type: String,
      trim: true,
      default: '',
    },
    lastUsedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const lastKnownLocationSchema = new mongoose.Schema(
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

const userSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ['parent', 'driver', 'admin'],
      default: 'parent',
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    homeAddress: {
      type: String,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    student: {
      type: studentSchema,
    },
    driver: {
      type: driverSchema,
    },
    validId: {
      type: validIdSchema,
    },
    status: {
      type: String,
      enum: ['pending', 'reviewing', 'approved', 'declined'],
      default: 'pending',
    },
    accountState: {
      type: String,
      enum: ['active', 'suspended', 'banned'],
      default: 'active',
      index: true,
    },
    declineReason: {
      type: String,
      trim: true,
      default: '',
    },
    notifications: {
      type: [notificationSchema],
      default: [],
    },
    pushSubscriptions: {
      type: [pushSubscriptionSchema],
      default: [],
    },
    lastKnownLocation: {
      type: lastKnownLocationSchema,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model('User', userSchema);

module.exports = User;
