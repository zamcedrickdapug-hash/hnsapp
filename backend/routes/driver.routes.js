const express = require('express');
const multer = require('multer');
const VanRequest = require('../models/VanRequest');
const User = require('../models/User');
const ValidIdDocument = require('../models/ValidIdDocument');
const Vehicle = require('../models/Vehicle');
const DriverStatus = require('../models/DriverStatus');
const { requireAuth } = require('../middleware/auth');
const { getIo, buildTripRoomName, buildUserRoomName } = require('../socket');
const {
  notifyParentDriverAccepted,
  notifyParentOnTheWay,
  notifyParentArrivalAtPickup,
  notifyParentStudentPickedUp,
  notifyParentHeadingToSchool,
  notifyParentArrivedAtSchool,
  clearNotificationsForRequest,
} = require('../services/notificationService');
const { sendPushToUserIds } = require('../utils/pushNotifications');
const { normalizePhoneNumber, isValidPhoneNumber } = require('../utils/validation');
const { verifyRegistrationIdentity } = require('../utils/firebaseIdentity');
const { releaseVanRequestAssignment } = require('../services/releaseVanRequestAssignment');
const {
  getDriverEligibility,
  areScheduleDetailsCompatible,
} = require('../services/driverEligibility');

const router = express.Router();
const MAX_VALID_ID_SIZE = 2 * 1024 * 1024;

const allowedMimeTypes = new Map([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.pdf', 'application/pdf'],
]);
const validFileSignatures = {
  'image/jpeg': Buffer.from([0xff, 0xd8, 0xff]),
  'image/png': Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  'application/pdf': Buffer.from('%PDF-'),
};

const fileFilter = (req, file, cb) => {
  const extension = String(file.originalname || '').toLowerCase().match(/\.[^.]+$/)?.[0];
  const isMimeAllowed = extension && allowedMimeTypes.get(extension) === file.mimetype;

  if (!isMimeAllowed) {
    const error = new Error('Only JPEG, PNG, or PDF files are allowed.');
    error.code = 'INVALID_FILE_TYPE';
    cb(error);
    return;
  }

  cb(null, true);
};

const hasValidFileSignature = (file) => {
  const signature = validFileSignatures[file.mimetype];
  return signature && file.buffer?.subarray(0, signature.length).equals(signature);
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: MAX_VALID_ID_SIZE + 1,
  },
});

// Helper function to validate license expiry date
const isValidLicenseExpiryDate = (expiryDateString) => {
	if (typeof expiryDateString !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(expiryDateString)) return false;

	const expiryDate = new Date(`${expiryDateString}T00:00:00.000Z`);
	if (Number.isNaN(expiryDate.getTime()) || expiryDate.toISOString().slice(0, 10) !== expiryDateString) return false;
	const today = new Date();
	const todayDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

	return expiryDateString >= todayDate;
};

// Firebase registration retains the existing ID upload and admin review workflow.
router.post('/create-profile', upload.single('validId'), async (req, res) => {
	console.info('[DRIVER] Profile creation request received.');
	let storedDocumentId;
	try {
		const {
			fullName,
			phone,
			homeAddress,
			licenseNumber,
			licenseExpiry,
			vehicleType,
			vehicleColor,
			seatCapacity,
			plateNumber,
			yearsOfExperience,
		} = req.body || {};
		const normalizedPhone = normalizePhoneNumber(phone || '');
		const identity = await verifyRegistrationIdentity(req.body || {});
		const normalizedLicenseNumber = typeof licenseNumber === 'string'
			? licenseNumber.trim().replace(/\s+/g, ' ')
			: '';
		const normalizedPlateNumber = typeof plateNumber === 'string'
			? plateNumber.trim().replace(/\s+/g, ' ').toUpperCase()
			: '';

		// Validate required fields
		const errors = [];
		if (typeof fullName !== 'string' || !fullName.trim()) errors.push('Full name is required.');
		if (!isValidPhoneNumber(phone)) errors.push('A valid Philippine mobile number is required.');
		if (typeof homeAddress !== 'string' || homeAddress.trim().length < 5) errors.push('Home address is required.');
		if (typeof licenseNumber !== 'string' || !/^[A-Za-z0-9 -]{5,30}$/.test(normalizedLicenseNumber)) errors.push('License number must be 5-30 characters (letters, numbers, hyphen and spaces).');
		if (!licenseExpiry) errors.push('License expiry date is required.');
		if (typeof vehicleType !== 'string' || !vehicleType.trim()) errors.push('Vehicle type is required.');
		const trimmedVehicleColor = typeof vehicleColor === 'string' ? vehicleColor.trim() : '';
		if (!trimmedVehicleColor || trimmedVehicleColor.length > 30) {
			return res.status(400).json({ message: 'Vehicle color must be between 1 and 30 characters.' });
		}
		const seatCapacityNumber = Number(seatCapacity);
		if (seatCapacity === undefined || seatCapacity === null || String(seatCapacity).trim() === '' || !Number.isInteger(seatCapacityNumber) || seatCapacityNumber < 3 || seatCapacityNumber > 20) {
			return res.status(400).json({ message: 'Seat capacity must be a whole number between 3 and 20.' });
		}
		if (typeof plateNumber !== 'string' || !/^[A-Za-z0-9 -]{3,15}$/.test(normalizedPlateNumber)) errors.push('Plate number must be 3-15 characters (letters, numbers, hyphen and spaces).');
		if (yearsOfExperience === undefined || yearsOfExperience === null || yearsOfExperience === '') {
			errors.push('Years of experience is required.');
		}
		if (!req.file) errors.push('A valid ID file is required.');
		if (req.file && req.file.size > MAX_VALID_ID_SIZE) errors.push('ID file must be 2MB or smaller.');
		if (req.file && !hasValidFileSignature(req.file)) {
			errors.push('The uploaded file content must be a valid JPEG, PNG, or PDF.');
		}

		if (errors.length > 0) {
			return res.status(400).json({ message: 'Validation failed.', errors });
		}

		// Validate license expiry date
		if (!isValidLicenseExpiryDate(licenseExpiry)) {
			return res.status(400).json({
				message: 'Driver license expiration date must be today or a future date.',
			});
		}

		// Validate years of experience is a valid number
		const yearsNum = Number(yearsOfExperience);
		if (!Number.isInteger(yearsNum) || yearsNum < 0 || yearsNum > 60) {
			return res.status(400).json({ message: 'Years of experience must be a whole number between 0 and 60.' });
		}

		// Check if user already exists
		let user = await User.findOne({ email: identity.email });

		if (user) {
			if (user.role !== 'driver' || user.firebaseUid !== identity.uid) {
				return res.status(409).json({ message: 'This email address is already registered. Please sign in.' });
			}
			return res.status(200).json({
				message: 'Driver profile already exists.',
				user: {
					id: user._id,
					role: user.role,
					fullName: user.fullName,
					email: user.email,
					status: user.status,
				},
			});
		}

		// Create new driver user
		user = new User({
			firebaseUid: identity.uid,
			fullName: fullName.trim(),
			email: identity.email,
			phone: normalizedPhone,
			homeAddress: homeAddress.trim(),
			role: 'driver',
			driver: {
				licenseNumber: normalizedLicenseNumber,
				licenseExpirationDate: new Date(licenseExpiry),
				vehicleType: vehicleType.trim(),
				vehicleColor: trimmedVehicleColor,
				seatCapacity: seatCapacityNumber,
				plateNumber: normalizedPlateNumber,
				yearsOfExperience: yearsNum,
			},
			isVerified: false,
			status: 'pending', // Driver profile is pending admin approval
			accountState: 'active',
			notifications: [{
				title: 'Application Received',
				message: 'Your driver account registration has been submitted and is pending verification.',
				status: 'pending',
			}],
		});

		const storedDocument = new ValidIdDocument({
			ownerId: user._id,
			originalName: req.file.originalname,
			mimeType: req.file.mimetype,
			size: req.file.size,
			data: req.file.buffer,
		});
		await storedDocument.save();
		storedDocumentId = storedDocument._id;
		user.validId = {
			documentId: storedDocument._id,
			originalName: req.file.originalname,
			filename: String(storedDocument._id),
			mimeType: req.file.mimetype,
			size: req.file.size,
		};

		await user.save();
		console.info('[DRIVER] Profile created with pending review status.');

		return res.status(201).json({
			message: 'Driver profile created successfully.',
			user: {
				id: user._id,
				role: user.role,
				fullName: user.fullName,
				email: user.email,
				status: user.status,
			},
		});
	} catch (error) {
		if (storedDocumentId) {
			try {
				await ValidIdDocument.deleteOne({ _id: storedDocumentId });
			} catch (cleanupError) {
				console.error('[DRIVER] Failed to clean up stored ID document:', cleanupError.name || 'UnknownError');
			}
		}
		if (error.status) return res.status(error.status).json({ message: error.message });
		if (error.code === 11000) return res.status(409).json({ message: 'This email address is already registered.' });
		return res.status(500).json({ message: 'Failed to create driver profile.' });
	}
}, (error, req, res, next) => {
	if (!(error instanceof multer.MulterError) && error.code !== 'INVALID_FILE_TYPE') return next(error);

	const message = error.code === 'LIMIT_FILE_SIZE'
		? 'ID file must be 2MB or smaller.'
		: error.code === 'LIMIT_UNEXPECTED_FILE'
			? 'Unexpected upload field. Upload the file using the validId field.'
			: error.message;
	console.warn('[DRIVER] Profile upload rejected:', error.code);
	return res.status(400).json({ message });
});

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
      $or: [
        { status: 'searching', rejectedBy: { $ne: req.user._id } },
        { driver: req.user._id },
      ],
    })
      .sort({ createdAt: -1 });

    const filteredRequests = await Promise.all(requests.map(async (request) => {
      if (String(request.driver || '') === String(req.user._id)) return request;
      const eligibility = await getDriverEligibility(req.user._id, request);
      return eligibility.eligible ? request : null;
    }));
    const eligibleRequests = filteredRequests.filter(Boolean);
    const populatedRequests = await VanRequest.populate(eligibleRequests, [
      { path: 'parent', select: 'fullName phone' },
      { path: 'driver', select: 'fullName phone driver.vehicleType driver.plateNumber' },
      { path: 'vehicleId', select: 'plateNumber vehicleType seatCapacity color manufacturer model' },
    ]);

    return res.status(200).json({ requests: populatedRequests });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to load driver requests right now.' });
  }
});

router.patch('/requests/:requestId/accept', async (req, res) => {
  try {
    if (req.user.status !== 'approved' || (req.user.accountState || 'active') !== 'active') {
      return res.status(403).json({ message: 'Only active, approved drivers can accept requests.' });
    }

    const existingRequest = await VanRequest.findById(req.params.requestId);
    if (!existingRequest) {
      return res.status(404).json({ message: 'Ride request not found.' });
    }

    if (existingRequest.status !== 'searching') {
      return res.status(409).json({ message: 'This request is already handled by another driver.' });
    }

    const eligibility = await getDriverEligibility(req.user._id, existingRequest);
    if (!eligibility.vehicle) {
      return res.status(400).json({ message: 'You need an assigned vehicle before accepting requests.' });
    }
    if (!eligibility.pickupWithinServiceZone) {
      return res.status(409).json({ message: 'This pickup is outside your service zone.' });
    }
    if (!eligibility.isOnline) {
      return res.status(409).json({ message: 'Go online before accepting a request.' });
    }
    if (!eligibility.slotDateCompatible) {
      return res.status(409).json({ message: 'All active bookings must use the same time slot and scheduled date.' });
    }
    const requestedSeats = Math.max(1, Number(existingRequest.seatsNeeded) || 1);
    if (eligibility.freeSeats < requestedSeats) {
      return res.status(409).json({ message: 'This booking exceeds your vehicle’s remaining seat capacity.' });
    }
    const vehicle = eligibility.vehicle;

    const rideRequest = await VanRequest.findOneAndUpdate(
      {
        _id: existingRequest._id,
        status: 'searching',
        driver: null,
        rejectedBy: { $ne: req.user._id },
      },
      {
        $set: {
          driver: req.user._id,
          vehicleId: vehicle?._id || null,
          status: 'accepted',
          acceptedAt: new Date(),
          liveLocation: null,
        },
      },
      { new: true }
    ).populate('parent', '_id fullName phone');

    if (!rideRequest) {
      return res.status(409).json({ message: 'This request is already handled or unavailable to you.' });
    }

    const activeRequests = await VanRequest.find({
      driver: req.user._id,
      status: { $in: ['accepted', 'arrived', 'picked_up'] },
    }).sort({ acceptedAt: 1, _id: 1 }).select('_id seatsNeeded slot scheduledDate');
    let cumulativeSeats = 0;
    let claimedRequestIsActive = false;
    let claimedRequestExceedsCapacity = false;
    for (const activeRequest of activeRequests) {
      cumulativeSeats += Math.max(1, Number(activeRequest.seatsNeeded) || 1);
      if (String(activeRequest._id) === String(rideRequest._id)) {
        claimedRequestIsActive = true;
        claimedRequestExceedsCapacity = cumulativeSeats > vehicle.seatCapacity;
        break;
      }
    }
    if (!claimedRequestIsActive) {
      return res.status(409).json({ message: 'This request is no longer active.' });
    }
    if (claimedRequestExceedsCapacity) {
      await VanRequest.findOneAndUpdate(
        {
          _id: rideRequest._id,
          driver: req.user._id,
          status: 'accepted',
        },
        {
          $set: {
            status: 'searching',
            driver: null,
            vehicleId: null,
            acceptedAt: null,
          },
        }
      );
      return res.status(409).json({ message: 'This booking exceeds your vehicle’s remaining seat capacity.' });
    }

    if (!areScheduleDetailsCompatible(rideRequest, activeRequests)) {
      await VanRequest.findOneAndUpdate(
        {
          _id: rideRequest._id,
          driver: req.user._id,
          status: 'accepted',
        },
        {
          $set: {
            status: 'searching',
            driver: null,
            vehicleId: null,
            acceptedAt: null,
          },
        }
      );
      return res.status(409).json({ message: 'All active bookings must use the same time slot and scheduled date.' });
    }

    await DriverStatus.findOneAndUpdate(
      { driverId: req.user._id },
      {
        $set: {
          activeRequestId: activeRequests[0]?._id || null,
          status: 'on-trip',
          isOnline: true,
          lastStatusUpdate: new Date(),
        },
      },
      { new: true }
    );
    await Vehicle.findOneAndUpdate(
      { _id: vehicle._id, assignedDriver: req.user._id },
      { $set: { status: 'assigned', isAvailable: false } },
      { new: true }
    );

    const populatedRequest = await VanRequest.findById(rideRequest._id)
      .populate('parent', 'fullName phone')
      .populate('driver', 'fullName phone driver.vehicleType driver.plateNumber')
      .populate('vehicleId', 'plateNumber vehicleType seatCapacity color manufacturer model');

    const parent = await User.findById(rideRequest.parent?._id || rideRequest.parent);
    const driver = await User.findById(req.user._id).select('fullName phone driver.vehicleType driver.plateNumber');

    // STAGE 2: Notify parent - driver accepted request
    if (parent) {
      await notifyParentDriverAccepted(
        parent._id,
        rideRequest._id,
        driver._id,
        driver.fullName,
        driver.phone,
        vehicle?.plateNumber || driver.driver?.plateNumber || '',
        vehicle?.vehicleType || driver.driver?.vehicleType || '',
        rideRequest.studentName,
        rideRequest.schoolName
      );

      // Keep old notification for backward compatibility
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

router.patch('/requests/:requestId/reject', async (req, res) => {
  try {
    if (req.user.status !== 'approved' || (req.user.accountState || 'active') !== 'active') {
      return res.status(403).json({ message: 'Only active, approved drivers can reject requests.' });
    }

    let rejectedRequest = await VanRequest.findOneAndUpdate(
      {
        _id: req.params.requestId,
        status: 'searching',
        rejectedBy: { $ne: req.user._id },
      },
      { $addToSet: { rejectedBy: req.user._id } },
      { new: true }
    );
    let releasedAssignment = false;

    if (!rejectedRequest) {
      const assignedRequest = await VanRequest.findOne({
        _id: req.params.requestId,
        driver: req.user._id,
        status: { $in: ['accepted', 'arrived'] },
      }).select('vehicleId');
      rejectedRequest = await VanRequest.findOneAndUpdate(
        {
          _id: req.params.requestId,
          driver: req.user._id,
          status: { $in: ['accepted', 'arrived'] },
        },
        {
          $set: {
            driver: null,
            vehicleId: null,
            status: 'searching',
            acceptedAt: null,
            liveLocation: null,
          },
          $addToSet: { rejectedBy: req.user._id },
        },
        { new: true }
      );
      releasedAssignment = Boolean(rejectedRequest);
      if (releasedAssignment) rejectedRequest.vehicleId = assignedRequest?.vehicleId || null;
    }

    if (!rejectedRequest) {
      const exists = await VanRequest.exists({ _id: req.params.requestId });
      if (!exists) return res.status(404).json({ message: 'Ride request not found.' });
      return res.status(409).json({ message: 'This request is no longer available to reject.' });
    }

    if (releasedAssignment) {
      await releaseVanRequestAssignment({
        driverId: req.user._id,
        requestId: rejectedRequest._id,
        vehicleId: rejectedRequest.vehicleId,
      });
    }

    const populatedRequest = await VanRequest.findById(rejectedRequest._id)
      .populate('parent', 'fullName phone')
      .populate('driver', 'fullName phone driver.vehicleType driver.plateNumber')
      .populate('vehicleId', 'plateNumber vehicleType seatCapacity color manufacturer model');

    const io = getIo();
    if (io) {
      const eventPayload = { request: populatedRequest };
      io.to(buildTripRoomName(rejectedRequest._id)).emit('trip:request-updated', eventPayload);
      io.to(buildUserRoomName(rejectedRequest.parent?._id || rejectedRequest.parent)).emit('trip:request-updated', eventPayload);
      io.to('drivers').emit('trip:request-updated', eventPayload);
    }

    return res.status(200).json({ message: 'Request rejected and made available to other drivers.', request: populatedRequest });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to reject ride request right now.' });
  }
});
router.patch('/requests/:requestId/location', async (req, res) => {
  try {
    const latitude = Number(req.body?.latitude);
    const longitude = Number(req.body?.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.status(400).json({ message: 'Valid latitude and longitude are required.' });
    }

    const currentRequest = await VanRequest.findById(req.params.requestId);

    if (!currentRequest) {
      return res.status(404).json({ message: 'Ride request not found.' });
    }

    if (!currentRequest.driver || String(currentRequest.driver) !== String(req.user._id)) {
      return res.status(403).json({ message: 'You are not assigned to this request.' });
    }

    if (!['accepted', 'arrived', 'picked_up'].includes(currentRequest.status)) {
      return res.status(409).json({ message: 'Location updates are only allowed for active requests.' });
    }

    const previousLocation = currentRequest.liveLocation;
    const previousStatus = currentRequest.status;
    const nextLiveLocation = {
      latitude,
      longitude,
      updatedAt: new Date(),
    };

    const rideRequest = await VanRequest.findOneAndUpdate(
      {
        _id: currentRequest._id,
        driver: req.user._id,
        status: previousStatus,
      },
      { $set: { liveLocation: nextLiveLocation } },
      { new: true }
    );

    if (!rideRequest) {
      return res.status(409).json({ message: 'Request status changed. Reload it before sending another location update.' });
    }

    await User.updateOne(
      { _id: req.user._id },
      { $set: { lastKnownLocation: nextLiveLocation } }
    );

    if (!previousLocation && previousStatus === 'accepted') {
      await notifyParentOnTheWay(
        rideRequest.parent,
        rideRequest._id,
        req.user.fullName,
        req.user.driver?.plateNumber || '',
        null,
        rideRequest.studentName,
        rideRequest.schoolName
      );
    }
    const io = getIo();
    if (io) {
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
    }

    try {
      const otherActiveRequests = await VanRequest.find({
        driver: req.user._id,
        _id: { $ne: rideRequest._id },
        status: { $in: ['accepted', 'arrived', 'picked_up'] },
      }).select('_id parent status');

      if (otherActiveRequests.length > 0) {
        await VanRequest.updateMany(
          {
            _id: { $in: otherActiveRequests.map((request) => request._id) },
            driver: req.user._id,
            status: { $in: ['accepted', 'arrived', 'picked_up'] },
          },
          { $set: { liveLocation: nextLiveLocation } }
        );

        if (io) {
          otherActiveRequests.forEach((request) => {
            const payload = {
              requestId: String(request._id),
              liveLocation: nextLiveLocation,
              status: request.status,
            };
            io.to(buildTripRoomName(request._id)).emit('trip:location-updated', payload);
            io.to(buildUserRoomName(request.parent)).emit('trip:location-updated', payload);
          });
        }
      }
    } catch {
      console.warn('[DRIVER] Location fan-out failed.');
    }

    return res.status(200).json({
      message: 'Location updated successfully.',
      request: rideRequest,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to update location right now.' });
  }
});

router.patch('/requests/:requestId/arrived', async (req, res) => {
  try {
    const currentRequest = await VanRequest.findById(req.params.requestId);
    if (!currentRequest) {
      return res.status(404).json({ message: 'Ride request not found.' });
    }
    if (!currentRequest.driver || String(currentRequest.driver) !== String(req.user._id)) {
      return res.status(403).json({ message: 'You are not assigned to this request.' });
    }
    if (currentRequest.status !== 'accepted') {
      return res.status(409).json({ message: 'Only an accepted request can be marked as arrived.' });
    }

    const arrivedAt = new Date();
    const rideRequest = await VanRequest.findOneAndUpdate(
      { _id: currentRequest._id, driver: req.user._id, status: 'accepted' },
      { $set: { status: 'arrived', arrivedAtDestinationAt: arrivedAt } },
      { new: true }
    ).populate('parent', '_id fullName');

    if (!rideRequest) {
      return res.status(409).json({ message: 'Request status changed before arrival could be recorded.' });
    }

    await notifyParentArrivalAtPickup(
      rideRequest.parent?._id || rideRequest.parent,
      rideRequest._id,
      req.user.fullName,
      req.user.driver?.plateNumber || '',
      rideRequest.studentName,
      rideRequest.schoolName
    );

    const populatedRequest = await VanRequest.findById(rideRequest._id)
      .populate('parent', 'fullName phone')
      .populate('driver', 'fullName phone driver.vehicleType driver.plateNumber')
      .populate('vehicleId', 'plateNumber vehicleType seatCapacity color manufacturer model');

    const io = getIo();
    if (io) {
      const eventPayload = { request: populatedRequest };
      io.to(buildTripRoomName(rideRequest._id)).emit('trip:request-updated', eventPayload);
      io.to(buildUserRoomName(rideRequest.parent?._id || rideRequest.parent)).emit('trip:request-updated', eventPayload);
      io.to(buildUserRoomName(req.user._id)).emit('trip:request-updated', eventPayload);
    }

    return res.status(200).json({ message: 'Arrival at pickup recorded.', request: populatedRequest });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to record arrival at pickup right now.' });
  }
});

router.patch('/requests/:requestId/picked-up', async (req, res) => {
  try {
    const currentRequest = await VanRequest.findById(req.params.requestId);

    if (!currentRequest) {
      return res.status(404).json({ message: 'Ride request not found.' });
    }

    if (!currentRequest.driver || String(currentRequest.driver) !== String(req.user._id)) {
      return res.status(403).json({ message: 'You are not assigned to this request.' });
    }

    if (currentRequest.status !== 'arrived') {
      return res.status(409).json({ message: 'Only a request that has arrived at pickup can be marked as picked up.' });
    }

    const rideRequest = await VanRequest.findOneAndUpdate(
      { _id: currentRequest._id, driver: req.user._id, status: 'arrived' },
      { $set: { status: 'picked_up', pickedUpAt: new Date() } },
      { new: true }
    ).populate('parent', '_id fullName');

    if (!rideRequest) {
      return res.status(409).json({ message: 'Request status changed before pickup could be recorded.' });
    }
    await notifyParentStudentPickedUp(
      rideRequest.parent?._id || rideRequest.parent,
      rideRequest._id,
      req.user.fullName,
      rideRequest.studentName,
      rideRequest.schoolName,
      null
    );
    await notifyParentHeadingToSchool(
      rideRequest.parent?._id || rideRequest.parent,
      rideRequest._id,
      req.user.fullName,
      rideRequest.schoolName,
      rideRequest.studentName,
      null
    );

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

// Mark every picked-up booking as arrived at school.
router.patch('/requests/:requestId/arrived-at-school', async (req, res) => {
  try {
    const currentRequest = await VanRequest.findById(req.params.requestId);

    if (!currentRequest) {
      return res.status(404).json({ message: 'Ride request not found.' });
    }

    if (!currentRequest.driver || String(currentRequest.driver) !== String(req.user._id)) {
      return res.status(403).json({ message: 'You are not assigned to this request.' });
    }

    const pickedUpRequests = await VanRequest.find({
      driver: req.user._id,
      status: 'picked_up',
    }).select('_id');
    if (pickedUpRequests.length === 0) {
      return res.status(409).json({ message: 'There are no picked-up bookings to mark as arrived at school.' });
    }

    const arrivedRequests = [];
    for (const pickedUpRequest of pickedUpRequests) {
      const arrivalTime = new Date();
      const arrivedRequest = await VanRequest.findOneAndUpdate(
        {
          _id: pickedUpRequest._id,
          driver: req.user._id,
          status: 'picked_up',
        },
        { $set: { status: 'arrived_at_school', arrivedAtSchoolAt: arrivalTime } },
        { new: true }
      ).populate('parent', '_id fullName');

      if (!arrivedRequest) continue;
      arrivedRequests.push(arrivedRequest);

      await notifyParentArrivedAtSchool(
        arrivedRequest.parent?._id || arrivedRequest.parent,
        arrivedRequest._id,
        req.user.fullName,
        arrivedRequest.studentName,
        arrivedRequest.schoolName,
        arrivalTime
      );

      const populatedRequest = await VanRequest.findById(arrivedRequest._id)
        .populate('parent', 'fullName phone')
        .populate('driver', 'fullName phone driver.vehicleType driver.plateNumber')
        .populate('vehicleId', 'plateNumber vehicleType seatCapacity color manufacturer model');
      const io = getIo();
      if (io) {
        const eventPayload = { request: populatedRequest };
        io.to(buildTripRoomName(arrivedRequest._id)).emit('trip:request-updated', eventPayload);
        io.to(buildUserRoomName(arrivedRequest.parent?._id || arrivedRequest.parent)).emit('trip:request-updated', eventPayload);
        io.to(buildUserRoomName(req.user._id)).emit('trip:request-updated', eventPayload);
      }
    }

    if (arrivedRequests.length === 0) {
      return res.status(409).json({ message: 'There are no picked-up bookings to mark as arrived at school.' });
    }

    return res.status(200).json({
      message: 'Arrival at school recorded.',
      requests: arrivedRequests,
    });
  } catch (error) {
    console.error('Arrived at school error:', error);
    return res.status(500).json({ message: 'Unable to update trip status right now.' });
  }
});

router.patch('/requests/complete-school-run', async (req, res) => {
  try {
    const arrivedAtSchoolRequests = await VanRequest.find({
      driver: req.user._id,
      status: 'arrived_at_school',
    }).select('_id');
    if (arrivedAtSchoolRequests.length === 0) {
      return res.status(409).json({ message: 'There are no bookings awaiting school-run completion.' });
    }

    const completedRequestIds = [];
    for (const arrivedRequest of arrivedAtSchoolRequests) {
      const completedAt = new Date();
      const completedRequest = await VanRequest.findOneAndUpdate(
        {
          _id: arrivedRequest._id,
          driver: req.user._id,
          status: 'arrived_at_school',
        },
        { $set: { status: 'completed', liveLocation: null } },
        { new: true }
      ).populate('parent', '_id fullName');

      if (!completedRequest) continue;
      completedRequestIds.push(String(completedRequest._id));

      await releaseVanRequestAssignment({
        driverId: req.user._id,
        requestId: completedRequest._id,
        vehicleId: completedRequest.vehicleId,
      });
      await driverService.updateTripStats(req.user._id, { status: 'completed' });

      const parent = await User.findById(completedRequest.parent?._id || completedRequest.parent);
      if (parent) {
        const formattedTime = completedAt.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });
        parent.notifications.push({
          title: 'Trip Completed',
          message: `${completedRequest.studentName} has arrived safely at ${completedRequest.schoolName} at ${formattedTime}. Driver ${req.user.fullName} completed the trip.`,
          status: 'info',
        });
        await parent.save();
        sendPushToUserIds([String(parent._id)], {
          title: 'Trip Completed',
          body: `${completedRequest.studentName} has safely arrived at school with ${req.user.fullName}.`,
          data: {
            type: 'trip-completed',
            requestId: String(completedRequest._id),
            status: 'completed',
          },
        }).catch(() => {});
      }

      const populatedRequest = await VanRequest.findById(completedRequest._id)
        .populate('parent', 'fullName phone')
        .populate('driver', 'fullName phone driver.vehicleType driver.plateNumber')
        .populate('vehicleId', 'plateNumber vehicleType seatCapacity color manufacturer model');
      const io = getIo();
      if (io) {
        const eventPayload = { request: populatedRequest };
        io.to(buildTripRoomName(completedRequest._id)).emit('trip:completed', eventPayload);
        io.to(buildUserRoomName(completedRequest.parent?._id || completedRequest.parent)).emit('trip:completed', eventPayload);
        io.to(buildUserRoomName(req.user._id)).emit('trip:completed', eventPayload);
        io.to(buildTripRoomName(completedRequest._id)).emit('trip:request-updated', eventPayload);
        io.to(buildUserRoomName(completedRequest.parent?._id || completedRequest.parent)).emit('trip:request-updated', eventPayload);
        io.to(buildUserRoomName(req.user._id)).emit('trip:request-updated', eventPayload);
        io.to('admins').emit('trip:completion-notification', {
          requestId: String(completedRequest._id),
          driverId: String(req.user._id),
          driverName: req.user.fullName,
          studentName: completedRequest.studentName,
          destination: completedRequest.schoolName,
          completedAt,
          status: 'completed',
        });
      }
    }

    if (completedRequestIds.length === 0) {
      return res.status(409).json({ message: 'There are no bookings awaiting school-run completion.' });
    }

    return res.status(200).json({
      message: 'School run completed successfully.',
      completedRequestIds,
    });
  } catch (error) {
    console.error('Complete school run error:', error);
    return res.status(500).json({ message: 'Unable to complete school run right now.' });
  }
});

router.patch('/requests/:requestId/arrived-school', (req, res) => {
  return res.status(410).json({
    message: 'This endpoint is no longer available. Use /requests/:requestId/arrived-at-school.',
  });
});


router.patch('/profile', async (req, res) => {
  try {
    const nextPhone = String(req.body?.phone || '').trim();
    const nextAddress = String(req.body?.homeAddress || '').trim();
    const hasLicenseNumber = Object.prototype.hasOwnProperty.call(req.body || {}, 'licenseNumber');
    const hasPlateNumber = Object.prototype.hasOwnProperty.call(req.body || {}, 'plateNumber');
    const licenseNumberProvided = hasLicenseNumber
      && req.body.licenseNumber !== undefined
      && req.body.licenseNumber !== null
      && (typeof req.body.licenseNumber !== 'string' || req.body.licenseNumber.trim() !== '');
    const plateNumberProvided = hasPlateNumber
      && req.body.plateNumber !== undefined
      && req.body.plateNumber !== null
      && (typeof req.body.plateNumber !== 'string' || req.body.plateNumber.trim() !== '');
    const normalizedLicenseNumber = typeof req.body?.licenseNumber === 'string'
      ? req.body.licenseNumber.trim().replace(/\s+/g, ' ')
      : '';
    const normalizedPlateNumber = typeof req.body?.plateNumber === 'string'
      ? req.body.plateNumber.trim().replace(/\s+/g, ' ').toUpperCase()
      : '';
    const hasLicenseExpiry = Object.prototype.hasOwnProperty.call(req.body || {}, 'licenseExpiry');
    const hasVehicleColor = Object.prototype.hasOwnProperty.call(req.body || {}, 'vehicleColor');
    const hasSeatCapacity = Object.prototype.hasOwnProperty.call(req.body || {}, 'seatCapacity');
    const trimmedVehicleColor = hasVehicleColor && typeof req.body.vehicleColor === 'string'
      ? req.body.vehicleColor.trim()
      : null;
    const seatCapacityNumber = hasSeatCapacity ? Number(req.body.seatCapacity) : null;

    if (hasVehicleColor && (!trimmedVehicleColor || trimmedVehicleColor.length > 30)) {
      return res.status(400).json({ message: 'Vehicle color must be between 1 and 30 characters.' });
    }
    if (
      hasSeatCapacity &&
      (req.body.seatCapacity === null || String(req.body.seatCapacity).trim() === '' ||
        !Number.isInteger(seatCapacityNumber) || seatCapacityNumber < 3 || seatCapacityNumber > 20)
    ) {
      return res.status(400).json({ message: 'Seat capacity must be a whole number between 3 and 20.' });
    }
    if (
      licenseNumberProvided
      && (typeof req.body.licenseNumber !== 'string' || !/^[A-Za-z0-9 -]{5,30}$/.test(normalizedLicenseNumber))
    ) {
      return res.status(400).json({ message: 'License number must be 5-30 characters (letters, numbers, hyphen and spaces).' });
    }
    if (
      plateNumberProvided
      && (typeof req.body.plateNumber !== 'string' || !/^[A-Za-z0-9 -]{3,15}$/.test(normalizedPlateNumber))
    ) {
      return res.status(400).json({ message: 'Plate number must be 3-15 characters (letters, numbers, hyphen and spaces).' });
    }
    if (hasLicenseExpiry) {
      const matchesDateFormat = typeof req.body.licenseExpiry === 'string'
        && /^\d{4}-\d{2}-\d{2}$/.test(req.body.licenseExpiry);
      const parsedLicenseExpiry = matchesDateFormat
        ? new Date(`${req.body.licenseExpiry}T00:00:00.000Z`)
        : null;
      if (
        !matchesDateFormat
        || Number.isNaN(parsedLicenseExpiry.getTime())
        || parsedLicenseExpiry.toISOString().slice(0, 10) !== req.body.licenseExpiry
      ) {
        return res.status(400).json({ message: 'License expiry must be a valid date in YYYY-MM-DD format.' });
      }
      const today = new Date();
      const todayDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      if (req.body.licenseExpiry < todayDate) {
        return res.status(400).json({ message: 'License expiry cannot be in the past.' });
      }
    }

    req.user.phone = nextPhone || req.user.phone;
    req.user.homeAddress = nextAddress || req.user.homeAddress;
    req.user.driver = {
      ...req.user.driver?.toObject?.(),
      vehicleType: String(req.body?.vehicleType || req.user.driver?.vehicleType || '').trim(),
      ...(plateNumberProvided ? { plateNumber: normalizedPlateNumber } : {}),
      ...(licenseNumberProvided ? { licenseNumber: normalizedLicenseNumber } : {}),
      ...(hasLicenseExpiry
        ? { licenseExpirationDate: new Date(`${req.body.licenseExpiry}T00:00:00.000Z`) }
        : {}),
      vehicleColor: hasVehicleColor ? trimmedVehicleColor : req.user.driver?.vehicleColor ?? null,
      seatCapacity: hasSeatCapacity ? seatCapacityNumber : req.user.driver?.seatCapacity ?? null,
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

// NEW ENDPOINTS FOR DRIVER DASHBOARD UPGRADE

const DriverStats = require('../models/DriverStats');
const DriverLocation = require('../models/DriverLocation');
const driverService = require('../services/driverService');

/**
 * GET /status
 * Get current driver online/offline status
 */
router.get('/status', async (req, res) => {
  try {
    const status = await driverService.getDriverStatus(req.user._id);
    return res.status(200).json({ status });
  } catch (error) {
    console.error('Get driver status error:', error);
    return res.status(500).json({ message: 'Unable to get driver status.' });
  }
});

/**
 * PATCH /status/toggle
 * Toggle driver online/offline status
 */
router.patch('/status/toggle', async (req, res) => {
  try {
    const { isOnline } = req.body;

    if (typeof isOnline !== 'boolean') {
      return res.status(400).json({ message: 'isOnline must be a boolean.' });
    }

    const status = await driverService.toggleDriverStatus(req.user._id, isOnline);
    return res.status(200).json({
      message: `Driver status updated to ${isOnline ? 'online' : 'offline'}.`,
      status,
    });
  } catch (error) {
    if (error.code === 'DRIVER_BUSY') {
      return res.status(409).json({ message: error.message });
    }
    console.error('Toggle driver status error:', error);
    return res.status(500).json({ message: 'Unable to update driver status.' });
  }
});

/**
 * POST /location/update
 * Update live driver location (for GPS tracking)
 */
router.post('/location/update', async (req, res) => {
  try {
    const { latitude, longitude, speed, heading, accuracy, requestId } = req.body;

    if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
      return res.status(400).json({ message: 'Valid latitude and longitude are required.' });
    }

    const location = await driverService.updateDriverLocation(
      req.user._id,
      {
        latitude: Number(latitude),
        longitude: Number(longitude),
        speed: Number(speed) || 0,
        heading: Number(heading),
        accuracy: Number(accuracy),
      },
      requestId
    );

    return res.status(200).json({
      message: 'Location updated successfully.',
      location,
    });
  } catch (error) {
    console.error('Update location error:', error);
    return res.status(500).json({ message: 'Unable to update location.' });
  }
});

/**
 * GET /stats
 * Get driver statistics (trips, ratings, earnings, etc)
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await driverService.getDriverStats(req.user._id);
    return res.status(200).json({ stats });
  } catch (error) {
    console.error('Get driver stats error:', error);
    return res.status(500).json({ message: 'Unable to get driver statistics.' });
  }
});

/**
 * GET /active-trip
 * Get current active trip for driver
 */
router.get('/active-trip', async (req, res) => {
  try {
    const trip = await driverService.getActiveTrip(req.user._id);
    return res.status(200).json({ trip });
  } catch (error) {
    console.error('Get active trip error:', error);
    return res.status(500).json({ message: 'Unable to get active trip.' });
  }
});

/**
 * GET /trip-history
 * Get driver trip history with filters
 */
router.get('/trip-history', async (req, res) => {
  try {
    const { status, startDate, endDate, limit = 20, page = 1 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const history = await driverService.getDriverTripHistory(req.user._id, {
      status,
      startDate,
      endDate,
      limit: Number(limit),
      skip,
    });

    return res.status(200).json({ history });
  } catch (error) {
    console.error('Get trip history error:', error);
    return res.status(500).json({ message: 'Unable to get trip history.' });
  }
});

/**
 * PATCH /trip-status/:requestId/:status
 * Update trip status (started, picked_up, completed, cancelled, etc)
 */
router.patch('/trip-status/:requestId/:tripStatus', async (req, res) => {
  try {
    const { requestId, tripStatus } = req.params;

    const validStatuses = ['arrived', 'picked_up', 'arrived_at_school', 'completed'];
    if (!validStatuses.includes(tripStatus)) {
      return res.status(400).json({ message: 'Invalid trip status.' });
    }

    const trip = await driverService.updateTripStatus(req.user._id, requestId, tripStatus);

    return res.status(200).json({
      message: `Trip status updated to ${tripStatus}.`,
      trip,
    });
  } catch (error) {
    if (error.message === 'Trip not found') {
      return res.status(404).json({ message: 'Trip not found.' });
    }
    if (error.code === 'TRIP_NOT_ASSIGNED') {
      return res.status(403).json({ message: 'You are not assigned to this trip.' });
    }
    if (error.code === 'INVALID_TRIP_TRANSITION' || error.code === 'TRIP_STATUS_CHANGED') {
      return res.status(409).json({ message: error.message });
    }
    console.error('Update trip status error:', error);
    return res.status(500).json({ message: 'Unable to update trip status.' });
  }
});

/**
 * GET /earnings
 * Get driver earnings/analytics
 */
router.get('/earnings', async (req, res) => {
  try {
    const stats = await driverService.getDriverStats(req.user._id);

    const earnings = {
      totalTrips: stats.totalTrips,
      completedTrips: stats.completedTrips,
      cancelledTrips: stats.cancelledTrips,
      totalDistance: stats.totalDistance,
      totalDrivingTime: stats.totalDrivingTime,
      averageRating: stats.averageRating,
      cancellationRate: stats.cancellationRate,
      monthlyStats: stats.monthlyStats || [],
    };

    return res.status(200).json({ earnings });
  } catch (error) {
    console.error('Get earnings error:', error);
    return res.status(500).json({ message: 'Unable to get earnings.' });
  }
});

/**
 * POST /emergency-sos
 * Trigger emergency SOS alert
 */
router.post('/emergency-sos', async (req, res) => {
  try {
    const { latitude, longitude, details } = req.body;

    const io = getIo();
    if (io) {
      io.emit('driver:emergency-sos', {
        driverId: req.user._id.toString(),
        driverName: req.user.fullName,
        driverPhone: req.user.phone,
        latitude: Number(latitude),
        longitude: Number(longitude),
        details: String(details || ''),
        timestamp: new Date(),
      });
    }

    return res.status(200).json({ message: 'Emergency SOS alert sent.' });
  } catch (error) {
    console.error('Emergency SOS error:', error);
    return res.status(500).json({ message: 'Unable to send emergency alert.' });
  }
});

module.exports = router;
