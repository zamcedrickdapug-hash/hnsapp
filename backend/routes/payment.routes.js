const express = require('express');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const { rateLimit } = require('express-rate-limit');
const Payment = require('../models/Payment');
const PaymentAudit = require('../models/PaymentAudit');
const VanRequest = require('../models/VanRequest');
const { requireAuth } = require('../middleware/auth');
const paymentConfig = require('../config/paymentConfig');
const { computeFare } = require('../services/fareService');

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
const billingStartDate = new Date(paymentConfig.billingStartDate);

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

const completionDate = (request) => request.updatedAt || null;

const snapshotFare = async (request) => {
  if (request.fareAmount !== null && request.fareAmount !== undefined) return request;
  const fare = computeFare({
    pickup: request.requesterLocation,
    destination: request.destinationLocation,
  });
  const updated = await VanRequest.findOneAndUpdate(
    {
      _id: request._id,
      status: 'completed',
      updatedAt: { $gte: billingStartDate },
      fareAmount: null,
    },
    { $set: { fareAmount: fare.fare, fareDistanceKm: fare.distanceKm } },
    { returnDocument: 'after', timestamps: false }
  ).lean();
  if (updated) return updated;
  return VanRequest.findOne({ _id: request._id }).lean();
};

const loadBillableTrips = async (ownerQuery) => {
  const trips = await VanRequest.find({
    ...ownerQuery,
    status: 'completed',
    updatedAt: { $gte: billingStartDate },
  })
    .sort({ updatedAt: -1, _id: -1 })
    .lean();
  const snapshotted = [];
  for (const trip of trips) {
    const snapshot = await snapshotFare(trip);
    if (snapshot) snapshotted.push(snapshot);
  }
  return snapshotted;
};

const studentNamesFor = (trip) => {
  const names = Array.isArray(trip.students)
    ? trip.students.map((student) => student.studentName).filter(Boolean)
    : [];
  if (!names.length && trip.studentName) names.push(trip.studentName);
  return names;
};

const summarizeTrip = (trip, fare = trip.fareAmount) => ({
  date: completionDate(trip),
  schoolName: trip.schoolName || '',
  studentNames: studentNamesFor(trip),
  fare: Number(fare || 0),
});

const paymentTrips = async (payment) => {
  const breakdown = Array.isArray(payment.fareBreakdown) ? payment.fareBreakdown : [];
  const linkedIds = breakdown.length
    ? breakdown.map((item) => idOf(item.vanRequest))
    : (payment.vanRequests?.length
      ? payment.vanRequests.map(idOf)
      : payment.vanRequest
        ? [idOf(payment.vanRequest)]
        : []);
  if (!linkedIds.length) return [];
  const trips = await VanRequest.find({ _id: { $in: linkedIds } })
    .select('_id updatedAt schoolName studentName students fareAmount')
    .lean();
  const byId = new Map(trips.map((trip) => [idOf(trip._id), trip]));
  return linkedIds.map((requestId, index) => {
    const trip = byId.get(requestId);
    if (!trip) return null;
    const fare = breakdown.length
      ? breakdown[index]?.fare
      : payment.amount;
    return summarizeTrip(trip, fare);
  }).filter(Boolean);
};

const asPayment = (payment, tripSummary = []) => ({
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
  tripSummary,
});

const linkedRequestIds = (payment) => (
  payment.vanRequests?.length
    ? payment.vanRequests.map((requestId) => idOf(requestId))
    : payment.vanRequest
      ? [idOf(payment.vanRequest)]
      : []
);

const validateTripIds = (value) => (
  Array.isArray(value)
  && value.length >= 1
  && value.length <= 20
  && value.every((id) => typeof id === 'string' && objectIdPattern.test(id))
  && new Set(value.map((id) => id.toLowerCase())).size === value.length
);

const claimTrips = async ({ ids, ownerField, ownerId, driverId, paymentId }) => {
  const result = await VanRequest.updateMany(
    {
      _id: { $in: ids },
      [ownerField]: ownerId,
      driver: driverId,
      status: 'completed',
      updatedAt: { $gte: billingStartDate },
      paymentStatus: 'unpaid',
    },
    { $set: { paymentStatus: 'pending', paymentId } }
  );
  return result.modifiedCount ?? result.nModified ?? 0;
};

const releaseTripClaims = (paymentId) => VanRequest.updateMany(
  { paymentId },
  { $set: { paymentStatus: 'unpaid', paymentId: null } }
);

const loadClaimableTrips = async ({ ids, ownerField, ownerId }) => {
  const trips = await VanRequest.find({
    _id: { $in: ids },
    [ownerField]: ownerId,
    status: 'completed',
    updatedAt: { $gte: billingStartDate },
  }).lean();
  if (trips.length !== ids.length) return { trips: null, status: 404 };
  const snapshotted = [];
  for (const trip of trips) {
    snapshotted.push(await snapshotFare(trip));
  }
  return { trips: snapshotted, status: null };
};

router.post('/', paymentRateLimit, isRole('parent'), async (req, res) => {
  let claimedPaymentId = null;
  try {
    const body = req.body || {};
    if (
      !validateTripIds(body.vanRequestIds)
      || !paymentConfig.methods.includes(body.method)
      || (body.note !== undefined && (typeof body.note !== 'string' || body.note.trim().length > 200))
      || (body.externalRef !== undefined && typeof body.externalRef !== 'string')
    ) {
      return res.status(400).json({ message: 'Payment trip details are invalid.' });
    }

    const externalRef = typeof body.externalRef === 'string' ? body.externalRef.trim() : '';
    if (
      (body.method === 'gcash' && (!externalRef || externalRef.length > 40))
      || (body.method === 'cash' && externalRef.length > 40)
    ) {
      return res.status(400).json({ message: 'A valid external reference is required for GCash.' });
    }

    const loaded = await loadClaimableTrips({
      ids: body.vanRequestIds,
      ownerField: 'parent',
      ownerId: req.user._id,
    });
    if (loaded.status) return res.status(loaded.status).json({ message: 'One or more trips are not yours or not billable.' });
    const requests = loaded.trips;
    if (requests.some((request) => request.paymentStatus !== 'unpaid')) {
      return res.status(409).json({ message: 'One or more trips are already claimed for payment.' });
    }
    if (requests.some((request) => !request.driver)) {
      return res.status(400).json({ message: 'Every trip must have an assigned driver.' });
    }
    const driverIds = new Set(requests.map((request) => idOf(request.driver)));
    if (driverIds.size !== 1) {
      return res.status(400).json({ message: 'Please pay one driver at a time.' });
    }
    const driverId = requests[0].driver;
    const amount = requests.reduce((total, request) => total + request.fareAmount, 0);
    claimedPaymentId = new mongoose.Types.ObjectId();
    const claimedCount = await claimTrips({
      ids: body.vanRequestIds,
      ownerField: 'parent',
      ownerId: req.user._id,
      driverId,
      paymentId: claimedPaymentId,
    });
    if (claimedCount !== body.vanRequestIds.length) {
      await releaseTripClaims(claimedPaymentId);
      claimedPaymentId = null;
      return res.status(409).json({ message: 'One or more trips were claimed by another payment.' });
    }

    const payment = await Payment.create({
      _id: claimedPaymentId,
      parent: req.user._id,
      driver: driverId,
      vanRequest: requests[0]._id,
      vanRequests: requests.map((request) => request._id),
      fareBreakdown: requests.map((request) => ({
        vanRequest: request._id,
        fare: request.fareAmount,
        distanceKm: request.fareDistanceKm,
      })),
      amount,
      currency: paymentConfig.currency,
      method: body.method,
      ...(externalRef ? { externalRef } : {}),
      note: typeof body.note === 'string' ? body.note.trim() : '',
      status: 'pending',
      submittedBy: req.user._id,
      submittedByRole: 'parent',
    });
    claimedPaymentId = null;
    await addAudit(payment, 'submitted', req.user._id, 'parent', null, 'pending');
    return res.status(201).json({
      payment: asPayment(payment, requests.map((request) => summarizeTrip(request))),
    });
  } catch (error) {
    if (claimedPaymentId) {
      await releaseTripClaims(claimedPaymentId);
    }
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
    const [payments, trips] = await Promise.all([
      Payment.find({ ...ownerQuery, ...cursor.query }).sort({ createdAt: -1, _id: -1 }).limit(limit + 1).lean(),
      loadBillableTrips({ parent: req.user._id }),
    ]);
    const hasMore = payments.length > limit;
    const page = payments.slice(0, limit);
    const summary = trips.reduce((totals, trip) => {
      totals.billableTrips += 1;
      totals.totalFees += trip.fareAmount || 0;
      if (trip.paymentStatus === 'paid') totals.paid += trip.fareAmount || 0;
      else if (trip.paymentStatus === 'pending') totals.awaiting += trip.fareAmount || 0;
      else totals.outstanding += trip.fareAmount || 0;
      return totals;
    }, { billableTrips: 0, totalFees: 0, paid: 0, awaiting: 0, outstanding: 0 });
    const paymentResponses = await Promise.all(page.map(async (payment) => (
      asPayment(payment, await paymentTrips(payment))
    )));
    return res.json({
      payments: paymentResponses,
      nextCursor: hasMore ? idOf(page[page.length - 1]._id) : null,
      billableTrips: trips.slice(0, 50).map((trip) => ({
        requestId: idOf(trip._id),
        date: completionDate(trip),
        schoolName: trip.schoolName || '',
        studentNames: studentNamesFor(trip),
        distanceKm: trip.fareDistanceKm ?? null,
        fare: trip.fareAmount,
        paymentStatus: trip.paymentStatus || 'unpaid',
      })),
      summary,
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
    const [payments, totals, trips] = await Promise.all([
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
      loadBillableTrips({ driver: req.user._id }),
    ]);
    const hasMore = payments.length > limit;
    const page = payments.slice(0, limit);
    const paymentResponses = await Promise.all(page.map(async (payment) => (
      asPayment(payment, await paymentTrips(payment))
    )));
    const collectibleTrips = trips.filter((trip) => trip.paymentStatus === 'unpaid');
    const awaitingTrips = trips.filter((trip) => trip.paymentStatus === 'pending');
    return res.json({
      payments: paymentResponses,
      nextCursor: hasMore ? idOf(page[page.length - 1]._id) : null,
      summary: {
        pendingCount: totals[0]?.pending[0]?.count || 0,
        pendingAmount: totals[0]?.pending[0]?.amount || 0,
        verifiedToday: totals[0]?.verifiedToday[0]?.count || 0,
        verifiedTotal: totals[0]?.verifiedTotal[0]?.amount || 0,
        uncollectedCount: collectibleTrips.length,
        uncollectedAmount: collectibleTrips.reduce((total, trip) => total + (trip.fareAmount || 0), 0),
        awaitingAmount: awaitingTrips.reduce((total, trip) => total + (trip.fareAmount || 0), 0),
      },
      collectibleTrips: collectibleTrips.slice(0, 50).map((trip) => ({
        requestId: idOf(trip._id),
        date: completionDate(trip),
        schoolName: trip.schoolName || '',
        studentNames: studentNamesFor(trip),
        distanceKm: trip.fareDistanceKm ?? null,
        fare: trip.fareAmount,
      })),
    });
  } catch (error) {
    console.error('[Payments] Driver payment listing failed:', error.name || 'UnknownError');
    return res.status(500).json({ message: 'Unable to load payments.' });
  }
});

router.post('/driver/record-cash', paymentRateLimit, isRole('driver'), async (req, res) => {
  let claimedPaymentId = null;
  try {
    const { vanRequestIds, note } = req.body || {};
    if (
      !validateTripIds(vanRequestIds)
      || (note !== undefined && (typeof note !== 'string' || note.trim().length > 200))
    ) {
      return res.status(400).json({ message: 'Cash payment details are invalid.' });
    }
    const loaded = await loadClaimableTrips({
      ids: vanRequestIds,
      ownerField: 'driver',
      ownerId: req.user._id,
    });
    if (loaded.status) return res.status(404).json({ message: 'One or more trips are not yours or not billable.' });
    const requests = loaded.trips;
    if (requests.some((request) => request.paymentStatus !== 'unpaid')) {
      return res.status(409).json({ message: 'One or more trips are already claimed for payment.' });
    }
    const parentIds = new Set(requests.map((request) => idOf(request.parent)));
    if (parentIds.size !== 1) {
      return res.status(400).json({ message: 'Cash can be recorded for one parent at a time.' });
    }
    const amount = requests.reduce((total, request) => total + request.fareAmount, 0);
    claimedPaymentId = new mongoose.Types.ObjectId();
    const claimedCount = await claimTrips({
      ids: vanRequestIds,
      ownerField: 'driver',
      ownerId: req.user._id,
      driverId: req.user._id,
      paymentId: claimedPaymentId,
    });
    if (claimedCount !== vanRequestIds.length) {
      await releaseTripClaims(claimedPaymentId);
      claimedPaymentId = null;
      return res.status(409).json({ message: 'One or more trips were claimed by another payment.' });
    }

    let payment;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        payment = await Payment.create({
          _id: claimedPaymentId,
          parent: requests[0].parent,
          driver: req.user._id,
          vanRequest: requests[0]._id,
          vanRequests: requests.map((request) => request._id),
          fareBreakdown: requests.map((request) => ({
            vanRequest: request._id,
            fare: request.fareAmount,
            distanceKm: request.fareDistanceKm,
          })),
          amount,
          currency: paymentConfig.currency,
          method: 'cash',
          note: typeof note === 'string' ? note.trim() : '',
          status: 'verified',
          submittedBy: req.user._id,
          submittedByRole: 'driver',
          referenceNo: makeReferenceNo(),
          verifiedBy: req.user._id,
          verifiedAt: new Date(),
        });
        break;
      } catch (error) {
        if (!isDuplicateKey(error) || attempt === 4) throw error;
      }
    }
    const paidResult = await VanRequest.updateMany(
      { _id: { $in: vanRequestIds }, driver: req.user._id, paymentId: claimedPaymentId, paymentStatus: 'pending' },
      { $set: { paymentStatus: 'paid' } }
    );
    if ((paidResult.modifiedCount ?? paidResult.nModified ?? 0) !== vanRequestIds.length) {
      return res.status(409).json({ message: 'Cash was recorded but trip payment status could not be synchronized.' });
    }
    claimedPaymentId = null;
    await addAudit(payment, 'recorded_cash', req.user._id, 'driver', null, 'verified');
    await addAudit(payment, 'verified', req.user._id, 'driver', 'pending', 'verified');
    return res.status(201).json({
      payment: asPayment(payment, requests.map((request) => summarizeTrip(request))),
    });
  } catch (error) {
    if (claimedPaymentId) await releaseTripClaims(claimedPaymentId);
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
    const existing = await Payment.findOne({ _id: req.params.id, driver: req.user._id })
      .select('_id status vanRequest vanRequests');
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
    const requestIds = linkedRequestIds(updated);
    if (requestIds.length) {
      const tripUpdate = toStatus === 'verified'
        ? { $set: { paymentStatus: 'paid' } }
        : { $set: { paymentStatus: 'unpaid', paymentId: null } };
      await VanRequest.updateMany(
        {
          _id: { $in: requestIds },
          driver: req.user._id,
          paymentId: updated._id,
          paymentStatus: 'pending',
        },
        tripUpdate
      );
    }
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
    const tripDetails = await paymentTrips(payment);
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
      trips: tripDetails,
      total: payment.amount,
    });
  } catch (error) {
    console.error('[Payments] Receipt lookup failed:', error.name || 'UnknownError');
    return res.status(500).json({ message: 'Unable to load receipt.' });
  }
});

module.exports = router;
