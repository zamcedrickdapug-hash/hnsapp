/**
 * Safety Reporting Service
 * 
 * PURPOSE:
 * Handles parent safety reports and driver ratings/reviews including:
 * - Report submission and validation
 * - Investigation workflow
 * - Driver strike system (3 strikes = suspension)
 * - Admin review queue management
 * - Parent communication
 * 
 * ARCHITECTURE:
 * Service Pattern: Encapsulates safety reporting business logic
 * Scalability: Handles high-volume reports
 * Error Handling: Comprehensive validation and error logging
 * 
 * REAL-WORLD: Mirrors Uber/Grab complaint handling and driver rating systems
 */

const {
  ParentSafetyReport,
  RatingReview,
  SEVERITY_LEVELS,
  REPORT_TYPES,
  INVESTIGATION_STATUS,
  RESOLUTION_TYPES,
} = require('../models/ParentSafetyReport');
const User = require('../models/User');
const { DriverVerification, VERIFICATION_STATUS } = require('../models/DriverVerification');
const { getIo } = require('../socket');

class SafetyReportingService {
  /**
   * Submit parent safety report
   */
  static async submitSafetyReport(reportData) {
    try {
      const {
        tripId,
        driverId,
        parentId,
        studentName,
        reportType,
        severity,
        description,
        specificDetails,
        evidenceImages = [],
        isAnonymous = false,
        parentContact,
      } = reportData;

      // Validate required fields
      if (!tripId || !driverId || !parentId || !studentName || !reportType || !severity || !description) {
        throw new Error('Missing required fields');
      }

      // Create report
      const report = new ParentSafetyReport({
        tripId,
        driverId,
        parentId,
        studentName,
        reportType,
        severity,
        description,
        specificDetails,
        evidenceImages,
        isAnonymous,
        parentContact,
        investigationStatus: INVESTIGATION_STATUS.PENDING,
      });

      await report.save();

      // Notify admin immediately
      await this.notifyAdminNewReport(report);

      // Create escalation for critical reports
      if (severity === SEVERITY_LEVELS.CRITICAL) {
        await this.escalateReport(report._id);
      }

      return report;
    } catch (error) {
      console.error('Error submitting safety report:', error);
      throw error;
    }
  }

  /**
   * Start investigation of safety report
   */
  static async startInvestigation(reportId, adminId, initialNotes = null) {
    try {
      const report = await ParentSafetyReport.findById(reportId);
      if (!report) throw new Error('Report not found');

      report.investigationStatus = INVESTIGATION_STATUS.IN_PROGRESS;
      report.assignedToAdmin = adminId;
      report.investigationStartedAt = new Date();
      report.investigationNotes = initialNotes;

      await report.save();

      return report;
    } catch (error) {
      console.error('Error starting investigation:', error);
      throw error;
    }
  }

  /**
   * Complete investigation and resolve report
   */
  static async completeInvestigation(
    reportId,
    adminId,
    resolutionType,
    resolutionNotes,
    disciplinaryAction = null
  ) {
    try {
      const report = await ParentSafetyReport.findById(reportId);
      if (!report) throw new Error('Report not found');

      report.investigationStatus = INVESTIGATION_STATUS.COMPLETED;
      report.investigationCompletedAt = new Date();
      report.resolution = resolutionType;
      report.resolutionNotes = resolutionNotes;
      report.disciplinaryAction = disciplinaryAction;

      // Handle driver strike system
      let totalStrikes = 0;
      if (resolutionType === RESOLUTION_TYPES.DRIVER_STRIKE) {
        report.strikeGiven = true;

        // Get driver's existing strikes
        const existingReports = await ParentSafetyReport.countDocuments({
          driverId: report.driverId,
          strikeGiven: true,
          resolution: RESOLUTION_TYPES.DRIVER_STRIKE,
        });

        report.strikeNumber = existingReports + 1;
        totalStrikes = report.strikeNumber;
        report.totalDriverStrikes = totalStrikes;

        // After 3 strikes → suspend driver
        if (totalStrikes >= 3) {
          await this.suspendDriverAfterStrikes(report.driverId, adminId);
        }
      }

      await report.save();

      // Notify parent of resolution
      await this.notifyParentResolution(report);

      return report;
    } catch (error) {
      console.error('Error completing investigation:', error);
      throw error;
    }
  }

  /**
   * Suspend driver after 3 strikes
   */
  static async suspendDriverAfterStrikes(driverId, adminId) {
    try {
      const verification = await DriverVerification.findOne({ driverId });
      if (verification) {
        await verification.updateOne({
          status: VERIFICATION_STATUS.SUSPENDED,
          suspendedAt: new Date(),
        });
      }

      await User.findByIdAndUpdate(driverId, {
        status: 'suspended',
        suspensionReason: '3 safety strikes - automatic suspension',
        suspendedAt: new Date(),
      });

      // Notify admin
      const io = getIo();
      io.to('admin_room').emit('driver_suspended', {
        driverId,
        reason: '3 strikes',
        timestamp: new Date(),
      });

      console.log(`[SAFETY] Driver ${driverId} suspended after 3 strikes`);
    } catch (error) {
      console.error('Error suspending driver:', error);
      throw error;
    }
  }

  /**
   * Submit driver rating and review
   */
  static async submitRatingReview(reviewData) {
    try {
      const {
        tripId,
        driverId,
        parentId,
        overallRating,
        safetyRating,
        communicationRating,
        punctualityRating,
        vehicleConditionRating,
        title,
        review,
        highlights = [],
        concerns = [],
        isPublic = true,
        isAnonymous = false,
      } = reviewData;

      // Validate ratings are 1-5
      const ratings = [overallRating, safetyRating, communicationRating, punctualityRating, vehicleConditionRating];
      if (!ratings.every((r) => r >= 1 && r <= 5)) {
        throw new Error('All ratings must be between 1-5');
      }

      const ratingReview = new RatingReview({
        tripId,
        driverId,
        parentId,
        overallRating,
        safetyRating,
        communicationRating,
        punctualityRating,
        vehicleConditionRating,
        title,
        review,
        highlights,
        concerns,
        isPublic,
        isAnonymous,
        isApproved: true, // Auto-approve for now, could have content moderation
      });

      await ratingReview.save();

      // Update driver average rating
      await this.updateDriverAverageRating(driverId);

      return ratingReview;
    } catch (error) {
      console.error('Error submitting rating review:', error);
      throw error;
    }
  }

  /**
   * Get pending reports for admin review
   */
  static async getPendingReports(limit = 50, skip = 0) {
    try {
      const pending = await ParentSafetyReport.find({
        investigationStatus: INVESTIGATION_STATUS.PENDING,
      })
        .populate('driverId', 'name email')
        .populate('parentId', 'name email')
        .sort({ severity: -1, createdAt: -1 })
        .limit(limit)
        .skip(skip);

      const total = await ParentSafetyReport.countDocuments({
        investigationStatus: INVESTIGATION_STATUS.PENDING,
      });

      return { pending, total };
    } catch (error) {
      console.error('Error getting pending reports:', error);
      throw error;
    }
  }

  /**
   * Get public reviews for driver profile
   */
  static async getDriverPublicReviews(driverId, limit = 10) {
    try {
      const reviews = await RatingReview.find({
        driverId,
        isPublic: true,
        isApproved: true,
      })
        .select('-parentId') // Don't expose parent ID
        .sort({ createdAt: -1 })
        .limit(limit);

      return reviews;
    } catch (error) {
      console.error('Error getting driver reviews:', error);
      throw error;
    }
  }

  /**
   * Get driver safety statistics
   */
  static async getDriverSafetyStats(driverId) {
    try {
      // Get safety reports
      const reports = await ParentSafetyReport.find({ driverId });
      const criticalReports = reports.filter((r) => r.severity === SEVERITY_LEVELS.CRITICAL).length;
      const totalReports = reports.length;
      const unresolved = reports.filter((r) => r.investigationStatus !== INVESTIGATION_STATUS.COMPLETED).length;

      // Get strikes
      const strikes = reports.filter((r) => r.strikeGiven).length;

      // Get ratings
      const ratings = await RatingReview.find({ driverId, isApproved: true });
      const avgRating = ratings.length > 0 ? ratings.reduce((sum, r) => sum + r.overallRating, 0) / ratings.length : null;

      return {
        totalReports,
        criticalReports,
        unresolvedReports: unresolved,
        totalStrikes: strikes,
        averageRating: avgRating,
        reviewCount: ratings.length,
        safetyScore: this.calculateDriverSafetyScore(totalReports, strikes, avgRating),
      };
    } catch (error) {
      console.error('Error getting driver safety stats:', error);
      throw error;
    }
  }

  /**
   * Get safety report summary for dashboard
   */
  static async getSafetyReportSummary() {
    try {
      const stats = await ParentSafetyReport.aggregate([
        {
          $facet: {
            bySeverity: [
              {
                $group: {
                  _id: '$severity',
                  count: { $sum: 1 },
                },
              },
            ],
            byStatus: [
              {
                $group: {
                  _id: '$investigationStatus',
                  count: { $sum: 1 },
                },
              },
            ],
            total: [
              {
                $count: 'count',
              },
            ],
          },
        },
      ]);

      return {
        bySeverity: stats[0].bySeverity,
        byStatus: stats[0].byStatus,
        total: stats[0].total[0]?.count || 0,
      };
    } catch (error) {
      console.error('Error getting safety report summary:', error);
      throw error;
    }
  }

  // ========== HELPER METHODS ==========

  static async notifyAdminNewReport(report) {
    const io = getIo();
    io.to('admin_room').emit('new_safety_report', {
      reportId: report._id,
      driverId: report.driverId,
      severity: report.severity,
      reportType: report.reportType,
      timestamp: report.createdAt,
    });

    console.log(`[SAFETY] New ${report.severity} safety report submitted against driver ${report.driverId}`);
  }

  static async escalateReport(reportId) {
    try {
      const report = await ParentSafetyReport.findById(reportId);
      report.investigationStatus = INVESTIGATION_STATUS.ESCALATED;
      await report.save();

      const io = getIo();
      io.to('admin_room').emit('escalated_safety_report', {
        reportId,
        severity: 'critical',
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Error escalating report:', error);
    }
  }

  static async notifyParentResolution(report) {
    console.log(`[NOTIFICATION] Parent ${report.parentId} - Safety report resolved: ${report.resolution}`);
  }

  static async updateDriverAverageRating(driverId) {
    try {
      const ratings = await RatingReview.find({ driverId, isApproved: true });
      if (ratings.length > 0) {
        const avgRating = ratings.reduce((sum, r) => sum + r.overallRating, 0) / ratings.length;
        await User.findByIdAndUpdate(driverId, {
          averageRating: avgRating,
          totalRatings: ratings.length,
        });
      }
    } catch (error) {
      console.error('Error updating driver average rating:', error);
    }
  }

  static calculateDriverSafetyScore(reportCount, strikeCount, avgRating) {
    // Score: 100 - (reports * 5) - (strikes * 20) + (rating * 5)
    let score = 100;
    score -= reportCount * 5;
    score -= strikeCount * 20;
    if (avgRating) score += avgRating * 5;
    return Math.max(0, Math.min(100, score)); // Clamp 0-100
  }
}

module.exports = SafetyReportingService;
