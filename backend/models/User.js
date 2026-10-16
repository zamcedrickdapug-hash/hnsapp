const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

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
    schoolLatitude: {
      type: Number,
      min: -90,
      max: 90,
    },
    schoolLongitude: {
      type: Number,
      min: -180,
      max: 180,
    },
  },
  { _id: false }
);

const studentListItemSchema = new mongoose.Schema({
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
  schoolLatitude: {
    type: Number,
    min: -90,
    max: 90,
  },
  schoolLongitude: {
    type: Number,
    min: -180,
    max: 180,
  },
});

const documentUploadSchema = new mongoose.Schema(
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
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending',
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { _id: false }
);

const driverSchema = new mongoose.Schema(
  {
    dateOfBirth: {
      type: Date,
      required: false,
    },
    licenseNumber: {
      type: String,
      trim: true,
    },
    licenseType: {
      type: String,
      enum: ['professional', 'nonprofessional'],
      default: 'professional',
    },
    licenseExpirationDate: {
      type: Date,
    },
    licenseVerified: {
      type: Boolean,
      default: false,
    },
    vehicleType: {
      type: String,
      trim: true,
    },
    vehicleColor: {
      type: String,
      trim: true,
      maxlength: 30,
      default: null,
    },
    seatCapacity: {
      type: Number,
      min: 3,
      max: 20,
      default: null,
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
    // Professional document uploads for school transportation
    documents: {
      licenseFront: {
        type: documentUploadSchema,
        default: null,
      },
      licenseBack: {
        type: documentUploadSchema,
        default: null,
      },
      selfieVerification: {
        type: documentUploadSchema,
        default: null,
      },
      nbiClearance: {
        type: documentUploadSchema,
        default: null,
      },
      vehicleOrCr: {
        type: documentUploadSchema,
        default: null,
      },
    },
    // Document verification status
    documentStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending',
    },
    documentRejectionReason: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { _id: false }
);

const validIdSchema = new mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
    },
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
    firebaseUid: {
      type: String,
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
      select: false,
    },
    signupMethod: {
      type: String,
      enum: ['email', 'phone'],
      default: 'email',
    },
    verificationCode: {
      type: String,
      select: false,
      default: null,
    },
    verificationCodeExpires: {
      type: Date,
      select: false,
      default: null,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    student: {
      type: studentSchema,
    },
    students: {
      type: [studentListItemSchema],
      default: [],
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
    suspensionReason: {
      type: String,
      enum: [
        'license_expired',
        'document_rejected',
        'admin_suspension',
        'safety_concern',
        'policy_violation',
      ],
      default: null,
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

userSchema.index({ firebaseUid: 1 }, { unique: true, sparse: true });

userSchema.methods.getStudentList = function() {
  if (this.students?.length) return this.students;
  if (this.student?.fullName) return [this.student];
  return [];
};

// Hash password before saving if it's modified and not already hashed
userSchema.pre('save', async function() {
  if (!this.isModified('passwordHash')) return;
  
  // Don't hash if it already looks like a bcrypt hash
  if (this.passwordHash && this.passwordHash.startsWith('$2')) {
    return;
  }
  
  // If there's no passwordHash, just continue
  if (!this.passwordHash) {
    return;
  }
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
  } catch (error) {
    throw error;
  }
});

// Method to compare password with stored hash
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.passwordHash);
  } catch (error) {
    console.error('Password comparison error:', error);
    return false;
  }
};

const User = mongoose.model('User', userSchema);

module.exports = User;
