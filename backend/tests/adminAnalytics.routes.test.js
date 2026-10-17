const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Module, createRequire } = require('node:module');
const express = require('express');

const root = path.resolve(__dirname, '..');
const mockPaymentConfig = {
  baseFare: 50,
  baseKm: 2,
  perKm: 10,
  roundTo: 5,
  minFare: 50,
  maxFare: 300,
  roadFactor: 1.3,
  billingStartDate: '2020-01-01T00:00:00+08:00',
  currency: 'PHP',
};

const getPath = (value, pathName) => pathName.split('.').reduce((current, part) => current?.[part], value);

const evaluate = (expression, record) => {
  if (typeof expression === 'string' && expression.startsWith('$')) return getPath(record, expression.slice(1));
  if (Array.isArray(expression)) return expression.map((item) => evaluate(item, record));
  if (!expression || typeof expression !== 'object' || expression instanceof Date) return expression;
  if (expression.$dateToString) {
    const date = evaluate(expression.$dateToString.date, record);
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: expression.$dateToString.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(date));
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    return `${values.year}-${values.month}-${values.day}`;
  }
  if (expression.$subtract) {
    const [left, right] = evaluate(expression.$subtract, record);
    return new Date(left).getTime() - new Date(right).getTime();
  }
  if (expression.$divide) {
    const [left, right] = evaluate(expression.$divide, record);
    return left / right;
  }
  if (expression.$ifNull) {
    const [value, fallback] = expression.$ifNull;
    return evaluate(value, record) ?? evaluate(fallback, record);
  }
  return Object.fromEntries(Object.entries(expression).map(([key, value]) => [key, evaluate(value, record)]));
};

const compareValues = (left, right) => {
  const leftValue = left instanceof Date ? left.getTime() : left;
  const rightValue = right instanceof Date ? right.getTime() : right;
  return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
};

const matches = (record, query) => Object.entries(query).every(([field, expected]) => {
  if (field === '$or') return expected.some((clause) => matches(record, clause));
  const actual = getPath(record, field);
  if (!expected || typeof expected !== 'object' || expected instanceof Date || Array.isArray(expected)) {
    return actual === expected;
  }
  return Object.entries(expected).every(([operator, operand]) => {
    if (operator === '$in') return operand.includes(actual);
    if (operator === '$gte') return compareValues(actual, operand) >= 0;
    if (operator === '$gt') return compareValues(actual, operand) > 0;
    if (operator === '$lt') return compareValues(actual, operand) < 0;
    if (operator === '$ne') return actual !== operand;
    if (operator === '$type') return operand === 'number' ? typeof actual === 'number' : typeof actual === operand;
    return false;
  });
});

const runPipeline = (source, pipeline) => pipeline.reduce((rows, stage) => {
  if (stage.$match) return rows.filter((record) => matches(record, stage.$match));
  if (stage.$group) {
    const groups = new Map();
    for (const record of rows) {
      const id = evaluate(stage.$group._id, record);
      const key = JSON.stringify(id);
      const group = groups.get(key) || { _id: id, __averages: {} };
      for (const [field, accumulator] of Object.entries(stage.$group)) {
        if (field === '_id') continue;
        if (Object.hasOwn(accumulator, '$sum')) {
          group[field] = (group[field] || 0) + (accumulator.$sum === 1 ? 1 : evaluate(accumulator.$sum, record) || 0);
        } else if (Object.hasOwn(accumulator, '$avg')) {
          const total = group.__averages[field] || { sum: 0, count: 0 };
          total.sum += evaluate(accumulator.$avg, record);
          total.count += 1;
          group.__averages[field] = total;
          group[field] = total.sum / total.count;
        }
      }
      groups.set(key, group);
    }
    return [...groups.values()].map(({ __averages, ...group }) => group);
  }
  if (stage.$sort) {
    return [...rows].sort((left, right) => {
      for (const [field, direction] of Object.entries(stage.$sort)) {
        const difference = compareValues(getPath(left, field), getPath(right, field));
        if (difference) return difference * direction;
      }
      return 0;
    });
  }
  if (stage.$limit) return rows.slice(0, stage.$limit);
  if (stage.$count) return rows.length ? [{ [stage.$count]: rows.length }] : [];
  if (stage.$project) {
    return rows.map((row) => Object.fromEntries(Object.entries(stage.$project)
      .filter(([, value]) => value !== 0)
      .map(([field, value]) => [field, value === 1 ? row[field] : evaluate(value, row)])));
  }
  return rows;
}, source);

const manilaDay = (offset) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const date = new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day) + offset));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
};

const dateAtManilaDay = (offset, hour = 10) => {
  const [year, month, day] = manilaDay(offset).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour - 8, 30));
};

const createServer = async (t) => {
  const createdAt = dateAtManilaDay(-2, 1);
  const completedAt = new Date(createdAt.getTime() + 30 * 60 * 1000);
  const currentDate = dateAtManilaDay(0);
  const trips = [
    { status: 'completed', createdAt, completedAt, updatedAt: new Date(completedAt.getTime() + 5 * 60 * 60 * 1000), fareAmount: 80, paymentStatus: 'paid', schoolName: 'North School' },
    { status: 'completed', createdAt: currentDate, completedAt: new Date(currentDate.getTime() + 30 * 60 * 1000), updatedAt: new Date(currentDate.getTime() + 60 * 60 * 1000), fareAmount: 120, paymentStatus: 'unpaid', schoolName: 'North School' },
    { status: 'cancelled', createdAt: currentDate, updatedAt: currentDate, fareAmount: null, paymentStatus: 'unpaid', schoolName: 'West School' },
  ];
  const users = [
    { role: 'parent', status: 'approved', accountState: 'active', createdAt },
    { role: 'driver', status: 'approved', accountState: 'active', createdAt },
    { role: 'driver', status: 'pending', accountState: 'active', createdAt: currentDate },
  ];
  const payments = [
    { status: 'verified', amount: 40, createdAt: currentDate },
  ];

  const aggregateModel = (records) => ({ aggregate: async (pipeline) => runPipeline(records, pipeline) });
  const fakeAuth = {
    requireAdmin: (req, res, next) => {
      const token = req.get('authorization');
      if (!token) return res.status(401).json({ message: 'Authentication token is required.' });
      if (token !== 'admin') return res.status(403).json({ message: 'Admin access is required.' });
      req.user = { role: 'admin' };
      return next();
    },
  };
  const filename = path.join(root, 'routes', 'adminAnalytics.routes.js');
  const loaded = new Module(filename, module);
  const realRequire = createRequire(filename);
  const dependencies = {
    '../models/User': aggregateModel(users),
    '../models/VanRequest': aggregateModel(trips),
    '../models/Payment': aggregateModel(payments),
    '../config/paymentConfig': mockPaymentConfig,
    '../middleware/auth': fakeAuth,
    '../socket': { getIo: () => ({ engine: {} }) },
    mongoose: { connection: { readyState: 1 } },
    'firebase-admin': { apps: [] },
  };
  loaded.require = (name) => Object.hasOwn(dependencies, name) ? dependencies[name] : realRequire(name);
  loaded._compile(fs.readFileSync(filename, 'utf8'), filename);

  const app = express();
  app.use('/api/admin/analytics', loaded.exports);
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const request = async (route, authorization = 'admin') => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/analytics${route}`, {
      headers: authorization ? { authorization } : {},
    });
    return { status: response.status, body: await response.json() };
  };
  return { request };
};

test('analytics endpoints require authentication and admin access', async (t) => {
  const { request } = await createServer(t);
  assert.equal((await request('/summary', '')).status, 401);
  assert.equal((await request('/summary', 'parent')).status, 403);
});

test('summary rejects unsupported ranges', async (t) => {
  const { request } = await createServer(t);
  assert.equal((await request('/summary?range=365d')).status, 400);
});

test('summary returns correct aggregate totals grouped by Manila calendar day without private fields', async (t) => {
  const { request } = await createServer(t);
  const { status, body } = await request('/summary?range=7d');

  assert.equal(status, 200);
  assert.deepEqual(body.tripsByStatus, [
    { status: 'cancelled', count: 1 },
    { status: 'completed', count: 2 },
  ]);
  assert.equal(body.summary.totalTrips, 3);
  assert.equal(body.summary.completedTrips, 2);
  assert.equal(body.summary.cancelledTrips, 1);
  assert.equal(body.summary.activeDrivers, 1);
  assert.equal(body.summary.averageMinutesToCompletion, 30);
  assert.deepEqual(body.approvals, { pending: 1, approved: 2, declined: 0 });
  assert.deepEqual(body.collections, {
    currency: 'PHP',
    totalCompletedBillableFares: 200,
    averageFare: 100,
    collected: 40,
    outstanding: 120,
  });
  assert.deepEqual(body.tripsPerDay, [
    { date: manilaDay(-2), count: 1 },
    { date: manilaDay(0), count: 2 },
  ]);
  assert.deepEqual(body.registrationsPerDay, [
    { date: manilaDay(-2), role: 'driver', count: 1 },
    { date: manilaDay(-2), role: 'parent', count: 1 },
    { date: manilaDay(0), role: 'driver', count: 1 },
  ]);
  assert.deepEqual(body.topSchools, [
    { school: 'North School', count: 2 },
    { school: 'West School', count: 1 },
  ]);

  const forbiddenFieldNames = /^(phone|email|latitude|longitude|coordinates|userId|driverId|parentId|secret|password|token|connectionString|url)$/i;
  const inspect = (value) => {
    if (Array.isArray(value)) return value.forEach(inspect);
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      assert.equal(forbiddenFieldNames.test(key), false, `Unexpected personal or secret field: ${key}`);
      inspect(child);
    }
  };
  inspect(body);
});

test('health and config expose only service booleans and the business-rule allowlist', async (t) => {
  const { request } = await createServer(t);
  const health = await request('/health');
  const config = await request('/config');

  assert.equal(health.status, 200);
  assert.equal(typeof health.body.databaseConnected, 'boolean');
  assert.equal(typeof health.body.socketServerRunning, 'boolean');
  assert.deepEqual(Object.keys(config.body).sort(), [
    'baseFare', 'baseKm', 'billingStartDate', 'currency', 'maxFare',
    'minFare', 'perKm', 'roadFactor', 'roundTo',
  ]);
  for (const payload of [health.body, config.body]) {
    for (const key of Object.keys(payload)) {
      assert.doesNotMatch(key, /phone|latitude|longitude|coordinates|secret|password|token|connectionString|url/i);
    }
  }
});
