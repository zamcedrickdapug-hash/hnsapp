/**
 * Verification Routes
 * 
 * Driver verification workflow endpoints
 * - Document upload
 * - Admin approval/rejection
 * - Status queries
 * - Document verification
 */

const express = require('express');
const router = express.Router();
const VerificationController = require('../controllers/verificationController');
const { requireAdmin, requireAuth } = require('../middleware/auth');

/**
 * PUBLIC ENDPOINTS (authenticated users)
 */

// Get verification status
router.get('/status/:driverId', requireAuth, VerificationController.getVerificationStatus);

// Upload document
router.post('/upload-document', requireAuth, VerificationController.uploadDocument);

/**
 * ADMIN ENDPOINTS
 * All require admin role
 */

// Get pending verifications for admin review
router.get('/admin/pending', requireAdmin, VerificationController.getPendingVerifications);

// Get verification summary
router.get('/admin/summary', requireAdmin, VerificationController.getVerificationSummary);

// Verify single document
router.post('/admin/verify-document', requireAdmin, VerificationController.verifyDocument);

// Reject single document
router.post('/admin/reject-document', requireAdmin, VerificationController.rejectDocument);

// Approve entire verification
router.post('/admin/approve', requireAdmin, VerificationController.approveVerification);

// Reject entire verification
router.post('/admin/reject', requireAdmin, VerificationController.rejectVerification);

// Suspend verification (for violations)
router.post('/admin/suspend', requireAdmin, VerificationController.suspendVerification);

module.exports = router;
