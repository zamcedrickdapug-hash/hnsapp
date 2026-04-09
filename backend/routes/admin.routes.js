const fs = require('fs');
const path = require('path');
const express = require('express');
const User = require('../models/User');
const { requireAdmin } = require('../middleware/auth');
const { sanitizeText } = require('../utils/validation');

const router = express.Router();

const STATUS_VALUES = ['pending', 'reviewing', 'approved', 'declined'];

const buildAdminRegistrationPayload = (user) => ({
  id: user._id,
  role: user.role,
  fullName: user.fullName,
  email: user.email,
  phone: user.phone,
  homeAddress: user.homeAddress,
  status: user.status,
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

module.exports = router;
