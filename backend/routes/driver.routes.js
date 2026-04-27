const express = require('express');
const VanRequest = require('../models/VanRequest');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const { getIo, buildTripRoomName, buildUserRoomName } = require('../socket');
const { sendPushToUserIds } = require('../utils/pushNotifications');

const router = express.Router();

const distanceInMeters = (first, second) => {
  const lat1 = Number(first?.latitude);
  const lon1 = Number(first?.longitude);
  const lat2 = Number(second?.latitude);
  const lon2 = Number(second?.longitude);

  if (![lat1, lon1, lat2, lon2].every((value) => Number.isFinite(value))) {
    return Number.POSITIVE_INFINITY;
  }

  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const ARRIVED_RADIUS_METERS = 60;

const ensureDriver = (req, res, next) => {
  if (!req.user || req.user.role !== 'driver') {
    return res.status(403).json({ message: 'Driver access is required.' });
  }

  return next();
};

router.use(requireAuth, ensureDriver);

router.get('/requests', async (req, res) => {
  try {
    const requests = await VanRequest.find({
      $or: [{ status: 'searching' }, { driver: req.user._id }],
    })
      .populate('parent', 'fullName phone')
      .populate('driver', 'fullName phone driver.vehicleType driver.plateNumber')
      .sort({ createdAt: -1 });

    return res.status(200).json({ requests });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to load driver requests right now.' });
  }
});

router.patch('/requests/:requestId/accept', async (req, res) => {
  try {
    const rideRequest = await VanRequest.findById(req.params.requestId).populate('parent', '_id fullName');

    if (!rideRequest) {
      return res.status(404).json({ message: 'Ride request not found.' });
    }

    if (rideRequest.status !== 'searching') {
      return res.status(409).json({ message: 'This request is already handled by another driver.' });
    }

    rideRequest.driver = req.user._id;
    rideRequest.status = 'accepted';
    rideRequest.acceptedAt = new Date();
    rideRequest.liveLocation = null;
    await rideRequest.save();

    const populatedRequest = await VanRequest.findById(rideRequest._id)
      .populate('parent', 'fullName phone')
      .populate('driver', 'fullName phone driver.vehicleType driver.plateNumber');

    const parent = await User.findById(rideRequest.parent?._id);

    if (parent) {
      parent.notifications.push({
        title: 'Driver accepted request',
        message: `${req.user.fullName} accepted your school van request.`,
        status: 'approved',
      });
      await parent.save();

      sendPushToUserIds([String(parent._id)], {
        title: 'Driver Accepted Your Request',
        body: `${req.user.fullName} is now assigned to your trip.`,
        data: {
          type: 'request-accepted',
          requestId: String(rideRequest._id),
        },
      }).catch(() => {});
    }

    const io = getIo();
    if (io) {
      const eventPayload = {
        request: populatedRequest,
      };

      io.to(buildTripRoomName(rideRequest._id)).emit('trip:request-updated', eventPayload);
      io.to(buildUserRoomName(rideRequest.parent?._id)).emit('trip:request-updated', eventPayload);
      io.to(buildUserRoomName(req.user._id)).emit('trip:request-updated', eventPayload);
    }

    return res.status(200).json({
      message: 'Ride request accepted successfully.',
      request: populatedRequest,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to accept ride request right now.' });
  }
});

router.patch('/requests/:requestId/location', async (req, res) => {
  try {
    const latitude = Number(req.body?.latitude);
    const longitude = Number(req.body?.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.status(400).json({ message: 'Valid latitude and longitude are required.' });
    }

    const rideRequest = await VanRequest.findById(req.params.requestId);

    if (!rideRequest) {
      return res.status(404).json({ message: 'Ride request not found.' });
    }

    if (!rideRequest.driver || String(rideRequest.driver) !== String(req.user._id)) {
      return res.status(403).json({ message: 'You are not assigned to this request.' });
    }

    if (!['accepted', 'arrived', 'picked_up'].includes(rideRequest.status)) {
      return res.status(409).json({ message: 'Location updates are only allowed for active requests.' });
    }

    const nextLiveLocation = {
      latitude,
      longitude,
      updatedAt: new Date(),
    };

    await User.updateOne(
      { _id: req.user._id },
      {
        $set: {
          lastKnownLocation: {
            ...nextLiveLocation,
          },
        },
      }
    );

    rideRequest.liveLocation = nextLiveLocation;

    const hasRequesterLocation =
      Number.isFinite(Number(rideRequest.requesterLocation?.latitude)) &&
      Number.isFinite(Number(rideRequest.requesterLocation?.longitude));

    if (rideRequest.status === 'accepted' && hasRequesterLocation) {
      const distanceToPickup = distanceInMeters({ latitude, longitude }, rideRequest.requesterLocation);
      if (distanceToPickup <= ARRIVED_RADIUS_METERS) {
        rideRequest.status = 'arrived';
      }
    }

    await rideRequest.save();

    await VanRequest.updateMany(
      {
        driver: req.user._id,
        _id: { $ne: rideRequest._id },
        status: { $in: ['accepted', 'arrived', 'picked_up'] },
      },
      {
        $set: {
          liveLocation: nextLiveLocation,
        },
      }
    );

    const io = getIo();
    if (io) {
      const otherActiveRequests = await VanRequest.find({
        driver: req.user._id,
        _id: { $ne: rideRequest._id },
        status: { $in: ['accepted', 'arrived', 'picked_up'] },
      }).select('_id parent status');

      io.to(buildTripRoomName(rideRequest._id)).emit('trip:location-updated', {
        requestId: String(rideRequest._id),
        liveLocation: nextLiveLocation,
        status: rideRequest.status,
      });

      io.to(buildUserRoomName(rideRequest.parent)).emit('trip:location-updated', {
        requestId: String(rideRequest._id),
        liveLocation: nextLiveLocation,
        status: rideRequest.status,
      });

      io.to(buildUserRoomName(req.user._id)).emit('trip:location-updated', {
        requestId: String(rideRequest._id),
        liveLocation: nextLiveLocation,
        status: rideRequest.status,
      });

      io.to('admins').emit('driver:location-updated', {
        driverId: String(req.user._id),
        requestId: String(rideRequest._id),
        tripStatus: rideRequest.status,
        location: nextLiveLocation,
      });

      otherActiveRequests.forEach((item) => {
        io.to(buildTripRoomName(item._id)).emit('trip:location-updated', {
          requestId: String(item._id),
          liveLocation: nextLiveLocation,
          status: item.status,
        });

        io.to(buildUserRoomName(item.parent)).emit('trip:location-updated', {
          requestId: String(item._id),
          liveLocation: nextLiveLocation,
          status: item.status,
        });
      });
    }

    return res.status(200).json({
      message: 'Location updated successfully.',
      request: rideRequest,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to update location right now.' });
  }
});

router.patch('/requests/:requestId/picked-up', async (req, res) => {
  try {
    const rideRequest = await VanRequest.findById(req.params.requestId).populate('parent', '_id fullName');

    if (!rideRequest) {
      return res.status(404).json({ message: 'Ride request not found.' });
    }

    if (!rideRequest.driver || String(rideRequest.driver) !== String(req.user._id)) {
      return res.status(403).json({ message: 'You are not assigned to this request.' });
    }

    if (!['accepted', 'arrived'].includes(rideRequest.status)) {
      return res.status(409).json({ message: 'Only active pickup trips can be marked as picked up.' });
    }

    rideRequest.status = 'picked_up';
    await rideRequest.save();

    const populatedRequest = await VanRequest.findById(rideRequest._id)
      .populate('parent', 'fullName phone')
      .populate('driver', 'fullName phone driver.vehicleType driver.plateNumber');

    const io = getIo();
    if (io) {
      const eventPayload = { request: populatedRequest };
      io.to(buildTripRoomName(rideRequest._id)).emit('trip:request-updated', eventPayload);
      io.to(buildUserRoomName(rideRequest.parent?._id)).emit('trip:request-updated', eventPayload);
      io.to(buildUserRoomName(req.user._id)).emit('trip:request-updated', eventPayload);

      io.to(buildTripRoomName(rideRequest._id)).emit('trip:location-updated', {
        requestId: String(rideRequest._id),
        liveLocation: rideRequest.liveLocation,
        status: rideRequest.status,
      });
    }

    return res.status(200).json({
      message: 'Trip marked as picked up.',
      request: populatedRequest,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to update trip status right now.' });
  }
});

// Mark that the driver arrived at school (complete trip)
router.patch('/requests/:requestId/arrived-school', async (req, res) => {
  try {
    const rideRequest = await VanRequest.findById(req.params.requestId).populate('parent', '_id fullName');

    if (!rideRequest) {
      return res.status(404).json({ message: 'Ride request not found.' });
    }

    if (!rideRequest.driver || String(rideRequest.driver) !== String(req.user._id)) {
      return res.status(403).json({ message: 'You are not assigned to this request.' });
    }

    if (rideRequest.status !== 'picked_up') {
      return res.status(409).json({ message: 'Trip must be in picked_up state to mark arrival at school.' });
    }

    rideRequest.status = 'completed';
    await rideRequest.save();

    const populatedRequest = await VanRequest.findById(rideRequest._id)
      .populate('parent', 'fullName phone')
      .populate('driver', 'fullName phone driver.vehicleType driver.plateNumber');

    // notify parent via in-app notification
    const parent = await User.findById(rideRequest.parent?._id);
    if (parent) {
      parent.notifications.push({
        title: 'Driver arrived at school',
        message: `${req.user.fullName} has arrived at the school with the student.`,
        status: 'info',
      });
      await parent.save();

      // send push
      sendPushToUserIds([String(parent._id)], {
        title: 'Driver arrived at school',
        body: `${req.user.fullName} has arrived at the school with the student.`,
        data: {
          type: 'driver-arrived-school',
          requestId: String(rideRequest._id),
        },
      }).catch(() => {});
    }

    const io = getIo();
    if (io) {
      const eventPayload = { request: populatedRequest };
      io.to(buildTripRoomName(rideRequest._id)).emit('trip:request-updated', eventPayload);
      io.to(buildUserRoomName(rideRequest.parent?._id)).emit('trip:request-updated', eventPayload);
      io.to(buildUserRoomName(req.user._id)).emit('trip:request-updated', eventPayload);

      io.to(buildTripRoomName(rideRequest._id)).emit('trip:location-updated', {
        requestId: String(rideRequest._id),
        liveLocation: rideRequest.liveLocation,
        status: rideRequest.status,
      });
    }

    return res.status(200).json({ message: 'Driver arrival at school recorded.', request: populatedRequest });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to update trip status right now.' });
  }
});

router.patch('/profile', async (req, res) => {
  try {
    const nextPhone = String(req.body?.phone || '').trim();
    const nextAddress = String(req.body?.homeAddress || '').trim();

    req.user.phone = nextPhone || req.user.phone;
    req.user.homeAddress = nextAddress || req.user.homeAddress;
    req.user.driver = {
      ...req.user.driver?.toObject?.(),
      vehicleType: String(req.body?.vehicleType || req.user.driver?.vehicleType || '').trim(),
      plateNumber: String(req.body?.plateNumber || req.user.driver?.plateNumber || '').trim(),
      licenseNumber: String(req.body?.licenseNumber || req.user.driver?.licenseNumber || '').trim(),
    };

    await req.user.save();

    return res.status(200).json({
      message: 'Driver settings updated successfully.',
      user: {
        id: req.user._id,
        fullName: req.user.fullName,
        phone: req.user.phone,
        homeAddress: req.user.homeAddress,
        driver: req.user.driver,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to update driver settings right now.' });
  }
});

module.exports = router;
