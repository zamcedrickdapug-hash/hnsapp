const fs = require('fs');
const path = require('path');
const express = require('express');
const User = require('../models/User');
const VanRequest = require('../models/VanRequest');
const { requireAdmin } = require('../middleware/auth');
const { sanitizeText } = require('../utils/validation');

const router = express.Router();

const STATUS_VALUES = ['pending', 'reviewing', 'approved', 'declined'];
const ACCOUNT_STATE_VALUES = ['active', 'suspended', 'banned'];

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

  await applicant.save();

  return res.status(200).json({
    message: `Registration set to ${requestedStatus}.`,
    registration: buildAdminRegistrationPayload(applicant),
  });
});

router.get('/registrations/:registrationId/id-document', requireAdmin, async (req, res) => {
  const parent = await User.findOne({ _id: req.params.registrationId, role: { $in: ['parent', 'driver'] } });

  if (!parent || !parent.validId?.path) {
    return res.status(404).json({ message: 'ID document not found.' });
  }

  const resolvedPath = path.resolve(parent.validId.path);

  if (!fs.existsSync(resolvedPath)) {
    return res.status(404).json({ message: 'Stored ID document file is missing.' });
  }

  const safeFileName = String(parent.validId.originalName || 'valid-id')
    .replace(/[\r\n]/g, '')
    .replace(/"/g, '');

  res.setHeader('Content-Type', parent.validId.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${safeFileName}"`);

  return res.sendFile(resolvedPath);
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

  if (targetUser.validId?.path) {
    const resolvedPath = path.resolve(targetUser.validId.path);
    if (fs.existsSync(resolvedPath)) {
      fs.unlinkSync(resolvedPath);
    }
  }

  await User.deleteOne({ _id: targetUser._id });

  return res.status(200).json({ message: 'User deleted successfully.' });
});

router.get('/driver-locations', requireAdmin, async (req, res) => {
  const requestsWithLocation = await VanRequest.find({
    driver: { $ne: null },
    liveLocation: { $ne: null },
  })
    .populate('driver', 'fullName email phone status accountState driver.vehicleType driver.plateNumber')
    .sort({ 'liveLocation.updatedAt': -1, updatedAt: -1 });

  const seenDriverIds = new Set();
  const locations = [];

  for (const item of requestsWithLocation) {
    const driver = item.driver;

    if (!driver?._id) {
      continue;
    }

    const driverId = String(driver._id);
    if (seenDriverIds.has(driverId)) {
      continue;
    }

    const latitude = Number(item.liveLocation?.latitude);
    const longitude = Number(item.liveLocation?.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      continue;
    }

    seenDriverIds.add(driverId);

    locations.push({
      driverId,
      driverName: driver.fullName,
      driverEmail: driver.email,
      phone: driver.phone,
      status: driver.status,
      accountState: driver.accountState || 'active',
      vehicleType: driver.driver?.vehicleType || '',
      plateNumber: driver.driver?.plateNumber || '',
      requestId: item._id,
      tripStatus: item.status,
      studentName: item.studentName,
      schoolName: item.schoolName,
      location: {
        latitude,
        longitude,
        updatedAt: item.liveLocation?.updatedAt || item.updatedAt,
      },
    });
  }

  return res.status(200).json({
    locations,
    total: locations.length,
  });
});

module.exports = router;
