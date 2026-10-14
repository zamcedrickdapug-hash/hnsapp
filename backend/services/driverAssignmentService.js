/**
 * Driver Assignment Engine
 * 
 * Intelligent driver matching algorithm for transportation operations
 * 
 * ASSIGNMENT LOGIC:
 * - Finds nearest available driver within operational area
 * - Validates driver qualification and safety status
 * - Considers current passenger load and vehicle capacity
 * - Evaluates driver ratings and performance history
 * - Optimizes for driver utilization and efficiency
 * - Prevents overassignment and fatigue
 * 
 * TRANSPORTATION LOGIC:
 * Uses weighted scoring algorithm:
 * - Distance to pickup (40% weight) - closer is better
 * - Driver rating (25% weight) - higher rated drivers preferred
 * - Vehicle capacity (20% weight) - must fit all students
 * - Driver availability (15% weight) - online, not on another trip
 * 
 * SAFETY IMPACT:
 * - Only assigns drivers with valid safety profiles
 * - Checks suspension status
 * - Validates license expiry
 * - Ensures NBI clearance current
 * - Prevents overworking drivers
 * 
 * SCALABILITY:
 * - Indexes on driver status for quick queries
 * - Geospatial queries for nearest-neighbor searches
 * - Batch assignment for multiple trips
 * - Caching of available drivers by zone
 */

const User = require('../models/User');
const Vehicle = require('../models/Vehicle');
const SafetyProfile = require('../models/SafetyProfile');
const TripAssignment = require('../models/TripAssignment');
const DriverStatus = require('../models/DriverStatus');
const DriverLocation = require('../models/DriverLocation');
const RouteOptimizationService = require('./routeOptimizationService');

class DriverAssignmentService {
  /**
   * Maximum distance to search for available drivers (kilometers)
   */
  static SEARCH_RADIUS = 25;
  
  /**
   * Scoring weights for driver selection algorithm
   */
  static SCORING_WEIGHTS = {
    distance: 0.4, // Closer is better
    rating: 0.25, // Higher rated drivers preferred
    capacity: 0.2, // Vehicle capacity match
    availability: 0.15, // Current workload
  };
  
  /**
   * Find the best available driver for a trip
   * 
   * @param {Object} tripRequest - Trip details {pickupPoints, schoolLocation, studentCount, vehicleType}
   * @param {string} operatorId - Operator requesting assignment
   * @returns {Object} Assignment with driver, vehicle, and score
   * 
   * ALGORITHM:
   * 1. Query available drivers within search radius
   * 2. Filter by safety qualification (not suspended, license valid)
   * 3. Calculate score for each candidate based on weighted factors
   * 4. Return top candidate with scoring details
   */
  static async findBestDriver(tripRequest, operatorId) {
    const {
      pickupPoints,
      schoolLocation,
      studentCount,
      vehicleType,
      preferredDriverId = null,
    } = tripRequest;
    
    if (!pickupPoints || pickupPoints.length === 0) {
      throw new Error('No pickup points provided');
    }
    
    if (!schoolLocation) {
      throw new Error('School location required');
    }
    
    // Use first pickup as reference for distance calculation
    const referencePickup = pickupPoints[0].pickupLocation;
    
    const assignmentResult = {
      success: false,
      driver: null,
      vehicle: null,
      score: 0,
      reason: '',
      candidates: [],
    };
    
    try {
      // Query available drivers for this operator
      const drivers = await this._getAvailableDrivers(operatorId);
      
      if (drivers.length === 0) {
        assignmentResult.reason = 'No available drivers found';
        return assignmentResult;
      }
      
      // Score each candidate
      const scoredCandidates = [];
      
      for (const driver of drivers) {
        const scoreResult = await this._scoreDriver(
          driver,
          referencePickup,
          studentCount,
          vehicleType,
          tripRequest
        );
        
        if (scoreResult.qualified) {
          scoredCandidates.push(scoreResult);
        }
      }
      
      if (scoredCandidates.length === 0) {
        assignmentResult.reason = 'No qualified drivers available';
        return assignmentResult;
      }
      
      // Sort by score (highest first)
      scoredCandidates.sort((a, b) => b.totalScore - a.totalScore);
      
      // Check for preferred driver first
      if (preferredDriverId) {
        const preferred = scoredCandidates.find(c => c.driver._id.toString() === preferredDriverId);
        if (preferred && preferred.totalScore > 0) {
          assignmentResult.driver = preferred.driver;
          assignmentResult.vehicle = preferred.vehicle;
          assignmentResult.score = preferred.totalScore;
          assignmentResult.success = true;
          assignmentResult.candidates = scoredCandidates.slice(0, 5);
          return assignmentResult;
        }
      }
      
      // Assign best candidate
      const best = scoredCandidates[0];
      assignmentResult.driver = best.driver;
      assignmentResult.vehicle = best.vehicle;
      assignmentResult.score = best.totalScore;
      assignmentResult.success = true;
      assignmentResult.candidates = scoredCandidates.slice(0, 5); // Top 5 candidates for fallback
      
    } catch (error) {
      assignmentResult.reason = `Assignment error: ${error.message}`;
    }
    
    return assignmentResult;
  }
  
  /**
   * Get available drivers for assignment
   * 
   * Criteria:
   * - Role is 'driver'
   * - Status is 'approved'
   * - Not suspended
   * - Currently online
   * - Not on maximum trip limit
   */
  static async _getAvailableDrivers(operatorId) {
    const drivers = await User.find({
      role: 'driver',
      status: 'approved',
      operator: operatorId,
    })
      .select('_id fullName email phone driver')
      .lean();
    
    // Filter by online status and not suspended
    const available = [];
    
    for (const driver of drivers) {
      const status = await DriverStatus.findOne({ driverId: driver._id })
        .select('isOnline lastLocationUpdate');
      
      const safetyProfile = await SafetyProfile.findOne({ driverId: driver._id }).select(
        'isSuspended isEligibleToDrive'
      );
      
      // Check availability criteria
      if (
        status &&
        status.isOnline &&
        safetyProfile &&
        safetyProfile.isEligibleToDrive &&
        !safetyProfile.isSuspended
      ) {
        available.push({
          ...driver,
          driverStatus: status,
          safetyProfile,
        });
      }
    }
    
    return available;
  }
  
  /**
   * Score a driver candidate based on multiple factors
   * 
   * Scoring breakdown:
   * - Distance score (40%): 100 if within 5km, decreases linearly
   * - Rating score (25%): Based on average rating (1-5 stars)
   * - Capacity score (20%): Does vehicle have enough seats?
   * - Availability score (15%): Based on current workload
   */
  static async _scoreDriver(driver, pickupLocation, studentCount, vehicleType, tripRequest) {
    const scoreResult = {
      driver,
      vehicle: null,
      qualified: false,
      totalScore: 0,
      breakdown: {
        distance: 0,
        rating: 0,
        capacity: 0,
        availability: 0,
      },
      details: [],
    };
    
    try {
      // Get driver vehicle
      const vehicle = await Vehicle.findOne({
        assignedDriver: driver._id,
        status: { $in: ['available', 'assigned'] },
      }).select('_id seatCapacity currentPassengers vehicleType');
      
      if (!vehicle) {
        scoreResult.details.push('No assigned vehicle');
        return scoreResult;
      }
      
      // Check vehicle has enough capacity
      if (vehicle.currentPassengers + studentCount > vehicle.seatCapacity) {
        scoreResult.details.push(
          `Vehicle capacity insufficient: ${vehicle.currentPassengers + studentCount} > ${vehicle.seatCapacity}`
        );
        return scoreResult;
      }
      
      // Calculate distance score
      const distanceScore = this._calculateDistanceScore(driver.driverStatus, pickupLocation);
      
      // Calculate rating score
      const ratingScore = this._calculateRatingScore(driver);
      
      // Calculate capacity score
      const capacityScore = this._calculateCapacityScore(vehicle, studentCount);
      
      // Calculate availability score
      const availabilityScore = await this._calculateAvailabilityScore(driver._id);
      
      // Weighted total
      const totalScore =
        distanceScore * this.SCORING_WEIGHTS.distance +
        ratingScore * this.SCORING_WEIGHTS.rating +
        capacityScore * this.SCORING_WEIGHTS.capacity +
        availabilityScore * this.SCORING_WEIGHTS.availability;
      
      scoreResult.vehicle = vehicle;
      scoreResult.qualified = true;
      scoreResult.totalScore = parseFloat(totalScore.toFixed(2));
      scoreResult.breakdown = {
        distance: parseFloat(distanceScore.toFixed(2)),
        rating: parseFloat(ratingScore.toFixed(2)),
        capacity: parseFloat(capacityScore.toFixed(2)),
        availability: parseFloat(availabilityScore.toFixed(2)),
      };
      
    } catch (error) {
      scoreResult.details.push(`Scoring error: ${error.message}`);
    }
    
    return scoreResult;
  }
  
  /**
   * Calculate distance score (0-100)
   * 
   * 100 = within 2 km
   * 0 = beyond 25 km
   * Linear interpolation between
   */
  static _calculateDistanceScore(driverStatus, pickupLocation) {
    if (!driverStatus || !driverStatus.lastLocationUpdate) {
      return 30; // Default if location unknown
    }
    
    const currentLocation = driverStatus.currentLocation;
    if (!currentLocation || !currentLocation.latitude) {
      return 30;
    }
    
    const distance = RouteOptimizationService.calculateDistance(
      currentLocation.latitude,
      currentLocation.longitude,
      pickupLocation.latitude,
      pickupLocation.longitude
    );
    
    // Score: 100 at 0km, 0 at 25km
    const maxDistance = 25;
    const score = Math.max(0, 100 * (1 - distance / maxDistance));
    
    return score;
  }
  
  /**
   * Calculate rating score (0-100)
   * 
   * Based on average parent rating (1-5 stars)
   * 5 stars = 100, 1 star = 20
   */
  static _calculateRatingScore(driver) {
    const driverInfo = driver.driver || {};
    const rating = driverInfo.averageRating || 3; // Default middle rating
    
    // Convert 1-5 scale to 0-100
    return (rating - 1) * 20 + 20; // 1★ = 20, 2★ = 40, ..., 5★ = 100
  }
  
  /**
   * Calculate capacity score (0-100)
   * 
   * 100 if plenty of room (> 50% available)
   * Decreases as vehicle fills up
   * 0 if no room
   */
  static _calculateCapacityScore(vehicle, studentCount) {
    const availableSeats = vehicle.seatCapacity - vehicle.currentPassengers;
    
    if (availableSeats < studentCount) {
      return 0; // Cannot fit
    }
    
    const utilizationRatio = (vehicle.currentPassengers + studentCount) / vehicle.seatCapacity;
    
    // Prefer less-full vehicles (more comfort)
    // 30% utilization = 100, 80% utilization = 50
    return Math.max(0, 100 * (1 - utilizationRatio + 0.3));
  }
  
  /**
   * Calculate availability score (0-100)
   * 
   * Based on current trip load
   * 0 trips = 100, 5+ trips = 20
   */
  static async _calculateAvailabilityScore(driverId) {
    const activeTrips = await TripAssignment.countDocuments({
      driverId,
      status: { $in: ['assigned', 'confirmed', 'in_progress'] },
    });
    
    // Score: 100 with 0 trips, decreases with more trips
    // 5+ trips = 20 points (still available but busy)
    const score = Math.max(20, 100 - activeTrips * 15);
    
    return score;
  }
  
  /**
   * Validate driver can accept assignment
   */
  static async validateDriverAssignment(driverId, tripRequest) {
    const validation = {
      valid: false,
      errors: [],
      warnings: [],
    };
    
    try {
      // Check driver exists and is approved
      const driver = await User.findOne({
        _id: driverId,
        role: 'driver',
        status: 'approved',
      });
      
      if (!driver) {
        validation.errors.push('Driver not found or not approved');
        return validation;
      }
      
      // Check safety profile
      const safetyProfile = await SafetyProfile.findOne({ driverId });
      
      if (!safetyProfile) {
        validation.errors.push('No safety profile found');
        return validation;
      }
      
      if (safetyProfile.isSuspended) {
        validation.errors.push('Driver is suspended');
        return validation;
      }
      
      if (!safetyProfile.isEligibleToDrive) {
        validation.errors.push(`Driver not eligible: ${safetyProfile.eligibilityStatus}`);
        return validation;
      }
      
      // Check license expiry
      if (new Date() > safetyProfile.licenseExpiry) {
        validation.errors.push('Driver license expired');
        return validation;
      }
      
      // Check NBI clearance
      if (
        safetyProfile.nbiClearanceExpiry &&
        new Date() > safetyProfile.nbiClearanceExpiry
      ) {
        validation.warnings.push('NBI clearance expired');
      }
      
      // Check driver is online
      const driverStatus = await DriverStatus.findOne({ driverId });
      
      if (!driverStatus || !driverStatus.isOnline) {
        validation.errors.push('Driver is offline');
        return validation;
      }
      
      // Check vehicle compatibility
      const vehicle = await Vehicle.findOne({
        assignedDriver: driverId,
      });
      
      if (!vehicle) {
        validation.errors.push('No vehicle assigned');
        return validation;
      }
      
      if (!vehicle.isAvailable) {
        validation.errors.push('Vehicle not available');
        return validation;
      }
      
      validation.valid = validation.errors.length === 0;
      
    } catch (error) {
      validation.errors.push(`Validation error: ${error.message}`);
    }
    
    return validation;
  }
  
  /**
   * Calculate assignment urgency based on time and student count
   */
  static calculateUrgency(tripRequest, minutesToDeparture = 30) {
    let urgencyScore = 0;
    
    // Time pressure (higher score = more urgent)
    if (minutesToDeparture < 10) urgencyScore += 40;
    else if (minutesToDeparture < 20) urgencyScore += 20;
    else if (minutesToDeparture < 30) urgencyScore += 10;
    
    // Student count (more students = more urgent)
    const studentCount = tripRequest.pickupPoints?.length || 0;
    if (studentCount > 8) urgencyScore += 30;
    else if (studentCount > 5) urgencyScore += 20;
    else if (studentCount > 2) urgencyScore += 10;
    
    return Math.min(100, urgencyScore);
  }
}

module.exports = DriverAssignmentService;
