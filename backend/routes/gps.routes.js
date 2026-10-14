const express = require('express');
const router = express.Router();
const DriverLocation = require('../models/DriverLocation');
const VanRequest = require('../models/VanRequest');
const { requireAuth } = require('../middleware/auth');

/**
 * GPS Tracking Routes
 * 
 * Endpoints for storing and retrieving real-time GPS tracking data
 * Protects against unauthorized access with JWT authentication
 */

/**
 * POST /api/gps/location
 * 
 * Record a driver's GPS location update
 * Called by drivers via Socket.io or HTTP fallback
 * 
 * Body:
 * - requestId: String (trip request ID)
 * - latitude: Number
 * - longitude: Number
 * - speed: Number (km/h, optional)
 * - heading: Number (0-360 degrees, optional)
 * - accuracy: Number (meters, optional)
 */
router.post('/location', requireAuth, async (req, res) => {
  try {
    const { requestId, latitude, longitude, speed, heading, accuracy } = req.body;

    // Validation
    if (!requestId || latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        ok: false,
        message: 'Missing required fields: requestId, latitude, longitude',
      });
    }

    // Only drivers can submit GPS locations
    if (req.user.role !== 'driver') {
      return res.status(403).json({
        ok: false,
        message: 'Only drivers can submit GPS locations',
      });
    }

    // Verify this is an active request for the driver
    const request = await VanRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({
        ok: false,
        message: 'Request not found',
      });
    }

    if (String(request.driver?._id) !== String(req.user.id)) {
      return res.status(403).json({
        ok: false,
        message: 'You are not the driver for this request',
      });
    }

    // Save to GPS history
    const location = new DriverLocation({
      driverId: req.user.id,
      requestId,
      latitude: Number(latitude),
      longitude: Number(longitude),
      speed: speed !== undefined ? Number(speed) : 0,
      heading: heading !== undefined ? Number(heading) : null,
      accuracy: accuracy !== undefined ? Number(accuracy) : null,
    });

    await location.save();

    // Update request with live location
    await VanRequest.updateOne(
      { _id: requestId },
      {
        liveLocation: {
          latitude: Number(latitude),
          longitude: Number(longitude),
          updatedAt: new Date(),
        },
      }
    );

    console.log(`[GPS API] Location saved - Driver: ${req.user.id}, Request: ${requestId}`);

    res.json({
      ok: true,
      message: 'Location recorded successfully',
      location: {
        latitude,
        longitude,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[GPS API] Location save error:', error.message);
    res.status(500).json({
      ok: false,
      message: 'Unable to save location',
      error: error.message,
    });
  }
});

/**
 * GET /api/gps/trip-locations/:requestId
 * 
 * Get all recorded GPS locations for a trip
 * Parents/Admins can view their trips, drivers can view their own trips
 * 
 * Query:
 * - limit: Number (default: 100, max: 1000)
 * - skip: Number (for pagination, default: 0)
 */
router.get('/trip-locations/:requestId', requireAuth, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { limit = 100, skip = 0 } = req.query;

    const limitNum = Math.min(parseInt(limit) || 100, 1000);
    const skipNum = parseInt(skip) || 0;

    // Verify authorization
    const request = await VanRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({
        ok: false,
        message: 'Request not found',
      });
    }

    const isParent = String(request.parent?._id) === String(req.user.id);
    const isDriver = String(request.driver?._id) === String(req.user.id);
    const isAdmin = req.user.role === 'admin';

    if (!isParent && !isDriver && !isAdmin) {
      return res.status(403).json({
        ok: false,
        message: 'You are not authorized to view this trip',
      });
    }

    // Get locations
    const locations = await DriverLocation.find({ requestId })
      .sort({ recordedAt: -1 })
      .limit(limitNum)
      .skip(skipNum)
      .lean();

    const total = await DriverLocation.countDocuments({ requestId });

    res.json({
      ok: true,
      locations: locations.reverse(), // Return in chronological order
      pagination: {
        total,
        limit: limitNum,
        skip: skipNum,
        remaining: Math.max(0, total - skipNum - limitNum),
      },
    });
  } catch (error) {
    console.error('[GPS API] Get trip locations error:', error.message);
    res.status(500).json({
      ok: false,
      message: 'Unable to retrieve trip locations',
      error: error.message,
    });
  }
});

/**
 * GET /api/gps/active-trip
 * 
 * Get the driver's currently active trip with live location
 * Only for drivers
 */
router.get('/active-trip', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'driver') {
      return res.status(403).json({
        ok: false,
        message: 'Only drivers can access this endpoint',
      });
    }

    // Find active trips (accepted or picked_up status)
    const activeTrip = await VanRequest.findOne({
      driver: req.user.id,
      status: { $in: ['accepted', 'arrived', 'picked_up'] },
    })
      .populate('parent', 'fullName phone')
      .lean();

    if (!activeTrip) {
      return res.json({
        ok: true,
        activeTrip: null,
        message: 'No active trip',
      });
    }

    // Get recent locations for this trip
    const locations = await DriverLocation.find({ requestId: activeTrip._id })
      .sort({ recordedAt: -1 })
      .limit(50)
      .lean();

    res.json({
      ok: true,
      activeTrip: {
        ...activeTrip,
        locations: locations.reverse(),
        locationCount: locations.length,
      },
    });
  } catch (error) {
    console.error('[GPS API] Get active trip error:', error.message);
    res.status(500).json({
      ok: false,
      message: 'Unable to retrieve active trip',
      error: error.message,
    });
  }
});

/**
 * GET /api/gps/request-location/:requestId
 * 
 * Get the latest live location for a request
 * Parents/Admins can view their trips
 */
router.get('/request-location/:requestId', requireAuth, async (req, res) => {
  try {
    const { requestId } = req.params;

    const request = await VanRequest.findById(requestId).lean();
    if (!request) {
      return res.status(404).json({
        ok: false,
        message: 'Request not found',
      });
    }

    // Verify authorization
    const isParent = String(request.parent) === String(req.user.id);
    const isDriver = String(request.driver) === String(req.user.id);
    const isAdmin = req.user.role === 'admin';

    if (!isParent && !isDriver && !isAdmin) {
      return res.status(403).json({
        ok: false,
        message: 'You are not authorized to view this trip',
      });
    }

    // Get latest location
    const latestLocation = await DriverLocation.findOne({ requestId })
      .sort({ recordedAt: -1 })
      .lean();

    res.json({
      ok: true,
      currentLocation: latestLocation || {
        latitude: null,
        longitude: null,
        updatedAt: null,
      },
      liveLocation: request.liveLocation,
      status: request.status,
    });
  } catch (error) {
    console.error('[GPS API] Get request location error:', error.message);
    res.status(500).json({
      ok: false,
      message: 'Unable to retrieve location',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/gps/location/:locationId
 * 
 * Delete a specific GPS location record (admin only)
 * Used for data cleanup/testing
 */
router.delete('/location/:locationId', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        ok: false,
        message: 'Only admins can delete locations',
      });
    }

    const { locationId } = req.params;

    await DriverLocation.findByIdAndDelete(locationId);

    res.json({
      ok: true,
      message: 'Location deleted',
    });
  } catch (error) {
    console.error('[GPS API] Delete location error:', error.message);
    res.status(500).json({
      ok: false,
      message: 'Unable to delete location',
      error: error.message,
    });
  }
});

/**
 * GET /api/gps/analytics/trip/:requestId
 * 
 * Get GPS analytics for a completed trip
 * - Total distance traveled
 * - Average speed
 * - Max speed
 * - Duration
 * - Stops
 */
router.get('/analytics/trip/:requestId', requireAuth, async (req, res) => {
  try {
    const { requestId } = req.params;

    const request = await VanRequest.findById(requestId).lean();
    if (!request) {
      return res.status(404).json({
        ok: false,
        message: 'Request not found',
      });
    }

    // Verify authorization
    const isParent = String(request.parent) === String(req.user.id);
    const isDriver = String(request.driver) === String(req.user.id);
    const isAdmin = req.user.role === 'admin';

    if (!isParent && !isDriver && !isAdmin) {
      return res.status(403).json({
        ok: false,
        message: 'You are not authorized to view this trip',
      });
    }

    const locations = await DriverLocation.find({ requestId })
      .sort({ recordedAt: 1 })
      .lean();

    if (locations.length === 0) {
      return res.json({
        ok: true,
        analytics: {
          pointCount: 0,
          distanceTraveledKm: 0,
          averageSpeedKmh: 0,
          maxSpeedKmh: 0,
          durationSeconds: 0,
        },
      });
    }

    // Calculate distance
    const haversine = (lat1, lon1, lat2, lon2) => {
      const R = 6371; // Earth's radius in km
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    let totalDistance = 0;
    for (let i = 1; i < locations.length; i++) {
      const curr = locations[i];
      const prev = locations[i - 1];
      totalDistance += haversine(
        prev.latitude,
        prev.longitude,
        curr.latitude,
        curr.longitude
      );
    }

    const speeds = locations.filter(l => l.speed && l.speed > 0).map(l => l.speed);
    const avgSpeed = speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;
    const maxSpeed = speeds.length > 0 ? Math.max(...speeds) : 0;

    const durationSeconds =
      (new Date(locations[locations.length - 1].recordedAt) - new Date(locations[0].recordedAt)) / 1000;

    res.json({
      ok: true,
      analytics: {
        pointCount: locations.length,
        distanceTraveledKm: Number(totalDistance.toFixed(2)),
        averageSpeedKmh: Number(avgSpeed.toFixed(1)),
        maxSpeedKmh: Number(maxSpeed.toFixed(1)),
        durationSeconds: Math.round(durationSeconds),
      },
    });
  } catch (error) {
    console.error('[GPS API] Analytics error:', error.message);
    res.status(500).json({
      ok: false,
      message: 'Unable to retrieve analytics',
      error: error.message,
    });
  }
});

module.exports = router;
