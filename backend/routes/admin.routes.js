const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const ValidIdDocument = require('../models/ValidIdDocument');
const Vehicle = require('../models/Vehicle');
const VanRequest = require('../models/VanRequest');
const { requireAdmin } = require('../middleware/auth');
const { sanitizeText } = require('../utils/validation');

const router = express.Router();

const STATUS_VALUES = ['pending', 'reviewing', 'approved', 'declined'];
const ACCOUNT_STATE_VALUES = ['active', 'suspended', 'banned'];
const PARENT_REVIEW_TRANSITIONS = {
  pending: ['reviewing', 'approved', 'declined'],
  reviewing: ['approved', 'declined'],
};

const buildAdminRegistrationPayload = (user) => ({
  id: user._id,
  role: user.role,
  fullName: user.fullName,
  email: user.email,
  phone: user.phone,
  homeAddress: user.homeAddress,
  status: user.status,
  accountState: user.accountState || 'active',
  declineReason: user.declineReason,
  createdAt: user.createdAt,
  student: user.student,
  driver: user.driver,
  validId: {
    originalName: user.validId?.originalName || '',
    mimeType: user.validId?.mimeType || '',
    size: user.validId?.size || 0,
  },
});

const buildAdminUserPayload = (user) => ({
  id: user._id,
  role: user.role,
  fullName: user.fullName,
  email: user.email,
  phone: user.phone,
  homeAddress: user.homeAddress,
  status: user.status,
  accountState: user.accountState || 'active',
  createdAt: user.createdAt,
  student: user.student,
  driver: user.driver,
});

router.get('/registrations', requireAdmin, async (req, res) => {
  const statusFilter = sanitizeText(req.query.status || 'pending').toLowerCase();
  const query = { role: { $in: ['parent', 'driver'] } };

  if (statusFilter !== 'all') {
    if (!STATUS_VALUES.includes(statusFilter)) {
      return res.status(400).json({ message: 'Invalid status filter.' });
    }

    query.status = statusFilter;
  }

  const registrations = await User.find(query).sort({ createdAt: -1 });

  return res.status(200).json({
    registrations: registrations.map(buildAdminRegistrationPayload),
  });
});

router.patch('/registrations/:registrationId/status', requireAdmin, async (req, res) => {
  const requestedStatus = sanitizeText(req.body?.status || '').toLowerCase();
  const declineReason = sanitizeText(req.body?.reason || '');

  if (!STATUS_VALUES.includes(requestedStatus)) {
    return res.status(400).json({ message: 'Invalid status update.' });
  }

  const applicant = await User.findOne({
    _id: req.params.registrationId,
    role: { $in: ['parent', 'driver'] },
  });

  if (!applicant) {
    return res.status(404).json({ message: 'Registration not found.' });
  }

  if (
    applicant.role === 'parent'
    && !PARENT_REVIEW_TRANSITIONS[applicant.status]?.includes(requestedStatus)
  ) {
    return res.status(409).json({ message: 'This Parent application can no longer transition to the requested status.' });
  }

  let normalizedVehicleType;
  let normalizedPlateNumber;
  if (requestedStatus === 'approved') {
    const validationErrors = [];

    if (applicant.role === 'parent') {
      if (!applicant.student?.fullName?.trim()) {
        validationErrors.push('Student name is required.');
      }
      if (!applicant.student?.schoolName?.trim()) {
        validationErrors.push('Student school is required.');
      }
    } else {
      if (!applicant.driver?.licenseNumber?.trim()) {
        validationErrors.push('Driver license number is required.');
      }

      const licenseExpiry = applicant.driver?.licenseExpirationDate
        ? new Date(applicant.driver.licenseExpirationDate)
        : null;
      const today = new Date();
      const todayDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const licenseExpiryDate = licenseExpiry && !Number.isNaN(licenseExpiry.getTime())
        ? licenseExpiry.toISOString().slice(0, 10)
        : '';
      if (!licenseExpiryDate || licenseExpiryDate < todayDate) {
        validationErrors.push('Driver license expiry must be a valid date that is not in the past.');
      }

      const validIdExists = applicant.validId?.documentId
        ? await ValidIdDocument.exists({
          _id: applicant.validId.documentId,
          ownerId: applicant._id,
        })
        : false;
      if (!validIdExists) {
        validationErrors.push('Driver ID document is required.');
      }

      const plateNumber = typeof applicant.driver?.plateNumber === 'string'
        ? applicant.driver.plateNumber.trim()
        : '';
      if (!plateNumber) {
        validationErrors.push('Vehicle plate number is required.');
      } else {
        normalizedPlateNumber = plateNumber.toUpperCase();
      }

      const vehicleType = typeof applicant.driver?.vehicleType === 'string'
        ? applicant.driver.vehicleType.trim().toLowerCase()
        : '';
      if (vehicleType.includes('minibus') || vehicleType.includes('mini bus')) {
        normalizedVehicleType = 'minibus';
      } else if (vehicleType.includes('mpv')) {
        normalizedVehicleType = 'mpv';
      } else if (vehicleType.includes('sedan')) {
        normalizedVehicleType = 'sedan';
      } else if (vehicleType.includes('van')) {
        normalizedVehicleType = 'van';
      } else {
        validationErrors.push('Vehicle type must contain one of the allowed types: sedan, mpv, van, minibus.');
      }

      if (!applicant.driver?.vehicleColor?.trim()) {
        validationErrors.push('Vehicle color is required.');
      }

      const seatCapacity = Number(applicant.driver?.seatCapacity);
      if (
        applicant.driver?.seatCapacity === undefined
        || applicant.driver?.seatCapacity === null
        || String(applicant.driver.seatCapacity).trim() === ''
        || !Number.isInteger(seatCapacity)
        || seatCapacity < 3
        || seatCapacity > 20
      ) {
        validationErrors.push('Seat capacity must be a whole number from 3 to 20.');
      }
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        message: `Cannot approve registration: ${validationErrors.join(' ')}`,
      });
    }
  }

  applicant.status = requestedStatus;
  applicant.declineReason = requestedStatus === 'declined' ? declineReason : '';

  const statusMessageMap = {
    approved: 'Your account has been approved.',
    declined: declineReason
      ? `Your account has been declined. Reason: ${declineReason}`
      : 'Your account has been declined.',
    reviewing: 'Your account is under review.',
    pending: 'Your account status was updated to pending verification.',
  };

  applicant.notifications.push({
    title: `Application ${requestedStatus.charAt(0).toUpperCase() + requestedStatus.slice(1)}`,
    message: statusMessageMap[requestedStatus],
    status: requestedStatus,
    read: false,
  });

  if (requestedStatus === 'approved') {
    let session;
    try {
      session = await mongoose.startSession();
      await session.withTransaction(async () => {
        if (applicant.role === 'driver') {
          const existingVehicle = await Vehicle.findOne({ plateNumber: normalizedPlateNumber }).session(session);
          if (
            existingVehicle?.assignedDriver
            && !existingVehicle.assignedDriver.equals(applicant._id)
          ) {
            const conflict = new Error('A vehicle with this plate number is already assigned to a different driver.');
            conflict.statusCode = 409;
            throw conflict;
          }

          await Vehicle.findOneAndUpdate(
            { plateNumber: normalizedPlateNumber },
            {
              $set: {
                plateNumber: normalizedPlateNumber,
                vehicleType: normalizedVehicleType,
                color: applicant.driver.vehicleColor.trim(),
                seatCapacity: Number(applicant.driver.seatCapacity),
                operatorId: req.user._id,
                assignedDriver: applicant._id,
                status: 'available',
                currentPassengers: 0,
                isAvailable: true,
              },
            },
            {
              upsert: true,
              new: true,
              runValidators: true,
              session,
            }
          );
        }

        await applicant.save({ session });
      });
    } catch (error) {
      if (error.statusCode === 409) {
        return res.status(409).json({ message: error.message });
      }

      if (
        error.code === 20
        || error.code === 303
        || /transaction numbers are only allowed|transactions are not supported|does not support transactions/i.test(error.message || '')
      ) {
        return res.status(500).json({
          message: 'Approval requires MongoDB transactions, but this deployment does not support transactions. No changes were saved.',
        });
      }

      if (error.code === 11000 && normalizedPlateNumber) {
        const conflictingVehicle = await Vehicle.findOne({ plateNumber: normalizedPlateNumber }).select('assignedDriver');
        if (
          conflictingVehicle?.assignedDriver
          && !conflictingVehicle.assignedDriver.equals(applicant._id)
        ) {
          return res.status(409).json({ message: 'A vehicle with this plate number is already assigned to a different driver.' });
        }
      }

      return res.status(500).json({ message: 'Unable to approve registration. No changes were saved.' });
    } finally {
      await session?.endSession();
    }
  } else {
    await applicant.save();
  }

  return res.status(200).json({
    message: `Registration set to ${requestedStatus}.`,
    registration: buildAdminRegistrationPayload(applicant),
  });
});

router.get('/registrations/:registrationId/id-document', requireAdmin, async (req, res) => {
  const parent = await User.findOne({ _id: req.params.registrationId, role: { $in: ['parent', 'driver'] } });

  if (!parent || !parent.validId?.documentId) {
    return res.status(404).json({ message: 'ID document not found.' });
  }

  const document = await ValidIdDocument.findOne({
    _id: parent.validId.documentId,
    ownerId: parent._id,
  }).select('+data');
  if (!document) {
    return res.status(404).json({ message: 'Stored ID document is missing from MongoDB.' });
  }

  const safeFileName = String(parent.validId.originalName || 'valid-id')
    .replace(/[\r\n]/g, '')
    .replace(/"/g, '');

  res.setHeader('Content-Type', parent.validId.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${safeFileName}"`);
  res.setHeader('Content-Length', String(document.size));

  return res.send(Buffer.from(document.data));
});

router.get('/users', requireAdmin, async (req, res) => {
  const roleFilter = sanitizeText(req.query.role || 'all').toLowerCase();
  const statusFilter = sanitizeText(req.query.status || 'all').toLowerCase();
  const accountStateFilter = sanitizeText(req.query.accountState || 'all').toLowerCase();

  const query = {};

  if (roleFilter !== 'all') {
    if (!['parent', 'driver', 'admin'].includes(roleFilter)) {
      return res.status(400).json({ message: 'Invalid role filter.' });
    }

    query.role = roleFilter;
  }

  if (statusFilter !== 'all') {
    if (!STATUS_VALUES.includes(statusFilter)) {
      return res.status(400).json({ message: 'Invalid status filter.' });
    }

    query.status = statusFilter;
  }

  if (accountStateFilter !== 'all') {
    if (!ACCOUNT_STATE_VALUES.includes(accountStateFilter)) {
      return res.status(400).json({ message: 'Invalid account state filter.' });
    }

    query.accountState = accountStateFilter;
  }

  const users = await User.find(query).sort({ createdAt: -1 });

  return res.status(200).json({
    users: users.map(buildAdminUserPayload),
  });
});

router.patch('/users/:userId/account-state', requireAdmin, async (req, res) => {
  const nextAccountState = sanitizeText(req.body?.accountState || '').toLowerCase();

  if (!ACCOUNT_STATE_VALUES.includes(nextAccountState)) {
    return res.status(400).json({ message: 'Invalid account state update.' });
  }

  const targetUser = await User.findById(req.params.userId);

  if (!targetUser) {
    return res.status(404).json({ message: 'User not found.' });
  }

  if (targetUser.role === 'admin') {
    return res.status(403).json({ message: 'Admin accounts cannot be suspended or banned.' });
  }

  targetUser.accountState = nextAccountState;

  if (nextAccountState !== 'active') {
    targetUser.notifications.push({
      title: nextAccountState === 'banned' ? 'Account Banned' : 'Account Suspended',
      message:
        nextAccountState === 'banned'
          ? 'Your account has been banned. Please contact support.'
          : 'Your account has been suspended. Please contact support.',
      status: 'declined',
      read: false,
    });
  }

  await targetUser.save();

  return res.status(200).json({
    message: `Account state updated to ${nextAccountState}.`,
    user: buildAdminUserPayload(targetUser),
  });
});

router.delete('/users/:userId', requireAdmin, async (req, res) => {
  const targetUser = await User.findById(req.params.userId);

  if (!targetUser) {
    return res.status(404).json({ message: 'User not found.' });
  }

  if (targetUser.role === 'admin') {
    return res.status(403).json({ message: 'Admin accounts cannot be deleted.' });
  }

  if (targetUser.validId?.documentId) {
    await ValidIdDocument.deleteOne({
      _id: targetUser.validId.documentId,
      ownerId: targetUser._id,
    });
  }

  await User.deleteOne({ _id: targetUser._id });

  return res.status(200).json({ message: 'User deleted successfully.' });
});

router.get('/driver-locations', requireAdmin, async (req, res) => {
  const drivers = await User.find({ role: 'driver', status: 'approved' })
    .select('fullName email phone status accountState driver.vehicleType driver.plateNumber lastKnownLocation')
    .sort({ fullName: 1 });

  const requestsWithLocation = await VanRequest.find({
    driver: { $ne: null },
    liveLocation: { $ne: null },
        status: { $in: ['accepted', 'arrived', 'picked_up'] },
  })
    .select('driver status liveLocation studentName schoolName updatedAt')
    .sort({ 'liveLocation.updatedAt': -1, updatedAt: -1 });

  const latestRequestByDriverId = new Map();
  for (const item of requestsWithLocation) {
    const driverId = String(item.driver || '');
    if (!driverId || latestRequestByDriverId.has(driverId)) {
      continue;
    }
    latestRequestByDriverId.set(driverId, item);
  }

  const locations = drivers
    .map((driver) => {
      const driverId = String(driver._id);
      const latestTrip = latestRequestByDriverId.get(driverId) || null;
      const fallbackLocation = driver.lastKnownLocation;
      const preferredLocation = latestTrip?.liveLocation || fallbackLocation;

      const latitude = Number(preferredLocation?.latitude);
      const longitude = Number(preferredLocation?.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return null;
      }

      return {
        driverId,
        driverName: driver.fullName,
        driverEmail: driver.email,
        phone: driver.phone,
        status: driver.status,
        accountState: driver.accountState || 'active',
        vehicleType: driver.driver?.vehicleType || '',
        plateNumber: driver.driver?.plateNumber || '',
        requestId: latestTrip?._id || null,
        tripStatus: latestTrip?.status || null,
        studentName: latestTrip?.studentName || '',
        schoolName: latestTrip?.schoolName || '',
        location: {
          latitude,
          longitude,
          updatedAt: preferredLocation?.updatedAt || latestTrip?.updatedAt,
        },
      };
    })
    .filter(Boolean);

  return res.status(200).json({ locations, total: locations.length });
});

module.exports = router;
