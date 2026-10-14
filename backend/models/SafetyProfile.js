/**
 * Safety Profile Model
 * Comprehensive driver safety and verification profile
 * 
 * PURPOSE:
 * - Maintain complete driver verification and clearance status
 * - Track driver violations and safety incidents
 * - Calculate driver trustworthiness scores
 * - Support parent confidence in driver assignments
 * 
 * SAFETY IMPACT:
 * - Requires NBI clearance and background verification
 * - Tracks all violations and incidents
 * - Enables automatic suspension on safety violations
 * - Provides transparency to parents and operators
 * 
 * SCALABILITY:
 * - One record per driver
 * - Indexed for quick verification checks
 * - Supports analytics on driver safety metrics
 */

const mongoose = require('mongoose');

const backgroundCheckSchema = new mongoose.Schema(
  {
    checkType: {
      type: String,
      enum: ['nbi', 'brgy_clearance', 'criminal_record', 'motor_vehicle_record', 'professional_license'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'verified', 'failed', 'expired'],
      required: true,
    },
    issuedDate: Date,
    expiryDate: Date,
    certificateNumber: String,
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    verifiedAt: Date,
    rejectionReason: String,
  },
  { _id: false }
);

const violationSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      default: Date.now,
    },
    violationType: {
      type: String,
      enum: [
        'speeding',
        'reckless_driving',
        'traffic_violation',
        'safety_violation',
        'misconduct',
        'late_arrival',
        'wrong_route',
        'passenger_safety',
        'maintenance_issue',
        'documentation_violation',
      ],
      required: true,
    },
    severity: {
      type: String,
      enum: ['warning', 'minor', 'moderate', 'severe', 'critical'],
      required: true,
    },
    description: {
      type: String,
      trim: true,
      required: true,
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    evidence: [String], // URLs to photos, documents, etc.
    status: {
      type: String,
      enum: ['reported', 'investigating', 'resolved', 'appealed'],
      default: 'reported',
    },
    resolution: String,
    strikeCount: {
      type: Number,
      default: 1,
    },
  },
  { _id: false }
);

const suspensionHistorySchema = new mongoose.Schema(
  {
    startDate: {
      type: Date,
      required: true,
    },
    endDate: Date,
    reason: {
      type: String,
      required: true,
    },
    severity: {
      type: String,
      enum: ['temporary', 'indefinite', 'pending_review'],
      default: 'temporary',
    },
    liftedAt: Date,
    liftedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    liftReason: String,
  },
  { _id: false }
);

const safetyProfileSchema = new mongoose.Schema(
  {
    // Driver reference
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    
    // License and credentials
    licenseNumber: {
      type: String,
      trim: true,
      required: true,
      unique: true,
      index: true,
    },
    
    licenseType: {
      type: String,
      enum: ['professional', 'regular', 'restricted'],
      default: 'professional',
    },
    
    licenseExpiry: {
      type: Date,
      required: true,
    },
    
    licenseVerifiedAt: Date,
    
    // Background verification
    backgroundChecks: [backgroundCheckSchema],
    
    allBackgroundChecksPassed: {
      type: Boolean,
      default: false,
    },
    
    nbiClearanceNumber: {
      type: String,
      trim: true,
      sparse: true,
    },
    
    nbiClearanceExpiry: {
      type: Date,
      sparse: true,
    },
    
    nbiVerifiedAt: Date,
    
    // Professional information
    yearsOfExperience: {
      type: Number,
      min: 0,
      max: 60,
    },
    
    totalTripsCompleted: {
      type: Number,
      default: 0,
    },
    
    totalPassengersServed: {
      type: Number,
      default: 0,
    },
    
    // Performance metrics
    averageRating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },
    
    totalRatings: {
      type: Number,
      default: 0,
    },
    
    onTimePercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    
    averageSpeedScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    
    safetyScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    
    // Violation tracking
    violations: [violationSchema],
    
    totalViolations: {
      type: Number,
      default: 0,
    },
    
    activeViolations: {
      type: Number,
      default: 0,
    },
    
    strikeCount: {
      type: Number,
      default: 0,
    },
    
    // Strike system (3-strike policy)
    maxStrikesAllowed: {
      type: Number,
      default: 3,
    },
    
    // Suspension management
    isSuspended: {
      type: Boolean,
      default: false,
      index: true,
    },
    
    suspensionStatus: {
      type: String,
      enum: ['active', 'appealed', 'lifted'],
      default: null,
      sparse: true,
    },
    
    suspensionHistory: [suspensionHistorySchema],
    
    currentSuspension: suspensionHistorySchema,
    
    // Emergency contact
    emergencyContactName: {
      type: String,
      trim: true,
    },
    
    emergencyContactPhone: {
      type: String,
      trim: true,
    },
    
    emergencyContactRelation: String,
    
    // Vehicle assignment history
    vehicleAssignmentHistory: [
      {
        vehicleId: mongoose.Schema.Types.ObjectId,
        assignedDate: Date,
        unassignedDate: Date,
        reason: String,
      },
    ],
    
    // Franchise/Operator
    franchiseNumber: {
      type: String,
      trim: true,
      sparse: true,
    },
    
    operatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    
    // Eligibility for driving
    isEligibleToDrive: {
      type: Boolean,
      default: false,
      index: true,
    },
    
    eligibilityStatus: {
      type: String,
      enum: [
        'pending_verification',
        'verified_eligible',
        'suspended',
        'license_expired',
        'failed_background_check',
        'under_investigation',
      ],
      default: 'pending_verification',
    },
    
    lastEligibilityCheckAt: Date,
    
    eligibilityCheckingDisabled: {
      type: Boolean,
      default: false,
    },
    
    // Training and certification
    trainings: [
      {
        trainingName: String,
        completedAt: Date,
        certificateNumber: String,
        expiryDate: Date,
      },
    ],
    
    // Audit trail
    profileCreatedAt: {
      type: Date,
      default: Date.now,
    },
    
    profileUpdatedAt: {
      type: Date,
      default: Date.now,
    },
    
    lastReviewedAt: Date,
    
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    
    internalNotes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    indexes: [
      { driverId: 1 },
      { isEligibleToDrive: 1, isSuspended: 1 },
      { licenseExpiry: 1 },
      { nbiClearanceExpiry: 1 },
    ],
  }
);

// Methods for safety profile management
safetyProfileSchema.methods.addViolation = function (violationType, severity, description, reportedBy) {
  const violation = {
    date: new Date(),
    violationType,
    severity,
    description,
    reportedBy,
    strikeCount: this._calculateStrikeWeight(severity),
  };
  
  this.violations.push(violation);
  this.totalViolations += 1;
  this.activeViolations += 1;
  this.strikeCount += violation.strikeCount;
  
  // Auto-suspend if strikes exceed limit
  if (this.strikeCount >= this.maxStrikesAllowed) {
    this.suspend('Exceeded maximum strike count', 'indefinite');
  }
  
  return violation;
};

safetyProfileSchema.methods._calculateStrikeWeight = function (severity) {
  const weights = {
    warning: 0,
    minor: 0.5,
    moderate: 1,
    severe: 2,
    critical: 3,
  };
  return weights[severity] || 0;
};

safetyProfileSchema.methods.suspend = function (reason, severity = 'temporary', endDate = null) {
  if (this.isSuspended && this.currentSuspension?.status === 'active') {
    return this; // Already suspended
  }
  
  const suspension = {
    startDate: new Date(),
    endDate: endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
    reason,
    severity,
  };
  
  this.isSuspended = true;
  this.suspensionStatus = 'active';
  this.currentSuspension = suspension;
  this.suspensionHistory.push(suspension);
  this.isEligibleToDrive = false;
  
  return this;
};

safetyProfileSchema.methods.liftSuspension = function (liftedBy, reason) {
  if (!this.isSuspended) {
    return this; // Not suspended
  }
  
  if (this.currentSuspension) {
    this.currentSuspension.liftedAt = new Date();
    this.currentSuspension.liftedBy = liftedBy;
    this.currentSuspension.liftReason = reason;
  }
  
  this.isSuspended = false;
  this.suspensionStatus = 'lifted';
  this.isEligibleToDrive = this.eligibilityStatus === 'verified_eligible';
  
  return this;
};

safetyProfileSchema.methods.updateEligibility = function () {
  // Check all conditions
  const conditions = {
    licenseValid: new Date() < this.licenseExpiry,
    backgroundChecksPassed: this.allBackgroundChecksPassed,
    nbiClearanceValid: !this.nbiClearanceExpiry || new Date() < this.nbiClearanceExpiry,
    notSuspended: !this.isSuspended,
  };
  
  const allConditionsMet = Object.values(conditions).every(v => v);
  
  if (allConditionsMet) {
    this.isEligibleToDrive = true;
    this.eligibilityStatus = 'verified_eligible';
  } else {
    this.isEligibleToDrive = false;
    
    if (!conditions.licenseValid) {
      this.eligibilityStatus = 'license_expired';
    } else if (!conditions.backgroundChecksPassed) {
      this.eligibilityStatus = 'failed_background_check';
    } else if (!conditions.nbiClearanceValid) {
      this.eligibilityStatus = 'license_expired';
    } else if (!conditions.notSuspended) {
      this.eligibilityStatus = 'suspended';
    }
  }
  
  this.lastEligibilityCheckAt = new Date();
  return this;
};

safetyProfileSchema.methods.calculateSafetyScore = function () {
  // Score calculation: 100 - violations impact
  let score = 100;
  
  // Deduct based on violations
  for (const violation of this.violations) {
    if (violation.status !== 'resolved') {
      const weights = { warning: 2, minor: 5, moderate: 10, severe: 15, critical: 25 };
      score -= weights[violation.severity] || 0;
    }
  }
  
  // Bonus for excellent track record
  if (this.totalViolations === 0 && this.totalTripsCompleted > 100) {
    score = 100;
  }
  
  this.safetyScore = Math.max(0, Math.min(100, score));
  return this.safetyScore;
};

const SafetyProfile = mongoose.model('SafetyProfile', safetyProfileSchema);

module.exports = SafetyProfile;
