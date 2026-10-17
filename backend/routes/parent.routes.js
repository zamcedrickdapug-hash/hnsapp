const express = require('express');
const User = require('../models/User');
const Notification = require('../models/Notification');
const VanRequest = require('../models/VanRequest');
const DriverPhoto = require('../models/DriverPhoto');
const School = require('../models/School');
const { releaseVanRequestAssignment } = require('../services/releaseVanRequestAssignment');
const { toParentSafeRequest } = require('../services/driverPublicProfile');
const { requireApplicant, requireParent } = require('../middleware/auth');
const { normalizePhoneNumber, isValidPhoneNumber } = require('../utils/validation');
const { verifyRegistrationIdentity } = require('../utils/firebaseIdentity');
const { sendPushToUserIds } = require('../utils/pushNotifications');
const { getIo, buildTripRoomName, buildUserRoomName } = require('../socket');
const { notifyParentSearching } = require('../services/notificationService');
const {
  getDriverEligibility,
  isPickupInAnyServiceZone,
} = require('../services/driverEligibility');

const router = express.Router();

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

const buildParentProfile = (user) => {
  const students = (typeof user.getStudentList === 'function' ? user.getStudentList() : [])
    .map((student) => ({
      fullName: student.fullName || '',
      gradeLevel: student.gradeLevel || '',
      schoolName: student.schoolName || '',
      schoolLatitude: student.schoolLatitude ?? '',
      schoolLongitude: student.schoolLongitude ?? '',
    }));

  return {
    parentName: user.fullName || '',
    contactNumber: user.phone || '',
    studentName: user.student?.fullName || '',
    gradeSection: user.student?.gradeLevel || '',
    schoolName: user.student?.schoolName || '',
    students,
    pickupZone: user.student?.pickupZone || user.homeAddress || '',
    pickupLatitude: user.student?.pickupLatitude ?? '',
    pickupLongitude: user.student?.pickupLongitude ?? '',
    schoolLatitude: user.student?.schoolLatitude ?? '',
    schoolLongitude: user.student?.schoolLongitude ?? '',
  };
};

router.get('/profile', requireParent, (req, res) => {
  return res.status(200).json({ profile: buildParentProfile(req.user) });
});

router.put('/profile', requireParent, async (req, res) => {
  const body = req.body || {};
  const parentName = typeof body.parentName === 'string' ? body.parentName.trim() : '';
  const contactNumber = typeof body.contactNumber === 'string' ? body.contactNumber.trim() : '';
  let studentName = typeof body.studentName === 'string' ? body.studentName.trim() : '';
  let gradeSection = typeof body.gradeSection === 'string' ? body.gradeSection.trim() : '';
  let schoolName = typeof body.schoolName === 'string' ? body.schoolName.trim() : '';
  let students;
  if (Object.hasOwn(body, 'students')) {
    if (!Array.isArray(body.students) || body.students.length > 5) {
      return res.status(400).json({ message: 'Students must be an array of up to 5 entries.' });
    }

    students = [];
    const studentNames = new Set();
    for (const [index, item] of body.students.entries()) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return res.status(400).json({ message: `Student ${index + 1} must be an object.` });
      }

      const student = {
        fullName: typeof item.fullName === 'string' ? item.fullName.trim() : '',
        gradeLevel: typeof item.gradeLevel === 'string' ? item.gradeLevel.trim() : '',
        schoolName: typeof item.schoolName === 'string' ? item.schoolName.trim() : '',
      };
      if (!student.fullName || !student.gradeLevel) {
        return res.status(400).json({ message: `Student ${index + 1} name and grade/section are required.` });
      }

      const normalizedName = student.fullName.toLowerCase();
      if (studentNames.has(normalizedName)) {
        return res.status(400).json({ message: 'Student names must be unique.' });
      }
      studentNames.add(normalizedName);

      const hasLatitude = item.schoolLatitude !== undefined && item.schoolLatitude !== null &&
        !(typeof item.schoolLatitude === 'string' && !item.schoolLatitude.trim());
      const hasLongitude = item.schoolLongitude !== undefined && item.schoolLongitude !== null &&
        !(typeof item.schoolLongitude === 'string' && !item.schoolLongitude.trim());
      if (hasLatitude !== hasLongitude) {
        return res.status(400).json({ message: `Student ${index + 1} must have both school coordinates or neither.` });
      }
      if (hasLatitude) {
        if (!['number', 'string'].includes(typeof item.schoolLatitude) ||
            !['number', 'string'].includes(typeof item.schoolLongitude)) {
          return res.status(400).json({ message: `Student ${index + 1} has invalid school coordinates.` });
        }
        const latitude = Number(item.schoolLatitude);
        const longitude = Number(item.schoolLongitude);
        if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
            !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
          return res.status(400).json({ message: `Student ${index + 1} has invalid school coordinates.` });
        }
        student.schoolLatitude = latitude;
        student.schoolLongitude = longitude;
      }
      students.push(student);
    }

    const firstStudent = students[0];
    studentName = firstStudent?.fullName || '';
    gradeSection = firstStudent?.gradeLevel || '';
    schoolName = firstStudent?.schoolName || '';
  }
  const pickupZone = typeof body.pickupZone === 'string' ? body.pickupZone.trim() : '';
  const hasPickupCoordinateFields =
    body.pickupLatitude !== undefined || body.pickupLongitude !== undefined;
  const hasPickupLatitude = body.pickupLatitude !== undefined && body.pickupLatitude !== null &&
    !(typeof body.pickupLatitude === 'string' && !body.pickupLatitude.trim());
  const hasPickupLongitude = body.pickupLongitude !== undefined && body.pickupLongitude !== null &&
    !(typeof body.pickupLongitude === 'string' && !body.pickupLongitude.trim());
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
  if (hasPickupLatitude !== hasPickupLongitude) {
    return res.status(400).json({ message: 'Enter both pickup coordinates or leave both blank.' });
  }
  let pickupLatitude;
  let pickupLongitude;
  if (hasPickupLatitude) {
    if (!['number', 'string'].includes(typeof body.pickupLatitude) ||
        !['number', 'string'].includes(typeof body.pickupLongitude)) {
      return res.status(400).json({ message: 'Enter valid pickup coordinates.' });
    }
    pickupLatitude = Number(body.pickupLatitude);
    pickupLongitude = Number(body.pickupLongitude);
    if (!Number.isFinite(pickupLatitude) || pickupLatitude < -90 || pickupLatitude > 90 ||
        !Number.isFinite(pickupLongitude) || pickupLongitude < -180 || pickupLongitude > 180) {
      return res.status(400).json({ message: 'Enter valid pickup coordinates.' });
    }
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
    if (!req.user.student) req.user.student = {};
    req.user.student.fullName = studentName;
    req.user.student.gradeLevel = gradeSection;
    req.user.student.schoolName = schoolName;
    if (students === undefined || typeof body.pickupZone === 'string') {
      req.user.homeAddress = pickupZone;
      req.user.student.pickupZone = pickupZone;
    }
    if (hasPickupCoordinateFields) {
      req.user.student.pickupLatitude = hasPickupLatitude ? pickupLatitude : undefined;
      req.user.student.pickupLongitude = hasPickupLongitude ? pickupLongitude : undefined;
    }
    if (students !== undefined) {
      const firstStudent = students[0];
      req.user.students = students;
      req.user.student.schoolLatitude = firstStudent?.schoolLatitude;
      req.user.student.schoolLongitude = firstStudent?.schoolLongitude;
    } else {
      req.user.student.schoolLatitude = hasLatitude ? schoolLatitude : undefined;
      req.user.student.schoolLongitude = hasLongitude ? schoolLongitude : undefined;
    }
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

router.post('/pickup-zone-check', requireParent, (req, res) => {
  const { latitude, longitude } = req.body || {};
  if (!['number', 'string'].includes(typeof latitude) ||
      !['number', 'string'].includes(typeof longitude) ||
      (typeof latitude === 'string' && !latitude.trim()) ||
      (typeof longitude === 'string' && !longitude.trim())) {
    return res.status(400).json({ message: 'Provide valid pickup latitude and longitude.' });
  }

  const location = parseRequesterLocation(req.body);
  if (!location) {
    return res.status(400).json({ message: 'Provide valid pickup latitude and longitude.' });
  }

  return res.status(200).json({ inside: isPickupInAnyServiceZone(location) });
});

router.get('/notifications', requireApplicant, async (req, res) => {
  const collectionNotifications = await Notification.find({ userId: req.user._id });
  const embeddedNotifications = [...(req.user.notifications || [])].filter((notification) => {
    const matchingType = {
      'Searching for driver': 'searching',
      'Driver accepted request': 'accepted',
    }[notification.title];
    if (!matchingType) return true;

    return !collectionNotifications.some((collectionNotification) => {
      const createdAt = new Date(notification.createdAt).getTime();
      const collectionCreatedAt = new Date(collectionNotification.createdAt).getTime();
      return collectionNotification.type === matchingType &&
        Math.abs(createdAt - collectionCreatedAt) <= 5000;
    });
  });
  const seenIds = new Set();
  const notifications = [...embeddedNotifications, ...collectionNotifications]
    .filter((notification) => {
      if (!notification?._id) return true;
      const id = String(notification._id);
      if (seenIds.has(id)) return false;
      seenIds.add(id);
      return true;
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return res.status(200).json({ notifications });
});

router.patch('/notifications/:notificationId/read', requireApplicant, async (req, res) => {
  const targetNotification = req.user.notifications?.id?.(req.params.notificationId) ||
    req.user.notifications?.find((notification) => String(notification._id) === req.params.notificationId);

  if (targetNotification) {
    targetNotification.read = true;
    await req.user.save();
    return res.status(200).json({ message: 'Notification marked as read.' });
  }

  const collectionNotification = await Notification.findOne({
    _id: req.params.notificationId,
    userId: req.user._id,
  });
  if (!collectionNotification) {
    return res.status(404).json({ message: 'Notification not found.' });
  }

  collectionNotification.read = true;
  collectionNotification.readAt = new Date();
  await collectionNotification.save();
  return res.status(200).json({ message: 'Notification marked as read.' });
});

router.post('/van-requests', requireParent, async (req, res) => {
  try {
    let selectedStudents;
    if (req.body?.studentNames !== undefined) {
      if (!Array.isArray(req.body.studentNames) || req.body.studentNames.length === 0) {
        return res.status(400).json({ message: 'Select one or more children to book.' });
      }

      const savedStudents = req.user.getStudentList();
      const selectedNames = new Set();
      selectedStudents = [];
      for (const requestedName of req.body.studentNames) {
        if (typeof requestedName !== 'string' || !requestedName.trim()) {
          return res.status(400).json({ message: 'Select valid children to book.' });
        }
        const normalizedName = requestedName.trim().toLowerCase();
        if (selectedNames.has(normalizedName)) {
          return res.status(400).json({ message: 'Selected children must be unique.' });
        }
        selectedNames.add(normalizedName);

        const student = savedStudents.find((savedStudent) => (
          String(savedStudent.fullName || '').trim().toLowerCase() === normalizedName
        ));
        if (!student) {
          return res.status(400).json({ message: 'One or more selected children do not belong to your account.' });
        }
        selectedStudents.push(student);
      }

      const selectedSchoolNames = new Set(selectedStudents.map((student) => (
        String(student.schoolName || '').trim().toLowerCase()
      )));
      if (selectedSchoolNames.size > 1) {
        return res.status(400).json({
          message: 'Selected children attend different schools. Please book them separately.',
        });
      }
    }

    const studentName = selectedStudents
      ? selectedStudents.map((student) => String(student.fullName || '').trim()).join(', ')
      : String(req.body?.studentName || '').trim() || String(req.user?.student?.fullName || '').trim();
    const pickupZone =
      String(req.body?.pickupZone || '').trim() || String(req.user?.homeAddress || '').trim();
    const gradeSection = selectedStudents
      ? String(selectedStudents[0].gradeLevel || '').trim()
      : String(req.body?.gradeSection || '').trim() || String(req.user?.student?.gradeLevel || '').trim();
    const schoolName = selectedStudents
      ? String(selectedStudents[0].schoolName || '').trim()
      : String(req.body?.schoolName || '').trim() || String(req.user?.student?.schoolName || '').trim();
    const emergencyContact =
      String(req.body?.emergencyContact || '').trim() || String(req.user?.phone || '').trim();
    const notes = String(req.body?.notes || '').trim();
    const requesterLocation = parseRequesterLocation({
      latitude: req.user?.student?.pickupLatitude,
      longitude: req.user?.student?.pickupLongitude,
    });
    const selectedSchoolCoordinates = selectedStudents?.find((student) => (
      student.schoolLatitude !== undefined && student.schoolLatitude !== null && student.schoolLatitude !== '' ||
      student.schoolLongitude !== undefined && student.schoolLongitude !== null && student.schoolLongitude !== ''
    ));
    const destinationLocation = selectedStudents
      ? parseDestinationLocation(selectedSchoolCoordinates && {
        latitude: selectedSchoolCoordinates.schoolLatitude,
        longitude: selectedSchoolCoordinates.schoolLongitude,
      })
      : parseDestinationLocation(req.body?.destinationLocation);
    const hasDestinationCoordinates = selectedStudents
      ? Boolean(selectedSchoolCoordinates)
      : req.body?.destinationLocation?.latitude !== undefined ||
        req.body?.destinationLocation?.longitude !== undefined;

    if (!requesterLocation) {
      return res.status(400).json({ message: 'Set your pickup location first' });
    }

    if (!studentName || !pickupZone) {
      return res.status(400).json({
        message:
          'Student name and pickup zone are required. Please complete parent settings or allow profile fallback values.',
      });
    }

    if (hasDestinationCoordinates && !destinationLocation) {
      return res.status(400).json({ message: 'Provide valid latitude and longitude for the school destination.' });
    }

    if (!isPickupInAnyServiceZone(requesterLocation)) {
      return res.status(400).json({ message: 'Outside our service area' });
    }

    const activeRequest = await VanRequest.findOne({
      parent: req.user._id,
      status: { $in: ['searching', 'accepted', 'arrived', 'picked_up'] },
    }).select('_id status');

    if (activeRequest) {
      return res.status(409).json({ message: 'You already have an active ride request.' });
    }

    const school = schoolName
      ? await School.findOne({
        name: new RegExp(`^${escapeRegExp(schoolName)}$`, 'i'),
        active: true,
      })
      : null;
    if (school) {
      const approvedDrivers = await User.find({
        role: 'driver',
        status: 'approved',
        accountState: { $in: ['active', null] },
      }).select('_id driver.assignedSchools');
      const hasAssignedDriver = approvedDrivers.some((driver) =>
        (driver.driver?.assignedSchools || []).some((assignedSchool) =>
          String(assignedSchool?._id || assignedSchool) === String(school._id)
        )
      );
      if (!hasAssignedDriver) {
        return res.status(409).json({ message: 'No driver is assigned to this school yet.' });
      }
    }

    const rideRequest = await VanRequest.create({
      parent: req.user._id,
      school: school?._id || null,
      studentName,
      gradeSection,
      schoolName,
      pickupZone,
      emergencyContact,
      notes,
      requesterLocation,
      destinationLocation,
      ...(selectedStudents ? {
        students: selectedStudents.map((student) => ({
          studentName: String(student.fullName || '').trim(),
          gradeLevel: String(student.gradeLevel || '').trim(),
        })),
        seatsNeeded: selectedStudents.length,
      } : {}),
      status: 'searching',
    });

    const populatedRequest = await VanRequest.findById(rideRequest._id)
      .populate('parent', 'fullName phone')
      .populate('driver', 'fullName phone status accountState driver.vehicleType driver.plateNumber driver.licenseExpirationDate driver.photoUpdatedAt')
      .populate('vehicleId', 'plateNumber vehicleType seatCapacity color manufacturer model');
    const parentSafeRequest = toParentSafeRequest(populatedRequest);

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

    const activeDrivers = await User.find({
      role: 'driver',
      status: 'approved',
      accountState: { $in: ['active', null] },
    }).select('_id');
    const eligibilityResults = await Promise.all(
      activeDrivers.map(async (driver) => ({
        driverId: String(driver._id),
        eligibility: await getDriverEligibility(driver._id, rideRequest),
      }))
    );
    const eligibleDriverIds = eligibilityResults
      .filter(({ eligibility }) => eligibility.eligible)
      .map(({ driverId }) => driverId);

    sendPushToUserIds(eligibleDriverIds, {
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
        request: parentSafeRequest,
      };

      // Emit to trip room
      io.to(buildTripRoomName(rideRequest._id)).emit('trip:request-updated', eventPayload);
      
      // Emit to parent's user room
      io.to(buildUserRoomName(req.user._id)).emit('trip:request-updated', eventPayload);
      
      // Emit new request to all connected drivers
      eligibleDriverIds.forEach((driverId) => {
        io.to(buildUserRoomName(driverId)).emit('trip:request-updated', eventPayload);
      });
      
      eligibleDriverIds.forEach((driverId) => {
        io.to(buildUserRoomName(driverId)).emit('new-searching-request', {
          request: parentSafeRequest,
          timestamp: new Date(),
        });
      });
    }

    return res.status(201).json({
      message: 'School van request submitted successfully.',
      request: parentSafeRequest,
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
      .populate('driver', 'fullName phone status accountState driver.vehicleType driver.plateNumber driver.licenseExpirationDate driver.photoUpdatedAt')
      .populate('vehicleId', 'plateNumber vehicleType seatCapacity color manufacturer model');
    const parentSafeRequest = toParentSafeRequest(populatedRequest);

    const io = getIo();
    if (io) {
      const eventPayload = {
        request: parentSafeRequest,
      };

      io.to(buildTripRoomName(rideRequest._id)).emit('trip:request-updated', eventPayload);
      io.to(buildUserRoomName(req.user._id)).emit('trip:request-updated', eventPayload);

      if (populatedRequest?.driver?._id) {
        io.to(buildUserRoomName(populatedRequest.driver._id)).emit('trip:request-updated', eventPayload);
      }
    }

    return res.status(200).json({
      message: 'Requester location updated successfully.',
      request: parentSafeRequest,
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
      .populate('driver', 'fullName phone status accountState driver.vehicleType driver.plateNumber driver.licenseExpirationDate driver.photoUpdatedAt')
      .populate('vehicleId', 'plateNumber vehicleType seatCapacity color manufacturer model');
    const parentSafeRequest = toParentSafeRequest(populatedRequest);

    const io = getIo();
    if (io) {
      const eventPayload = { request: parentSafeRequest };
      io.to(buildTripRoomName(rideRequest._id)).emit('trip:request-updated', eventPayload);
      io.to(buildUserRoomName(req.user._id)).emit('trip:request-updated', eventPayload);

      if (populatedRequest?.driver?._id) {
        io.to(buildUserRoomName(populatedRequest.driver._id)).emit('trip:request-updated', eventPayload);
      }
    }

    return res.status(200).json({
      message: 'Pickup confirmation recorded.',
      request: parentSafeRequest,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to confirm pickup right now.' });
  }
});

router.get('/van-requests', requireParent, async (req, res) => {
  try {
    const requests = await VanRequest.find({ parent: req.user._id })
      .populate('driver', 'fullName phone status accountState driver.vehicleType driver.plateNumber driver.licenseExpirationDate driver.photoUpdatedAt')
      .populate('vehicleId', 'plateNumber vehicleType seatCapacity color manufacturer model')
      .sort({ createdAt: -1 });

    return res.status(200).json({ requests: requests.map(toParentSafeRequest) });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to load your ride requests right now.' });
  }
});

router.get('/van-requests/:requestId/driver-photo', requireParent, async (req, res) => {
  try {
    const request = await VanRequest.findOne({
      _id: req.params.requestId,
      parent: req.user._id,
    }).select('driver status');
    if (!request || !request.driver || request.status === 'cancelled') {
      return res.status(404).json({ message: 'Driver photo not found.' });
    }

    const photo = await DriverPhoto.findOne({ userId: request.driver }).select('+data');
    if (!photo || !['image/jpeg', 'image/png', 'image/webp'].includes(photo.contentType)) {
      return res.status(404).json({ message: 'Driver photo not found.' });
    }

    return res
      .set('Content-Type', photo.contentType)
      .set('Cache-Control', 'private, max-age=300')
      .set('X-Content-Type-Options', 'nosniff')
      .send(photo.data);
  } catch (error) {
    return res.status(500).json({ message: 'Unable to load driver photo.' });
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
      .populate('driver', 'fullName phone status accountState driver.vehicleType driver.plateNumber driver.licenseExpirationDate driver.photoUpdatedAt')
      .populate('vehicleId', 'plateNumber vehicleType seatCapacity color manufacturer model');
    const parentSafeRequest = toParentSafeRequest(populatedRequest);

    const io = getIo();
    if (io) {
      const eventPayload = { request: parentSafeRequest };
      io.to(buildTripRoomName(request._id)).emit('trip:request-updated', eventPayload);
      io.to(buildUserRoomName(req.user._id)).emit('trip:request-updated', eventPayload);
      if (request.driver) io.to(buildUserRoomName(request.driver)).emit('trip:request-updated', eventPayload);
    }

    return res.status(200).json({ message: 'Ride request cancelled.', request: parentSafeRequest });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to cancel ride request right now.' });
  }
});

module.exports = router;
