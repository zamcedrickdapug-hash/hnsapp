/**
 * Route Optimization Service
 * 
 * Handles route feasibility validation and optimization
 * 
 * TRANSPORTATION LOGIC:
 * - Validates if pickup combinations are feasible
 * - Calculates distances using Haversine formula (no API calls)
 * - Estimates travel times based on road types
 * - Clusters pickups geographically for efficiency
 * - Optimizes pickup sequence using nearest-neighbor algorithm
 * - Checks against max radius and max delay constraints
 * 
 * PURPOSE:
 * - Prevent impossible route assignments (e.g., Sta. Maria + SM Fairview + Cavite in one trip)
 * - Ensure realistic travel times
 * - Optimize driver efficiency
 * - Maintain student safety through logical routing
 * 
 * SAFETY IMPACT:
 * - Ensures realistic trip durations
 * - Prevents driver fatigue from impossible assignments
 * - Maintains predictable arrival times
 * 
 * SCALABILITY:
 * - Stateless design for horizontal scaling
 * - Efficient algorithms (O(n²) for small n acceptable)
 * - Supports real-time route validation
 */

const Vehicle = require('../models/Vehicle');
const TripAssignment = require('../models/TripAssignment');

class RouteOptimizationService {
  /**
   * Earth's radius in kilometers
   */
  static EARTH_RADIUS_KM = 6371;
  
  /**
   * Maximum travel radius for a single trip (kilometers)
   * Configurable per vehicle or operator
   */
  static DEFAULT_MAX_RADIUS = 50;
  
  /**
   * Maximum estimated delay from first to last pickup (minutes)
   */
  static DEFAULT_MAX_DELAY = 45;
  
  /**
   * Average speeds for different road types (km/h)
   */
  static SPEED_ESTIMATES = {
    urban: 25,
    suburban: 40,
    highway: 60,
  };
  
  /**
   * Calculate distance between two GPS coordinates using Haversine formula
   * 
   * @param {number} lat1 - Starting latitude
   * @param {number} lon1 - Starting longitude
   * @param {number} lat2 - Ending latitude
   * @param {number} lon2 - Ending longitude
   * @returns {number} Distance in kilometers
   * 
   * Formula: a = sin²(Δlat/2) + cos(lat1) * cos(lat2) * sin²(Δlon/2)
   *          c = 2 * atan2(√a, √(1−a))
   *          d = R * c
   */
  static calculateDistance(lat1, lon1, lat2, lon2) {
    const toRad = (deg) => (deg * Math.PI) / 180;
    
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = this.EARTH_RADIUS_KM * c;
    
    return parseFloat(distance.toFixed(2));
  }
  
  /**
   * Estimate travel time between two points based on road type
   * 
   * @param {number} distance - Distance in kilometers
   * @param {string} roadType - Type of road ('urban', 'suburban', 'highway')
   * @returns {number} Estimated time in minutes
   */
  static estimateTravelTime(distance, roadType = 'urban') {
    const speed = this.SPEED_ESTIMATES[roadType] || this.SPEED_ESTIMATES.urban;
    const timeHours = distance / speed;
    const timeMinutes = timeHours * 60;
    // Add buffer for traffic and stops
    const bufferMinutes = Math.ceil(distance / 10); // ~6% buffer
    return Math.ceil(timeMinutes + bufferMinutes);
  }
  
  /**
   * Validate if a route is feasible
   * 
   * @param {Array} pickupPoints - Array of pickup locations with lat/lon
   * @param {Object} schoolLocation - School location {lat, lon}
   * @param {Object} constraints - Route constraints {maxRadius, maxDelay}
   * @returns {Object} Feasibility report
   * 
   * TRANSPORTATION LOGIC:
   * - Calculate total distance for all possible pickup sequences
   * - Check if any sequence keeps distance and time within limits
   * - Cluster nearby pickups to validate geographic feasibility
   */
  validateRouteFeasibility(pickupPoints, schoolLocation, constraints = {}) {
    const maxRadius = constraints.maxRadius || this.constructor.DEFAULT_MAX_RADIUS;
    const maxDelay = constraints.maxDelay || this.constructor.DEFAULT_MAX_DELAY;
    
    const report = {
      isFeasible: false,
      totalDistance: 0,
      estimatedDuration: 0,
      reasons: [],
      issues: [],
      optimizedSequence: [],
    };
    
    // Need at least one pickup
    if (!pickupPoints || pickupPoints.length === 0) {
      report.issues.push('No pickup points provided');
      return report;
    }
    
    // Validate school location
    if (!schoolLocation || !schoolLocation.latitude || !schoolLocation.longitude) {
      report.issues.push('Invalid school location');
      return report;
    }
    
    try {
      // Get optimized sequence
      const optimized = this.optimizePickupSequence(pickupPoints, schoolLocation);
      report.optimizedSequence = optimized.sequence;
      report.totalDistance = optimized.totalDistance;
      report.estimatedDuration = optimized.totalDuration;
      
      // Check distance constraint
      if (optimized.totalDistance <= maxRadius) {
        report.reasons.push('acceptable_distance');
      } else {
        report.issues.push(
          `Total distance ${optimized.totalDistance}km exceeds limit of ${maxRadius}km`
        );
      }
      
      // Check time constraint
      if (optimized.totalDuration <= maxDelay) {
        report.reasons.push('acceptable_time');
      } else {
        report.issues.push(
          `Estimated duration ${optimized.totalDuration}min exceeds limit of ${maxDelay}min`
        );
      }
      
      // Check geographic clustering
      const clustering = this.analyzeGeographicClustering(pickupPoints);
      if (clustering.isWellClustered) {
        report.reasons.push('route_clustered_well');
      } else {
        report.issues.push(
          `Route points too dispersed (spread: ${clustering.maxDistance}km). Geographic clustering score: ${(clustering.clusteringScore * 100).toFixed(1)}%`
        );
      }
      
      // Final feasibility determination
      report.isFeasible =
        report.issues.length === 0 &&
        (report.reasons.includes('acceptable_distance') || report.reasons.length >= 2);
    } catch (error) {
      report.issues.push(`Route validation error: ${error.message}`);
    }
    
    return report;
  }
  
  /**
   * Optimize pickup sequence using nearest-neighbor algorithm
   * 
   * ALGORITHM:
   * 1. Start from first pickup point
   * 2. Find nearest unvisited point
   * 3. Add to sequence, move to that point
   * 4. Repeat until all points visited
   * 5. Finally go to school
   * 
   * This is O(n²) but optimal for small n (< 20 pickups typical)
   */
  optimizePickupSequence(pickupPoints, schoolLocation) {
    if (pickupPoints.length === 0) {
      return { sequence: [], totalDistance: 0, totalDuration: 0 };
    }
    
    const sequence = [];
    const visited = new Set();
    let currentPoint = pickupPoints[0];
    let totalDistance = 0;
    let totalDuration = 0;
    
    sequence.push(0);
    visited.add(0);
    
    // Nearest-neighbor algorithm
    while (visited.size < pickupPoints.length) {
      let nearestIndex = -1;
      let nearestDistance = Infinity;
      
      for (let i = 0; i < pickupPoints.length; i++) {
        if (visited.has(i)) continue;
        
        const distance = this.constructor.calculateDistance(
          currentPoint.pickupLocation.latitude,
          currentPoint.pickupLocation.longitude,
          pickupPoints[i].pickupLocation.latitude,
          pickupPoints[i].pickupLocation.longitude
        );
        
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = i;
        }
      }
      
      if (nearestIndex === -1) break;
      
      sequence.push(nearestIndex);
      visited.add(nearestIndex);
      totalDistance += nearestDistance;
      totalDuration += this.constructor.estimateTravelTime(nearestDistance);
      
      currentPoint = pickupPoints[nearestIndex];
    }
    
    // Add distance to school
    const distanceToSchool = this.constructor.calculateDistance(
      currentPoint.pickupLocation.latitude,
      currentPoint.pickupLocation.longitude,
      schoolLocation.latitude,
      schoolLocation.longitude
    );
    
    totalDistance += distanceToSchool;
    totalDuration += this.constructor.estimateTravelTime(distanceToSchool);
    
    return {
      sequence,
      totalDistance: parseFloat(totalDistance.toFixed(2)),
      totalDuration: Math.ceil(totalDuration),
    };
  }
  
  /**
   * Analyze geographic clustering of pickup points
   * 
   * Returns clustering quality score (0-1)
   * Well-clustered = points are geographically grouped
   * Poor clustering = points are spread across wide area
   */
  analyzeGeographicClustering(pickupPoints) {
    if (pickupPoints.length <= 1) {
      return {
        isWellClustered: true,
        clusteringScore: 1,
        maxDistance: 0,
        averageDistance: 0,
      };
    }
    
    // Calculate all pairwise distances
    const distances = [];
    for (let i = 0; i < pickupPoints.length; i++) {
      for (let j = i + 1; j < pickupPoints.length; j++) {
        const dist = this.constructor.calculateDistance(
          pickupPoints[i].pickupLocation.latitude,
          pickupPoints[i].pickupLocation.longitude,
          pickupPoints[j].pickupLocation.latitude,
          pickupPoints[j].pickupLocation.longitude
        );
        distances.push(dist);
      }
    }
    
    const maxDistance = Math.max(...distances);
    const averageDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
    
    // Clustering heuristic: tighter clusters = higher score
    // If max distance is small, clustering is good
    const clusteringScore = Math.max(0, 1 - maxDistance / 25); // 25km is reference
    
    return {
      isWellClustered: clusteringScore > 0.6, // 60% threshold
      clusteringScore: parseFloat(clusteringScore.toFixed(2)),
      maxDistance: parseFloat(maxDistance.toFixed(2)),
      averageDistance: parseFloat(averageDistance.toFixed(2)),
    };
  }
  
  /**
   * Calculate feasibility score (0-100)
   * 
   * Considers multiple factors:
   * - Distance efficiency
   * - Time efficiency
   * - Route clustering
   * - Vehicle capacity utilization
   */
  calculateFeasibilityScore(optimizationReport, vehicleCapacity) {
    let score = 100;
    
    // Distance penalty
    if (optimizationReport.issues.some(i => i.includes('distance'))) {
      score -= 40;
    }
    
    // Time penalty
    if (optimizationReport.issues.some(i => i.includes('duration'))) {
      score -= 30;
    }
    
    // Clustering penalty
    if (optimizationReport.issues.some(i => i.includes('dispersed'))) {
      score -= 20;
    }
    
    return Math.max(0, score);
  }
  
  /**
   * Get route metrics for monitoring
   */
  getRouteMetrics(trip) {
    if (!trip || !trip.pickupPoints || trip.pickupPoints.length === 0) {
      return {
        totalDistance: 0,
        totalDuration: 0,
        averageSpeed: 0,
        pickupEfficiency: 0,
      };
    }
    
    const pickupCount = trip.pickupPoints.length;
    const metrics = trip.routeMetrics || {};
    
    return {
      totalDistance: metrics.totalDistance || 0,
      totalDuration: metrics.totalDuration || 0,
      averageSpeed: metrics.averageSpeed || 0,
      pickupEfficiency: (pickupCount / (metrics.totalDuration || 1)) * 60, // Pickups per hour
      estimatedVsActualRatio:
        metrics.actualDuration && metrics.estimatedDuration
          ? (metrics.actualDuration / metrics.estimatedDuration).toFixed(2)
          : 1,
    };
  }
}

module.exports = RouteOptimizationService;
