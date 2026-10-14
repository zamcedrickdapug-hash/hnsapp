/**
 * Incident Report Model
 * Tracks safety incidents, parent complaints, and investigation workflows
 * 
 * PURPOSE:
 * - Record all safety incidents and parent complaints
 * - Track investigation and resolution process
 * - Support driver strike system
 * - Enable incident analytics and pattern detection
 * 
 * SAFETY IMPACT:
 * - Immediate incident notification to operators and admins
 * - Structured investigation workflow
 * - Automatic driver suspension on critical incidents
 * - Full audit trail for transparency and legal protection
 * 
 * SCALABILITY:
 * - Indexed by status for quick filtering
 * - Historical records for trend analysis
 * - Supports bulk incident queries
 */

const mongoose = require('mongoose');

const investigationNoteSchema = new mongoose.Schema(
  {
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    note: {
      type: String,
      trim: true,
      required: true,
    },
    attachment: String, // URL to evidence file
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const incidentReportSchema = new mongoose.Schema(
  {
    // Report identification
    reportNumber: {
      type: String,
      unique: true,
      index: true,
      required: true,
    },
    
    // Incident details
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    
    reporterRole: {
      type: String,
      enum: ['parent', 'driver', 'operator', 'admin', 'system'],
      required: true,
    },
    
    incidentDate: {
      type: Date,
      required: true,
      index: true,
    },
    
    reportedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    
    // Trip information
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TripAssignment',
      index: true,
    },
    
    tripNumber: {
      type: String,
      trim: true,
      index: true,
    },
    
    // Involved parties
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    
    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      sparse: true,
    },
    
    affectedStudents: [
      {
        studentName: String,
        studentId: mongoose.Schema.Types.ObjectId,
        injuryStatus: {
          type: String,
          enum: ['unharmed', 'minor_injury', 'moderate_injury', 'severe_injury'],
        },
        notes: String,
      },
    ],
    
    // Incident classification
    incidentType: {
      type: String,
      enum: [
        'speeding',
        'reckless_driving',
        'traffic_violation',
        'unsafe_behavior',
        'misconduct',
        'late_arrival',
        'wrong_route',
        'passenger_safety',
        'vehicle_maintenance',
        'communication_failure',
        'unauthorized_stop',
        'route_deviation',
        'equipment_failure',
        'accident',
        'near_miss',
        'other',
      ],
      required: true,
      index: true,
    },
    
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'low',
      index: true,
    },
    
    // Incident description
    description: {
      type: String,
      trim: true,
      required: true,
    },
    
    location: {
      latitude: Number,
      longitude: Number,
      address: String,
    },
    
    evidenceUrls: [String], // Photos, videos, documents
    
    witnesses: [
      {
        name: String,
        contactInfo: String,
        statement: String,
      },
    ],
    
    // Investigation workflow
    investigationStatus: {
      type: String,
      enum: [
        'pending_review',
        'under_investigation',
        'evidence_collected',
        'findings_ready',
        'resolved',
        'dismissed',
        'escalated',
        'awaiting_driver_response',
      ],
      default: 'pending_review',
      index: true,
    },
    
    investigationNotes: [investigationNoteSchema],
    
    investigatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      sparse: true,
    },
    
    investigationStartedAt: {
      type: Date,
      default: null,
    },
    
    investigationCompletedAt: {
      type: Date,
      default: null,
    },
    
    // Findings
    findings: {
      driverAtFault: {
        type: Boolean,
        default: null,
      },
      
      faultDescription: {
        type: String,
        trim: true,
      },
      
      complianceIssue: {
        type: String,
        enum: ['yes', 'no', 'partial'],
        default: null,
      },
      
      complianceDetails: String,
      
      safetyRisk: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: null,
      },
    },
    
    // Actions taken
    actionsTaken: [
      {
        actionType: {
          type: String,
          enum: [
            'driver_warning',
            'retraining_required',
            'license_review',
            'vehicle_inspection',
            'temporary_suspension',
            'permanent_termination',
            'parent_communication',
            'police_report',
            'insurance_claim',
          ],
          required: true,
        },
        description: String,
        takenAt: {
          type: Date,
          default: Date.now,
        },
        takenBy: mongoose.Schema.Types.ObjectId,
        status: {
          type: String,
          enum: ['pending', 'in_progress', 'completed'],
          default: 'pending',
        },
      },
    ],
    
    // Driver strike update
    strikeIssued: {
      type: Boolean,
      default: false,
    },
    
    strikeCount: {
      type: Number,
      default: 0,
    },
    
    // Resolution
    resolutionStatus: {
      type: String,
      enum: ['open', 'resolved', 'escalated_to_authorities', 'closed'],
      default: 'open',
      index: true,
    },
    
    resolutionSummary: {
      type: String,
      trim: true,
    },
    
    resolvedAt: {
      type: Date,
      default: null,
    },
    
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      sparse: true,
    },
    
    // Parent communication
    parentNotifications: [
      {
        parentId: mongoose.Schema.Types.ObjectId,
        notifiedAt: Date,
        method: {
          type: String,
          enum: ['sms', 'email', 'push_notification', 'in_app'],
        },
        status: {
          type: String,
          enum: ['pending', 'sent', 'failed'],
        },
      },
    ],
    
    parentResponseReceived: {
      type: Boolean,
      default: false,
    },
    
    parentFeedback: {
      type: String,
      trim: true,
    },
    
    // Escalation tracking
    escalatedToAdmin: {
      type: Boolean,
      default: false,
    },
    
    escalatedToAuthorities: {
      type: Boolean,
      default: false,
    },
    
    policeReportNumber: {
      type: String,
      trim: true,
      sparse: true,
    },
    
    insuranceClaimNumber: {
      type: String,
      trim: true,
      sparse: true,
    },
    
    // Quality assurance
    qaReviewedAt: {
      type: Date,
      default: null,
    },
    
    qaReviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      sparse: true,
    },
    
    qaFeedback: String,
    
    // Metadata
    operator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    
    tags: [String], // For categorization and filtering
    
    relatedIncidents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'IncidentReport',
      },
    ],
  },
  {
    timestamps: true,
    indexes: [
      { reportNumber: 1 },
      { driverId: 1, incidentDate: -1 },
      { incidentType: 1, severity: 1 },
      { investigationStatus: 1, createdAt: -1 },
      { resolutionStatus: 1 },
      { reportedBy: 1, reportedAt: -1 },
    ],
  }
);

// Methods for incident management
incidentReportSchema.methods.startInvestigation = function (investigatorId) {
  this.investigationStatus = 'under_investigation';
  this.investigatedBy = investigatorId;
  this.investigationStartedAt = new Date();
  return this;
};

incidentReportSchema.methods.addInvestigationNote = function (noteText, addedBy, attachmentUrl = null) {
  this.investigationNotes.push({
    note: noteText,
    addedBy,
    attachment: attachmentUrl,
    timestamp: new Date(),
  });
  return this;
};

incidentReportSchema.methods.completeInvestigation = function (findings) {
  this.investigationStatus = 'findings_ready';
  this.investigationCompletedAt = new Date();
  this.findings = { ...this.findings, ...findings };
  return this;
};

incidentReportSchema.methods.issueDriverStrike = function (strikeCount = 1) {
  this.strikeIssued = true;
  this.strikeCount = strikeCount;
  return this;
};

incidentReportSchema.methods.addActionTaken = function (actionType, description, takenBy) {
  this.actionsTaken.push({
    actionType,
    description,
    takenBy,
    takenAt: new Date(),
    status: 'pending',
  });
  return this;
};

incidentReportSchema.methods.resolve = function (summary, resolvedBy) {
  this.resolutionStatus = 'resolved';
  this.resolutionSummary = summary;
  this.resolvedAt = new Date();
  this.resolvedBy = resolvedBy;
  return this;
};

incidentReportSchema.methods.notifyParents = function (parentIds, method = 'push_notification') {
  for (const parentId of parentIds) {
    this.parentNotifications.push({
      parentId,
      method,
      status: 'pending',
      notifiedAt: new Date(),
    });
  }
  return this;
};

incidentReportSchema.methods.escalateToAuthorities = function () {
  this.escalatedToAuthorities = true;
  return this;
};

const IncidentReport = mongoose.model('IncidentReport', incidentReportSchema);

module.exports = IncidentReport;
