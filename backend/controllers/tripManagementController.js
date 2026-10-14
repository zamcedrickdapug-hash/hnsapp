/**
 * Trip Management Controller
 * 
 * Handles transportation trip operations:
 * - Trip booking and creation
 * - Driver assignment
 * - Route optimization
 * - Trip status tracking
 * - Real-time updates
 * 
 * TRANSPORTATION LOGIC:
 * - Validates feasibility before assigning driver
 * - Optimizes pickup routes
 * - Manages parent approvals
 * - Tracks trip lifecycle
 * - Handles trip completion and cancellation
 * 
 * SAFETY OPERATIONS:
 * - Requires parent approval before trip starts
 * - Tracks all GPS events
 * - Monitors speed and behavior
 * - Manages emergency responses
 */

const TripAssignment = require('../models/TripAssignment');
const Vehicle = require('../models/Vehicle');
const SafetyProfile = require('../models/SafetyProfile');
const User = require('../models/User');
const IncidentReport = require('../models/IncidentReport');

const RouteOptimizationService = require('../services/routeOptimizationService');
const DriverAssignmentService = require('../services/driverAssignmentService');
const VehicleCapacityService = require('../services/vehicleCapacityService');

const { getIo } = require('../socket');

class TripManagementController {
  /**
   * Create new trip request
   * 
   * POST /api/transportation/trips
   * 
   * FLOW:
   * 1. Validate pickup points and school location
   * 2. Check route feasibility
   * 3. Find optimal driver assignment
   * 4. Reserve vehicle capacity
   * 5. Create trip record with pending_approval status
   * 6. Notify parent for approval
   */
  static async createTrip(req, res) {
    try {
      const {
        pickupPoints,
        schoolId,
        schoolName,
        schoolLocation,
        tripType,
        preferredDriverId,
      } = req.body;
      
      const operatorId = req.user._id;
      
      // Validation
      if (!pickupPoints || pickupPoints.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'At least one pickup point is required',
        });
      }
      
      if (!schoolLocation || !schoolLocation.latitude || !schoolLocation.longitude) {
        return res.status(400).json({
          success: false,
          error: 'Valid school location required',
        });
      }
      
      // Validate route feasibility
      const routeValidation = new RouteOptimizationService().validateRouteFeasibility(
        pickupPoints,
        schoolLocation
      );
      
      if (!routeValidation.isFeasible) {
        return res.status(400).json({
          success: false,
          error: 'Route is not feasible',
          details: routeValidation.issues,
          validation: routeValidation,
        });
      }
      
      // Check capacity
      const tripRequest = {
        pickupPoints,
        schoolLocation,
        studentCount: pickupPoints.length,
        tripType,
        preferredDriverId,
      };
      
      // Assign driver
      const assignment = await DriverAssignmentService.findBestDriver(tripRequest, operatorId);
      
      if (!assignment.success) {
        return res.status(400).json({
          success: false,
          error: 'Could not find suitable driver',
          reason: assignment.reason,
          candidates: assignment.candidates,
        });
      }
      
      // Generate trip number
      const tripNumber = await this._generateTripNumber(operatorId);
      
      // Create trip
      const trip = new TripAssignment({
        tripNumber,
        operatorId,
        driverId: assignment.driver._id,
        vehicleId: assignment.vehicle._id,
        schoolId,
        schoolName,
        schoolLocation,
        tripType,
        pickupPoints: pickupPoints.map((p, i) => ({
          ...p,
          sequence: i + 1,
          qrVerificationCode: this._generateQRCode(),
        })),
        optimizedSequence: routeValidation.optimizedSequence,
        routeMetrics: {
          totalDistance: routeValidation.totalDistance,
          estimatedDuration: routeValidation.estimatedDuration,
        },
        isFeasible: true,
        feasibilityReasons: routeValidation.reasons,
        status: 'pending_approval',
        safetyChecksPassed: await this._performSafetyChecks(assignment.driver._id),
      });
      
      await trip.save();
      
      // Reserve vehicle seats
      const reservation = await VehicleCapacityService.reserveSeats(
        assignment.vehicle._id,
        trip._id,
        pickupPoints.length
      );
      
      if (!reservation.success) {
        await trip.deleteOne(); // Rollback trip creation
        return res.status(400).json({
          success: false,
          error: 'Could not reserve vehicle capacity',
          reason: reservation.reason,
        });
      }
      
      // Notify parents for approval
      await this._notifyParentsForApproval(trip);
      
      // Broadcast via WebSocket
      const io = getIo();
      if (io) {
        io.to(`operator:${operatorId}`).emit('trip:created', {
          tripId: trip._id,
          tripNumber: trip.tripNumber,
          status: trip.status,
          driver: {
            id: assignment.driver._id,
            name: assignment.driver.fullName,
            rating: assignment.driver.driver?.averageRating || 0,
          },
          vehicle: {
            id: assignment.vehicle._id,
            plate: assignment.vehicle.plateNumber,
            type: assignment.vehicle.vehicleType,
          },
          route: {
            distance: routeValidation.totalDistance,
            duration: routeValidation.estimatedDuration,
            pickups: pickupPoints.length,
          },
        });
      }
      
      res.status(201).json({
        success: true,
        trip: this._formatTripResponse(trip),
        assignmentDetails: {
          driver: {
            id: assignment.driver._id,
            name: assignment.driver.fullName,
            rating: assignment.driver.driver?.averageRating || 0,
            score: assignment.score,
          },
          vehicle: {
            id: assignment.vehicle._id,
            plate: assignment.vehicle.plateNumber,
            type: assignment.vehicle.vehicleType,
            available: assignment.vehicle.availableSeats,
          },
        },
        routeDetails: routeValidation,
      });
    } catch (error) {
      console.error('Trip creation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create trip',
        message: error.message,
      });
    }
  }
  
  /**
   * Get trip details
   * 
   * GET /api/transportation/trips/:tripId
   */
  static async getTrip(req, res) {
    try {
      const { tripId } = req.params;
      
      const trip = await TripAssignment.findById(tripId)
        .populate('driverId', 'fullName email phone driver')
        .populate('vehicleId', 'plateNumber vehicleType seatCapacity')
        .populate('pickupPoints.parentId', 'fullName phone');
      
      if (!trip) {
        return res.status(404).json({
          success: false,
          error: 'Trip not found',
        });
      }
      
      res.json({
        success: true,
        trip: this._formatTripResponse(trip),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch trip',
        message: error.message,
      });
    }
  }
  
  /**
   * Update trip status
   * 
   * PATCH /api/transportation/trips/:tripId/status
   */
  static async updateTripStatus(req, res) {
    try {
      const { tripId } = req.params;
      const { newStatus, reason } = req.body;
      
      const trip = await TripAssignment.findById(tripId);
      
      if (!trip) {
        return res.status(404).json({
          success: false,
          error: 'Trip not found',
        });
      }
      
      // Validate status transition
      const validTransitions = {
        pending_approval: ['approved', 'cancelled'],
        approved: ['assigned', 'cancelled'],
        assigned: ['confirmed', 'cancelled'],
        confirmed: ['in_progress', 'cancelled'],
        in_progress: ['in_transit_to_school', 'cancelled'],
        in_transit_to_school: ['arrived_at_school', 'cancelled'],
        arrived_at_school: ['completed', 'cancelled'],
        completed: [],
        cancelled: [],
      };
      
      if (!validTransitions[trip.status]?.includes(newStatus)) {
        return res.status(400).json({
          success: false,
          error: `Cannot transition from ${trip.status} to ${newStatus}`,
        });
      }
      
      // Update trip
      trip.updateStatus(newStatus, reason);
      
      // Handle status-specific logic
      switch (newStatus) {
        case 'approved':
          trip.parentApprovedAt = new Date();
          break;
        case 'in_progress':
          trip.startedAt = new Date();
          trip.gpsTrackingActive = true;
          break;
        case 'completed':
          trip.completedAt = new Date();
          trip.gpsTrackingActive = false;
          // Release vehicle seats
          await VehicleCapacityService.releaseSeats(
            trip.vehicleId,
            trip._id,
            trip.pickupPoints.length
          );
          break;
        case 'cancelled':
          trip.cancelledAt = new Date();
          trip.cancellationReason = reason;
          trip.gpsTrackingActive = false;
          // Release vehicle seats
          await VehicleCapacityService.releaseSeats(
            trip.vehicleId,
            trip._id,
            trip.pickupPoints.length
          );
          break;
      }
      
      await trip.save();
      
      // Broadcast status change
      const io = getIo();
      if (io) {
        io.to(`trip:${tripId}`).emit('trip:status-updated', {
          tripId: trip._id,
          status: newStatus,
          timestamp: new Date(),
        });
      }
      
      res.json({
        success: true,
        trip: this._formatTripResponse(trip),
        message: `Trip status updated to ${newStatus}`,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to update trip status',
        message: error.message,
      });
    }
  }
  
  /**
   * Get trip history for filter
   * 
   * GET /api/transportation/trips?status=completed&startDate=...&endDate=...
   */
  static async getTripHistory(req, res) {
    try {
      const { status, startDate, endDate, driverId, schoolId, limit = 50, skip = 0 } = req.query;
      
      const filter = { operatorId: req.user._id };
      
      if (status) filter.status = status;
      if (driverId) filter.driverId = driverId;
      if (schoolId) filter.schoolId = schoolId;
      
      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) filter.createdAt.$lte = new Date(endDate);
      }
      
      const trips = await TripAssignment.find(filter)
        .populate('driverId', 'fullName')
        .populate('vehicleId', 'plateNumber')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip));
      
      const total = await TripAssignment.countDocuments(filter);
      
      res.json({
        success: true,
        trips: trips.map(t => this._formatTripResponse(t)),
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip),
          remaining: Math.max(0, total - (parseInt(skip) + parseInt(limit))),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch trip history',
        message: error.message,
      });
    }
  }
  
  /**
   * Utility: Generate unique trip number
   */
  static async _generateTripNumber(operatorId) {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await TripAssignment.countDocuments({
      operatorId,
      createdAt: {
        $gte: new Date(new Date().setHours(0, 0, 0, 0)),
        $lt: new Date(new Date().setHours(23, 59, 59, 999)),
      },
    });
    
    return `TRIP-${date}-${String(count + 1).padStart(5, '0')}`;
  }
  
  /**
   * Generate QR verification code
   */
  static _generateQRCode() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
  
  /**
   * Perform safety checks before trip starts
   */
  static async _performSafetyChecks(driverId) {
    const safetyProfile = await SafetyProfile.findOne({ driverId });
    
    if (!safetyProfile) return false;
    
    return (
      safetyProfile.isEligibleToDrive &&
      !safetyProfile.isSuspended &&
      safetyProfile.licenseExpiry > new Date()
    );
  }
  
  /**
   * Notify parents for trip approval
   */
  static async _notifyParentsForApproval(trip) {
    const io = getIo();
    
    for (const pickup of trip.pickupPoints) {
      const parent = await User.findById(pickup.parentId);
      
      if (parent && io) {
        io.to(`user:${pickup.parentId}`).emit('trip:approval-required', {
          tripId: trip._id,
          tripNumber: trip.tripNumber,
          studentName: pickup.studentName,
          school: trip.schoolName,
          estimatedArrival: new Date(Date.now() + trip.routeMetrics.estimatedDuration * 60000),
          message: `Trip approved by operator. Please confirm pickup for ${pickup.studentName}`,
        });
      }
    }
  }
  
  /**
   * Format trip response
   */
  static _formatTripResponse(trip) {
    return {
      id: trip._id,
      tripNumber: trip.tripNumber,
      status: trip.status,
      driver: trip.driverId,
      vehicle: trip.vehicleId,
      school: {
        id: trip.schoolId,
        name: trip.schoolName,
        location: trip.schoolLocation,
      },
      route: {
        distance: trip.routeMetrics?.totalDistance || 0,
        duration: trip.routeMetrics?.estimatedDuration || 0,
        pickups: trip.pickupPoints.length,
        sequence: trip.optimizedSequence,
      },
      pickupPoints: trip.pickupPoints.map(p => ({
        student: p.studentName,
        location: p.pickupLocation,
        sequence: p.sequence,
        status: p.pickupStatus,
        qrCode: p.qrVerificationCode,
      })),
      timeline: {
        requested: trip.requestedAt,
        assigned: trip.assignedAt,
        started: trip.startedAt,
        completed: trip.completedAt,
      },
      safety: {
        parentApproved: trip.parentApprovedAt ? true : false,
        sosActivated: trip.sosActivatedAt ? true : false,
        eventsCount: trip.safetyEvents.length,
      },
      quality: {
        rating: trip.parentRating,
        feedback: trip.parentFeedback,
      },
    };
  }
}

module.exports = TripManagementController;
