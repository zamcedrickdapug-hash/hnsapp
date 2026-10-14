/**
 * Incident Management Controller
 * 
 * Handles incident reporting, investigation, and driver safety operations
 * 
 * SAFETY OPERATIONS:
 * - Accept incident reports from parents and drivers
 * - Manage incident investigation workflow
 * - Issue driver strikes and suspensions
 * - Generate incident statistics and reports
 * - Coordinate stakeholder notifications
 */

const IncidentReport = require('../models/IncidentReport');
const SafetyProfile = require('../models/SafetyProfile');
const TripAssignment = require('../models/TripAssignment');
const User = require('../models/User');

const IncidentManagementService = require('../services/incidentManagementService');
const { getIo } = require('../socket');

class IncidentManagementController {
  /**
   * Create incident report
   * 
   * POST /api/incidents/report
   * 
   * Reporter roles: parent, driver, operator, admin
   * 
   * SAFETY FLOW:
   * 1. Validate incident details
   * 2. Generate report number
   * 3. Create incident record
   * 4. Notify admin and operator
   * 5. Initiate investigation
   */
  static async reportIncident(req, res) {
    try {
      const {
        tripId,
        incidentType,
        severity,
        description,
        location,
        affectedStudents,
        evidenceUrls,
      } = req.body;
      
      const reportedBy = req.user._id;
      const reporterRole = req.user.role;
      
      // Get trip to extract driver and vehicle info
      const trip = tripId ? await TripAssignment.findById(tripId) : null;
      
      if (tripId && !trip) {
        return res.status(404).json({
          success: false,
          error: 'Trip not found',
        });
      }
      
      // Validate incident type and severity
      const validIncidentTypes = [
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
      ];
      
      const validSeverities = ['low', 'medium', 'high', 'critical'];
      
      if (!validIncidentTypes.includes(incidentType)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid incident type',
          validTypes: validIncidentTypes,
        });
      }
      
      if (!validSeverities.includes(severity)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid severity level',
          validSeverities,
        });
      }
      
      // Create incident report via service
      const reportData = {
        reportedBy,
        reporterRole,
        driverId: trip?.driverId || req.body.driverId,
        vehicleId: trip?.vehicleId || req.body.vehicleId,
        tripId,
        incidentType,
        severity,
        description,
        location,
        affectedStudents: affectedStudents || [],
        evidenceUrls: evidenceUrls || [],
        operatorId: trip?.operatorId || req.user.operator,
      };
      
      const creationResult = await IncidentManagementService.createIncidentReport(reportData);
      
      if (!creationResult.success) {
        return res.status(400).json({
          success: false,
          error: 'Failed to create incident report',
          reason: creationResult.reason,
        });
      }
      
      const report = creationResult.report;
      
      // Notify affected parents if trip exists
      if (trip && severity === 'critical') {
        await this._notifyParentsOfIncident(trip, report);
      }
      
      res.status(201).json({
        success: true,
        report: this._formatIncidentResponse(report),
        message: `Incident report ${report.reportNumber} created successfully`,
      });
    } catch (error) {
      console.error('Incident report error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to report incident',
        message: error.message,
      });
    }
  }
  
  /**
   * Get incident report details
   * 
   * GET /api/incidents/:reportId
   */
  static async getIncident(req, res) {
    try {
      const { reportId } = req.params;
      
      const report = await IncidentReport.findById(reportId)
        .populate('reportedBy', 'fullName email')
        .populate('driverId', 'fullName email phone')
        .populate('investigatedBy', 'fullName email')
        .populate('resolvedBy', 'fullName email');
      
      if (!report) {
        return res.status(404).json({
          success: false,
          error: 'Report not found',
        });
      }
      
      res.json({
        success: true,
        report: this._formatIncidentResponse(report),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch incident',
        message: error.message,
      });
    }
  }
  
  /**
   * Start investigation
   * 
   * POST /api/incidents/:reportId/investigate
   * 
   * Admin/Operator only
   */
  static async startInvestigation(req, res) {
    try {
      const { reportId } = req.params;
      
      const result = await IncidentManagementService.startInvestigation(reportId, req.user._id);
      
      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: 'Failed to start investigation',
          reason: result.reason,
        });
      }
      
      res.json({
        success: true,
        report: this._formatIncidentResponse(result.report),
        message: 'Investigation started',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to start investigation',
        message: error.message,
      });
    }
  }
  
  /**
   * Add investigation note
   * 
   * POST /api/incidents/:reportId/notes
   */
  static async addInvestigationNote(req, res) {
    try {
      const { reportId } = req.params;
      const { note, attachmentUrl } = req.body;
      
      if (!note) {
        return res.status(400).json({
          success: false,
          error: 'Note content required',
        });
      }
      
      const report = await IncidentReport.findById(reportId);
      
      if (!report) {
        return res.status(404).json({
          success: false,
          error: 'Report not found',
        });
      }
      
      report.addInvestigationNote(note, req.user._id, attachmentUrl);
      await report.save();
      
      res.json({
        success: true,
        report: this._formatIncidentResponse(report),
        message: 'Investigation note added',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to add note',
        message: error.message,
      });
    }
  }
  
  /**
   * Complete investigation and determine findings
   * 
   * POST /api/incidents/:reportId/complete
   * 
   * Findings structure:
   * {
   *   driverAtFault: boolean,
   *   faultDescription: string,
   *   complianceIssue: 'yes' | 'no' | 'partial',
   *   safetyRisk: 'low' | 'medium' | 'high' | 'critical'
   * }
   */
  static async completeInvestigation(req, res) {
    try {
      const { reportId } = req.params;
      const { findings } = req.body;
      
      if (!findings || typeof findings !== 'object') {
        return res.status(400).json({
          success: false,
          error: 'Findings object required',
        });
      }
      
      const result = await IncidentManagementService.completeInvestigation(
        reportId,
        findings,
        req.user._id
      );
      
      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: 'Failed to complete investigation',
          reason: result.reason,
        });
      }
      
      res.json({
        success: true,
        report: this._formatIncidentResponse(result.report),
        actionsRecommended: result.actionsRecommended,
        message: 'Investigation completed',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to complete investigation',
        message: error.message,
      });
    }
  }
  
  /**
   * Resolve incident
   * 
   * POST /api/incidents/:reportId/resolve
   */
  static async resolveIncident(req, res) {
    try {
      const { reportId } = req.params;
      const { resolutionSummary } = req.body;
      
      if (!resolutionSummary) {
        return res.status(400).json({
          success: false,
          error: 'Resolution summary required',
        });
      }
      
      const result = await IncidentManagementService.resolveIncident(
        reportId,
        resolutionSummary,
        req.user._id
      );
      
      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: 'Failed to resolve incident',
          reason: result.reason,
        });
      }
      
      res.json({
        success: true,
        report: this._formatIncidentResponse(result.report),
        message: 'Incident resolved',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to resolve incident',
        message: error.message,
      });
    }
  }
  
  /**
   * Get incident statistics
   * 
   * GET /api/incidents/statistics?days=30
   */
  static async getIncidentStatistics(req, res) {
    try {
      const { days = 30 } = req.query;
      const operatorId = req.user.operator || req.user._id;
      
      const stats = await IncidentManagementService.getIncidentStatistics(operatorId, parseInt(days));
      
      res.json({
        success: true,
        statistics: stats,
        period: `Last ${days} days`,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch statistics',
        message: error.message,
      });
    }
  }
  
  /**
   * Get incident history
   * 
   * GET /api/incidents?status=...&driverId=...
   */
  static async getIncidentHistory(req, res) {
    try {
      const {
        status,
        driverId,
        incidentType,
        startDate,
        endDate,
        limit = 50,
        skip = 0,
      } = req.query;
      
      const filter = {};
      
      if (status) filter.investigationStatus = status;
      if (driverId) filter.driverId = driverId;
      if (incidentType) filter.incidentType = incidentType;
      
      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) filter.createdAt.$lte = new Date(endDate);
      }
      
      const reports = await IncidentReport.find(filter)
        .populate('driverId', 'fullName')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip));
      
      const total = await IncidentReport.countDocuments(filter);
      
      res.json({
        success: true,
        reports: reports.map(r => this._formatIncidentResponse(r)),
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip),
          remaining: Math.max(0, total - (parseInt(skip) + parseInt(limit))),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch incident history',
        message: error.message,
      });
    }
  }
  
  /**
   * Get driver safety profile
   * 
   * GET /api/drivers/:driverId/safety
   */
  static async getDriverSafetyProfile(req, res) {
    try {
      const { driverId } = req.params;
      
      const profile = await SafetyProfile.findOne({ driverId })
        .populate('driverId', 'fullName email phone');
      
      if (!profile) {
        return res.status(404).json({
          success: false,
          error: 'Safety profile not found',
        });
      }
      
      res.json({
        success: true,
        profile: {
          driver: profile.driverId,
          license: {
            number: profile.licenseNumber,
            expiry: profile.licenseExpiry,
            valid: new Date() < profile.licenseExpiry,
          },
          background: {
            nbiClearance: profile.nbiClearanceNumber,
            nbiExpiry: profile.nbiClearanceExpiry,
            allChecksPassed: profile.allBackgroundChecksPassed,
          },
          performance: {
            rating: profile.averageRating,
            totalRatings: profile.totalRatings,
            tripsCompleted: profile.totalTripsCompleted,
            onTimePercentage: profile.onTimePercentage,
          },
          safety: {
            score: profile.safetyScore,
            violations: profile.violations.length,
            strikes: profile.strikeCount,
            suspended: profile.isSuspended,
            eligible: profile.isEligibleToDrive,
          },
          incidents: {
            total: profile.totalViolations,
            recent: profile.violations.slice(0, 5),
          },
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch safety profile',
        message: error.message,
      });
    }
  }
  
  /**
   * Utility: Notify parents of incident
   */
  static async _notifyParentsOfIncident(trip, report) {
    const io = getIo();
    
    for (const pickup of trip.pickupPoints) {
      if (io) {
        io.to(`user:${pickup.parentId}`).emit('incident:alert', {
          reportNumber: report.reportNumber,
          severity: report.severity,
          type: report.incidentType,
          tripNumber: trip.tripNumber,
          message: `An incident has been reported on trip ${trip.tripNumber}. We are investigating and will provide updates.`,
          contactSupport: true,
        });
      }
    }
  }
  
  /**
   * Format incident response
   */
  static _formatIncidentResponse(report) {
    return {
      id: report._id,
      reportNumber: report.reportNumber,
      reportedBy: report.reportedBy,
      reporterRole: report.reporterRole,
      incidentDate: report.incidentDate,
      reportedAt: report.reportedAt,
      tripNumber: report.tripNumber,
      driver: report.driverId,
      vehicle: report.vehicleId,
      type: report.incidentType,
      severity: report.severity,
      description: report.description,
      location: report.location,
      affectedStudents: report.affectedStudents,
      evidence: report.evidenceUrls,
      investigation: {
        status: report.investigationStatus,
        startedAt: report.investigationStartedAt,
        completedAt: report.investigationCompletedAt,
        investigator: report.investigatedBy,
        notes: report.investigationNotes.length,
      },
      findings: report.findings,
      actions: report.actionsTaken,
      strikeIssued: report.strikeIssued,
      strikeCount: report.strikeCount,
      resolution: {
        status: report.resolutionStatus,
        summary: report.resolutionSummary,
        resolvedAt: report.resolvedAt,
        resolvedBy: report.resolvedBy,
      },
    };
  }
}

module.exports = IncidentManagementController;
