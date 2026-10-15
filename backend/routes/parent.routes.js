const express = require('express');
const User = require('../models/User');
const VanRequest = require('../models/VanRequest');
const { releaseVanRequestAssignment } = require('../services/releaseVanRequestAssignment');
const { requireApplicant, requireParent } = require('../middleware/auth');
const { normalizePhoneNumber, isValidPhoneNumber } = require('../utils/validation');
const { verifyRegistrationIdentity } = require('../utils/firebaseIdentity');
const { sendPushToUserIds } = require('../utils/pushNotifications');
const { getIo, buildTripRoomName, buildUserRoomName } = require('../socket');
const { notifyParentSearching } = require('../services/notificationService');

const router = express.Router();

const parseRequesterLocation = (locationPayload) => {
  const latitude = Number(locationPayload?.latitude);
  const longitude = Number(locationPayload?.longitude);
  const accuracy = Number(locationPayload?.accuracy);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }

  return {
    latitude,
    longitude,
    ...(Number.isFinite(accuracy) && accuracy >= 0 ? { accuracy } : {}),
    capturedAt: new Date(),
  };
};

const parseDestinationLocation = (locationPayload) => {
  const rawLatitude = locationPayload?.latitude;
  const rawLongitude = locationPayload?.longitude;

  if (rawLatitude === undefined || rawLatitude === null || rawLatitude === '' ||
      rawLongitude === undefined || rawLongitude === null || rawLongitude === '') {
    return null;
  }

  const latitude = Number(rawLatitude);
  const longitude = Number(rawLongitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }

  return { latitude, longitude, updatedAt: new Date() };
};

// Create parent profile for Firebase authenticated users
router.post('/create-profile', async (req, res) => {
  try {
    const { fullName, phone } = req.body || {};

    if (typeof fullName !== 'string' || !fullName.trim()) {
      return res.status(400).json({ message: 'Full name is required.' });
    }

    const normalizedPhone = normalizePhoneNumber(phone || '');
    if (!isValidPhoneNumber(phone)) {
      return res.status(400).json({ message: 'Please enter a valid Philippine mobile number.' });
    }

    const identity = await verifyRegistrationIdentity(req.body);

    // Check if user already exists
    let user = await User.findOne({ email: identity.email });

    if (user) {
      if (user.role !== 'parent' || user.firebaseUid !== identity.uid) {
        return res.status(409).json({ message: 'This email address is already registered. Please sign in.' });
      }
      return res.status(200).json({
        message: 'Parent profile already exists.',
        user: {
          id: user._id,
          role: user.role,
          fullName: user.fullName,
          email: user.email,
          status: user.status,
        },
      });
    }

    // The existing review status remains separate from Firebase email verification.
    user = new User({
      firebaseUid: identity.uid,
      fullName: fullName.trim(),
      email: identity.email,
      phone: normalizedPhone,
      role: 'parent',
      isVerified: false,
      status: 'pending',
      accountState: 'active',
    });

    await user.save();

    return res.status(201).json({
      message: 'Parent profile created successfully.',
      user: {
        id: user._id,
        role: user.role,
        fullName: user.fullName,
        email: user.email,
        status: user.status,
      },
    });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    if (error.code === 11000) return res.status(409).json({ message: 'This email address is already registered.' });
    return res.status(500).json({ message: 'Failed to create parent profile.' });
  }
});

const buildParentProfile = (user) => ({
  parentName: user.fullName || '',
  contactNumber: user.phone || '',
  studentName: user.student?.fullName || '',
  gradeSection: user.student?.gradeLevel || '',
  schoolName: user.student?.schoolName || '',
  pickupZone: user.homeAddress || '',
  schoolLatitude: user.student?.schoolLatitude ?? '',
  schoolLongitude: user.student?.schoolLongitude ?? '',
});

router.get('/profile', requireParent, (req, res) => {
  return res.status(200).json({ profile: buildParentProfile(req.user) });
});

router.put('/profile', requireParent, async (req, res) => {
  const body = req.body || {};
  const parentName = typeof body.parentName === 'string' ? body.parentName.trim() : '';
  const contactNumber = typeof body.contactNumber === 'string' ? body.contactNumber.trim() : '';
  const studentName = typeof body.studentName === 'string' ? body.studentName.trim() : '';
  const gradeSection = typeof body.gradeSection === 'string' ? body.gradeSection.trim() : '';
  const schoolName = typeof body.schoolName === 'string' ? body.schoolName.trim() : '';
  const pickupZone = typeof body.pickupZone === 'string' ? body.pickupZone.trim() : '';
  const hasLatitude = body.schoolLatitude !== undefined && body.schoolLatitude !== null &&
    !(typeof body.schoolLatitude === 'string' && !body.schoolLatitude.trim());
  const hasLongitude = body.schoolLongitude !== undefined && body.schoolLongitude !== null &&
    !(typeof body.schoolLongitude === 'string' && !body.schoolLongitude.trim());

  if (!parentName) {
    return res.status(400).json({ message: 'Parent name is required.' });
  }
  if (!isValidPhoneNumber(contactNumber)) {
    return res.status(400).json({ message: 'Please enter a valid Philippine mobile number.' });
  }
  if (hasLatitude !== hasLongitude) {
    return res.status(400).json({ message: 'Enter both school destination coordinates or leave both blank.' });
  }

  let schoolLatitude;
  let schoolLongitude;
  if (hasLatitude) {
    if (!['number', 'string'].includes(typeof body.schoolLatitude) ||
        !['number', 'string'].includes(typeof body.schoolLongitude)) {
      return res.status(400).json({ message: 'Enter valid school destination coordinates.' });
    }
    schoolLatitude = Number(body.schoolLatitude);
    schoolLongitude = Number(body.schoolLongitude);
    if (!Number.isFinite(schoolLatitude) || schoolLatitude < -90 || schoolLatitude > 90 ||
        !Number.isFinite(schoolLongitude) || schoolLongitude < -180 || schoolLongitude > 180) {
      return res.status(400).json({ message: 'Enter valid school destination coordinates.' });
    }
  }

  try {
    req.user.fullName = parentName;
    req.user.phone = normalizePhoneNumber(contactNumber);
    req.user.homeAddress = pickupZone;
    if (!req.user.student) req.user.student = {};
    req.user.student.fullName = studentName;
    req.user.student.gradeLevel = gradeSection;
    req.user.student.schoolName = schoolName;
    req.user.student.schoolLatitude = hasLatitude ? schoolLatitude : undefined;
    req.user.student.schoolLongitude = hasLongitude ? schoolLongitude : undefined;
    await req.user.save();

    return res.status(200).json({
      message: 'Parent profile saved successfully.',
      profile: buildParentProfile(req.user),
    });
  } catch (error) {
    console.error('[PARENT] Failed to save profile:', error.name || 'UnknownError');
    return res.status(500).json({ message: 'Unable to save parent profile.' });
  }
});

router.get('/notifications', requireApplicant, async (req, res) => {
  const notifications = [...(req.user.notifications || [])].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

  return res.status(200).json({ notifications });
});

router.patch('/notifications/:notificationId/read', requireApplicant, async (req, res) => {
  const targetNotification = req.user.notifications.id(req.params.notificationId);

  if (!targetNotification) {
    return res.status(404).json({ message: 'Notification not found.' });
  }

  targetNotification.read = true;
  await req.user.save();

  return res.status(200).json({ message: 'Notification marked as read.' });
});

router.post('/van-requests', requireParent, async (req, res) => {
  try {
    const studentName =
      String(req.body?.studentName || '').trim() || String(req.user?.student?.fullName || '').trim();
    const pickupZone =
      String(req.body?.pickupZone || '').trim() || String(req.user?.homeAddress || '').trim();
    const gradeSection =
      String(req.body?.gradeSection || '').trim() || String(req.user?.student?.gradeLevel || '').trim();
    const schoolName =
      String(req.body?.schoolName || '').trim() || String(req.user?.student?.schoolName || '').trim();
    const emergencyContact =
      String(req.body?.emergencyContact || '').trim() || String(req.user?.phone || '').trim();
    const notes = String(req.body?.notes || '').trim();
    const requesterLocation = parseRequesterLocation(req.body?.requesterLocation);
    const destinationLocation = parseDestinationLocation(req.body?.destinationLocation);
    const hasDestinationCoordinates =
      req.body?.destinationLocation?.latitude !== undefined ||
      req.body?.destinationLocation?.longitude !== undefined;

    if (!studentName || !pickupZone) {
      return res.status(400).json({
        message:
          'Student name and pickup zone are required. Please complete parent settings or allow profile fallback values.',
      });
    }

    if (hasDestinationCoordinates && !destinationLocation) {
      return res.status(400).json({ message: 'Provide valid latitude and longitude for the school destination.' });
    }

    const activeRequest = await VanRequest.findOne({
      parent: req.user._id,
      status: { $in: ['searching', 'accepted', 'arrived', 'picked_up'] },
    }).select('_id status');

    if (activeRequest) {
      return res.status(409).json({ message: 'You already have an active ride request.' });
    }

    const rideRequest = await VanRequest.create({
      parent: req.user._id,
      studentName,
      gradeSection,
      schoolName,
      pickupZone,
      emergencyContact,
      notes,
      requesterLocation,
      destinationLocation,
      status: 'searching',
    });

    const populatedRequest = await VanRequest.findById(rideRequest._id)
      .populate('parent', 'fullName phone')
      .populate('driver', 'fullName phone driver.vehicleType driver.plateNumber')
      .populate('vehicleId', 'plateNumber vehicleType seatCapacity color manufacturer model');

    // STAGE 1: Notify parent - searching for driver
    await notifyParentSearching(
      req.user._id,
      rideRequest._id,
      studentName,
      schoolName,
      pickupZone
    );

    // Keep old notification for backward compatibility
    req.user.notifications.push({
      title: 'Searching for driver',
      message: 'Your school van request is now searching for an available driver.',
      status: 'pending',
    });
    await req.user.save();

    const activeDrivers = await User.find({ role: 'driver', status: 'approved' }).select('_id');
    const activeDriverIds = activeDrivers.map((driver) => String(driver._id));

    sendPushToUserIds(activeDriverIds, {
      title: 'New School Van Request',
      body: `${studentName} needs pickup${pickupZone ? ` at ${pickupZone}` : ''}.`,
      data: {
        type: 'new-van-request',
        requestId: String(rideRequest._id),
      },
    }).catch(() => {});

    const io = getIo();
    if (io) {
      const eventPayload = {
        request: populatedRequest,
      };

      // Emit to trip room
      io.to(buildTripRoomName(rideRequest._id)).emit('trip:request-updated', eventPayload);
      
      // Emit to parent's user room
      io.to(buildUserRoomName(req.user._id)).emit('trip:request-updated', eventPayload);
      
      // Emit new request to all connected drivers
      activeDriverIds.forEach((driverId) => {
        io.to(buildUserRoomName(driverId)).emit('trip:request-updated', eventPayload);
      });
      
      // Broadcast new searching request to all drivers in the drivers room
      io.to('drivers').emit('new-searching-request', {
        request: populatedRequest,
        timestamp: new Date(),
      });
    }

    return res.status(201).json({
      message: 'School van request submitted successfully.',
      request: populatedRequest,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to submit ride request right now.' });
  }
});

router.patch('/van-requests/:requestId/requester-location', requireParent, async (req, res) => {
  try {
    const requesterLocation = parseRequesterLocation(req.body);

    if (!requesterLocation) {
      return res.status(400).json({ message: 'Valid requester location is required.' });
    }

    const rideRequest = await VanRequest.findOneAndUpdate(
      {
        _id: req.params.requestId,
        parent: req.user._id,
        status: { $in: ['searching', 'accepted', 'arrived', 'picked_up'] },
      },
      { $set: { requesterLocation } },
      { new: true }
    );

    if (!rideRequest) {
      const ownedRequest = await VanRequest.findOne({ _id: req.params.requestId, parent: req.user._id });
      if (!ownedRequest) return res.status(404).json({ message: 'Ride request not found.' });
      return res.status(409).json({ message: 'Requester location updates are only allowed for active requests.' });
    }

    const populatedRequest = await VanRequest.findById(rideRequest._id)
      .populate('parent', 'fullName phone')
      .populate('driver', 'fullName phone driver.vehicleType driver.plateNumber')
      .populate('vehicleId', 'plateNumber vehicleType seatCapacity color manufacturer model');

    const io = getIo();
    if (io) {
      const eventPayload = {
        request: populatedRequest,
      };

      io.to(buildTripRoomName(rideRequest._id)).emit('trip:request-updated', eventPayload);
      io.to(buildUserRoomName(req.user._id)).emit('trip:request-updated', eventPayload);

      if (populatedRequest?.driver?._id) {
        io.to(buildUserRoomName(populatedRequest.driver._id)).emit('trip:request-updated', eventPayload);
      }
    }

    return res.status(200).json({
      message: 'Requester location updated successfully.',
      request: populatedRequest,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to update requester location right now.' });
  }
});

router.patch('/van-requests/:requestId/pickup-confirm', requireParent, async (req, res) => {
  try {
    let rideRequest = await VanRequest.findOneAndUpdate(
      {
        _id: req.params.requestId,
        parent: req.user._id,
        status: { $in: ['accepted', 'arrived'] },
        pickupConfirmedByParentAt: null,
      },
      { $set: { pickupConfirmedByParentAt: new Date() } },
      { new: true }
    );

    if (!rideRequest) {
      rideRequest = await VanRequest.findOne({ _id: req.params.requestId, parent: req.user._id });
      if (!rideRequest) return res.status(404).json({ message: 'Ride request not found.' });
      if (!['accepted', 'arrived'].includes(rideRequest.status)) {
        return res.status(409).json({ message: 'Pickup confirmation is only allowed for active pickup trips.' });
      }
    }

    const populatedRequest = await VanRequest.findById(rideRequest._id)
      .populate('parent', 'fullName phone')
      .populate('driver', 'fullName phone driver.vehicleType driver.plateNumber')
      .populate('vehicleId', 'plateNumber vehicleType seatCapacity color manufacturer model');

    const io = getIo();
    if (io) {
      const eventPayload = { request: populatedRequest };
      io.to(buildTripRoomName(rideRequest._id)).emit('trip:request-updated', eventPayload);
      io.to(buildUserRoomName(req.user._id)).emit('trip:request-updated', eventPayload);

      if (populatedRequest?.driver?._id) {
        io.to(buildUserRoomName(populatedRequest.driver._id)).emit('trip:request-updated', eventPayload);
      }
    }

    return res.status(200).json({
      message: 'Pickup confirmation recorded.',
      request: populatedRequest,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to confirm pickup right now.' });
  }
});

router.get('/van-requests', requireParent, async (req, res) => {
  try {
    const requests = await VanRequest.find({ parent: req.user._id })
      .populate('driver', 'fullName phone driver.vehicleType driver.plateNumber')
      .populate('vehicleId', 'plateNumber vehicleType seatCapacity color manufacturer model')
      .sort({ createdAt: -1 });

    return res.status(200).json({ requests });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to load your ride requests right now.' });
  }
});

router.patch('/van-requests/:requestId/cancel', requireParent, async (req, res) => {
  try {
    const request = await VanRequest.findOneAndUpdate(
      {
        _id: req.params.requestId,
        parent: req.user._id,
        status: { $in: ['searching', 'accepted', 'arrived'] },
      },
      { $set: { status: 'cancelled', liveLocation: null } },
      { new: true }
    );

    if (!request) {
      const ownedRequest = await VanRequest.findOne({ _id: req.params.requestId, parent: req.user._id });
      if (!ownedRequest) return res.status(404).json({ message: 'Ride request not found.' });
      return res.status(409).json({ message: 'This request can no longer be cancelled.' });
    }

    if (request.driver) {
      await releaseVanRequestAssignment({
        driverId: request.driver,
        requestId: request._id,
        vehicleId: request.vehicleId,
      });
    }

    const populatedRequest = await VanRequest.findById(request._id)
      .populate('driver', 'fullName phone driver.vehicleType driver.plateNumber')
      .populate('vehicleId', 'plateNumber vehicleType seatCapacity color manufacturer model');

    const io = getIo();
    if (io) {
      const eventPayload = { request: populatedRequest };
      io.to(buildTripRoomName(request._id)).emit('trip:request-updated', eventPayload);
      io.to(buildUserRoomName(req.user._id)).emit('trip:request-updated', eventPayload);
      if (request.driver) io.to(buildUserRoomName(request.driver)).emit('trip:request-updated', eventPayload);
    }

    return res.status(200).json({ message: 'Ride request cancelled.', request: populatedRequest });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to cancel ride request right now.' });
  }
});

module.exports = router;
