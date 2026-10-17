const express = require('express');
const crypto = require('node:crypto');
const { rateLimit } = require('express-rate-limit');
const Payment = require('../models/Payment');
const PaymentAudit = require('../models/PaymentAudit');
const VanRequest = require('../models/VanRequest');
const { requireAuth } = require('../middleware/auth');
const paymentConfig = require('../config/paymentConfig');

const router = express.Router();
const paymentRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user._id),
  message: { message: 'Too many payment requests. Please try again shortly.' },
});
const objectIdPattern = /^[a-f\d]{24}$/i;
const referencePattern = /^HNS-\d{8}-[A-Z0-9]{6}$/;
const statuses = ['pending', 'verified', 'rejected'];

router.use(requireAuth);

const isRole = (role) => (req, res, next) => {
  if (req.user?.role !== role) {
    return res.status(403).json({ message: `${role[0].toUpperCase()}${role.slice(1)} access is required.` });
  }
  return next();
};

const idOf = (value) => String(value?._id || value || '');
const isDuplicateKey = (error) => error?.code === 11000;

const parseLimit = (rawLimit) => {
  if (rawLimit === undefined) return 20;
  if (typeof rawLimit !== 'string' || !/^\d+$/.test(rawLimit)) return null;
  const value = Number(rawLimit);
  return Number.isInteger(value) && value > 0 ? Math.min(value, 50) : null;
};

const getCursorQuery = async (Model, before, ownerQuery, timeField = 'createdAt') => {
  if (before === undefined) return { query: {}, error: null };
  if (typeof before !== 'string' || !objectIdPattern.test(before)) {
    return { query: null, error: 'Cursor is invalid.' };
  }
  const cursor = await Model.findOne({ _id: before, ...ownerQuery })
    .select(`_id ${timeField}`)
    .lean();
  if (!cursor) return { query: null, error: 'Cursor not found.' };
  const cursorTime = cursor[timeField];
  return {
    query: {
      $or: [
        { [timeField]: { $lt: cursorTime } },
        { [timeField]: cursorTime, _id: { $lt: cursor._id } },
      ],
    },
    error: null,
  };
};

const asPayment = (payment) => ({
  _id: idOf(payment._id),
  referenceNo: payment.referenceNo || null,
  parent: idOf(payment.parent),
  driver: idOf(payment.driver),
  vanRequest: payment.vanRequest ? idOf(payment.vanRequest) : null,
  amount: payment.amount,
  currency: payment.currency,
  method: payment.method,
  externalRef: payment.externalRef,
  note: payment.note,
  status: payment.status,
  verifiedAt: payment.verifiedAt,
  rejectReason: payment.rejectReason,
  createdAt: payment.createdAt,
});

const manilaDayStart = (now = new Date()) => {
  const manilaNow = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  manilaNow.setUTCHours(0, 0, 0, 0);
  return new Date(manilaNow.getTime() - 8 * 60 * 60 * 1000);
};

const makeReferenceNo = (now = new Date()) => {
  const manilaDate = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const date = [
    manilaDate.getUTCFullYear(),
    String(manilaDate.getUTCMonth() + 1).padStart(2, '0'),
    String(manilaDate.getUTCDate()).padStart(2, '0'),
  ].join('');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.randomBytes(6);
  const suffix = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
  return `HNS-${date}-${suffix}`;
};

const hasValidAmount = (amount) => (
  typeof amount === 'number'
  && Number.isFinite(amount)
  && amount > 0
  && amount <= paymentConfig.maxPaymentAmount
  && Math.abs(amount * 100 - Math.round(amount * 100)) <= Number.EPSILON * Math.max(1, amount * 100) * 2
);

const addAudit = (payment, action, actor, actorRole, fromStatus, toStatus) => PaymentAudit.create({
  payment: payment._id,
  referenceNo: payment.referenceNo || null,
  action,
  actor,
  actorRole,
  fromStatus,
  toStatus,
  amount: payment.amount,
  at: new Date(),
});

router.post('/', paymentRateLimit, isRole('parent'), async (req, res) => {
  try {
    const body = req.body || {};
    const hasRequestId = body.vanRequestId !== undefined;
    if (
      !hasValidAmount(body.amount)
      || !paymentConfig.methods.includes(body.method)
      || (body.driverId !== undefined && (typeof body.driverId !== 'string' || !objectIdPattern.test(body.driverId)))
      || (hasRequestId && (typeof body.vanRequestId !== 'string' || !objectIdPattern.test(body.vanRequestId)))
      || (hasRequestId && body.driverId !== undefined)
      || (body.note !== undefined && (typeof body.note !== 'string' || body.note.trim().length > 200))
      || (body.externalRef !== undefined && typeof body.externalRef !== 'string')
    ) {
      return res.status(400).json({ message: 'Payment details are invalid.' });
    }

    const externalRef = typeof body.externalRef === 'string' ? body.externalRef.trim() : '';
    if (
      (body.method === 'gcash' && (!externalRef || externalRef.length > 40))
      || (body.method === 'cash' && externalRef.length > 40)
    ) {
      return res.status(400).json({ message: 'A valid external reference is required for GCash.' });
    }

    let request = null;
    let driverId = body.driverId;
    if (hasRequestId) {
      request = await VanRequest.findOne({ _id: body.vanRequestId, parent: req.user._id }).select('driver parent');
      if (!request) return res.status(404).json({ message: 'Van request not found.' });
      if (!request.driver) return res.status(400).json({ message: 'The request has no assigned driver.' });
      driverId = idOf(request.driver);
    } else {
      if (!driverId) return res.status(400).json({ message: 'A driver or van request is required.' });
      const hasRequest = await VanRequest.exists({ parent: req.user._id, driver: driverId });
      if (!hasRequest) return res.status(400).json({ message: 'No request is assigned to that driver.' });
    }

    const payment = await Payment.create({
      parent: req.user._id,
      driver: driverId,
      vanRequest: request?._id || null,
      amount: body.amount,
      currency: paymentConfig.currency,
      method: body.method,
      ...(externalRef ? { externalRef } : {}),
      note: typeof body.note === 'string' ? body.note.trim() : '',
      status: 'pending',
      submittedBy: req.user._id,
      submittedByRole: 'parent',
    });
    await addAudit(payment, 'submitted', req.user._id, 'parent', null, 'pending');
    return res.status(201).json({ payment: asPayment(payment) });
  } catch (error) {
    if (isDuplicateKey(error)) return res.status(409).json({ message: 'That GCash reference was already used for this driver.' });
    console.error('[Payments] Submission failed:', error.name || 'UnknownError');
    return res.status(500).json({ message: 'Unable to submit payment.' });
  }
});

router.get('/mine', isRole('parent'), async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit);
    if (!limit) return res.status(400).json({ message: 'Limit must be a positive integer.' });
    const ownerQuery = { parent: req.user._id };
    const cursor = await getCursorQuery(Payment, req.query.before, ownerQuery);
    if (cursor.error) return res.status(404).json({ message: cursor.error });
    const [payments, completedTrips, verifiedTotals] = await Promise.all([
      Payment.find({ ...ownerQuery, ...cursor.query }).sort({ createdAt: -1, _id: -1 }).limit(limit + 1).lean(),
      VanRequest.countDocuments({ parent: req.user._id, status: 'completed' }),
      Payment.aggregate([
        { $match: { ...ownerQuery, status: 'verified' } },
        { $group: { _id: null, totalVerified: { $sum: '$amount' } } },
      ]),
    ]);
    const hasMore = payments.length > limit;
    const page = payments.slice(0, limit);
    const totalVerified = verifiedTotals[0]?.totalVerified || 0;
    const totalFees = completedTrips * paymentConfig.feePerTrip;
    return res.json({
      payments: page.map(asPayment),
      nextCursor: hasMore ? idOf(page[page.length - 1]._id) : null,
      summary: {
        completedTrips,
        totalFees,
        totalVerified,
        outstanding: Math.max(totalFees - totalVerified, 0),
      },
    });
  } catch (error) {
    console.error('[Payments] Parent payment listing failed:', error.name || 'UnknownError');
    return res.status(500).json({ message: 'Unable to load payments.' });
  }
});

router.get('/driver', isRole('driver'), async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit);
    const status = req.query.status === undefined ? 'all' : req.query.status;
    if (!limit) return res.status(400).json({ message: 'Limit must be a positive integer.' });
    if (!['all', ...statuses].includes(status)) return res.status(400).json({ message: 'Payment status is invalid.' });
    const ownerQuery = { driver: req.user._id };
    const cursor = await getCursorQuery(Payment, req.query.before, ownerQuery);
    if (cursor.error) return res.status(404).json({ message: cursor.error });
    const baseQuery = { ...ownerQuery, ...cursor.query, ...(status === 'all' ? {} : { status }) };
    const todayStart = manilaDayStart();
    const [payments, totals] = await Promise.all([
      Payment.find(baseQuery).sort({ createdAt: -1, _id: -1 }).limit(limit + 1).lean(),
      Payment.aggregate([
        {
          $facet: {
            pending: [
              { $match: { ...ownerQuery, status: 'pending' } },
              { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$amount' } } },
            ],
            verifiedToday: [
              { $match: { ...ownerQuery, status: 'verified', verifiedAt: { $gte: todayStart } } },
              { $count: 'count' },
            ],
            verifiedTotal: [
              { $match: { ...ownerQuery, status: 'verified' } },
              { $group: { _id: null, amount: { $sum: '$amount' } } },
            ],
          },
        },
      ]),
    ]);
    const hasMore = payments.length > limit;
    const page = payments.slice(0, limit);
    return res.json({
      payments: page.map(asPayment),
      nextCursor: hasMore ? idOf(page[page.length - 1]._id) : null,
      summary: {
        pendingCount: totals[0]?.pending[0]?.count || 0,
        pendingAmount: totals[0]?.pending[0]?.amount || 0,
        verifiedToday: totals[0]?.verifiedToday[0]?.count || 0,
        verifiedTotal: totals[0]?.verifiedTotal[0]?.amount || 0,
      },
    });
  } catch (error) {
    console.error('[Payments] Driver payment listing failed:', error.name || 'UnknownError');
    return res.status(500).json({ message: 'Unable to load payments.' });
  }
});

router.post('/driver/record-cash', paymentRateLimit, isRole('driver'), async (req, res) => {
  try {
    const { vanRequestId, amount, note } = req.body || {};
    if (
      typeof vanRequestId !== 'string'
      || !objectIdPattern.test(vanRequestId)
      || !hasValidAmount(amount)
      || (note !== undefined && (typeof note !== 'string' || note.trim().length > 200))
    ) {
      return res.status(400).json({ message: 'Cash payment details are invalid.' });
    }
    const request = await VanRequest.findOne({
      _id: vanRequestId,
      driver: req.user._id,
      status: { $in: ['accepted', 'arrived', 'picked_up', 'arrived_at_school', 'completed'] },
    }).select('_id parent driver');
    if (!request) return res.status(404).json({ message: 'Assigned active or completed request not found.' });

    let payment;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        payment = await Payment.create({
          parent: request.parent,
          driver: req.user._id,
          vanRequest: request._id,
          amount,
          currency: paymentConfig.currency,
          method: 'cash',
          note: typeof note === 'string' ? note.trim() : '',
          status: 'pending',
          submittedBy: req.user._id,
          submittedByRole: 'driver',
        });
        break;
      } catch (error) {
        if (!isDuplicateKey(error) || attempt === 4) throw error;
      }
    }
    await addAudit(payment, 'recorded_cash', req.user._id, 'driver', null, 'pending');
    let verifiedPayment;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        verifiedPayment = await Payment.findOneAndUpdate(
          { _id: payment._id, driver: req.user._id, status: 'pending' },
          {
            $set: {
              status: 'verified',
              referenceNo: makeReferenceNo(),
              verifiedBy: req.user._id,
              verifiedAt: new Date(),
            },
          },
          { returnDocument: 'after', runValidators: true }
        );
        break;
      } catch (error) {
        if (!isDuplicateKey(error) || attempt === 4) throw error;
      }
    }
    if (!verifiedPayment) return res.status(409).json({ message: 'Cash payment could not be verified.' });
    await addAudit(verifiedPayment, 'verified', req.user._id, 'driver', 'pending', 'verified');
    return res.status(201).json({ payment: asPayment(verifiedPayment) });
  } catch (error) {
    console.error('[Payments] Cash recording failed:', error.name || 'UnknownError');
    return res.status(500).json({ message: 'Unable to record cash payment.' });
  }
});

const transitionPayment = async (req, res, toStatus) => {
  try {
    if (!objectIdPattern.test(req.params.id)) return res.status(404).json({ message: 'Payment not found.' });
    const rejectReason = req.body?.rejectReason;
    if (
      toStatus === 'rejected'
      && (typeof rejectReason !== 'string' || !rejectReason.trim() || rejectReason.trim().length > 200)
    ) {
      return res.status(400).json({ message: 'A rejection reason of at most 200 characters is required.' });
    }
    const existing = await Payment.findOne({ _id: req.params.id, driver: req.user._id }).select('_id status');
    if (!existing) return res.status(404).json({ message: 'Payment not found.' });
    if (existing.status !== 'pending') return res.status(409).json({ message: 'Only pending payments can be reviewed.' });

    let updated;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const update = {
          status: toStatus,
          ...(toStatus === 'verified'
            ? { referenceNo: makeReferenceNo(), verifiedBy: req.user._id, verifiedAt: new Date() }
            : { rejectReason: rejectReason.trim() }),
        };
        updated = await Payment.findOneAndUpdate(
          { _id: req.params.id, driver: req.user._id, status: 'pending' },
          { $set: update },
          { returnDocument: 'after', runValidators: true }
        );
        break;
      } catch (error) {
        if (!isDuplicateKey(error) || attempt === 4) throw error;
      }
    }
    if (!updated) return res.status(409).json({ message: 'Only pending payments can be reviewed.' });
    await addAudit(updated, toStatus, req.user._id, 'driver', 'pending', toStatus);
    return res.json({ payment: asPayment(updated) });
  } catch (error) {
    console.error('[Payments] Payment review failed:', error.name || 'UnknownError');
    return res.status(500).json({ message: 'Unable to review payment.' });
  }
};

router.post('/:id/verify', paymentRateLimit, isRole('driver'), (req, res) => transitionPayment(req, res, 'verified'));
router.post('/:id/reject', paymentRateLimit, isRole('driver'), (req, res) => transitionPayment(req, res, 'rejected'));

router.get('/verify/:referenceNo', async (req, res) => {
  try {
    if (!referencePattern.test(req.params.referenceNo)) return res.status(404).json({ message: 'Verified payment not found.' });
    const payment = await Payment.findOne({ referenceNo: req.params.referenceNo, status: 'verified' })
      .select('status amount currency verifiedAt')
      .lean();
    if (!payment) return res.status(404).json({ message: 'Verified payment not found.' });
    return res.json({
      valid: true,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      verifiedAt: payment.verifiedAt,
    });
  } catch (error) {
    console.error('[Payments] Public reference verification failed:', error.name || 'UnknownError');
    return res.status(500).json({ message: 'Unable to verify payment reference.' });
  }
});

router.get('/admin/overview', isRole('admin'), async (req, res) => {
  try {
    const [totals, recentPayments] = await Promise.all([
      Payment.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$amount' } } },
      ]),
      Payment.find().sort({ createdAt: -1, _id: -1 }).limit(20)
        .select('referenceNo amount currency method status verifiedAt createdAt').lean(),
    ]);
    const byStatus = Object.fromEntries(statuses.map((status) => [status, { count: 0, amount: 0 }]));
    totals.forEach((total) => {
      if (byStatus[total._id]) byStatus[total._id] = { count: total.count, amount: total.amount };
    });
    return res.json({
      totals: byStatus,
      recentPayments: recentPayments.map((payment) => ({
        referenceNo: payment.referenceNo || null,
        amount: payment.amount,
        currency: payment.currency,
        method: payment.method,
        status: payment.status,
        verifiedAt: payment.verifiedAt,
        createdAt: payment.createdAt,
      })),
    });
  } catch (error) {
    console.error('[Payments] Admin overview failed:', error.name || 'UnknownError');
    return res.status(500).json({ message: 'Unable to load payment overview.' });
  }
});

router.get('/admin/audit', isRole('admin'), async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit);
    if (!limit) return res.status(400).json({ message: 'Limit must be a positive integer.' });
    const cursor = await getCursorQuery(PaymentAudit, req.query.before, {}, 'at');
    if (cursor.error) return res.status(404).json({ message: cursor.error });
    const rows = await PaymentAudit.find(cursor.query).sort({ at: -1, _id: -1 }).limit(limit + 1).lean();
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    return res.json({
      audit: page.map((row) => ({
        _id: idOf(row._id),
        payment: idOf(row.payment),
        referenceNo: row.referenceNo || null,
        action: row.action,
        actor: idOf(row.actor),
        actorRole: row.actorRole,
        fromStatus: row.fromStatus,
        toStatus: row.toStatus,
        amount: row.amount,
        at: row.at,
      })),
      nextCursor: hasMore ? idOf(page[page.length - 1]._id) : null,
    });
  } catch (error) {
    console.error('[Payments] Admin audit listing failed:', error.name || 'UnknownError');
    return res.status(500).json({ message: 'Unable to load payment audit.' });
  }
});

router.get('/:id/receipt', async (req, res) => {
  try {
    if (!objectIdPattern.test(req.params.id)) return res.status(404).json({ message: 'Verified receipt not found.' });
    const payment = await Payment.findOne({
      _id: req.params.id,
      status: 'verified',
      $or: [
        { parent: req.user._id },
        { driver: req.user._id },
        ...(req.user.role === 'admin' ? [{}] : []),
      ],
    })
      .populate({ path: 'parent', select: 'fullName' })
      .populate({ path: 'driver', select: 'fullName driver.plateNumber' })
      .populate({
        path: 'vanRequest',
        select: 'studentName students schoolName vehicleId',
        populate: { path: 'vehicleId', select: 'plateNumber' },
      })
      .lean();
    if (!payment) return res.status(404).json({ message: 'Verified receipt not found.' });
    const request = payment.vanRequest;
    const studentNames = Array.isArray(request?.students)
      ? request.students.map((student) => student.studentName).filter(Boolean)
      : [];
    if (!studentNames.length && request?.studentName) studentNames.push(request.studentName);
    const plateNumber = request?.vehicleId?.plateNumber || payment.driver?.driver?.plateNumber;
    return res.json({
      referenceNo: payment.referenceNo,
      amount: payment.amount,
      currency: payment.currency,
      method: payment.method,
      verifiedAt: payment.verifiedAt,
      parentName: payment.parent?.fullName || '',
      driverName: payment.driver?.fullName || '',
      ...(plateNumber ? { plateNumber } : {}),
      ...(request ? { studentNames, schoolName: request.schoolName || '' } : {}),
    });
  } catch (error) {
    console.error('[Payments] Receipt lookup failed:', error.name || 'UnknownError');
    return res.status(500).json({ message: 'Unable to load receipt.' });
  }
});

module.exports = router;
