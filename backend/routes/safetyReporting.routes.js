/**
 * Safety Reporting Routes
 * 
 * Parent safety reports and ratings endpoints
 * - Submit safety reports
 * - Submit ratings/reviews
 * - Admin investigation management
 * - Safety statistics queries
 */

const express = require('express');
const router = express.Router();
const SafetyReportingController = require('../controllers/safetyReportingController');
const { requireAdmin, requireParent, requireAuth } = require('../middleware/auth');

/**
 * PARENT ENDPOINTS
 */

// Submit safety report
router.post('/report', requireParent, SafetyReportingController.submitSafetyReport);

// Submit rating and review
router.post('/rating', requireParent, SafetyReportingController.submitRatingReview);

/**
 * PUBLIC ENDPOINTS (authenticated)
 */

// Get driver public reviews
router.get('/driver/:driverId/reviews', requireAuth, SafetyReportingController.getDriverPublicReviews);

// Get driver safety statistics
router.get('/driver/:driverId/stats', requireAuth, SafetyReportingController.getDriverSafetyStats);

/**
 * ADMIN ENDPOINTS
 * All require admin role
 */

// Get pending reports for review
router.get('/admin/pending', requireAdmin, SafetyReportingController.getPendingReports);

// Get safety reporting summary
router.get('/admin/summary', requireAdmin, SafetyReportingController.getSafetyReportSummary);

// Start investigation
router.post('/admin/start-investigation', requireAdmin, SafetyReportingController.startInvestigation);

// Complete investigation
router.post('/admin/complete-investigation', requireAdmin, SafetyReportingController.completeInvestigation);

module.exports = router;
