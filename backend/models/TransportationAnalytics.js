/**
 * Transportation Analytics Model
 * 
 * PURPOSE:
 * Aggregated metrics and analytics data for operations monitoring and reporting.
 * Supports daily, weekly, monthly, and custom period analytics.
 * 
 * BUSINESS LOGIC:
 * - Pre-aggregated metrics for fast dashboard queries
 * - Time-series data structure
 * - Supports drill-down analytics
 * - Revenue and profitability tracking
 * - Safety metrics aggregation
 * 
 * REAL-WORLD APPLICATION:
 * Operations dashboards need fast metrics - pre-aggregation prevents slow queries.
 * Real-time aggregation would query millions of trips - not scalable.
 * Analytics model provides instant access to key metrics.
 * 
 * SCALABILITY:
 * - Indexed by period and date for time-series queries
 * - Supports sharding by date for growth
 * - TTL indexes for auto-cleanup of old data
 * - Ready for time-series database migration
 */

const mongoose = require('mongoose');

/**
 * Analytics Period Types
 */
const PERIOD_TYPES = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  CUSTOM: 'custom',
};

/**
 * Entity Types (what we're tracking)
 */
const ENTITY_TYPES = {
  SYSTEM: 'system', // Platform-wide metrics
  DRIVER: 'driver', // Individual driver metrics
  VEHICLE: 'vehicle', // Vehicle metrics
  SCHOOL: 'school', // School metrics
  ROUTE: 'route', // Route metrics
};

const transportationAnalyticsSchema = new mongoose.Schema(
  {
    // Time Period
    periodType: {
      type: String,
      enum: Object.values(PERIOD_TYPES),
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    year: Number,
    month: Number,
    week: Number,
    day: Number,
    // Entity Tracked
    entityType: {
      type: String,
      enum: Object.values(ENTITY_TYPES),
      required: true,
      index: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      description: 'If entityType is driver/vehicle/school/route, this is their ID',
      index: true,
    },
    entityName: String,
    // ========== OPERATIONAL METRICS ==========
    trips: {
      total: {
        type: Number,
        default: 0,
      },
      completed: {
        type: Number,
        default: 0,
      },
      cancelled: {
        type: Number,
        default: 0,
      },
      completionRate: {
        type: Number,
        description: 'Percentage (0-100)',
      },
    },
    // ========== PERFORMANCE METRICS ==========
    onTimePerformance: {
      onTimePickups: {
        type: Number,
        default: 0,
      },
      latePickups: {
        type: Number,
        default: 0,
      },
      earlyPickups: {
        type: Number,
        default: 0,
      },
      averageDelayMinutes: Number,
      onTimePercentage: Number, // 0-100
      maxDelayMinutes: Number,
    },
    routeEfficiency: {
      averageRouteTime: Number, // minutes
      averageDistanceKm: Number,
      plannedVsActualTime: Number, // ratio
      routeOptimizationScore: {
        type: Number,
        min: 0,
        max: 100,
      },
    },
    // ========== SAFETY METRICS ==========
    safety: {
      speedViolations: {
        type: Number,
        default: 0,
      },
      harshBrakingEvents: {
        type: Number,
        default: 0,
      },
      routeDeviations: {
        type: Number,
        default: 0,
      },
      safetyAlerts: {
        type: Number,
        default: 0,
      },
      incidentReports: {
        type: Number,
        default: 0,
      },
      safetyScore: {
        type: Number,
        min: 0,
        max: 100,
        description: '100 = perfect safety record',
      },
    },
    // ========== DRIVER METRICS ==========
    drivers: {
      activeDrivers: Number,
      onlineDrivers: Number,
      averageRating: Number, // 1-5 stars
      totalRatings: Number,
      suspendedDrivers: Number,
    },
    // ========== VEHICLE METRICS ==========
    vehicles: {
      activeVehicles: Number,
      inServiceVehicles: Number,
      maintenanceRequired: Number,
      averageCapacityUsage: Number, // Percentage
      averageStudentsPerTrip: Number,
    },
    // ========== STUDENT/PARENT METRICS ==========
    students: {
      activeStudents: Number,
      pickupsCompleted: Number,
      parentComplaints: Number,
      parentSatisfactionScore: Number, // 1-5
    },
    // ========== FINANCIAL METRICS ==========
    financial: {
      estimatedRevenue: Number, // Based on trips
      costPerTrip: Number,
      profitMargin: Number, // Percentage
      totalCosts: Number,
      estimatedProfit: Number,
    },
    // ========== CAPACITY METRICS ==========
    capacity: {
      totalCapacityAvailable: Number,
      studentsTransported: Number,
      capacityUtilization: Number, // Percentage
      peakCapacityUsage: Number, // Percentage
    },
    // ========== ALERT & INCIDENT METRICS ==========
    incidents: {
      totalIncidents: Number,
      criticalIncidents: Number,
      unresolvedIncidents: Number,
      averageResolutionTimeHours: Number,
    },
    // ========== PARENT ENGAGEMENT ==========
    parentEngagement: {
      ratingSubmitted: Number,
      reviewsWritten: Number,
      safetyReportsSubmitted: Number,
      complaintResolutionRate: Number, // Percentage
    },
    // ========== PEAK HOURS ANALYSIS ==========
    peakHours: [
      {
        hour: Number, // 0-23
        tripsCount: Number,
        averageWaitTime: Number,
        averagePickupDelay: Number,
      },
    ],
    // ========== ROUTE ANALYSIS ==========
    routes: [
      {
        routeId: mongoose.Schema.Types.ObjectId,
        routeName: String,
        tripsCompleted: Number,
        averageTimeMinutes: Number,
        averageDistanceKm: Number,
        averageStudents: Number,
        safetyIncidents: Number,
      },
    ],
    // ========== GEOGRAPHIC COVERAGE ==========
    coverage: {
      schoolsServed: Number,
      areasServed: Number,
      averageServiceRadius: Number, // km
      busyAreas: [String], // Geographic areas with high demand
    },
    // ========== NOTES & OBSERVATIONS ==========
    notes: String,
    keyInsights: [String], // Actionable insights for operations
    recommendations: [String], // Suggested improvements
    // ========== DATA QUALITY ==========
    dataCompleteness: Number, // Percentage 0-100
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Indexes for Time-Series Queries
transportationAnalyticsSchema.index({ date: -1, entityType: 1, entityId: 1 });
transportationAnalyticsSchema.index({ periodType: 1, date: -1 });
transportationAnalyticsSchema.index({ entityType: 1, entityId: 1, date: -1 });
transportationAnalyticsSchema.index({ 'safety.safetyScore': 1, date: -1 });

// TTL Index: Keep only last 2 years of daily analytics
transportationAnalyticsSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: 730 * 24 * 60 * 60, // 2 years
    partialFilterExpression: { periodType: 'daily' },
  }
);

// Virtual: Calculate health score (composite metric)
transportationAnalyticsSchema.virtual('healthScore').get(function () {
  if (!this.trips.total) return 0;

  const safetyScore = (this.safety?.safetyScore || 0) * 0.4;
  const onTimeScore = (this.onTimePerformance?.onTimePercentage || 0) * 0.3;
  const capacityScore = (this.capacity?.capacityUtilization || 0) * 0.2;
  const parentScore = (this.students?.parentSatisfactionScore || 0) * 20 * 0.1; // Convert 1-5 to 0-100

  return Math.round(safetyScore + onTimeScore + capacityScore + parentScore);
});

// Virtual: Calculate efficiency score
transportationAnalyticsSchema.virtual('efficiencyScore').get(function () {
  if (!this.trips.total) return 0;

  const completionScore = (this.trips.completionRate || 0) * 0.5;
  const onTimeScore = (this.onTimePerformance?.onTimePercentage || 0) * 0.3;
  const capacityScore = (this.capacity?.capacityUtilization || 0) * 0.2;

  return Math.round(completionScore + onTimeScore + capacityScore);
});

transportationAnalyticsSchema.set('toJSON', { virtuals: true });
transportationAnalyticsSchema.set('toObject', { virtuals: true });

// Pre-save: Calculate derived fields
transportationAnalyticsSchema.pre('save', function (next) {
  // Calculate on-time percentage
  if (this.onTimePerformance) {
    const total = this.onTimePerformance.onTimePickups + this.onTimePerformance.latePickups;
    if (total > 0) {
      this.onTimePerformance.onTimePercentage = Math.round(
        (this.onTimePerformance.onTimePickups / total) * 100
      );
    }
  }

  // Calculate trip completion rate
  if (this.trips) {
    const total = this.trips.completed + this.trips.cancelled;
    if (total > 0) {
      this.trips.completionRate = Math.round((this.trips.completed / total) * 100);
    }
  }

  // Extract date components
  if (this.date) {
    const d = new Date(this.date);
    this.year = d.getFullYear();
    this.month = d.getMonth() + 1;
    this.day = d.getDate();
    // Simple week calculation
    const firstDay = new Date(d.getFullYear(), 0, 1);
    const pastDaysOfYear = (d - firstDay) / 86400000;
    this.week = Math.ceil((pastDaysOfYear + firstDay.getDay() + 1) / 7);
  }

  next();
});

const TransportationAnalytics = mongoose.model('TransportationAnalytics', transportationAnalyticsSchema);

module.exports = {
  TransportationAnalytics,
  PERIOD_TYPES,
  ENTITY_TYPES,
};
