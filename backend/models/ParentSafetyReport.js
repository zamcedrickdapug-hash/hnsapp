/**
 * Parent Safety Report & Rating/Review Model
 * 
 * PURPOSE:
 * Comprehensive parent feedback system including safety reports, ratings, and reviews.
 * Enables parents to report issues and rate driver/vehicle experience.
 * Creates accountability and identifies problematic drivers.
 * 
 * BUSINESS LOGIC:
 * - Multiple severity levels for escalation
 * - Investigation workflow with admin review
 * - Automatic driver strike system (3 strikes = suspension)
 * - Evidence/image upload support
 * - Ratings and reviews for transparency
 * - Public ratings (anonymous option)
 * 
 * REAL-WORLD APPLICATION:
 * Similar to Uber/Grab rider feedback where poor ratings trigger investigations.
 * Essential for child safety transportation - parents must feel heard.
 * 
 * SCALABILITY:
 * - Indexed by driver, trip, status for quick queries
 * - Support for bulk investigations
 * - Analytics aggregation ready
 */

const mongoose = require('mongoose');

/**
 * Safety Report Severity Levels
 */
const SEVERITY_LEVELS = {
  LOW: 'low', // Minor issue, documentation only
  MEDIUM: 'medium', // Needs investigation
  HIGH: 'high', // Urgent, potential disciplinary action
  CRITICAL: 'critical', // Immediate action required
};

/**
 * Report Types
 */
const REPORT_TYPES = {
  UNSAFE_DRIVING: 'unsafe_driving', // Speeding, reckless driving
  LATE_PICKUP: 'late_pickup', // Missed scheduled pickup
  MISCONDUCT: 'misconduct', // Driver behavior, professionalism
  WRONG_STUDENT: 'wrong_student', // Picked up wrong child
  VEHICLE_ISSUE: 'vehicle_issue', // Vehicle condition, cleanliness
  GPS_TRACKING: 'gps_tracking', // GPS malfunction or unusual route
  COMMUNICATION: 'communication', // Driver not responding
};

/**
 * Investigation Status
 */
const INVESTIGATION_STATUS = {
  PENDING: 'pending', // Awaiting admin review
  IN_PROGRESS: 'in_progress', // Under investigation
  COMPLETED: 'completed', // Investigation concluded
  ESCALATED: 'escalated', // Referred to authorities
};

/**
 * Resolution Types
 */
const RESOLUTION_TYPES = {
  UNWARRANTED: 'unwarranted', // Report was false/unfounded
  MINOR_ISSUE: 'minor_issue', // Driver counseled, no strike
  DRIVER_STRIKE: 'driver_strike', // 1 strike given
  MULTIPLE_STRIKES: 'multiple_strikes', // Multiple strikes
  SUSPENSION: 'suspension', // Driver temporarily suspended
  TERMINATION: 'termination', // Driver removed from platform
  LEGAL_ACTION: 'legal_action', // Referred to authorities
};

// Parent Safety Report Schema
const parentSafetyReportSchema = new mongoose.Schema(
  {
    reportId: {
      type: String,
      unique: true,
      description: 'Unique report identifier (PSR-YYYY-MM-XXXXX)',
    },
    // Report Basics
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
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    studentName: {
      type: String,
      required: true,
    },
    studentAge: Number,
    // Report Details
    reportType: {
      type: String,
      enum: Object.values(REPORT_TYPES),
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: Object.values(SEVERITY_LEVELS),
      required: true,
      index: true,
    },
    description: {
      type: String,
      required: true,
      minlength: 20,
      maxlength: 5000,
    },
    specificDetails: {
      timeOfIncident: Date,
      locationDetails: String,
      vehicleCondition: String,
      driverBehavior: String,
      childReaction: String,
    },
    // Evidence
    evidenceImages: [
      {
        imageUrl: String,
        description: String,
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    videoUrl: {
      type: String,
      description: 'Video evidence if available',
    },
    // Anonymous reporting option
    isAnonymous: {
      type: Boolean,
      default: false,
    },
    // Follow-up
    hasWitnesses: {
      type: Boolean,
      default: false,
    },
    witnessDetails: String,
    parentContact: {
      email: String,
      phone: String,
      preferredContact: {
        type: String,
        enum: ['email', 'phone', 'both'],
      },
    },
    // Admin Investigation
    investigationStatus: {
      type: String,
      enum: Object.values(INVESTIGATION_STATUS),
      default: INVESTIGATION_STATUS.PENDING,
      index: true,
    },
    assignedToAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    investigationNotes: String,
    investigationStartedAt: Date,
    investigationCompletedAt: Date,
    // Resolution
    resolution: {
      type: String,
      enum: Object.values(RESOLUTION_TYPES),
    },
    resolutionNotes: String,
    disciplinaryAction: {
      type: String,
      description: 'e.g., "Written warning", "1 week suspension", "Termination"',
    },
    // Driver Strikes System
    strikeGiven: {
      type: Boolean,
      default: false,
    },
    strikeNumber: {
      type: Number,
      description: 'Which strike (1, 2, or 3)',
    },
    totalDriverStrikes: {
      type: Number,
      description: 'Total strikes driver has now',
    },
    // Parent Communication
    parentNotificationSentAt: Date,
    parentNotificationRead: {
      type: Boolean,
      default: false,
    },
    resolutionCommunication: {
      type: String,
      description: 'Message sent to parent about resolution',
    },
    // Soft delete
    deletedAt: Date,
  },
  { timestamps: true }
);

// Rating/Review Schema
const ratingReviewSchema = new mongoose.Schema(
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
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Ratings
    overallRating: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    safetyRating: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    communicationRating: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    punctualityRating: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    vehicleConditionRating: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    // Review Text
    title: {
      type: String,
      maxlength: 100,
    },
    review: {
      type: String,
      maxlength: 1000,
    },
    highlights: [
      {
        type: String,
        enum: ['punctual', 'safe', 'friendly', 'professional', 'vehicle_clean', 'helpful', 'attentive'],
      },
    ],
    concerns: [String], // Areas for improvement
    // Visibility
    isPublic: {
      type: Boolean,
      default: true,
      description: 'Visible on driver profile',
    },
    isAnonymous: {
      type: Boolean,
      default: false,
    },
    // Admin Moderation
    isApproved: {
      type: Boolean,
      default: true,
      description: 'True if passed content moderation',
    },
    moderationNotes: String,
    flaggedForReview: {
      type: Boolean,
      default: false,
      description: 'True if inappropriate content detected',
    },
    // Feedback Loop
    driverResponse: String,
    driverResponseAt: Date,
  },
  { timestamps: true }
);

// Indexes for performance
parentSafetyReportSchema.index({ driverId: 1, severity: 1, createdAt: -1 });
parentSafetyReportSchema.index({ investigationStatus: 1, assignedToAdmin: 1 });
parentSafetyReportSchema.index({ reportType: 1, createdAt: -1 });
parentSafetyReportSchema.index({ strikeGiven: 1, driverId: 1 });
parentSafetyReportSchema.index({ deletedAt: 1 });

ratingReviewSchema.index({ driverId: 1, overallRating: 1 });
ratingReviewSchema.index({ driverId: 1, createdAt: -1 });
ratingReviewSchema.index({ isPublic: 1, isApproved: 1 });
ratingReviewSchema.index({ flaggedForReview: 1 });

// Pre-save: Generate reportId
parentSafetyReportSchema.pre('save', async function (next) {
  if (!this.reportId) {
    const date = new Date();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const count = await mongoose.model('ParentSafetyReport').countDocuments({
      createdAt: {
        $gte: new Date(yyyy, date.getMonth(), 1),
      },
    });
    this.reportId = `PSR-${yyyy}-${mm}-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

// Virtual: Get driver strike percentage until suspension
ratingReviewSchema.virtual('strikesToSuspension').get(function () {
  return 3 - (this.totalDriverStrikes || 0);
});

const ParentSafetyReport = mongoose.model('ParentSafetyReport', parentSafetyReportSchema);
const RatingReview = mongoose.model('RatingReview', ratingReviewSchema);

module.exports = {
  ParentSafetyReport,
  RatingReview,
  SEVERITY_LEVELS,
  REPORT_TYPES,
  INVESTIGATION_STATUS,
  RESOLUTION_TYPES,
};
