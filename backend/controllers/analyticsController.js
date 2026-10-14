/**
 * Analytics Controller
 * 
 * PURPOSE:
 * Handles HTTP requests for transportation analytics and reporting
 * - Real-time operational metrics
 * - Historical analytics queries
 * - Performance trends
 * - Peak hours analysis
 */

const AnalyticsService = require('../services/analyticsService');

class AnalyticsController {
  /**
   * GET /api/analytics/real-time
   * Get real-time operational metrics
   * For live operations dashboard
   */
  static async getRealTimeMetrics(req, res) {
    try {
      const metrics = await AnalyticsService.getRealTimeMetrics();

      res.json({
        success: true,
        data: metrics,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Error getting real-time metrics:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * GET /api/analytics/summary
   * Get summary analytics for date range
   */
  static async getAnalyticsSummary(req, res) {
    try {
      const { startDate, endDate, entityType } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Missing required query params: startDate, endDate',
        });
      }

      const analytics = await AnalyticsService.getAnalyticsForDateRange(
        new Date(startDate),
        new Date(endDate),
        entityType || 'system'
      );

      res.json({
        success: true,
        data: analytics,
        count: analytics.length,
      });
    } catch (error) {
      console.error('Error getting analytics summary:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * GET /api/analytics/trends
   * Get performance trends (week-over-week, month-over-month)
   */
  static async getPerformanceTrends(req, res) {
    try {
      const trends = await AnalyticsService.getPerformanceTrends();

      res.json({
        success: true,
        data: trends,
      });
    } catch (error) {
      console.error('Error getting performance trends:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * GET /api/analytics/peak-hours
   * Get peak hours analysis for today
   */
  static async getPeakHoursAnalysis(req, res) {
    try {
      const { date } = req.query;

      const peakHours = await AnalyticsService.getPeakHoursAnalysis(
        date ? new Date(date) : new Date()
      );

      res.json({
        success: true,
        data: peakHours,
      });
    } catch (error) {
      console.error('Error getting peak hours analysis:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * GET /api/analytics/driver/:driverId
   * Get analytics for specific driver
   */
  static async getDriverAnalytics(req, res) {
    try {
      const { driverId } = req.params;
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Missing required query params: startDate, endDate',
        });
      }

      const analytics = await AnalyticsService.getAnalyticsForDateRange(
        new Date(startDate),
        new Date(endDate),
        'driver'
      );

      // Filter for specific driver
      const driverAnalytics = analytics.filter((a) => a.entityId.toString() === driverId);

      res.json({
        success: true,
        data: driverAnalytics,
        count: driverAnalytics.length,
      });
    } catch (error) {
      console.error('Error getting driver analytics:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * GET /api/analytics/school/:schoolId
   * Get analytics for specific school
   */
  static async getSchoolAnalytics(req, res) {
    try {
      const { schoolId } = req.params;
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Missing required query params: startDate, endDate',
        });
      }

      const analytics = await AnalyticsService.getAnalyticsForDateRange(
        new Date(startDate),
        new Date(endDate),
        'school'
      );

      // Filter for specific school
      const schoolAnalytics = analytics.filter((a) => a.entityId.toString() === schoolId);

      res.json({
        success: true,
        data: schoolAnalytics,
        count: schoolAnalytics.length,
      });
    } catch (error) {
      console.error('Error getting school analytics:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * POST /api/analytics/calculate-daily
   * Admin: Trigger daily analytics calculation
   */
  static async calculateDailyAnalytics(req, res) {
    try {
      const { date } = req.body;

      // Run in background (don't wait)
      AnalyticsService.calculateDailyAnalytics(date ? new Date(date) : new Date()).catch((error) => {
        console.error('Error calculating daily analytics:', error);
      });

      res.json({
        success: true,
        message: 'Daily analytics calculation started',
      });
    } catch (error) {
      console.error('Error triggering daily analytics:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * GET /api/analytics/health-score
   * Get overall system health score
   */
  static async getSystemHealthScore(req, res) {
    try {
      const { date } = req.query;

      const queryDate = date ? new Date(date) : new Date();
      queryDate.setHours(0, 0, 0, 0);

      const { TransportationAnalytics } = require('../models/TransportationAnalytics');
      const analytics = await TransportationAnalytics.findOne({
        date: queryDate,
        entityType: 'system',
        periodType: 'daily',
      });

      if (!analytics) {
        return res.status(404).json({
          success: false,
          message: 'Analytics not found for this date',
        });
      }

      res.json({
        success: true,
        data: {
          healthScore: analytics.healthScore,
          efficiencyScore: analytics.efficiencyScore,
          safetyScore: analytics.safety.safetyScore,
          onTimePercentage: analytics.onTimePerformance.onTimePercentage,
          completionRate: analytics.trips.completionRate,
          timestamp: analytics.date,
        },
      });
    } catch (error) {
      console.error('Error getting health score:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * GET /api/analytics/export
   * Export analytics data (CSV or JSON)
   */
  static async exportAnalytics(req, res) {
    try {
      const { startDate, endDate, format = 'json' } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Missing required query params: startDate, endDate',
        });
      }

      const { TransportationAnalytics } = require('../models/TransportationAnalytics');
      const analytics = await TransportationAnalytics.find({
        date: { $gte: new Date(startDate), $lte: new Date(endDate) },
        entityType: 'system',
        periodType: 'daily',
      }).sort({ date: -1 });

      if (format === 'csv') {
        // Convert to CSV
        const csv = this.convertToCSV(analytics);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="analytics.csv"');
        res.send(csv);
      } else {
        // Return JSON
        res.json({
          success: true,
          data: analytics,
          count: analytics.length,
        });
      }
    } catch (error) {
      console.error('Error exporting analytics:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  // ========== HELPER METHODS ==========

  static convertToCSV(analytics) {
    if (!analytics || analytics.length === 0) return '';

    const headers = [
      'Date',
      'Total Trips',
      'Completed Trips',
      'Completion Rate',
      'On Time Percentage',
      'Safety Score',
      'Students Transported',
    ];

    const rows = analytics.map((a) => [
      a.date.toISOString().split('T')[0],
      a.trips.total,
      a.trips.completed,
      a.trips.completionRate + '%',
      a.onTimePerformance.onTimePercentage + '%',
      a.safety.safetyScore,
      a.capacity.studentsTransported,
    ]);

    const csv =
      headers.join(',') +
      '\n' +
      rows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');

    return csv;
  }
}

module.exports = AnalyticsController;
