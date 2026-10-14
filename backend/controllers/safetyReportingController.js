/**
 * Safety Reporting Controller
 * 
 * PURPOSE:
 * Handles HTTP requests for parent safety reports and ratings
 * - Submit safety reports
 * - Submit ratings/reviews
 * - Admin investigation management
 * - Safety statistics endpoints
 */

const SafetyReportingService = require('../services/safetyReportingService');
const { SEVERITY_LEVELS, INVESTIGATION_STATUS } = require('../models/ParentSafetyReport');

class SafetyReportingController {
  /**
   * POST /api/safety/report
   * Parent submits safety report
   */
  static async submitSafetyReport(req, res) {
    try {
      const parentId = req.user._id;
      const {
        tripId,
        driverId,
        studentName,
        reportType,
        severity,
        description,
        specificDetails,
        evidenceImages,
        isAnonymous,
        parentContact,
      } = req.body;

      // Validate required fields
      if (!tripId || !driverId || !studentName || !reportType || !severity || !description) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields',
        });
      }

      // Validate severity
      if (!Object.values(SEVERITY_LEVELS).includes(severity)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid severity level',
        });
      }

      const report = await SafetyReportingService.submitSafetyReport({
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
      });

      res.status(201).json({
        success: true,
        message: 'Safety report submitted successfully',
        data: report,
      });
    } catch (error) {
      console.error('Error submitting safety report:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * POST /api/safety/rating
   * Parent submits rating and review
   */
  static async submitRatingReview(req, res) {
    try {
      const parentId = req.user._id;
      const {
        tripId,
        driverId,
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
      } = req.body;

      // Validate required ratings
      if (!tripId || !driverId || !overallRating) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: tripId, driverId, overallRating',
        });
      }

      const ratingReview = await SafetyReportingService.submitRatingReview({
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
      });

      res.status(201).json({
        success: true,
        message: 'Rating and review submitted successfully',
        data: ratingReview,
      });
    } catch (error) {
      console.error('Error submitting rating review:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * GET /api/safety/admin/pending
   * Admin: Get pending safety reports for review
   */
  static async getPendingReports(req, res) {
    try {
      const { limit = 50, skip = 0 } = req.query;

      const result = await SafetyReportingService.getPendingReports(
        parseInt(limit),
        parseInt(skip)
      );

      res.json({
        success: true,
        data: result.pending,
        total: result.total,
        limit: parseInt(limit),
        skip: parseInt(skip),
      });
    } catch (error) {
      console.error('Error getting pending reports:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * POST /api/safety/admin/start-investigation
   * Admin: Start investigation on report
   */
  static async startInvestigation(req, res) {
    try {
      const adminId = req.user._id;
      const { reportId, initialNotes } = req.body;

      if (!reportId) {
        return res.status(400).json({
          success: false,
          message: 'Missing reportId',
        });
      }

      const report = await SafetyReportingService.startInvestigation(
        reportId,
        adminId,
        initialNotes
      );

      res.json({
        success: true,
        message: 'Investigation started',
        data: report,
      });
    } catch (error) {
      console.error('Error starting investigation:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * POST /api/safety/admin/complete-investigation
   * Admin: Complete investigation and resolve report
   */
  static async completeInvestigation(req, res) {
    try {
      const adminId = req.user._id;
      const { reportId, resolutionType, resolutionNotes, disciplinaryAction } = req.body;

      if (!reportId || !resolutionType) {
        return res.status(400).json({
          success: false,
          message: 'Missing reportId or resolutionType',
        });
      }

      const report = await SafetyReportingService.completeInvestigation(
        reportId,
        adminId,
        resolutionType,
        resolutionNotes,
        disciplinaryAction
      );

      res.json({
        success: true,
        message: 'Investigation completed',
        data: report,
      });
    } catch (error) {
      console.error('Error completing investigation:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * GET /api/safety/driver/:driverId/stats
   * Get driver safety statistics
   */
  static async getDriverSafetyStats(req, res) {
    try {
      const { driverId } = req.params;

      const stats = await SafetyReportingService.getDriverSafetyStats(driverId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error('Error getting driver safety stats:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * GET /api/safety/driver/:driverId/reviews
   * Get public reviews for driver
   */
  static async getDriverPublicReviews(req, res) {
    try {
      const { driverId } = req.params;
      const { limit = 10 } = req.query;

      const reviews = await SafetyReportingService.getDriverPublicReviews(
        driverId,
        parseInt(limit)
      );

      res.json({
        success: true,
        data: reviews,
      });
    } catch (error) {
      console.error('Error getting driver reviews:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * GET /api/safety/admin/summary
   * Admin: Get safety reporting summary for dashboard
   */
  static async getSafetyReportSummary(req, res) {
    try {
      const summary = await SafetyReportingService.getSafetyReportSummary();

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      console.error('Error getting safety report summary:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

module.exports = SafetyReportingController;
