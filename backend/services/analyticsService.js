/**
 * Analytics Service
 * 
 * PURPOSE:
 * Aggregates transportation metrics for operational dashboards and reporting:
 * - Real-time operational metrics
 * - Driver performance scoring
 * - On-time performance tracking
 * - Safety metrics aggregation
 * - Financial metrics estimation
 * 
 * ARCHITECTURE:
 * Pre-aggregated metrics for fast dashboard queries
 * Scheduled jobs to calculate and store analytics
 * 
 * REAL-WORLD: Similar to dispatch center analytics
 * Grab, Uber, and fleet management systems all need fast metrics
 */

const { TransportationAnalytics, PERIOD_TYPES, ENTITY_TYPES } = require('../models/TransportationAnalytics');
const TripAssignment = require('../models/TripAssignment');
const TripSafetyAlert = require('../models/TripSafetyAlert');
const DriverStats = require('../models/DriverStats');
const Vehicle = require('../models/Vehicle');
const SafetyReportingService = require('./safetyReportingService');

class AnalyticsService {
  /**
   * Calculate and store daily analytics
   * Should be called once per day (e.g., at midnight)
   */
  static async calculateDailyAnalytics(date = new Date()) {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      // Calculate system-wide analytics
      const systemAnalytics = await this.calculateSystemAnalytics(startOfDay, endOfDay);
      await this.storeAnalytics({
        ...systemAnalytics,
        periodType: PERIOD_TYPES.DAILY,
        date: startOfDay,
        entityType: ENTITY_TYPES.SYSTEM,
      });

      // Calculate per-driver analytics
      const drivers = await TripAssignment.distinct('driverId', {
        createdAt: { $gte: startOfDay, $lte: endOfDay },
      });

      for (const driverId of drivers) {
        const driverAnalytics = await this.calculateDriverAnalytics(driverId, startOfDay, endOfDay);
        await this.storeAnalytics({
          ...driverAnalytics,
          periodType: PERIOD_TYPES.DAILY,
          date: startOfDay,
          entityType: ENTITY_TYPES.DRIVER,
          entityId: driverId,
        });
      }

      // Calculate per-school analytics
      const schools = await TripAssignment.distinct('schoolId', {
        createdAt: { $gte: startOfDay, $lte: endOfDay },
      });

      for (const schoolId of schools) {
        const schoolAnalytics = await this.calculateSchoolAnalytics(schoolId, startOfDay, endOfDay);
        await this.storeAnalytics({
          ...schoolAnalytics,
          periodType: PERIOD_TYPES.DAILY,
          date: startOfDay,
          entityType: ENTITY_TYPES.SCHOOL,
          entityId: schoolId,
        });
      }

      console.log(`[ANALYTICS] Daily analytics calculated for ${date.toDateString()}`);
    } catch (error) {
      console.error('Error calculating daily analytics:', error);
      throw error;
    }
  }

  /**
   * Calculate system-wide analytics for date range
   */
  static async calculateSystemAnalytics(startDate, endDate) {
    try {
      // Get all trips in period
      const trips = await TripAssignment.find({
        createdAt: { $gte: startDate, $lte: endDate },
      });

      // Get all alerts in period
      const alerts = await TripSafetyAlert.find({
        createdAt: { $gte: startDate, $lte: endDate },
      });

      const completedTrips = trips.filter((t) => t.status === 'completed').length;
      const cancelledTrips = trips.filter((t) => t.status === 'cancelled').length;

      // On-time performance
      const onTimeTrips = trips.filter((t) => {
        const delay = t.actualPickupTime ? t.actualPickupTime - t.scheduledPickupTime : 0;
        return delay <= 300000; // 5 minutes tolerance
      }).length;

      // Student count
      const totalStudents = trips.reduce((sum, t) => sum + (t.studentCount || 0), 0);

      // Average students per trip
      const avgStudents = trips.length > 0 ? totalStudents / trips.length : 0;

      // Calculate safety score
      const speedViolations = alerts.filter((a) => a.alertType === 'speed_violation').length;
      const safetyScore = Math.max(0, 100 - speedViolations * 5);

      return {
        trips: {
          total: trips.length,
          completed: completedTrips,
          cancelled: cancelledTrips,
          completionRate: trips.length > 0 ? Math.round((completedTrips / trips.length) * 100) : 0,
        },
        onTimePerformance: {
          onTimePickups: onTimeTrips,
          latePickups: trips.length - onTimeTrips,
          earlyPickups: 0,
          averageDelayMinutes: this.calculateAverageDelay(trips),
          onTimePercentage: trips.length > 0 ? Math.round((onTimeTrips / trips.length) * 100) : 0,
        },
        safety: {
          speedViolations,
          safetyAlerts: alerts.length,
          safetyScore,
        },
        capacity: {
          studentsTransported: totalStudents,
          averageStudentsPerTrip: Math.round(avgStudents * 10) / 10,
        },
      };
    } catch (error) {
      console.error('Error calculating system analytics:', error);
      throw error;
    }
  }

  /**
   * Calculate driver-specific analytics
   */
  static async calculateDriverAnalytics(driverId, startDate, endDate) {
    try {
      const trips = await TripAssignment.find({
        driverId,
        createdAt: { $gte: startDate, $lte: endDate },
      });

      const completedTrips = trips.filter((t) => t.status === 'completed').length;

      // Safety stats
      const safetyStats = await SafetyReportingService.getDriverSafetyStats(driverId);

      // On-time
      const onTimeTrips = trips.filter((t) => {
        const delay = t.actualPickupTime ? t.actualPickupTime - t.scheduledPickupTime : 0;
        return delay <= 300000;
      }).length;

      return {
        trips: {
          total: trips.length,
          completed: completedTrips,
          completionRate: trips.length > 0 ? Math.round((completedTrips / trips.length) * 100) : 0,
        },
        onTimePerformance: {
          onTimePickups: onTimeTrips,
          onTimePercentage: trips.length > 0 ? Math.round((onTimeTrips / trips.length) * 100) : 0,
        },
        safety: {
          safetyScore: safetyStats.safetyScore,
          incidentReports: safetyStats.totalReports,
        },
        drivers: {
          activeDrivers: 1,
          averageRating: safetyStats.averageRating,
          totalRatings: safetyStats.reviewCount,
        },
      };
    } catch (error) {
      console.error('Error calculating driver analytics:', error);
      throw error;
    }
  }

  /**
   * Calculate school-specific analytics
   */
  static async calculateSchoolAnalytics(schoolId, startDate, endDate) {
    try {
      const trips = await TripAssignment.find({
        schoolId,
        createdAt: { $gte: startDate, $lte: endDate },
      });

      const completedTrips = trips.filter((t) => t.status === 'completed').length;
      const onTimeTrips = trips.filter((t) => {
        const delay = t.actualPickupTime ? t.actualPickupTime - t.scheduledPickupTime : 0;
        return delay <= 300000;
      }).length;

      const totalStudents = trips.reduce((sum, t) => sum + (t.studentCount || 0), 0);

      return {
        trips: {
          total: trips.length,
          completed: completedTrips,
          completionRate: trips.length > 0 ? Math.round((completedTrips / trips.length) * 100) : 0,
        },
        onTimePerformance: {
          onTimePickups: onTimeTrips,
          onTimePercentage: trips.length > 0 ? Math.round((onTimeTrips / trips.length) * 100) : 0,
        },
        students: {
          activeStudents: totalStudents,
          pickupsCompleted: completedTrips,
        },
      };
    } catch (error) {
      console.error('Error calculating school analytics:', error);
      throw error;
    }
  }

  /**
   * Get real-time metrics for operations dashboard
   */
  static async getRealTimeMetrics() {
    try {
      // Get active trips right now
      const activeTrips = await TripAssignment.find({
        status: { $in: ['assigned', 'in_progress', 'pickup'] },
      });

      // Get online drivers
      const onlineDrivers = await DriverStats.find({
        isOnline: true,
      });

      // Get critical alerts
      const criticalAlerts = await TripSafetyAlert.find({
        severity: 'critical',
        status: 'active',
      });

      // Get capacity usage
      const totalCapacity = await this.calculateSystemCapacity();
      const usedCapacity = activeTrips.reduce((sum, t) => sum + (t.studentCount || 0), 0);

      return {
        activeTrips: activeTrips.length,
        onlineDrivers: onlineDrivers.length,
        studentsActive: usedCapacity,
        capacityUtilization: totalCapacity > 0 ? Math.round((usedCapacity / totalCapacity) * 100) : 0,
        criticalAlerts: criticalAlerts.length,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('Error getting real-time metrics:', error);
      throw error;
    }
  }

  /**
   * Get historical analytics for date range
   */
  static async getAnalyticsForDateRange(startDate, endDate, entityType = ENTITY_TYPES.SYSTEM) {
    try {
      const analytics = await TransportationAnalytics.find({
        date: { $gte: startDate, $lte: endDate },
        entityType,
        periodType: PERIOD_TYPES.DAILY,
      }).sort({ date: -1 });

      return analytics;
    } catch (error) {
      console.error('Error getting analytics for date range:', error);
      throw error;
    }
  }

  /**
   * Get performance trends (week-over-week, month-over-month)
   */
  static async getPerformanceTrends() {
    try {
      const today = new Date();
      const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const twoWeeksAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);

      const thisWeek = await this.getAnalyticsForDateRange(lastWeek, today);
      const previousWeek = await this.getAnalyticsForDateRange(twoWeeksAgo, lastWeek);

      // Calculate averages
      const thisWeekAvg = this.calculateAverageMetrics(thisWeek);
      const previousWeekAvg = this.calculateAverageMetrics(previousWeek);

      return {
        thisWeek: thisWeekAvg,
        previousWeek: previousWeekAvg,
        trends: this.calculateTrends(thisWeekAvg, previousWeekAvg),
      };
    } catch (error) {
      console.error('Error getting performance trends:', error);
      throw error;
    }
  }

  /**
   * Get peak hours analysis
   */
  static async getPeakHoursAnalysis(date = new Date()) {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const peakHours = await TripAssignment.aggregate([
        {
          $match: {
            createdAt: { $gte: startOfDay, $lte: endOfDay },
          },
        },
        {
          $group: {
            _id: { $hour: '$createdAt' },
            tripsCount: { $sum: 1 },
            avgDelay: { $avg: '$delayMinutes' },
          },
        },
        {
          $sort: { _id: 1 },
        },
      ]);

      return peakHours.map((hour) => ({
        hour: hour._id,
        tripsCount: hour.tripsCount,
        averageWaitTime: Math.round(hour.avgDelay || 0),
      }));
    } catch (error) {
      console.error('Error getting peak hours analysis:', error);
      throw error;
    }
  }

  // ========== HELPER METHODS ==========

  static async storeAnalytics(analyticsData) {
    try {
      // Check if already exists for this period/entity
      const existing = await TransportationAnalytics.findOne({
        date: analyticsData.date,
        entityType: analyticsData.entityType,
        entityId: analyticsData.entityId,
        periodType: analyticsData.periodType,
      });

      if (existing) {
        // Update existing
        Object.assign(existing, analyticsData);
        await existing.save();
      } else {
        // Create new
        const analytics = new TransportationAnalytics(analyticsData);
        await analytics.save();
      }
    } catch (error) {
      console.error('Error storing analytics:', error);
      throw error;
    }
  }

  static calculateAverageDelay(trips) {
    if (trips.length === 0) return 0;

    const totalDelay = trips.reduce((sum, trip) => {
      if (trip.actualPickupTime && trip.scheduledPickupTime) {
        const delay = trip.actualPickupTime - trip.scheduledPickupTime;
        return sum + delay;
      }
      return sum;
    }, 0);

    return Math.round((totalDelay / trips.length / 60000) * 10) / 10; // Convert ms to minutes
  }

  static async calculateSystemCapacity() {
    try {
      const vehicles = await Vehicle.find({ status: 'active' });
      return vehicles.reduce((sum, v) => sum + (v.capacity || 0), 0);
    } catch (error) {
      console.error('Error calculating system capacity:', error);
      return 0;
    }
  }

  static calculateAverageMetrics(analytics) {
    if (analytics.length === 0) return null;

    const avg = {
      completionRate: 0,
      onTimePercentage: 0,
      safetyScore: 0,
      capacityUtilization: 0,
    };

    analytics.forEach((a) => {
      avg.completionRate += a.trips?.completionRate || 0;
      avg.onTimePercentage += a.onTimePerformance?.onTimePercentage || 0;
      avg.safetyScore += a.safety?.safetyScore || 0;
      avg.capacityUtilization += a.capacity?.capacityUtilization || 0;
    });

    Object.keys(avg).forEach((key) => {
      avg[key] = Math.round((avg[key] / analytics.length) * 10) / 10;
    });

    return avg;
  }

  static calculateTrends(current, previous) {
    if (!current || !previous) return null;

    return {
      completionRate: current.completionRate - previous.completionRate,
      onTimePercentage: current.onTimePercentage - previous.onTimePercentage,
      safetyScore: current.safetyScore - previous.safetyScore,
      capacityUtilization: current.capacityUtilization - previous.capacityUtilization,
    };
  }
}

module.exports = AnalyticsService;
