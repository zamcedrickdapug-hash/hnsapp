/**
 * Real-Time Transportation Tracking
 * 
 * WebSocket handlers for live transportation operations:
 * - Real-time driver location tracking
 * - Live trip progress updates
 * - Parent notifications of trip status
 * - Driver-dispatcher communication
 * - Emergency SOS handling
 * 
 * SAFETY OPERATIONS:
 * - Broadcasts GPS location to relevant parties only (parents, dispatcher, admin)
 * - Monitors speed and alerts on violations
 * - Handles SOS activation and emergency routing
 * - Logs all tracking data for incident review
 */

const TripAssignment = require('../models/TripAssignment');
const Vehicle = require('../models/Vehicle');
const DriverStatus = require('../models/DriverStatus');
const User = require('../models/User');
const RouteOptimizationService = require('../services/routeOptimizationService');

class TransportationTracking {
  /**
   * Initialize transportation tracking for trip
   */
  static async initializeTripTracking(io, socket, tripId) {
    try {
      const trip = await TripAssignment.findById(tripId).populate('driverId vehicleId pickupPoints.parentId');
      
      if (!trip) {
        socket.emit('error', { message: 'Trip not found' });
        return;
      }
      
      // Verify socket user is authorized
      const isAuthorized = this._isUserAuthorizedForTrip(socket.user, trip);
      if (!isAuthorized) {
        socket.emit('error', { message: 'Not authorized for this trip' });
        return;
      }
      
      // Join trip room
      socket.join(`trip:${tripId}`);
      
      // Broadcast initial trip state
      socket.emit('trip:state', {
        tripId: trip._id,
        status: trip.status,
        driver: {
          id: trip.driverId._id,
          name: trip.driverId.fullName,
        },
        vehicle: {
          id: trip.vehicleId._id,
          plate: trip.vehicleId.plateNumber,
        },
        pickupCount: trip.pickupPoints.length,
        currentPickup: trip.pickupPoints.filter(p => p.pickupStatus === 'arrived')[0],
      });
      
      console.log(`[TRACKING] User ${socket.user._id} tracking trip ${tripId}`);
    } catch (error) {
      console.error('Trip tracking error:', error);
      socket.emit('error', { message: 'Failed to initialize tracking' });
    }
  }
  
  /**
   * Update driver location in real-time
   * 
   * Called frequently by driver app (every 5-10 seconds during trip)
   */
  static async updateDriverLocation(io, socket, data) {
    try {
      const { tripId, latitude, longitude, speed, heading, accuracy } = data;
      
      if (!tripId || latitude === undefined || longitude === undefined) {
        return socket.emit('error', { message: 'Invalid location data' });
      }
      
      // Validate coordinates
      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        return socket.emit('error', { message: 'Invalid GPS coordinates' });
      }
      
      const trip = await TripAssignment.findById(tripId);
      if (!trip) {
        return socket.emit('error', { message: 'Trip not found' });
      }
      
      // Authorize driver
      if (!trip.driverId.equals(socket.user._id)) {
        return socket.emit('error', { message: 'Not authorized' });
      }
      
      // Update trip with latest location
      trip.driverCurrentLocation = {
        latitude,
        longitude,
        accuracy,
        timestamp: new Date(),
      };
      
      trip.lastLocationUpdateAt = new Date();
      
      // Record location history
      trip.locationUpdates.push({
        latitude,
        longitude,
        speed: speed || 0,
        heading: heading || 0,
        accuracy: accuracy || 0,
        timestamp: new Date(),
      });
      
      // Monitor speed - safety check
      if (speed && speed > 80) {
        // High speed alert
        trip.safetyEvents.push({
          eventType: 'speed_alert',
          severity: speed > 100 ? 'critical' : 'high',
          description: `Speeding detected: ${speed} km/h`,
          location: { latitude, longitude },
          timestamp: new Date(),
        });
        
        // Notify parents of excessive speed
        this._notifyParentsOfSafetyEvent(io, trip, 'speeding', speed);
      }
      
      await trip.save();
      
      // Broadcast location to authorized parties
      this._broadcastLocationUpdate(io, trip, {
        latitude,
        longitude,
        speed,
        heading,
        accuracy,
        timestamp: new Date(),
      });
      
    } catch (error) {
      console.error('Location update error:', error);
      socket.emit('error', { message: 'Failed to update location' });
    }
  }
  
  /**
   * Update pickup status (student picked up)
   */
  static async updatePickupStatus(io, socket, data) {
    try {
      const { tripId, pickupIndex, status, qrVerificationCode } = data;
      
      const trip = await TripAssignment.findById(tripId);
      if (!trip || !trip.driverId.equals(socket.user._id)) {
        return socket.emit('error', { message: 'Not authorized' });
      }
      
      if (pickupIndex < 0 || pickupIndex >= trip.pickupPoints.length) {
        return socket.emit('error', { message: 'Invalid pickup index' });
      }
      
      const pickup = trip.pickupPoints[pickupIndex];
      
      // Verify QR code if required
      if (qrVerificationCode && pickup.qrVerificationCode !== qrVerificationCode) {
        return socket.emit('error', { message: 'Invalid QR code' });
      }
      
      // Update pickup status
      pickup.pickupStatus = status;
      
      if (status === 'picked_up') {
        pickup.actualPickupTime = new Date();
      } else if (status === 'arrived') {
        pickup.estimatedArrivalTime = new Date();
      }
      
      await trip.save();
      
      // Broadcast pickup update
      io.to(`trip:${tripId}`).emit('pickup:updated', {
        tripId: trip._id,
        pickupIndex,
        studentName: pickup.studentName,
        status,
        timestamp: new Date(),
      });
      
      // Notify parent of pickup
      io.to(`user:${pickup.parentId}`).emit('pickup:status', {
        studentName: pickup.studentName,
        status,
        message: this._getPickupMessage(status),
      });
      
    } catch (error) {
      console.error('Pickup status error:', error);
      socket.emit('error', { message: 'Failed to update pickup' });
    }
  }
  
  /**
   * Update trip status (arrived at school, completed, etc.)
   */
  static async updateTripStatus(io, socket, data) {
    try {
      const { tripId, newStatus, reason } = data;
      
      const trip = await TripAssignment.findById(tripId);
      if (!trip) {
        return socket.emit('error', { message: 'Trip not found' });
      }
      
      // Only driver or admin can update status
      if (!trip.driverId.equals(socket.user._id) && socket.user.role !== 'admin') {
        return socket.emit('error', { message: 'Not authorized' });
      }
      
      const oldStatus = trip.status;
      trip.updateStatus(newStatus, reason);
      
      // Handle status-specific logic
      switch (newStatus) {
        case 'arrived_at_school':
          trip.arrivedAtDestinationAt = new Date();
          trip.gpsTrackingActive = false;
          break;
        case 'completed':
          trip.completedAt = new Date();
          trip.gpsTrackingActive = false;
          break;
      }
      
      await trip.save();
      
      // Broadcast status change to all participants
      io.to(`trip:${tripId}`).emit('trip:status-changed', {
        tripId: trip._id,
        oldStatus,
        newStatus,
        timestamp: new Date(),
        message: `Trip status changed to ${newStatus}`,
      });
      
      // Notify parents
      for (const pickup of trip.pickupPoints) {
        io.to(`user:${pickup.parentId}`).emit('trip:status-update', {
          tripId: trip._id,
          status: newStatus,
          message: this._getTripStatusMessage(newStatus),
        });
      }
      
    } catch (error) {
      console.error('Trip status error:', error);
      socket.emit('error', { message: 'Failed to update status' });
    }
  }
  
  /**
   * Handle SOS activation (emergency button)
   */
  static async activateSOS(io, socket, data) {
    try {
      const { tripId, reason } = data;
      
      const trip = await TripAssignment.findById(tripId);
      if (!trip || !trip.driverId.equals(socket.user._id)) {
        return socket.emit('error', { message: 'Not authorized' });
      }
      
      // Activate SOS
      trip.activateSOS();
      trip.sosActivatedAt = new Date();
      
      const pickupLocations = trip.pickupPoints.map(p => ({
        studentName: p.studentName,
        contact: p.emergencyContact,
      }));
      
      await trip.save();
      
      // Broadcast CRITICAL alert to all parties
      const sosAlert = {
        tripId: trip._id,
        tripNumber: trip.tripNumber,
        severity: 'critical',
        type: 'SOS_ACTIVATED',
        reason,
        driverLocation: trip.driverCurrentLocation,
        affectedStudents: pickupLocations,
        timestamp: new Date(),
      };
      
      // Send to admin and operator
      io.to('admin').emit('emergency:sos', sosAlert);
      io.to(`operator:${trip.operatorId}`).emit('emergency:sos', sosAlert);
      
      // Send to parents
      for (const pickup of trip.pickupPoints) {
        io.to(`user:${pickup.parentId}`).emit('emergency:sos', {
          studentName: pickup.studentName,
          message: 'Emergency SOS activated. Help is being sent.',
          location: trip.driverCurrentLocation,
        });
      }
      
      // Send to driver
      socket.emit('sos:confirmed', {
        message: 'Emergency SOS activated. Help is on the way.',
      });
      
      console.log(`[EMERGENCY] SOS activated for trip ${tripId}: ${reason}`);
      
    } catch (error) {
      console.error('SOS activation error:', error);
      socket.emit('error', { message: 'Failed to activate SOS' });
    }
  }
  
  /**
   * Request parent approval for trip
   */
  static async requestParentApproval(io, socket, data) {
    try {
      const { tripId } = data;
      
      const trip = await TripAssignment.findById(tripId);
      if (!trip) {
        return socket.emit('error', { message: 'Trip not found' });
      }
      
      // Send approval request to each parent
      for (const pickup of trip.pickupPoints) {
        io.to(`user:${pickup.parentId}`).emit('trip:approval-request', {
          tripId: trip._id,
          tripNumber: trip.tripNumber,
          studentName: pickup.studentName,
          school: trip.schoolName,
          driver: {
            name: trip.driverId.fullName,
            rating: trip.driverId.driver?.averageRating || 0,
          },
          vehicle: {
            plate: trip.vehicleId.plateNumber,
            type: trip.vehicleType,
          },
          estimatedArrival: new Date(Date.now() + trip.routeMetrics.estimatedDuration * 60000),
          qrCode: pickup.qrVerificationCode,
          requiresApproval: true,
        });
      }
      
      socket.emit('approval:requested', {
        message: 'Parent approval requests sent',
        recipients: trip.pickupPoints.length,
      });
      
    } catch (error) {
      console.error('Approval request error:', error);
      socket.emit('error', { message: 'Failed to request approval' });
    }
  }
  
  /**
   * Parent approves trip
   */
  static async parentApprovalResponse(io, socket, data) {
    try {
      const { tripId, approved } = data;
      
      const trip = await TripAssignment.findById(tripId);
      if (!trip) {
        return socket.emit('error', { message: 'Trip not found' });
      }
      
      // Find pickup for this parent
      const pickup = trip.pickupPoints.find(p => p.parentId.equals(socket.user._id));
      if (!pickup) {
        return socket.emit('error', { message: 'Not a parent in this trip' });
      }
      
      if (approved) {
        pickup.pickupStatus = 'confirmed_by_parent';
        await trip.save();
        
        socket.emit('approval:accepted', {
          message: 'Trip approved. Driver will pick up your child.',
        });
        
        // Notify driver
        io.to(`user:${trip.driverId}`).emit('pickup:approved', {
          studentName: pickup.studentName,
          message: `${pickup.studentName} parent approved`,
        });
      } else {
        socket.emit('approval:rejected', {
          message: 'Trip approval declined.',
        });
      }
      
    } catch (error) {
      console.error('Approval response error:', error);
      socket.emit('error', { message: 'Failed to respond to approval' });
    }
  }
  
  /**
   * Calculate and broadcast ETA updates
   */
  static calculateETA(trip, currentLocation) {
    if (!trip.pickupPoints || trip.pickupPoints.length === 0) {
      return null;
    }
    
    // Find next unserved pickup
    const nextPickup = trip.pickupPoints.find(p => !['picked_up', 'no_show'].includes(p.pickupStatus));
    
    if (!nextPickup) {
      // All pickups done, ETA to school
      const distanceToSchool = RouteOptimizationService.calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        trip.schoolLocation.latitude,
        trip.schoolLocation.longitude
      );
      
      const eta = new Date(
        Date.now() + RouteOptimizationService.estimateTravelTime(distanceToSchool) * 60000
      );
      
      return {
        destination: 'school',
        address: trip.schoolName,
        distance: distanceToSchool,
        eta,
      };
    }
    
    // ETA to next pickup
    const distanceToPickup = RouteOptimizationService.calculateDistance(
      currentLocation.latitude,
      currentLocation.longitude,
      nextPickup.pickupLocation.latitude,
      nextPickup.pickupLocation.longitude
    );
    
    const eta = new Date(
      Date.now() + RouteOptimizationService.estimateTravelTime(distanceToPickup) * 60000
    );
    
    return {
      destination: 'pickup',
      studentName: nextPickup.studentName,
      address: nextPickup.pickupLocation.address,
      distance: distanceToPickup,
      eta,
    };
  }
  
  // ====== UTILITY METHODS ======
  
  static _isUserAuthorizedForTrip(user, trip) {
    // Driver
    if (trip.driverId.equals(user._id)) return true;
    
    // Parents
    if (trip.pickupPoints.some(p => p.parentId.equals(user._id))) return true;
    
    // Operator/Admin
    if (user.role === 'admin' || trip.operatorId.equals(user._id)) return true;
    
    return false;
  }
  
  static _broadcastLocationUpdate(io, trip, location) {
    const update = {
      tripId: trip._id,
      location,
      timestamp: new Date(),
    };
    
    // Send to trip room (parents, driver, admin, operator)
    io.to(`trip:${trip._id}`).emit('driver:location-updated', update);
    
    // Calculate and send ETA
    const eta = this.calculateETA(trip, location);
    if (eta) {
      io.to(`trip:${trip._id}`).emit('eta:updated', eta);
    }
  }
  
  static _notifyParentsOfSafetyEvent(io, trip, eventType, value) {
    const messages = {
      speeding: `Driver exceeding speed limit: ${value} km/h`,
      harsh_braking: 'Harsh braking detected',
      harsh_acceleration: 'Harsh acceleration detected',
      route_deviation: 'Trip deviating from planned route',
    };
    
    for (const pickup of trip.pickupPoints) {
      io.to(`user:${pickup.parentId}`).emit('safety:alert', {
        studentName: pickup.studentName,
        eventType,
        message: messages[eventType] || 'Safety event detected',
        severity: eventType === 'speeding' ? 'high' : 'medium',
      });
    }
  }
  
  static _getPickupMessage(status) {
    const messages = {
      arrived: 'Driver has arrived to pick up your child',
      picked_up: 'Your child has been picked up and is on the way',
      no_show: 'Driver arrived but child was not available',
      confirmed_by_parent: 'You have confirmed the pickup',
    };
    
    return messages[status] || '';
  }
  
  static _getTripStatusMessage(status) {
    const messages = {
      in_progress: 'Trip has started',
      in_transit_to_school: 'All pickups complete, heading to school',
      arrived_at_school: 'Driver has arrived at school',
      completed: 'Trip completed successfully',
      cancelled: 'Trip has been cancelled',
    };
    
    return messages[status] || '';
  }
}

module.exports = TransportationTracking;
