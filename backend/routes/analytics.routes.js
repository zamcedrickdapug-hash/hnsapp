/**
 * Analytics Routes
 * 
 * Transportation analytics and reporting endpoints
 * - Real-time operational metrics
 * - Historical analytics
 * - Performance trends
 * - Data export
 */

const express = require('express');
const router = express.Router();
const AnalyticsController = require('../controllers/analyticsController');
const { requireAdmin, requireAuth } = require('../middleware/auth');

/**
 * REAL-TIME METRICS
 */

// Get real-time operational metrics
router.get('/real-time', requireAuth, AnalyticsController.getRealTimeMetrics);

/**
 * ANALYTICS QUERIES
 */

// Get summary analytics for date range
router.get('/summary', requireAuth, AnalyticsController.getAnalyticsSummary);

// Get performance trends
router.get('/trends', requireAuth, AnalyticsController.getPerformanceTrends);

// Get peak hours analysis
router.get('/peak-hours', requireAuth, AnalyticsController.getPeakHoursAnalysis);

// Get driver-specific analytics
router.get('/driver/:driverId', requireAuth, AnalyticsController.getDriverAnalytics);

// Get school-specific analytics
router.get('/school/:schoolId', requireAuth, AnalyticsController.getSchoolAnalytics);

// Get system health score
router.get('/health-score', requireAuth, AnalyticsController.getSystemHealthScore);

/**
 * DATA EXPORT
 */

// Export analytics data (CSV or JSON)
router.get('/export', requireAuth, AnalyticsController.exportAnalytics);

/**
 * ADMIN ENDPOINTS
 * Manual analytics calculation triggers
 */

// Calculate daily analytics
router.post('/admin/calculate-daily', requireAdmin, AnalyticsController.calculateDailyAnalytics);

module.exports = router;
