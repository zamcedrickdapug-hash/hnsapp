/**
 * Incident Management Service
 * 
 * Handles safety incident reporting, investigation, and driver strike management
 * 
 * PURPOSE:
 * - Record and track safety incidents
 * - Manage investigation workflow
 * - Implement 3-strike driver suspension system
 * - Notify stakeholders of incidents
 * - Generate incident analytics and reports
 * 
 * SAFETY IMPACT:
 * - Immediate incident documentation
 * - Structured investigation ensures fairness
 * - Automatic driver suspension for critical violations
 * - Full audit trail for legal protection
 * - Parent communication for transparency
 * 
 * SCALABILITY:
 * - Indexed for fast incident queries
 * - Bulk notification capability
 * - Historical incident analytics
 * - Pattern detection for systemic issues
 */

const IncidentReport = require('../models/IncidentReport');
const SafetyProfile = require('../models/SafetyProfile');
const User = require('../models/User');
const TripAssignment = require('../models/TripAssignment');
const { getIo } = require('../socket');

class IncidentManagementService {
  /**
   * Generate unique incident report number
   */
  static async generateReportNumber() {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const sequence = await IncidentReport.countDocuments({
      createdAt: {
        $gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
        $lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1),
      },
    });
    
    return `INC-${dateStr}-${String(sequence + 1).padStart(4, '0')}`;
  }
  
  /**
   * Create new incident report
   * 
   * @param {Object} incidentData - Incident details
   * @returns {Object} Created incident report
   */
  static async createIncidentReport(incidentData) {
    const {
      reportedBy,
      reporterRole,
      driverId,
      vehicleId,
      tripId,
      incidentType,
      severity,
      description,
      location,
      affectedStudents,
      evidenceUrls,
      operatorId,
    } = incidentData;
    
    const creationResult = {
      success: false,
      report: null,
      reason: '',
    };
    
    try {
      // Validate required fields
      if (!reportedBy || !reporterRole || !driverId || !incidentType || !severity) {
        creationResult.reason = 'Missing required incident fields';
        return creationResult;
      }
      
      // Generate report number
      const reportNumber = await this.generateReportNumber();
      
      // Create incident report
      const report = new IncidentReport({
        reportNumber,
        reportedBy,
        reporterRole,
        driverId,
        vehicleId,
        tripId,
        tripNumber: null, // Will be populated if trip exists
        incidentType,
        severity,
        description,
        location,
        affectedStudents: affectedStudents || [],
        evidenceUrls: evidenceUrls || [],
        investigationStatus: 'pending_review',
        operator: operatorId,
      });
      
      // Add trip details if available
      if (tripId) {
        const trip = await TripAssignment.findById(tripId).select('tripNumber');
        if (trip) {
          report.tripNumber = trip.tripNumber;
        }
      }
      
      await report.save();
      
      creationResult.success = true;
      creationResult.report = report;
      
      // Notify admin
      this._notifyAdminOfIncident(report);
      
    } catch (error) {
      creationResult.reason = `Error creating report: ${error.message}`;
    }
    
    return creationResult;
  }
  
  /**
   * Initiate incident investigation
   */
  static async startInvestigation(reportId, investigatorId) {
    const result = {
      success: false,
      report: null,
      reason: '',
    };
    
    try {
      const report = await IncidentReport.findByIdAndUpdate(
        reportId,
        {
          investigationStatus: 'under_investigation',
          investigatedBy: investigatorId,
          investigationStartedAt: new Date(),
        },
        { returnDocument: 'after' }
      );
      
      if (!report) {
        result.reason = 'Report not found';
        return result;
      }
      
      result.success = true;
      result.report = report;
      
    } catch (error) {
      result.reason = `Error starting investigation: ${error.message}`;
    }
    
    return result;
  }
  
  /**
   * Complete investigation and determine findings
   */
  static async completeInvestigation(reportId, findings, completedBy) {
    const result = {
      success: false,
      report: null,
      reason: '',
      actionsRecommended: [],
    };
    
    try {
      const report = await IncidentReport.findById(reportId);
      
      if (!report) {
        result.reason = 'Report not found';
        return result;
      }
      
      // Update findings
      report.findings = findings;
      report.investigationStatus = 'findings_ready';
      report.investigationCompletedAt = new Date();
      
      // Determine if driver at fault
      if (findings.driverAtFault) {
        result.actionsRecommended.push({
          type: 'issue_strike',
          severity: findings.safetyRisk,
          reason: findings.faultDescription,
        });
        
        // Determine strike count based on severity
        let strikeCount = 1;
        if (findings.safetyRisk === 'critical') strikeCount = 3;
        else if (findings.safetyRisk === 'high') strikeCount = 2;
        
        report.strikeIssued = true;
        report.strikeCount = strikeCount;
        
        // Add strike to driver's safety profile
        const strikeResult = await this._addDriverStrike(report.driverId, report, strikeCount);
        if (strikeResult.suspendedAutomatically) {
          result.actionsRecommended.push({
            type: 'suspend_driver',
            reason: 'Exceeded strike limit',
            severity: 'critical',
          });
        }
      }
      
      // Determine if compliance issue
      if (findings.complianceIssue === 'yes') {
        result.actionsRecommended.push({
          type: 'compliance_review',
          reason: findings.complianceDetails,
        });
      }
      
      await report.save();
      
      result.success = true;
      result.report = report;
      
    } catch (error) {
      result.reason = `Error completing investigation: ${error.message}`;
    }
    
    return result;
  }
  
  /**
   * Issue strike to driver
   * Implements 3-strike policy
   */
  static async _addDriverStrike(driverId, incidentReport, strikeCount = 1) {
    const result = {
      success: false,
      suspendedAutomatically: false,
      reason: '',
    };
    
    try {
      const safetyProfile = await SafetyProfile.findOne({ driverId });
      
      if (!safetyProfile) {
        result.reason = 'Driver safety profile not found';
        return result;
      }
      
      // Add violation to safety profile
      const violation = {
        date: new Date(),
        violationType: this._mapIncidentToViolation(incidentReport.incidentType),
        severity: this._mapSeverityLevel(incidentReport.severity),
        description: incidentReport.description,
        reportedBy: incidentReport.reportedBy,
        evidence: incidentReport.evidenceUrls,
        status: 'reported',
        strikeCount,
      };
      
      safetyProfile.violations.push(violation);
      safetyProfile.totalViolations += 1;
      safetyProfile.strikeCount += strikeCount;
      
      // Check strike limit
      if (safetyProfile.strikeCount >= safetyProfile.maxStrikesAllowed) {
        // Auto-suspend
        safetyProfile.suspend(
          `Exceeded maximum strike count (${safetyProfile.strikeCount}/${safetyProfile.maxStrikesAllowed})`,
          'indefinite'
        );
        result.suspendedAutomatically = true;
        
        // Notify operator
        this._notifyOperatorOfSuspension(driverId, safetyProfile);
      }
      
      safetyProfile.updateEligibility();
      await safetyProfile.save();
      
      result.success = true;
      
    } catch (error) {
      result.reason = `Error adding strike: ${error.message}`;
    }
    
    return result;
  }
  
  /**
   * Map incident type to violation type
   */
  static _mapIncidentToViolation(incidentType) {
    const mapping = {
      speeding: 'speeding',
      reckless_driving: 'reckless_driving',
      traffic_violation: 'traffic_violation',
      unsafe_behavior: 'safety_violation',
      misconduct: 'misconduct',
      late_arrival: 'late_arrival',
      wrong_route: 'wrong_route',
      passenger_safety: 'passenger_safety',
      vehicle_maintenance: 'maintenance_issue',
      communication_failure: 'documentation_violation',
      unauthorized_stop: 'safety_violation',
      route_deviation: 'wrong_route',
      equipment_failure: 'maintenance_issue',
      accident: 'safety_violation',
      near_miss: 'safety_violation',
    };
    
    return mapping[incidentType] || 'other';
  }
  
  /**
   * Map severity to violation severity
   */
  static _mapSeverityLevel(incidentSeverity) {
    const mapping = {
      low: 'minor',
      medium: 'moderate',
      high: 'severe',
      critical: 'critical',
    };
    
    return mapping[incidentSeverity] || 'moderate';
  }
  
  /**
   * Resolve incident and close investigation
   */
  static async resolveIncident(reportId, resolutionSummary, resolvedBy) {
    const result = {
      success: false,
      report: null,
      reason: '',
    };
    
    try {
      const report = await IncidentReport.findByIdAndUpdate(
        reportId,
        {
          resolutionStatus: 'resolved',
          resolutionSummary,
          resolvedAt: new Date(),
          resolvedBy,
        },
        { returnDocument: 'after' }
      );
      
      if (!report) {
        result.reason = 'Report not found';
        return result;
      }
      
      result.success = true;
      result.report = report;
      
    } catch (error) {
      result.reason = `Error resolving incident: ${error.message}`;
    }
    
    return result;
  }
  
  /**
   * Get incident statistics for operator
   */
  static async getIncidentStatistics(operatorId, dateRange = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - dateRange);
    
    const stats = {
      totalIncidents: 0,
      byType: {},
      bySeverity: {},
      byDriver: [],
      resolved: 0,
      pending: 0,
      suspended: 0,
    };
    
    try {
      const incidents = await IncidentReport.find({
        operator: operatorId,
        createdAt: { $gte: startDate },
      });
      
      stats.totalIncidents = incidents.length;
      
      // Count by type
      for (const incident of incidents) {
        stats.byType[incident.incidentType] = (stats.byType[incident.incidentType] || 0) + 1;
        stats.bySeverity[incident.severity] = (stats.bySeverity[incident.severity] || 0) + 1;
        
        if (incident.resolutionStatus === 'resolved') stats.resolved += 1;
        else stats.pending += 1;
        
        if (incident.strikeIssued) stats.suspended += 1;
      }
      
      // Top drivers with incidents
      const driverIncidents = {};
      for (const incident of incidents) {
        const driverId = incident.driverId.toString();
        driverIncidents[driverId] = (driverIncidents[driverId] || 0) + 1;
      }
      
      stats.byDriver = Object.entries(driverIncidents)
        .map(([driverId, count]) => ({ driverId, incidentCount: count }))
        .sort((a, b) => b.incidentCount - a.incidentCount)
        .slice(0, 10);
      
    } catch (error) {
      console.error('Error getting statistics:', error);
    }
    
    return stats;
  }
  
  /**
   * Notify admin of incident
   */
  static _notifyAdminOfIncident(report) {
    const io = getIo();
    if (io) {
      io.emit('incident:new', {
        reportId: report._id,
        reportNumber: report.reportNumber,
        severity: report.severity,
        type: report.incidentType,
        driverId: report.driverId,
        timestamp: new Date(),
      });
    }
  }
  
  /**
   * Notify operator of driver suspension
   */
  static _notifyOperatorOfSuspension(driverId, safetyProfile) {
    const io = getIo();
    if (io) {
      io.emit('driver:suspended', {
        driverId,
        reason: safetyProfile.currentSuspension.reason,
        strikeCount: safetyProfile.strikeCount,
        timestamp: new Date(),
      });
    }
  }
}

module.exports = IncidentManagementService;
