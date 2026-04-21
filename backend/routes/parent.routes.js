const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const VanRequest = require('../models/VanRequest');
const { requireApplicant, requireParent } = require('../middleware/auth');
const { validateRegistrationPayload } = require('../utils/validation');
const { sendPushToUserIds } = require('../utils/pushNotifications');
const { getIo, buildTripRoomName, buildUserRoomName } = require('../socket');

const router = express.Router();

const uploadsDirectory = path.resolve(__dirname, '../uploads/ids');

const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];

const ensureUploadsDirectory = () => {
  fs.mkdirSync(uploadsDirectory, { recursive: true });
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureUploadsDirectory();
    cb(null, uploadsDirectory);
  },
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const safeExtension = allowedExtensions.includes(extension) ? extension : '';
    const randomName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${safeExtension}`;
    cb(null, randomName);
  },
});

const fileFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname || '').toLowerCase();
  const isMimeAllowed = allowedMimeTypes.includes(file.mimetype);
  const isExtensionAllowed = allowedExtensions.includes(extension);

  if (!isMimeAllowed || !isExtensionAllowed) {
    cb(new Error('Only JPG, PNG, WEBP images or PDF files are allowed.'));
    return;
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

const removeFileIfExists = (filePath) => {
  if (!filePath) {
    return;
  }

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

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

router.post('/register', upload.single('validId'), async (req, res) => {
  try {
    const validation = validateRegistrationPayload(req.body);

    if (!req.file) {
      validation.errors.push('A valid ID file is required.');
    }

    if (validation.errors.length > 0) {
      removeFileIfExists(req.file?.path);
      return res.status(400).json({
        message: 'Please fix the highlighted issues and try again.',
        errors: validation.errors,
      });
    }

    const existingUser = await User.findOne({ email: validation.data.email });

    if (existingUser) {
      removeFileIfExists(req.file?.path);
      return res.status(409).json({ message: 'This email address is already registered.' });
    }

    const passwordHash = await bcrypt.hash(validation.data.password, 12);

    const user = await User.create({
      role: validation.data.role,
      fullName: validation.data.fullName,
      email: validation.data.email,
      phone: validation.data.phone,
      homeAddress: validation.data.homeAddress,
      passwordHash,
      student: validation.data.student,
      driver: validation.data.driver,
      validId: {
        originalName: req.file.originalname,
        filename: req.file.filename,
        path: req.file.path,
        mimeType: req.file.mimetype,
        size: req.file.size,
      },
      status: 'pending',
      notifications: [
        {
          title: 'Application Received',
          message: `Your ${validation.data.role} account registration has been submitted and is pending verification.`,
          status: 'pending',
        },
      ],
    });

    return res.status(201).json({
      message: 'Registration submitted successfully. Your account is now pending verification.',
      registrationId: user._id,
      status: user.status,
    });
  } catch (error) {
    removeFileIfExists(req.file?.path);
    return res.status(500).json({ message: 'Unable to submit registration right now.' });
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

    if (!studentName || !pickupZone) {
      return res.status(400).json({
        message:
          'Student name and pickup zone are required. Please complete parent settings or allow profile fallback values.',
      });
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
      status: 'searching',
    });

    const populatedRequest = await VanRequest.findById(rideRequest._id)
      .populate('parent', 'fullName phone')
      .populate('driver', 'fullName phone driver.vehicleType driver.plateNumber');

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

      io.to(buildTripRoomName(rideRequest._id)).emit('trip:request-updated', eventPayload);
      io.to(buildUserRoomName(req.user._id)).emit('trip:request-updated', eventPayload);
      activeDriverIds.forEach((driverId) => {
        io.to(buildUserRoomName(driverId)).emit('trip:request-updated', eventPayload);
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

    const rideRequest = await VanRequest.findOne({
      _id: req.params.requestId,
      parent: req.user._id,
    });

    if (!rideRequest) {
      return res.status(404).json({ message: 'Ride request not found.' });
    }

    if (!['searching', 'accepted', 'arrived', 'picked_up'].includes(rideRequest.status)) {
      return res
        .status(409)
        .json({ message: 'Requester location updates are only allowed for active requests.' });
    }

    rideRequest.requesterLocation = requesterLocation;
    await rideRequest.save();

    const populatedRequest = await VanRequest.findById(rideRequest._id)
      .populate('parent', 'fullName phone')
      .populate('driver', 'fullName phone driver.vehicleType driver.plateNumber');

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
    const rideRequest = await VanRequest.findOne({
      _id: req.params.requestId,
      parent: req.user._id,
    });

    if (!rideRequest) {
      return res.status(404).json({ message: 'Ride request not found.' });
    }

    if (!['accepted', 'arrived'].includes(rideRequest.status)) {
      return res.status(409).json({ message: 'Pickup confirmation is only allowed for active pickup trips.' });
    }

    if (!rideRequest.pickupConfirmedByParentAt) {
      rideRequest.pickupConfirmedByParentAt = new Date();
      await rideRequest.save();
    }

    const populatedRequest = await VanRequest.findById(rideRequest._id)
      .populate('parent', 'fullName phone')
      .populate('driver', 'fullName phone driver.vehicleType driver.plateNumber');

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
      .sort({ createdAt: -1 });

    return res.status(200).json({ requests });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to load your ride requests right now.' });
  }
});

router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'ID file size must be less than 5MB.' });
    }

    return res.status(400).json({ message: 'Unable to process uploaded file.' });
  }

  if (error && error.message) {
    return res.status(400).json({ message: error.message });
  }

  return next(error);
});

module.exports = router;
