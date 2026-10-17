const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Module, createRequire } = require('node:module');
const express = require('express');
const paymentConfig = require('../config/paymentConfig');

const root = path.resolve(__dirname, '..');
const ids = {
  parent: '111111111111111111111111',
  otherParent: '222222222222222222222222',
  driver: '333333333333333333333333',
  otherDriver: '444444444444444444444444',
  admin: '555555555555555555555555',
  request: 'aaaaaaaaaaaaaaaaaaaaaaaa',
  otherRequest: 'bbbbbbbbbbbbbbbbbbbbbbbb',
};

const clone = (value) => {
  if (Array.isArray(value)) return value.map(clone);
  if (value instanceof Date) return new Date(value.getTime());
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
  }
  return value;
};

const idOf = (value) => String(value?._id || value || '');

const matches = (record, query = {}) => Object.entries(query).every(([key, expected]) => {
  if (key === '$or') return expected.some((clause) => matches(record, clause));
  const actual = record?.[key];
  if (expected && typeof expected === 'object' && !(expected instanceof Date) && !Array.isArray(expected)) {
    if ('$in' in expected && !expected.$in.some((item) => String(item) === String(actual))) return false;
    if ('$gte' in expected && new Date(actual).getTime() < new Date(expected.$gte).getTime()) return false;
    if ('$lt' in expected && new Date(actual).getTime() >= new Date(expected.$lt).getTime()) return false;
    return Object.keys(expected).some((operator) => ['$in', '$gte', '$lt'].includes(operator));
  }
  if (expected === null) return actual == null;
  return idOf(actual) === idOf(expected);
});

const createFixture = async (t, seeded = {}) => {
  const payments = (seeded.payments || []).map((payment, index) => ({
    _id: payment._id || (index + 1).toString(16).padStart(24, '0'),
    createdAt: payment.createdAt || new Date(Date.now() - index * 1000),
    ...clone(payment),
  }));
  const audits = clone(seeded.audits || []);
  const requests = [
    {
      _id: ids.request,
      parent: ids.parent,
      driver: ids.driver,
      status: 'completed',
      studentName: 'Student A',
      students: [{ studentName: 'Student A' }, { studentName: 'Student B' }],
      schoolName: 'School A',
      vehicleId: { plateNumber: 'ABC-123' },
    },
    {
      _id: ids.otherRequest,
      parent: ids.otherParent,
      driver: ids.otherDriver,
      status: 'accepted',
    },
    ...(seeded.requests || []),
  ];
  const users = new Map([
    [ids.parent, { _id: ids.parent, role: 'parent', fullName: 'Parent A' }],
    [ids.otherParent, { _id: ids.otherParent, role: 'parent', fullName: 'Parent B' }],
    [ids.driver, { _id: ids.driver, role: 'driver', fullName: 'Driver A', driver: { plateNumber: 'DRV-456' } }],
    [ids.otherDriver, { _id: ids.otherDriver, role: 'driver', fullName: 'Driver B' }],
    [ids.admin, { _id: ids.admin, role: 'admin', fullName: 'Admin' }],
  ]);

  const populateValue = (record, fields) => {
    if (!record) return record;
    const result = clone(record);
    for (const { path: field } of fields) {
      if (field === 'parent') result.parent = clone(users.get(idOf(result.parent)) || null);
      if (field === 'driver') result.driver = clone(users.get(idOf(result.driver)) || null);
      if (field === 'vanRequest') {
        result.vanRequest = clone(requests.find((request) => idOf(request._id) === idOf(result.vanRequest)) || null);
      }
    }
    return result;
  };

  class FakeQuery {
    constructor(resolve, transform = clone) {
      this.resolve = resolve;
      this.transform = transform;
      this.sortFields = null;
      this.limitCount = null;
      this.populateFields = [];
    }
    select() { return this; }
    lean() { return this; }
    populate(field) {
      this.populateFields.push(typeof field === 'string' ? { path: field } : field);
      return this;
    }
    sort(fields) { this.sortFields = fields; return this; }
    limit(value) { this.limitCount = value; return this; }
    then(resolve, reject) {
      return Promise.resolve().then(this.resolve).then((value) => {
        if (Array.isArray(value)) {
          let items = value;
          if (this.sortFields) {
            items = [...items].sort((left, right) => {
              for (const [field, direction] of Object.entries(this.sortFields)) {
                const a = left[field] instanceof Date ? left[field].getTime() : String(left[field] ?? '');
                const b = right[field] instanceof Date ? right[field].getTime() : String(right[field] ?? '');
                if (a !== b) return (a < b ? -1 : 1) * direction;
              }
              return 0;
            });
          }
          if (this.limitCount !== null) items = items.slice(0, this.limitCount);
          return items.map((item) => this.transform(item, this.populateFields));
        }
        return this.transform(value, this.populateFields);
      }).then(resolve, reject);
    }
  }
  const runAggregate = (records, pipeline) => {
    let rows = records;
    for (const stage of pipeline) {
      if (stage.$match) {
        rows = rows.filter((record) => matches(record, stage.$match));
      } else if (stage.$group) {
        const key = stage.$group._id === '$status' ? 'status' : null;
        const groups = new Map();
        rows.forEach((record) => {
          const groupId = key ? record[key] : null;
          const group = groups.get(groupId) || { _id: groupId };
          Object.entries(stage.$group).forEach(([field, expression]) => {
            if (field === '_id') return;
            const source = expression.$sum === 1 ? 1 : record[expression.$sum.slice(1)] || 0;
            group[field] = (group[field] || 0) + source;
          });
          groups.set(groupId, group);
        });
        rows = [...groups.values()];
      } else if (stage.$count) {
        rows = rows.length ? [{ [stage.$count]: rows.length }] : [];
      } else if (stage.$facet) {
        rows = [Object.fromEntries(Object.entries(stage.$facet)
          .map(([name, subPipeline]) => [name, runAggregate(rows, subPipeline)]))];
      }
    }
    return rows;
  };
  const Payment = {
    create: async (data) => {
      if (
        data.externalRef
        && payments.some((payment) => idOf(payment.driver) === idOf(data.driver)
          && ['pending', 'verified'].includes(payment.status)
          && payment.externalRef === data.externalRef)
      ) {
        const duplicate = new Error('duplicate');
        duplicate.code = 11000;
        throw duplicate;
      }
      if (data.referenceNo && payments.some((payment) => payment.referenceNo === data.referenceNo)) {
        const duplicate = new Error('duplicate');
        duplicate.code = 11000;
        throw duplicate;
      }
      const created = {
        _id: (payments.length + 1).toString(16).padStart(24, '0'),
        createdAt: new Date(),
        ...clone(data),
      };
      payments.push(created);
      return clone(created);
    },
    find: (query = {}) => new FakeQuery(() => payments.filter((payment) => matches(payment, query))),
    findOne: (query = {}) => new FakeQuery(() => payments.find((payment) => matches(payment, query)) || null, populateValue),
    countDocuments: async (query = {}) => payments.filter((payment) => matches(payment, query)).length,
    aggregate: async (pipeline) => runAggregate(payments, pipeline),
    findOneAndUpdate: async (query, update) => {
      const payment = payments.find((candidate) => matches(candidate, query));
      if (!payment) return null;
      Object.assign(payment, clone(update.$set));
      return clone(payment);
    },
  };
  const PaymentAudit = {
    create: async (data) => {
      const audit = { _id: (audits.length + 1).toString(16).padStart(24, '0'), ...clone(data) };
      audits.push(audit);
      return clone(audit);
    },
    find: (query = {}) => new FakeQuery(() => audits.filter((audit) => matches(audit, query))),
    findOne: (query = {}) => new FakeQuery(() => audits.find((audit) => matches(audit, query)) || null),
  };
  const VanRequest = {
    findOne: (query = {}) => new FakeQuery(() => requests.find((request) => matches(request, query)) || null),
    exists: async (query = {}) => requests.some((request) => matches(request, query)),
    countDocuments: async (query = {}) => requests.filter((request) => matches(request, query)).length,
  };
  const auth = {
    requireAuth: (req, res, next) => {
      const userId = req.get('authorization')?.replace(/^Bearer /, '');
      const user = users.get(userId);
      if (!user) return res.status(401).json({ message: 'Authentication token is required.' });
      req.user = user;
      return next();
    },
  };
  const filename = path.join(root, 'routes', 'payment.routes.js');
  const loaded = new Module(filename, module);
  const realRequire = createRequire(filename);
  const dependencies = {
    '../models/Payment': Payment,
    '../models/PaymentAudit': PaymentAudit,
    '../models/VanRequest': VanRequest,
    '../middleware/auth': auth,
    '../config/paymentConfig': paymentConfig,
  };
  loaded.require = (name) => Object.hasOwn(dependencies, name) ? dependencies[name] : realRequire(name);
  loaded._compile(fs.readFileSync(filename, 'utf8'), filename);

  const app = express();
  app.use(express.json());
  app.use('/api/payments', loaded.exports);
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const request = async (method, route, userId, body) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/payments${route}`, {
      method,
      headers: {
        ...(userId ? { authorization: `Bearer ${userId}` } : {}),
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  };
  return { request, payments, audits, router: loaded.exports };
};

test('parent submits a payment and sees only own payments', async (t) => {
  const f = await createFixture(t, {
    payments: [
      { parent: ids.parent, driver: ids.driver, amount: 100, currency: 'PHP', method: 'cash', status: 'pending' },
      { parent: ids.otherParent, driver: ids.otherDriver, amount: 200, currency: 'PHP', method: 'cash', status: 'pending' },
    ],
  });
  const submitted = await f.request('POST', '/', ids.parent, {
    vanRequestId: ids.request,
    amount: 100,
    method: 'cash',
  });
  assert.equal(submitted.status, 201);
  assert.equal(submitted.body.payment.driver, ids.driver);
  assert.equal(submitted.body.payment.parent, ids.parent);
  assert.equal(f.audits.length, 1);
  assert.equal(f.audits[0].action, 'submitted');
  const listed = await f.request('GET', '/mine', ids.parent);
  assert.equal(listed.status, 200);
  assert.equal(listed.body.payments.length, 2);
  assert.ok(listed.body.payments.every((payment) => payment.parent === ids.parent));
});

test('parent cannot submit against another parent request or use another parent cursor', async (t) => {
  const f = await createFixture(t, {
    payments: [{ parent: ids.otherParent, driver: ids.otherDriver, amount: 100, method: 'cash', status: 'pending' }],
  });
  const submitted = await f.request('POST', '/', ids.parent, {
    vanRequestId: ids.otherRequest,
    amount: 100,
    method: 'cash',
  });
  assert.equal(submitted.status, 404);
  const listed = await f.request('GET', `/mine?before=${f.payments[0]._id}`, ids.parent);
  assert.equal(listed.status, 404);
});

test('amount, precision, max amount, method, and GCash reference are validated', async (t) => {
  const f = await createFixture(t);
  for (const body of [
    { driverId: ids.driver, amount: 0, method: 'cash' },
    { driverId: ids.driver, amount: 100.001, method: 'cash' },
    { driverId: ids.driver, amount: 50000.01, method: 'cash' },
    { driverId: ids.driver, amount: 100, method: 'bitcoin' },
    { driverId: ids.driver, amount: 100, method: 'gcash' },
  ]) {
    assert.equal((await f.request('POST', '/', ids.parent, body)).status, 400);
  }
  assert.equal((await f.request('POST', '/', ids.parent, {
    driverId: ids.driver,
    amount: 1.15,
    method: 'gcash',
    externalRef: '  TX-123  ',
  })).status, 201);
  assert.equal(f.payments[0].externalRef, 'TX-123');
  assert.equal(f.payments[0].amount, 1.15);
});

test('GCash reference can be reused after rejection but conflicts while pending or verified', async (t) => {
  const f = await createFixture(t, {
    payments: [{
      parent: ids.parent,
      driver: ids.driver,
      amount: 100,
      currency: 'PHP',
      method: 'gcash',
      externalRef: 'GC-REUSE',
      status: 'rejected',
    }],
  });
  const payload = { driverId: ids.driver, amount: 100, method: 'gcash', externalRef: 'GC-REUSE' };
  assert.equal((await f.request('POST', '/', ids.parent, payload)).status, 201);
  assert.equal(f.payments.at(-1).status, 'pending');
  assert.equal((await f.request('POST', '/', ids.parent, payload)).status, 409);
  f.payments.at(-1).status = 'verified';
  assert.equal((await f.request('POST', '/', ids.parent, payload)).status, 409);
});

test('same GCash external reference remains exclusive for pending and verified payments', async (t) => {
  const f = await createFixture(t);
  const payload = { driverId: ids.driver, amount: 100, method: 'gcash', externalRef: 'GC-123' };
  assert.equal((await f.request('POST', '/', ids.parent, payload)).status, 201);
  assert.equal((await f.request('POST', '/', ids.parent, payload)).status, 409);
  f.payments[0].status = 'verified';
  assert.equal((await f.request('POST', '/', ids.parent, payload)).status, 409);
});

test('only the assigned driver can verify/reject and review only pending payments', async (t) => {
  const f = await createFixture(t, {
    payments: [{ parent: ids.parent, driver: ids.driver, amount: 100, currency: 'PHP', method: 'cash', status: 'pending' }],
  });
  const paymentId = f.payments[0]._id;
  assert.equal((await f.request('POST', `/${paymentId}/verify`, ids.otherDriver, {})).status, 404);
  const verified = await f.request('POST', `/${paymentId}/verify`, ids.driver, {});
  assert.equal(verified.status, 200);
  assert.match(verified.body.payment.referenceNo, /^HNS-\d{8}-[A-Z0-9]{6}$/);
  assert.equal((await f.request('POST', `/${paymentId}/verify`, ids.driver, {})).status, 409);
  assert.equal((await f.request('POST', `/${paymentId}/reject`, ids.driver, { rejectReason: 'No matching record' })).status, 409);
  assert.equal((await f.request('POST', `/${paymentId}/reject`, ids.otherDriver, { rejectReason: 'No matching record' })).status, 404);
  assert.equal(f.audits.length, 1);
  assert.equal(f.audits[0].action, 'verified');
});

test('rejection changes pending to rejected and records the reason and audit', async (t) => {
  const f = await createFixture(t, {
    payments: [{ parent: ids.parent, driver: ids.driver, amount: 100, currency: 'PHP', method: 'gcash', status: 'pending' }],
  });
  const paymentId = f.payments[0]._id;
  assert.equal((await f.request('POST', `/${paymentId}/reject`, ids.driver, {})).status, 400);
  const response = await f.request('POST', `/${paymentId}/reject`, ids.driver, { rejectReason: 'Reference not found' });
  assert.equal(response.status, 200);
  assert.equal(response.body.payment.status, 'rejected');
  assert.equal(f.audits[0].action, 'rejected');
});

test('reference numbers are server generated, Manila dated, and unique', async (t) => {
  const f = await createFixture(t, {
    payments: [
      { parent: ids.parent, driver: ids.driver, amount: 100, currency: 'PHP', method: 'cash', status: 'pending' },
      { parent: ids.parent, driver: ids.driver, amount: 100, currency: 'PHP', method: 'cash', status: 'pending' },
    ],
  });
  const today = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const expectedDate = `${today.getUTCFullYear()}${String(today.getUTCMonth() + 1).padStart(2, '0')}${String(today.getUTCDate()).padStart(2, '0')}`;
  const results = await Promise.all(f.payments.map((payment) => f.request('POST', `/${payment._id}/verify`, ids.driver, {})));
  const references = results.map((result) => result.body.payment.referenceNo);
  assert.ok(references.every((reference) => reference.startsWith(`HNS-${expectedDate}-`)));
  assert.equal(new Set(references).size, 2);
  assert.ok(references.every((reference) => /^HNS-\d{8}-[A-Z0-9]{6}$/.test(reference)));
});

test('receipt is available only for verified payments and excludes private fields', async (t) => {
  const f = await createFixture(t, {
    payments: [{
      parent: ids.parent,
      driver: ids.driver,
      vanRequest: ids.request,
      amount: 100,
      currency: 'PHP',
      method: 'cash',
      status: 'pending',
      externalRef: 'PRIVATE-GCASH-REF',
      referenceNo: 'HNS-20261017-ABC123',
    }],
  });
  const paymentId = f.payments[0]._id;
  assert.equal((await f.request('GET', `/${paymentId}/receipt`, ids.parent)).status, 404);
  f.payments[0].status = 'verified';
  f.payments[0].verifiedAt = new Date();
  const receipt = await f.request('GET', `/${paymentId}/receipt`, ids.parent);
  assert.equal(receipt.status, 200);
  assert.deepEqual(receipt.body.studentNames, ['Student A', 'Student B']);
  assert.equal(receipt.body.schoolName, 'School A');
  assert.equal(receipt.body.plateNumber, 'ABC-123');
  for (const forbidden of ['phone', 'email', 'latitude', 'longitude', 'externalRef', 'parentId', 'driverId']) {
    assert.equal(JSON.stringify(receipt.body).toLowerCase().includes(forbidden.toLowerCase()), false);
  }
});

test('verification endpoint returns only its minimal verified-payment shape', async (t) => {
  const verifiedAt = new Date();
  const f = await createFixture(t, {
    payments: [{
      parent: ids.parent,
      driver: ids.driver,
      amount: 100,
      currency: 'PHP',
      method: 'gcash',
      status: 'verified',
      referenceNo: 'HNS-20261017-ABC123',
      verifiedAt,
    }],
  });
  const response = await f.request('GET', '/verify/HNS-20261017-ABC123', ids.parent);
  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(response.body).sort(), ['amount', 'currency', 'status', 'valid', 'verifiedAt']);
  assert.equal(response.body.valid, true);
  assert.equal((await f.request('GET', '/verify/bad-reference', ids.parent)).status, 404);
});

test('parent balance uses all completed trips and all verified payments, beyond the page', async (t) => {
  const f = await createFixture(t, {
    requests: Array.from({ length: 24 }, (_, index) => ({
      _id: (index + 100).toString(16).padStart(24, '0'),
      parent: ids.parent,
      driver: ids.driver,
      status: 'completed',
    })),
    payments: [
      { parent: ids.parent, driver: ids.driver, amount: 200, currency: 'PHP', method: 'cash', status: 'verified' },
      { parent: ids.parent, driver: ids.driver, amount: 100, currency: 'PHP', method: 'cash', status: 'pending' },
    ],
  });
  const response = await f.request('GET', '/mine?limit=1', ids.parent);
  assert.equal(response.body.payments.length, 1);
  assert.equal(response.body.summary.completedTrips, 25);
  assert.equal(response.body.summary.totalFees, 25 * paymentConfig.feePerTrip);
  assert.equal(response.body.summary.totalVerified, 200);
  assert.equal(response.body.summary.outstanding, 25 * paymentConfig.feePerTrip - 200);
});

test('driver cashier summary counts payments verified since Manila midnight', async (t) => {
  const todayStart = new Date(Date.now() + 8 * 60 * 60 * 1000);
  todayStart.setUTCHours(0, 0, 0, 0);
  const beforeMidnight = new Date(todayStart.getTime() - 8 * 60 * 60 * 1000 - 1);
  const midnight = new Date(todayStart.getTime() - 8 * 60 * 60 * 1000);
  const f = await createFixture(t, {
    payments: [
      { parent: ids.parent, driver: ids.driver, amount: 100, currency: 'PHP', method: 'cash', status: 'pending' },
      { parent: ids.parent, driver: ids.driver, amount: 200, currency: 'PHP', method: 'cash', status: 'verified', verifiedAt: beforeMidnight },
      { parent: ids.parent, driver: ids.driver, amount: 300, currency: 'PHP', method: 'cash', status: 'verified', verifiedAt: midnight },
    ],
  });
  const response = await f.request('GET', '/driver', ids.driver);
  assert.equal(response.body.summary.pendingCount, 1);
  assert.equal(response.body.summary.pendingAmount, 100);
  assert.equal(response.body.summary.verifiedToday, 1);
  assert.equal(response.body.summary.verifiedTotal, 500);
});

test('cash recording requires own active/completed request and writes both audit actions', async (t) => {
  const f = await createFixture(t);
  const response = await f.request('POST', '/driver/record-cash', ids.driver, {
    vanRequestId: ids.request,
    amount: 100,
  });
  assert.equal(response.status, 201);
  assert.equal(response.body.payment.status, 'verified');
  assert.match(response.body.payment.referenceNo, /^HNS-\d{8}-[A-Z0-9]{6}$/);
  assert.deepEqual(f.audits.map((audit) => audit.action), ['recorded_cash', 'verified']);
  assert.equal((await f.request('POST', '/driver/record-cash', ids.otherDriver, {
    vanRequestId: ids.request,
    amount: 100,
  })).status, 404);
});

test('admin endpoints reject non-admins; audit routes are read-only', async (t) => {
  const f = await createFixture(t);
  assert.equal((await f.request('GET', '/admin/overview', ids.parent)).status, 403);
  assert.equal((await f.request('GET', '/admin/audit', ids.driver)).status, 403);
  assert.equal((await f.request('GET', '/admin/audit', ids.admin)).status, 200);
  assert.equal((await f.request('GET', '/admin/overview', ids.admin)).status, 200);
  const mutationMethods = f.router.stack
    .filter((layer) => layer.route?.path?.includes('audit'))
    .flatMap((layer) => Object.keys(layer.route.methods))
    .filter((method) => ['put', 'patch', 'delete'].includes(method));
  assert.deepEqual(mutationMethods, []);
});

test('all payment routes require authentication', async (t) => {
  const f = await createFixture(t);
  for (const [method, route, body] of [
    ['GET', '/mine'],
    ['GET', '/driver'],
    ['GET', '/admin/overview'],
    ['GET', '/admin/audit'],
    ['POST', '/', { driverId: ids.driver, amount: 100, method: 'cash' }],
  ]) {
    assert.equal((await f.request(method, route, null, body)).status, 401);
  }
});

test('payment schemas define the required immutable audit data and duplicate-reference index', () => {
  const Payment = require('../models/Payment');
  const PaymentAudit = require('../models/PaymentAudit');
  assert.equal(Payment.schema.path('referenceNo').options.unique, true);
  assert.equal(Payment.schema.path('externalRef').options.maxlength, 40);
  assert.equal(Payment.schema.path('note').options.maxlength, 200);
  assert.equal(PaymentAudit.schema.path('action').options.enum.includes('recorded_cash'), true);
  assert.equal(PaymentAudit.schema.path('at').options.required, true);
  assert.ok(Payment.schema.indexes().some(([index, options]) => (
    index.driver === 1
    && index.externalRef === 1
    && options.unique
    && options.partialFilterExpression.externalRef.$type === 'string'
    && options.partialFilterExpression.status.$in.join(',') === 'pending,verified'
  )));
  assert.deepEqual(paymentConfig.methods, ['cash', 'gcash']);
  assert.equal(paymentConfig.currency, 'PHP');
});
