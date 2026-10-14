/**
 * Verification Controller
 * 
 * PURPOSE:
 * Handles HTTP requests for driver verification workflows
 * - Document upload endpoints
 * - Admin approval/rejection
 * - Verification status queries
 * 
 * PATTERN:
 * - Async/await error handling
 * - Input validation
 * - Response formatting
 * - Logging
 */

const VerificationService = require('../services/verificationService');
const { DriverVerification, VERIFICATION_STATUS } = require('../models/DriverVerification');

class VerificationController {
  /**
   * GET /api/verification/status/:driverId
   * Get driver's verification status
   */
  static async getVerificationStatus(req, res) {
    try {
      const { driverId } = req.params;

      const verification = await VerificationService.getVerificationStatus(driverId);

      if (!verification) {
        return res.status(404).json({
          success: false,
          message: 'Verification record not found',
        });
      }

      res.json({
        success: true,
        data: verification,
      });
    } catch (error) {
      console.error('Error getting verification status:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * POST /api/verification/upload-document
   * Upload driver document
   */
  static async uploadDocument(req, res) {
    try {
      const { driverId } = req.user; // From auth middleware
      const { documentType, fileUrl, fileName, expiryDate } = req.body;

      if (!documentType || !fileUrl || !fileName) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: documentType, fileUrl, fileName',
        });
      }

      const verification = await VerificationService.uploadDocument(
        driverId,
        documentType,
        fileUrl,
        fileName,
        expiryDate ? new Date(expiryDate) : null
      );

      res.json({
        success: true,
        message: 'Document uploaded successfully',
        data: verification,
      });
    } catch (error) {
      console.error('Error uploading document:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * POST /api/verification/admin/approve
   * Admin approves driver verification
   * Requires admin role
   */
  static async approveVerification(req, res) {
    try {
      const { driverId } = req.body;
      const adminId = req.user._id;
      const { approvalNotes } = req.body;

      if (!driverId) {
        return res.status(400).json({
          success: false,
          message: 'Missing driverId',
        });
      }

      const verification = await VerificationService.approveVerification(
        driverId,
        adminId,
        approvalNotes
      );

      res.json({
        success: true,
        message: 'Driver verification approved',
        data: verification,
      });
    } catch (error) {
      console.error('Error approving verification:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * POST /api/verification/admin/reject
   * Admin rejects driver verification
   */
  static async rejectVerification(req, res) {
    try {
      const { driverId, rejectionReason } = req.body;
      const adminId = req.user._id;

      if (!driverId || !rejectionReason) {
        return res.status(400).json({
          success: false,
          message: 'Missing driverId or rejectionReason',
        });
      }

      const verification = await VerificationService.rejectVerification(
        driverId,
        adminId,
        rejectionReason
      );

      res.json({
        success: true,
        message: 'Driver verification rejected',
        data: verification,
      });
    } catch (error) {
      console.error('Error rejecting verification:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * POST /api/verification/admin/suspend
   * Admin suspends driver verification
   */
  static async suspendVerification(req, res) {
    try {
      const { driverId, suspensionReason } = req.body;
      const adminId = req.user._id;

      if (!driverId || !suspensionReason) {
        return res.status(400).json({
          success: false,
          message: 'Missing driverId or suspensionReason',
        });
      }

      const verification = await VerificationService.suspendVerification(
        driverId,
        adminId,
        suspensionReason
      );

      res.json({
        success: true,
        message: 'Driver verification suspended',
        data: verification,
      });
    } catch (error) {
      console.error('Error suspending verification:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * GET /api/verification/admin/pending
   * Get all pending verifications for admin
   */
  static async getPendingVerifications(req, res) {
    try {
      const { limit = 50, skip = 0 } = req.query;

      const result = await VerificationService.getPendingVerifications(
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
      console.error('Error getting pending verifications:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * GET /api/verification/admin/summary
   * Get verification statistics for admin dashboard
   */
  static async getVerificationSummary(req, res) {
    try {
      const summary = await VerificationService.getVerificationSummary();

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      console.error('Error getting verification summary:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * POST /api/verification/verify-document
   * Admin verifies a single document
   */
  static async verifyDocument(req, res) {
    try {
      const { driverId, documentType, verificationNotes } = req.body;
      const adminId = req.user._id;

      if (!driverId || !documentType) {
        return res.status(400).json({
          success: false,
          message: 'Missing driverId or documentType',
        });
      }

      const verification = await VerificationService.verifyDocument(
        driverId,
        documentType,
        adminId,
        verificationNotes
      );

      res.json({
        success: true,
        message: 'Document verified',
        data: verification,
      });
    } catch (error) {
      console.error('Error verifying document:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * POST /api/verification/reject-document
   * Admin rejects a single document
   */
  static async rejectDocument(req, res) {
    try {
      const { driverId, documentType, rejectionReason } = req.body;
      const adminId = req.user._id;

      if (!driverId || !documentType || !rejectionReason) {
        return res.status(400).json({
          success: false,
          message: 'Missing driverId, documentType, or rejectionReason',
        });
      }

      const verification = await VerificationService.rejectDocument(
        driverId,
        documentType,
        adminId,
        rejectionReason
      );

      res.json({
        success: true,
        message: 'Document rejected',
        data: verification,
      });
    } catch (error) {
      console.error('Error rejecting document:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

module.exports = VerificationController;
