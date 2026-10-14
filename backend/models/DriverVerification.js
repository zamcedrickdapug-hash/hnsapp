/**
 * Driver Verification Model
 * 
 * PURPOSE:
 * Manages complete driver verification workflow including document submission,
 * expiration tracking, admin approval, and verification audit history.
 * 
 * BUSINESS LOGIC:
 * - Documents required before driver can accept trips
 * - Automatic alerts for document expiration
 * - Admin multi-level approval workflow
 * - Audit trail for compliance and safety
 * - Support for document status tracking
 * 
 * REAL-WORLD APPLICATION:
 * Similar to Grab/Uber driver verification where transport authorities require
 * verified licenses, background checks, and insurance documentation.
 * 
 * SCALABILITY:
 * - Indexed by driverId and status for quick queries
 * - Timestamps for audit trail
 * - Soft deletes supported
 * - Designed for high-volume verification workflows
 */

const mongoose = require('mongoose');

/**
 * Verification Status Enum
 * pending → under_review → approved/rejected → suspended/banned
 */
const VERIFICATION_STATUS = {
  PENDING: 'pending',
  UNDER_REVIEW: 'under_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  SUSPENDED: 'suspended',
  BANNED: 'banned',
};

/**
 * Document Types Required for Verification
 */
const DOCUMENT_TYPES = {
  DRIVERS_LICENSE: 'drivers_license',
  OR_CR: 'or_cr', // Official Receipt / Certificate of Registration
  NBI_CLEARANCE: 'nbi_clearance',
  DRUG_TEST: 'drug_test',
  PROFILE_PHOTO: 'profile_photo',
  VEHICLE_PHOTOS: 'vehicle_photos',
  INSURANCE: 'insurance',
};

/**
 * Document Status
 */
const DOCUMENT_STATUS = {
  PENDING: 'pending',
  VERIFIED: 'verified',
  EXPIRED: 'expired',
  REJECTED: 'rejected',
};

const documentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: Object.values(DOCUMENT_TYPES),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(DOCUMENT_STATUS),
      default: DOCUMENT_STATUS.PENDING,
    },
    fileUrl: {
      type: String,
      required: true,
      description: 'URL to uploaded document (AWS S3, Firebase Storage, etc)',
    },
    fileName: {
      type: String,
      required: true,
    },
    expiryDate: {
      type: Date,
      description: 'When document expires (license, NBI, drug test, etc)',
    },
    isExpired: {
      type: Boolean,
      default: false,
      description: 'Calculated field - true if expiryDate < now',
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      description: 'Admin who verified this document',
    },
    verificationNotes: {
      type: String,
      description: 'Admin notes during verification (e.g., "License invalid", "Photo unclear")',
    },
    rejectionReason: {
      type: String,
      description: 'Detailed reason for rejection (if status === rejected)',
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    verifiedAt: {
      type: Date,
      description: 'When admin verified this document',
    },
  },
  { _id: true }
);

const driverVerificationSchema = new mongoose.Schema(
  {
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    // Overall verification status
    status: {
      type: String,
      enum: Object.values(VERIFICATION_STATUS),
      default: VERIFICATION_STATUS.PENDING,
      index: true,
    },
    // Individual documents
    documents: [documentSchema],
    // Verification workflow
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    approvedAt: {
      type: Date,
      description: 'When final approval was given',
    },
    rejectedAt: {
      type: Date,
      description: 'When verification was rejected',
    },
    suspendedAt: {
      type: Date,
      description: 'When verification was suspended',
    },
    // Admin workflow
    assignedToAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      description: 'Admin assigned to review this verification',
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      description: 'Admin who made final decision',
    },
    approvalNotes: {
      type: String,
      description: 'Admin notes for approval decision',
    },
    // Expiration tracking
    expiryAlert: {
      type: Boolean,
      default: false,
      description: 'True if any document is expiring soon',
    },
    expiringDocuments: [
      {
        type: String,
        enum: Object.values(DOCUMENT_TYPES),
      },
    ],
    nextExpiryDate: {
      type: Date,
      description: 'Earliest expiry date among all documents',
    },
    // Audit trail
    verificationHistory: [
      {
        action: {
          type: String,
          enum: ['submitted', 'document_uploaded', 'approved', 'rejected', 'suspended', 'resubmitted'],
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
        performedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        notes: String,
      },
    ],
    // Communication
    communicationLog: [
      {
        message: String,
        sentTo: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        sentAt: {
          type: Date,
          default: Date.now,
        },
        readAt: Date,
      },
    ],
    // Soft delete
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Indexes for performance
driverVerificationSchema.index({ driverId: 1, status: 1 });
driverVerificationSchema.index({ status: 1, submittedAt: -1 });
driverVerificationSchema.index({ assignedToAdmin: 1, status: 1 });
driverVerificationSchema.index({ expiryAlert: 1, nextExpiryDate: 1 });
driverVerificationSchema.index({ deletedAt: 1 });

// Middleware: Update isExpired field before saving
driverVerificationSchema.pre('save', function (next) {
  const now = new Date();
  let earliestExpiry = null;
  let expiringDocs = [];

  // Check each document for expiration
  this.documents.forEach((doc) => {
    if (doc.expiryDate) {
      doc.isExpired = doc.expiryDate < now;

      // Track earliest expiry
      if (doc.expiryDate > now) {
        if (!earliestExpiry || doc.expiryDate < earliestExpiry) {
          earliestExpiry = doc.expiryDate;
        }
      }

      // Check if expiring within 30 days
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      if (doc.expiryDate <= thirtyDaysFromNow && doc.expiryDate > now) {
        expiringDocs.push(doc.type);
      }
    }
  });

  this.nextExpiryDate = earliestExpiry;
  this.expiringDocuments = expiringDocs;
  this.expiryAlert = expiringDocs.length > 0;

  next();
});

// Virtual: Check if all required documents are submitted
driverVerificationSchema.virtual('allDocumentsSubmitted').get(function () {
  const requiredDocs = Object.values(DOCUMENT_TYPES);
  const submittedTypes = this.documents.map((d) => d.type);
  return requiredDocs.every((required) => submittedTypes.includes(required));
});

// Virtual: Calculate verification progress percentage
driverVerificationSchema.virtual('verificationProgress').get(function () {
  const totalRequired = Object.values(DOCUMENT_TYPES).length;
  const submitted = this.documents.filter((d) => d.status !== DOCUMENT_STATUS.PENDING).length;
  return Math.round((submitted / totalRequired) * 100);
});

// Virtual: Days until expiry
driverVerificationSchema.virtual('daysUntilExpiry').get(function () {
  if (!this.nextExpiryDate) return null;
  const now = new Date();
  const diffTime = this.nextExpiryDate - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
});

driverVerificationSchema.set('toJSON', { virtuals: true });
driverVerificationSchema.set('toObject', { virtuals: true });

const DriverVerification = mongoose.model('DriverVerification', driverVerificationSchema);

module.exports = {
  DriverVerification,
  VERIFICATION_STATUS,
  DOCUMENT_TYPES,
  DOCUMENT_STATUS,
};
