const express = require('express');
const mongoose = require('mongoose');
const firebaseAdmin = require('firebase-admin');
const User = require('../models/User');
const VanRequest = require('../models/VanRequest');
const Payment = require('../models/Payment');
const paymentConfig = require('../config/paymentConfig');
const { requireAdmin } = require('../middleware/auth');
const { getIo } = require('../socket');

const router = express.Router();
const ALLOWED_RANGES = new Set(['7d', '30d', '90d']);
const RANGE_DAYS = { '7d': 7, '30d': 30, '90d': 90 };
const BILLABLE_TRIP_STATUSES = ['completed'];

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
  const billableMatch = {
    ...tripMatch,
    status: { $in: BILLABLE_TRIP_STATUSES },
    updatedAt: { $gte: new Date(paymentConfig.billingStartDate) },
    fareAmount: { $type: 'number', $gt: 0 },
  };

  try {
    const [
      tripDays,
      tripStatuses,
      registrationDays,
      approvalStatuses,
      activeDriverResult,
      topSchools,
      fareTotals,
      collectedTotals,
      outstandingTotals,
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
        { $group: { _id: '$schoolName', count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
        { $limit: 10 },
        { $project: { _id: 0, school: '$_id', count: 1 } },
      ]),
      VanRequest.aggregate([
        { $match: billableMatch },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            total: { $sum: '$fareAmount' },
            average: { $avg: '$fareAmount' },
            averageMinutesToCompletion: {
              $avg: {
                $divide: [
                  { $subtract: [{ $ifNull: ['$completedAt', '$updatedAt'] }, '$createdAt'] },
                  60000,
                ],
              },
            },
          },
        },
      ]),
      Payment.aggregate([
        { $match: { status: 'verified', createdAt: { $gte: start, $lt: end } } },
        { $group: { _id: null, amount: { $sum: '$amount' } } },
      ]),
      VanRequest.aggregate([
        {
          $match: {
            ...billableMatch,
            paymentStatus: { $in: ['unpaid', 'pending'] },
          },
        },
        { $group: { _id: null, amount: { $sum: '$fareAmount' } } },
      ]),
    ]);

    const statusCounts = Object.fromEntries(tripStatuses.map(({ _id, count }) => [_id, count]));
    const approvalCounts = Object.fromEntries(approvalStatuses.map(({ _id, count }) => [_id, count]));
    const totalTrips = Object.values(statusCounts).reduce((total, count) => total + count, 0);
    const completedTrips = statusCounts.completed || 0;
    const cancelledTrips = statusCounts.cancelled || 0;
    const fareSummary = fareTotals[0] || {};

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
        approved: approvalCounts.approved || 0,
        declined: approvalCounts.declined || 0,
      },
      topSchools: topSchools.map(({ school, count }) => ({ school, count })),
      collections: {
        currency: paymentConfig.currency,
        totalCompletedBillableFares: fareSummary.total || 0,
        averageFare: fareSummary.average || 0,
        collected: collectedTotals[0]?.amount || 0,
        outstanding: outstandingTotals[0]?.amount || 0,
      },
      summary: {
        totalTrips,
        completedTrips,
        cancelledTrips,
        completedRate: totalTrips ? completedTrips / totalTrips : 0,
        cancelledRate: totalTrips ? cancelledTrips / totalTrips : 0,
        activeDrivers: activeDriverResult[0]?.count || 0,
        averageMinutesToCompletion: fareSummary.averageMinutesToCompletion ?? null,
      },
    });
  } catch (error) {
    return routeError(res, error, 'Unable to load analytics summary.');
  }
});

router.get('/health', requireAdmin, async (req, res) => {
  const now = new Date();
  const firebaseConfigured = firebaseAdmin.apps.length > 0
    || Boolean(process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_ADMIN_SDK_PATH);
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
      googleMapsKeyPresent: Boolean(process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY),
      firebaseConfigured,
      emailServiceConfigured: Boolean(
        (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD)
        || (process.env.SMTP_USERNAME && process.env.SMTP_PASSWORD),
      ),
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
