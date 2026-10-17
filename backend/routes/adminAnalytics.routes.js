const express = require('express');
const mongoose = require('mongoose');
const path = require('node:path');
const firebaseAdmin = require('firebase-admin');
const User = require('../models/User');
const VanRequest = require('../models/VanRequest');
const paymentConfig = require('../config/paymentConfig');
const { computeFare } = require('../services/fareService');
const { requireAdmin } = require('../middleware/auth');
const { getIo } = require('../socket');

const router = express.Router();
const ALLOWED_RANGES = new Set(['7d', '30d', '90d']);
const RANGE_DAYS = { '7d': 7, '30d': 30, '90d': 90 };
const BILLABLE_TRIPS_LIMIT = 5000;

const getManilaStartOfDay = (date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return new Date(Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
  ) - (8 * 60 * 60 * 1000));
};

const registrationRangeMatch = (start, end) => ({
  role: { $in: ['parent', 'driver'] },
  createdAt: { $gte: start, $lt: end },
});

const tripRangeMatch = (start, end) => ({
  createdAt: { $gte: start, $lt: end },
});

const routeError = (res, error, message) => {
  console.error('[AdminAnalytics] Read-only query failed:', error?.name || 'UnknownError');
  return res.status(500).json({ message });
};

router.get('/summary', requireAdmin, async (req, res) => {
  const range = req.query.range === undefined ? '30d' : req.query.range;
  if (typeof range !== 'string' || !ALLOWED_RANGES.has(range)) {
    return res.status(400).json({ message: 'Range must be 7d, 30d, or 90d.' });
  }

  const now = new Date();
  const end = now;
  const start = new Date(getManilaStartOfDay(now).getTime() - ((RANGE_DAYS[range] - 1) * 24 * 60 * 60 * 1000));
  const tripMatch = tripRangeMatch(start, end);
  const billableStart = new Date(Math.max(start.getTime(), new Date(paymentConfig.billingStartDate).getTime()));
  const billableMatch = {
    status: 'completed',
    updatedAt: { $gte: billableStart, $lt: end },
  };

  try {
    const [
      tripDays,
      tripStatuses,
      registrationDays,
      approvalStatuses,
      activeDriverResult,
      topSchools,
      billableCountResult,
      completionTimeResult,
      billableTrips,
    ] = await Promise.all([
      VanRequest.aggregate([
        { $match: tripMatch },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$createdAt',
                timezone: 'Asia/Manila',
              },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $limit: RANGE_DAYS[range] },
      ]),
      VanRequest.aggregate([
        { $match: tripMatch },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      User.aggregate([
        { $match: registrationRangeMatch(start, end) },
        {
          $group: {
            _id: {
              date: {
                $dateToString: {
                  format: '%Y-%m-%d',
                  date: '$createdAt',
                  timezone: 'Asia/Manila',
                },
              },
              role: '$role',
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.date': 1, '_id.role': 1 } },
        { $limit: RANGE_DAYS[range] * 2 },
      ]),
      User.aggregate([
        { $match: { role: { $in: ['parent', 'driver'] } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      User.aggregate([
        { $match: { role: 'driver', status: 'approved', accountState: 'active' } },
        { $count: 'count' },
      ]),
      VanRequest.aggregate([
        { $match: { ...tripMatch, schoolName: { $type: 'string', $ne: '' } } },
        { $project: { trimmedSchool: { $trim: { input: '$schoolName' } } } },
        { $match: { trimmedSchool: { $ne: '' } } },
        { $project: { schoolKey: { $toLower: '$trimmedSchool' }, school: '$trimmedSchool' } },
        {
          $group: {
            _id: { key: '$schoolKey', school: '$school' },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.key': 1, count: -1, '_id.school': 1 } },
        {
          $group: {
            _id: '$_id.key',
            school: { $first: '$_id.school' },
            count: { $sum: '$count' },
          },
        },
        { $sort: { count: -1, school: 1 } },
        { $limit: 10 },
        { $project: { _id: 0, school: 1, count: 1 } },
      ]),
      VanRequest.aggregate([
        { $match: billableMatch },
        { $count: 'count' },
      ]),
      VanRequest.aggregate([
        { $match: { status: 'completed', completedAt: { $exists: true, $ne: null, $gte: start, $lt: end } } },
        {
          $group: {
            _id: null,
            averageMinutes: {
              $avg: {
                $divide: [
                  { $subtract: ['$completedAt', '$createdAt'] },
                  60000,
                ],
              },
            },
          },
        },
      ]),
      VanRequest.find(billableMatch)
        .select('fareAmount paymentStatus requesterLocation destinationLocation')
        .sort({ updatedAt: -1, _id: -1 })
        .limit(BILLABLE_TRIPS_LIMIT)
        .lean(),
    ]);

    const statusCounts = Object.fromEntries(tripStatuses.map(({ _id, count }) => [_id, count]));
    const approvalCounts = Object.fromEntries(approvalStatuses.map(({ _id, count }) => [_id, count]));
    const totalTrips = Object.values(statusCounts).reduce((total, count) => total + count, 0);
    const completedTrips = statusCounts.completed || 0;
    const cancelledTrips = statusCounts.cancelled || 0;
    const billableFares = billableTrips.map((trip) => (
      trip.fareAmount === null || trip.fareAmount === undefined
        ? computeFare({
          pickup: trip.requesterLocation,
          destination: trip.destinationLocation,
        }).fare
        : trip.fareAmount
    ));
    let collected = 0;
    let outstanding = 0;
    billableTrips.forEach((trip, index) => {
      if (trip.paymentStatus === 'paid') collected += billableFares[index];
      else outstanding += billableFares[index];
    });
    const total = collected + outstanding;
    const averageFare = billableFares.length ? total / billableFares.length : 0;
    const billableCount = billableCountResult[0]?.count || 0;

    return res.status(200).json({
      range,
      generatedAt: now.toISOString(),
      tripsPerDay: tripDays.map(({ _id, count }) => ({ date: _id, count })),
      tripsByStatus: Object.entries(statusCounts).map(([status, count]) => ({ status, count })),
      registrationsPerDay: registrationDays.map(({ _id, count }) => ({
        date: _id.date,
        role: _id.role,
        count,
      })),
      approvals: {
        pending: approvalCounts.pending || 0,
        reviewing: approvalCounts.reviewing || 0,
        approved: approvalCounts.approved || 0,
        declined: approvalCounts.declined || 0,
      },
      topSchools: topSchools.map(({ school, count }) => ({ school, count })),
      collections: {
        currency: paymentConfig.currency,
        total,
        averageFare,
        collected,
        outstanding,
        truncated: billableCount > billableTrips.length,
      },
      summary: {
        totalTrips,
        completedTrips,
        cancelledTrips,
        completedRate: totalTrips ? completedTrips / totalTrips : 0,
        cancelledRate: totalTrips ? cancelledTrips / totalTrips : 0,
        activeDrivers: activeDriverResult[0]?.count || 0,
        averageMinutesToCompletion: completionTimeResult[0]?.averageMinutes ?? null,
      },
    });
  } catch (error) {
    return routeError(res, error, 'Unable to load analytics summary.');
  }
});

const isFirebaseConfigured = () => {
  if (firebaseAdmin.apps.length > 0) return true;
  try {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
      : require(path.resolve(
        process.env.FIREBASE_ADMIN_SDK_PATH || path.resolve(__dirname, '../serviceAccountKey.json'),
      ));
    firebaseAdmin.credential.cert(serviceAccount);
    return true;
  } catch {
    return false;
  }
};

router.get('/health', requireAdmin, async (req, res) => {
  const now = new Date();
  const socketServer = getIo();

  return res.status(200).json({
    serverTime: new Intl.DateTimeFormat('en-PH', {
      dateStyle: 'medium',
      timeStyle: 'long',
      timeZone: 'Asia/Manila',
    }).format(now),
    uptimeSeconds: Math.floor(process.uptime()),
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'development',
    databaseConnected: mongoose.connection.readyState === 1,
    socketServerRunning: Boolean(socketServer?.engine),
    features: {
      firebaseConfigured: isFirebaseConfigured(),
      emailServiceConfigured: Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASSWORD),
    },
  });
});

router.get('/config', requireAdmin, (req, res) => {
  const {
    baseFare,
    baseKm,
    perKm,
    roundTo,
    minFare,
    maxFare,
    roadFactor,
    billingStartDate,
    currency,
  } = paymentConfig;
  return res.status(200).json({
    baseFare,
    baseKm,
    perKm,
    roundTo,
    minFare,
    maxFare,
    roadFactor,
    billingStartDate,
    currency,
  });
});

module.exports = router;
