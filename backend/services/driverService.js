/**
 * Driver Service
 * Handles all driver-related business logic including status, location, stats tracking
 */
const DriverStatus = require('../models/DriverStatus');
const DriverLocation = require('../models/DriverLocation');
const DriverStats = require('../models/DriverStats');
const VanRequest = require('../models/VanRequest');
const User = require('../models/User');
const { getIo, buildTripRoomName, buildUserRoomName } = require('../socket');
const { releaseVanRequestAssignment } = require('./releaseVanRequestAssignment');
const { toParentSafeRequest } = require('./driverPublicProfile');

/**
 * Update or create driver status
 */
const updateDriverStatus = async (driverId, statusData) => {
  try {
    const existingStatus = await DriverStatus.findOne({ driverId });

    if (existingStatus) {
      Object.assign(existingStatus, statusData);
      existingStatus.lastStatusUpdate = new Date();
      return await existingStatus.save();
    }

    const newStatus = new DriverStatus({
      driverId,
      ...statusData,
      lastStatusUpdate: new Date(),
    });
    return await newStatus.save();
  } catch (error) {
    console.error('Error updating driver status:', error);
    throw error;
  }
};

/**
 * Get current driver status
 */
const getDriverStatus = async (driverId) => {
  try {
    let status = await DriverStatus.findOne({ driverId }).populate('driverId', 'name email phone');

    if (!status) {
      status = new DriverStatus({
        driverId,
        status: 'offline',
        isOnline: false,
      });
      await status.save();
    }

    return status;
  } catch (error) {
    console.error('Error getting driver status:', error);
    throw error;
  }
};

/**
 * Update driver live location
 * Saves location to both DriverStatus and DriverLocation for history
 */
const updateDriverLocation = async (driverId, locationData, requestId = null) => {
  try {
    const { latitude, longitude, speed = 0, heading, accuracy } = locationData;

    // Validate coordinates
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new Error('Invalid coordinates');
    }

    // Update current status
    await updateDriverStatus(driverId, {
      currentLocation: {
        latitude,
        longitude,
        accuracy,
        timestamp: new Date(),
      },
      lastLocationUpdate: new Date(),
    });

    // Save to location history
    const locationRecord = new DriverLocation({
      driverId,
      requestId,
      latitude,
      longitude,
      speed,
      heading,
      accuracy,
      recordedAt: new Date(),
    });
    await locationRecord.save();

    // Broadcast location update via Socket.IO
    const io = getIo();
    if (io) {
      io.to(`driver:${driverId}`).emit('location:updated', {
        driverId: driverId.toString(),
        latitude,
        longitude,
        speed,
        heading,
        accuracy,
        timestamp: new Date(),
      });
    }

    return locationRecord;
  } catch (error) {
    console.error('Error updating driver location:', error);
    throw error;
  }
};

/**
 * Toggle driver online/offline status
 */
const toggleDriverStatus = async (driverId, isOnline) => {
  try {
    if (!isOnline) {
      const activeRequest = await VanRequest.exists({
        driver: driverId,
        status: { $in: ['accepted', 'arrived', 'picked_up'] },
      });
      if (activeRequest) {
        const error = new Error('Driver availability cannot change while a request is active.');
        error.code = 'DRIVER_BUSY';
        throw error;
      }
    }

    let status = await DriverStatus.findOneAndUpdate(
      { driverId, activeRequestId: null },
      {
        $set: {
          isOnline,
          status: isOnline ? 'online' : 'offline',
          lastStatusUpdate: new Date(),
        },
      },
      { new: true }
    );

    if (!status) {
      const currentStatus = await DriverStatus.findOne({ driverId });
      if (currentStatus?.activeRequestId) {
        const error = new Error('Driver availability cannot change while a request is active.');
        error.code = 'DRIVER_BUSY';
        throw error;
      }

      status = await updateDriverStatus(driverId, {
        isOnline,
        status: isOnline ? 'online' : 'offline',
      });
    }

    // Broadcast status change
    const io = getIo();
    if (io) {
      io.emit('driver:status-changed', {
        driverId: driverId.toString(),
        isOnline,
        status: isOnline ? 'online' : 'offline',
        timestamp: new Date(),
      });
    }

    return status;
  } catch (error) {
    if (error.code !== 'DRIVER_BUSY') {
      console.error('Error toggling driver status:', error);
    }
    throw error;
  }
};

/**
 * Get driver stats
 */
const getDriverStats = async (driverId) => {
  try {
    let stats = await DriverStats.findOne({ driverId });

    if (!stats) {
      stats = new DriverStats({
        driverId,
        totalTrips: 0,
        completedTrips: 0,
        cancelledTrips: 0,
      });
      await stats.save();
    }

    return stats;
  } catch (error) {
    console.error('Error getting driver stats:', error);
    throw error;
  }
};

/**
 * Update trip statistics after trip completion
 */
const updateTripStats = async (driverId, tripData) => {
  try {
    const { distance, duration, status } = tripData;

    let stats = await DriverStats.findOne({ driverId });
    if (!stats) {
      stats = new DriverStats({ driverId });
    }

    // Update totals
    stats.totalTrips = (stats.totalTrips || 0) + 1;
    if (status === 'completed') {
      stats.completedTrips = (stats.completedTrips || 0) + 1;
    } else if (status === 'cancelled') {
      stats.cancelledTrips = (stats.cancelledTrips || 0) + 1;
    }

    // Update distances and times
    stats.totalDistance = (stats.totalDistance || 0) + (distance || 0);
    stats.totalDrivingTime = (stats.totalDrivingTime || 0) + (duration || 0);

    // Update cancellation rate
    if (stats.totalTrips > 0) {
      stats.cancellationRate = (stats.cancelledTrips / stats.totalTrips) * 100;
    }

    stats.lastUpdated = new Date();
    return await stats.save();
  } catch (error) {
    console.error('Error updating trip stats:', error);
    throw error;
  }
};

/**
 * Get driver trip history with filters
 */
const getDriverTripHistory = async (driverId, filters = {}) => {
  try {
    const { status, startDate, endDate, limit = 20, skip = 0 } = filters;

    const query = { driverId };

    if (status && status !== 'all') {
      query.status = status;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const trips = await VanRequest.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .populate('parentId', 'name email phone')
      .exec();

    const total = await VanRequest.countDocuments(query);

    return {
      trips,
      total,
      page: Math.floor(skip / limit) + 1,
      pages: Math.ceil(total / limit),
    };
  } catch (error) {
    console.error('Error getting trip history:', error);
    throw error;
  }
};

/**
 * Get active trip for driver
 */
const getActiveTrip = async (driverId) => {
  try {
    const status = await DriverStatus.findOne({ driverId });
    if (!status || !status.activeRequestId) {
      return null;
    }

    const trip = await VanRequest.findById(status.activeRequestId)
      .populate('parentId', 'name email phone')
      .populate('driverId', 'name email phone')
      .exec();

    return trip;
  } catch (error) {
    console.error('Error getting active trip:', error);
    throw error;
  }
};

/**
 * Update active trip status
 */
const updateTripStatus = async (driverId, requestId, tripStatus) => {
  try {
    const currentTrip = await VanRequest.findOne({ _id: requestId, driver: driverId });
    if (!currentTrip) {
      const error = new Error('Trip is not assigned to this driver.');
      error.code = 'TRIP_NOT_ASSIGNED';
      throw error;
    }

    const allowedTransitions = {
      accepted: ['arrived'],
      arrived: ['picked_up'],
      picked_up: ['arrived_at_school'],
      arrived_at_school: ['completed'],
    };
    if (!allowedTransitions[currentTrip.status]?.includes(tripStatus)) {
      const error = new Error(`Cannot transition a ${currentTrip.status} request to ${tripStatus}.`);
      error.code = 'INVALID_TRIP_TRANSITION';
      throw error;
    }

    const updatedAt = new Date();
    const updates = { status: tripStatus };
    if (tripStatus === 'arrived') updates.arrivedAtDestinationAt = updatedAt;
    if (tripStatus === 'picked_up') updates.pickedUpAt = updatedAt;
    if (tripStatus === 'arrived_at_school') updates.arrivedAtSchoolAt = updatedAt;
    if (tripStatus === 'completed' && !currentTrip.arrivedAtSchoolAt) {
      updates.arrivedAtSchoolAt = updatedAt;
    }

    const trip = await VanRequest.findOneAndUpdate(
      { _id: requestId, driver: driverId, status: currentTrip.status },
      { $set: updates },
      { new: true }
    )
      .populate('parent', 'fullName phone')
      .populate('driver', 'fullName phone status accountState driver.vehicleType driver.plateNumber driver.licenseExpirationDate')
      .populate('vehicleId', 'plateNumber vehicleType seatCapacity');

    if (!trip) {
      const error = new Error('Trip status changed before this update could be applied.');
      error.code = 'TRIP_STATUS_CHANGED';
      throw error;
    }

    if (tripStatus === 'completed') {
      await releaseVanRequestAssignment({
        driverId,
        requestId,
        vehicleId: trip.vehicleId?._id || trip.vehicleId,
      });
      await updateTripStats(driverId, { status: 'completed' });
    }

    const parentSafeTrip = toParentSafeRequest(trip);
    const io = getIo();
    if (io) {
      const eventPayload = { request: parentSafeTrip };
      io.to(buildTripRoomName(requestId)).emit('trip:request-updated', eventPayload);
      io.to(buildUserRoomName(trip.parent?._id || trip.parent)).emit('trip:request-updated', eventPayload);
      io.to(buildUserRoomName(driverId)).emit('trip:request-updated', eventPayload);
    }

    return parentSafeTrip;
  } catch (error) {
    if (!['TRIP_NOT_ASSIGNED', 'INVALID_TRIP_TRANSITION', 'TRIP_STATUS_CHANGED'].includes(error.code)) {
      console.error('Error updating trip status:', error);
    }
    throw error;
  }
};

module.exports = {
  updateDriverStatus,
  getDriverStatus,
  updateDriverLocation,
  toggleDriverStatus,
  getDriverStats,
  updateTripStats,
  getDriverTripHistory,
  getActiveTrip,
  updateTripStatus,
};
