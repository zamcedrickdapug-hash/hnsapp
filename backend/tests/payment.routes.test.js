const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Module, createRequire } = require('node:module');
const express = require('express');
const paymentConfig = require('../config/paymentConfig');

const root = path.resolve(__dirname, '..');
const BILLING_DATE = new Date('2026-10-17T12:00:00+08:00');
const ids = {
  parent: '111111111111111111111111',
  otherParent: '222222222222222222222222',
  driver: '333333333333333333333333',
  otherDriver: '444444444444444444444444',
  admin: '555555555555555555555555',
  request: 'aaaaaaaaaaaaaaaaaaaaaaaa',
  otherRequest: 'bbbbbbbbbbbbbbbbbbbbbbbb',
  request2: 'cccccccccccccccccccccccc',
  request3: 'dddddddddddddddddddddddd',
  request4: 'eeeeeeeeeeeeeeeeeeeeeeee',
};

const clone = (value) => {
  if (Array.isArray(value)) return value.map(clone);
  if (value instanceof Date) return new Date(value.getTime());
  if (value?._bsontype === 'ObjectId') return value.toString();
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
  }
  return value;
};

const idOf = (value) => String(value?._id || value || '');
const matches = (record, query = {}) => Object.entries(query).every(([key, expected]) => {
  if (key === '$or') return expected.some((clause) => matches(record, clause));
  const actual = record?.[key];
  if (
    expected
    && typeof expected === 'object'
    && !(expected instanceof Date)
    && !Array.isArray(expected)
    && expected._bsontype !== 'ObjectId'
  ) {
    if ('$in' in expected && !expected.$in.some((item) => idOf(item) === idOf(actual))) return false;
    if ('$gte' in expected && new Date(actual).getTime() < new Date(expected.$gte).getTime()) return false;
    if ('$lt' in expected && new Date(actual).getTime() >= new Date(expected.$lt).getTime()) return false;
    return Object.keys(expected).some((operator) => ['$in', '$gte', '$lt'].includes(operator));
  }
  if (expected === null) return actual == null;
  return idOf(actual) === idOf(expected);
});

const createFixture = async (t, seeded = {}) => {
  const payments = (seeded.payments || []).map((payment, index) => ({
    _id: (index + 1).toString(16).padStart(24, '0'),
    createdAt: new Date(Date.now() - index * 1000),
    ...clone(payment),
  }));
  const audits = clone(seeded.audits || []);
  const defaultTrip = {
    _id: ids.request,
    parent: ids.parent,
    driver: ids.driver,
    status: 'completed',
    updatedAt: BILLING_DATE,
    requesterLocation: { latitude: 14.6, longitude: 121 },
    destinationLocation: { latitude: 14.627, longitude: 121 },
    fareAmount: null,
    fareDistanceKm: null,
    paymentStatus: 'unpaid',
    paymentId: null,
    studentName: 'Student A',
    students: [{ studentName: 'Student A' }, { studentName: 'Student B' }],
    schoolName: 'School A',
    vehicleId: { plateNumber: 'ABC-123' },
  };
  const requests = [
    defaultTrip,
    {
      _id: ids.otherRequest,
      parent: ids.otherParent,
      driver: ids.otherDriver,
      status: 'completed',
      updatedAt: BILLING_DATE,
    },
    ...(seeded.requests || []).map((request) => ({
      updatedAt: BILLING_DATE,
      fareAmount: null,
      fareDistanceKm: null,
      paymentStatus: 'unpaid',
      paymentId: null,
      requesterLocation: { latitude: 14.6, longitude: 121 },
      destinationLocation: { latitude: 14.627, longitude: 121 },
      ...clone(request),
    })),
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
        result.vanRequest = clone(requests.find((trip) => idOf(trip._id) === idOf(result.vanRequest)) || null);
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
        const groupField = stage.$group._id === '$status' ? 'status' : null;
        const groups = new Map();
        rows.forEach((record) => {
          const groupId = groupField ? record[groupField] : null;
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
      if (data.externalRef && payments.some((payment) => (
        idOf(payment.driver) === idOf(data.driver)
        && ['pending', 'verified'].includes(payment.status)
        && payment.externalRef === data.externalRef
      ))) {
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
        _id: data._id || (payments.length + 1).toString(16).padStart(24, '0'),
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
      Object.assign(payment, clone(update.$set || {}));
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
    find: (query = {}) => new FakeQuery(() => requests.filter((request) => matches(request, query))),
    findOne: (query = {}) => new FakeQuery(() => requests.find((request) => matches(request, query)) || null),
    findOneAndUpdate: (query, update) => new FakeQuery(() => {
      const request = requests.find((candidate) => matches(candidate, query));
      if (!request) return null;
      Object.assign(request, clone(update.$set || {}));
      return request;
    }),
    updateMany: async (query, update) => {
      const matched = requests.filter((request) => matches(request, query));
      matched.forEach((request) => {
        Object.assign(request, clone(update.$set || {}));
        Object.keys(update.$unset || {}).forEach((field) => delete request[field]);
      });
      return { matchedCount: matched.length, modifiedCount: matched.length, nModified: matched.length };
    },
    exists: async (query = {}) => requests.some((request) => matches(request, query)),
    countDocuments: async (query = {}) => requests.filter((request) => matches(request, query)).length,
  };
  const auth = {
    requireAuth: (req, res, next) => {
      const user = users.get(req.get('authorization'));
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
    '../services/fareService': realRequire('../services/fareService'),
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
        ...(userId ? { authorization: userId } : {}),
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  };
  return { request, payments, audits, requests, router: loaded.exports };
};

const extraTrip = (overrides = {}) => ({
  parent: ids.parent,
  driver: ids.driver,
  status: 'completed',
  ...overrides,
});

test('parent submits server-priced trips and sees only own payments', async (t) => {
  const f = await createFixture(t, {
    payments: [
      { parent: ids.parent, driver: ids.driver, amount: 70, currency: 'PHP', method: 'cash', status: 'pending' },
      { parent: ids.otherParent, driver: ids.otherDriver, amount: 200, currency: 'PHP', method: 'cash', status: 'pending' },
    ],
  });
  const submitted = await f.request('POST', '/', ids.parent, {
    vanRequestIds: [ids.request],
    amount: 1,
    method: 'cash',
  });
  assert.equal(submitted.status, 201);
  assert.equal(submitted.body.payment.driver, ids.driver);
  assert.equal(submitted.body.payment.parent, ids.parent);
  assert.equal(submitted.body.payment.amount, 70);
  assert.equal(f.requests[0].paymentStatus, 'pending');
  assert.equal(f.audits.length, 1);
  assert.equal(f.audits[0].action, 'submitted');
  const listed = await f.request('GET', '/mine', ids.parent);
  assert.equal(listed.status, 200);
  assert.equal(listed.body.payments.length, 2);
  assert.ok(listed.body.payments.every((payment) => payment.parent === ids.parent));
  assert.equal(listed.body.billableTrips[0].fare, 70);
});

test('parent cannot submit against another parent trip or use another parent cursor', async (t) => {
  const f = await createFixture(t, {
    payments: [{ parent: ids.otherParent, driver: ids.otherDriver, amount: 100, method: 'cash', status: 'pending' }],
  });
  assert.equal((await f.request('POST', '/', ids.parent, {
    vanRequestIds: [ids.otherRequest],
    method: 'cash',
  })).status, 404);
  assert.equal((await f.request('GET', `/mine?before=${f.payments[0]._id}`, ids.parent)).status, 404);
});

test('simultaneous submissions cannot claim the same trip twice', async (t) => {
  const f = await createFixture(t);
  const body = { vanRequestIds: [ids.request], method: 'cash' };
  const results = await Promise.all([
    f.request('POST', '/', ids.parent, body),
    f.request('POST', '/', ids.parent, body),
  ]);
  assert.deepEqual(results.map((result) => result.status).sort(), [201, 409]);
  assert.equal(f.payments.length, 1);
  assert.equal(f.audits.length, 1);
});

test('trip ids, method, GCash reference, and note are validated; client amount is ignored', async (t) => {
  const f = await createFixture(t);
  for (const body of [
    { vanRequestIds: [], method: 'cash' },
    { vanRequestIds: [ids.request, ids.request], method: 'cash' },
    { vanRequestIds: [ids.request], method: 'bitcoin' },
    { vanRequestIds: [ids.request], method: 'gcash' },
    { vanRequestIds: [ids.request], method: 'gcash', externalRef: 'x'.repeat(41) },
    { vanRequestIds: [ids.request], method: 'cash', note: 'x'.repeat(201) },
  ]) {
    assert.equal((await f.request('POST', '/', ids.parent, body)).status, 400);
  }
  const response = await f.request('POST', '/', ids.parent, {
    vanRequestIds: [ids.request],
    amount: 0.01,
    method: 'gcash',
    externalRef: '  TX-123  ',
  });
  assert.equal(response.status, 201);
  assert.equal(response.body.payment.amount, 70);
  assert.equal(f.payments[0].externalRef, 'TX-123');
});

test('GCash reference reuse is allowed after rejection and blocked while pending or verified', async (t) => {
  const f = await createFixture(t, {
    requests: [
      extraTrip({ _id: ids.request2 }),
      extraTrip({ _id: ids.request3 }),
      extraTrip({ _id: ids.request4 }),
    ],
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
  const submit = (requestId) => f.request('POST', '/', ids.parent, {
    vanRequestIds: [requestId],
    method: 'gcash',
    externalRef: 'GC-REUSE',
  });
  assert.equal((await submit(ids.request2)).status, 201);
  assert.equal((await submit(ids.request3)).status, 409);
  const pending = f.payments.find((payment) => payment.externalRef === 'GC-REUSE' && payment.status === 'pending');
  pending.status = 'verified';
  assert.equal((await submit(ids.request4)).status, 409);
});

test('a pending GCash reference is exclusive for the same driver', async (t) => {
  const f = await createFixture(t, { requests: [extraTrip({ _id: ids.request2 })] });
  const body = { method: 'gcash', externalRef: 'GC-123' };
  assert.equal((await f.request('POST', '/', ids.parent, { ...body, vanRequestIds: [ids.request] })).status, 201);
  assert.equal((await f.request('POST', '/', ids.parent, { ...body, vanRequestIds: [ids.request2] })).status, 409);
});

test('one payment cannot mix trips assigned to different drivers', async (t) => {
  const f = await createFixture(t, {
    requests: [extraTrip({ _id: ids.request2, driver: ids.otherDriver })],
  });
  assert.equal((await f.request('POST', '/', ids.parent, {
    vanRequestIds: [ids.request, ids.request2],
    method: 'cash',
  })).status, 400);
});

test('only the assigned driver can verify; verification is one-time and marks trips paid', async (t) => {
  const f = await createFixture(t);
  const submitted = await f.request('POST', '/', ids.parent, {
    vanRequestIds: [ids.request],
    method: 'cash',
  });
  const paymentId = submitted.body.payment._id;
  assert.equal((await f.request('POST', `/${paymentId}/verify`, ids.otherDriver, {})).status, 404);
  const verified = await f.request('POST', `/${paymentId}/verify`, ids.driver, {});
  assert.equal(verified.status, 200);
  assert.match(verified.body.payment.referenceNo, /^HNS-\d{8}-[A-Z0-9]{6}$/);
  assert.equal(f.requests[0].paymentStatus, 'paid');
  assert.equal((await f.request('POST', `/${paymentId}/verify`, ids.driver, {})).status, 409);
  assert.equal((await f.request('POST', `/${paymentId}/reject`, ids.driver, { rejectReason: 'No matching record' })).status, 409);
  assert.deepEqual(f.audits.map((audit) => audit.action), ['submitted', 'verified']);
});

test('rejection releases linked trips so the parent can submit them again', async (t) => {
  const f = await createFixture(t);
  const first = await f.request('POST', '/', ids.parent, { vanRequestIds: [ids.request], method: 'cash' });
  const paymentId = first.body.payment._id;
  assert.equal((await f.request('POST', `/${paymentId}/reject`, ids.driver, {})).status, 400);
  const rejected = await f.request('POST', `/${paymentId}/reject`, ids.driver, { rejectReason: 'Reference not found' });
  assert.equal(rejected.status, 200);
  assert.equal(f.requests[0].paymentStatus, 'unpaid');
  assert.equal(f.requests[0].paymentId, null);
  assert.equal((await f.request('POST', '/', ids.parent, { vanRequestIds: [ids.request], method: 'cash' })).status, 201);
  assert.deepEqual(f.audits.map((audit) => audit.action), ['submitted', 'rejected', 'submitted']);
});

test('reference numbers are server-generated and unique', async (t) => {
  const f = await createFixture(t, { requests: [extraTrip({ _id: ids.request2 })] });
  const first = await f.request('POST', '/', ids.parent, { vanRequestIds: [ids.request], method: 'cash' });
  const verify = await f.request('POST', `/${first.body.payment._id}/verify`, ids.driver, {});
  assert.match(verify.body.payment.referenceNo, /^HNS-\d{8}-[A-Z0-9]{6}$/);
  const ref = verify.body.payment.referenceNo;
  const retry = await f.request('POST', '/', ids.parent, { vanRequestIds: [ids.request2], method: 'cash' });
  const second = await f.request('POST', `/${retry.body.payment._id}/verify`, ids.driver, {});
  assert.notEqual(second.body.payment.referenceNo, ref);
});

test('receipt is verified-only, lists trip details, and excludes private fields', async (t) => {
  const f = await createFixture(t);
  const submitted = await f.request('POST', '/', ids.parent, { vanRequestIds: [ids.request], method: 'cash' });
  const paymentId = submitted.body.payment._id;
  assert.equal((await f.request('GET', `/${paymentId}/receipt`, ids.parent)).status, 404);
  await f.request('POST', `/${paymentId}/verify`, ids.driver, {});
  Object.assign(f.requests[0], { hiddenByParent: true, hiddenByDriver: true });
  const receipt = await f.request('GET', `/${paymentId}/receipt`, ids.parent);
  assert.equal(receipt.status, 200);
  assert.deepEqual(receipt.body.trips[0].studentNames, ['Student A', 'Student B']);
  assert.equal(receipt.body.trips[0].schoolName, 'School A');
  assert.equal(receipt.body.trips[0].fare, 70);
  assert.equal(receipt.body.total, 70);
  assert.equal(receipt.body.plateNumber, 'ABC-123');
  for (const forbidden of ['phone', 'email', 'latitude', 'longitude', 'externalRef', 'parentId', 'driverId']) {
    assert.equal(JSON.stringify(receipt.body).toLowerCase().includes(forbidden.toLowerCase()), false);
  }
});

test('reference verification returns only the minimal shape', async (t) => {
  const f = await createFixture(t, {
    payments: [{
      parent: ids.parent,
      driver: ids.driver,
      amount: 100,
      currency: 'PHP',
      method: 'gcash',
      status: 'verified',
      referenceNo: 'HNS-20261017-ABC123',
      verifiedAt: new Date(),
    }],
  });
  const response = await f.request('GET', '/verify/HNS-20261017-ABC123', ids.parent);
  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(response.body).sort(), ['amount', 'currency', 'status', 'valid', 'verifiedAt']);
  assert.equal(response.body.valid, true);
  assert.equal((await f.request('GET', '/verify/bad-reference', ids.parent)).status, 404);
});

test('billable summary covers all trips beyond payment page and excludes pre-launch trips', async (t) => {
  const f = await createFixture(t, {
    requests: [
      ...Array.from({ length: 24 }, (_, index) => extraTrip({
        _id: (index + 100).toString(16).padStart(24, '0'),
        paymentStatus: index === 0 ? 'paid' : index === 1 ? 'pending' : 'unpaid',
        ...(index === 2 ? { hiddenByParent: true } : {}),
        ...(index === 3 ? { hiddenByDriver: true } : {}),
      })),
      extraTrip({ _id: '999999999999999999999999', updatedAt: new Date('2026-10-16T15:59:59.999Z') }),
    ],
    payments: [
      { parent: ids.parent, driver: ids.driver, amount: 200, currency: 'PHP', method: 'cash', status: 'verified' },
      { parent: ids.parent, driver: ids.driver, amount: 100, currency: 'PHP', method: 'cash', status: 'pending' },
    ],
  });
  const response = await f.request('GET', '/mine?limit=1', ids.parent);
  assert.equal(response.body.payments.length, 1);
  assert.equal(response.body.summary.billableTrips, 25);
  assert.equal(response.body.summary.totalFees, 25 * 70);
  assert.equal(response.body.summary.paid, 70);
  assert.equal(response.body.summary.awaiting, 70);
  assert.equal(response.body.summary.outstanding, 23 * 70);
  assert.equal(response.body.billableTrips.length, 25);
  assert.equal(f.requests.find((trip) => trip._id === '999999999999999999999999').fareAmount, null);
});

test('fare snapshot stays fixed if fare configuration later changes', async (t) => {
  const f = await createFixture(t);
  const first = await f.request('GET', '/mine', ids.parent);
  const savedFare = f.requests[0].fareAmount;
  const oldBaseFare = paymentConfig.baseFare;
  try {
    paymentConfig.baseFare = oldBaseFare + 100;
    const second = await f.request('GET', '/mine', ids.parent);
    assert.equal(second.body.billableTrips[0].fare, savedFare);
  } finally {
    paymentConfig.baseFare = oldBaseFare;
  }
  assert.equal(first.body.billableTrips[0].fare, savedFare);
});

test('driver sees allowlisted trip summaries, own collectible trips, and uncollected totals', async (t) => {
  const f = await createFixture(t, {
    requests: [
      extraTrip({ _id: ids.request2, driver: ids.otherDriver }),
      extraTrip({ _id: ids.request3, paymentStatus: 'pending' }),
    ],
    payments: [{
      parent: ids.parent,
      driver: ids.driver,
      vanRequest: ids.request,
      vanRequests: [ids.request],
      fareBreakdown: [{ vanRequest: ids.request, fare: 70, distanceKm: 3 }],
      amount: 70,
      currency: 'PHP',
      method: 'cash',
      status: 'pending',
    }],
  });
  Object.assign(f.requests.find((trip) => trip._id === ids.request), {
    hiddenByParent: true,
    hiddenByDriver: true,
  });
  const response = await f.request('GET', '/driver', ids.driver);
  assert.equal(response.body.payments[0].tripSummary[0].fare, 70);
  assert.equal(response.body.summary.uncollectedCount, 1);
  assert.equal(response.body.summary.uncollectedAmount, 70);
  assert.equal(response.body.summary.awaitingAmount, 70);
  assert.equal(response.body.collectibleTrips.length, 1);
  assert.equal(response.body.collectibleTrips[0].requestId, ids.request);
  assert.equal((await f.request('GET', '/driver', ids.otherDriver)).body.payments.length, 0);
  for (const forbidden of ['phone', 'email', 'latitude', 'longitude']) {
    assert.equal(JSON.stringify(response.body).toLowerCase().includes(forbidden), false);
  }
});

test('driver records cash only for own unpaid completed trips and writes audit rows', async (t) => {
  const f = await createFixture(t, { requests: [extraTrip({ _id: ids.request2, driver: ids.otherDriver })] });
  assert.equal((await f.request('POST', '/driver/record-cash', ids.otherDriver, {
    vanRequestIds: [ids.request],
  })).status, 404);
  const response = await f.request('POST', '/driver/record-cash', ids.driver, { vanRequestIds: [ids.request] });
  assert.equal(response.status, 201);
  assert.equal(response.body.payment.status, 'verified');
  assert.equal(response.body.payment.amount, 70);
  assert.match(response.body.payment.referenceNo, /^HNS-\d{8}-[A-Z0-9]{6}$/);
  assert.equal(f.requests[0].paymentStatus, 'paid');
  assert.deepEqual(f.audits.map((audit) => audit.action), ['recorded_cash', 'verified']);
  assert.equal((await f.request('POST', '/driver/record-cash', ids.driver, {
    vanRequestIds: [ids.request],
  })).status, 409);
});

test('driver cashier summary counts payments verified since Manila midnight', async (t) => {
  const localNow = new Date(Date.now() + 8 * 60 * 60 * 1000);
  localNow.setUTCHours(0, 0, 0, 0);
  const midnight = new Date(localNow.getTime() - 8 * 60 * 60 * 1000);
  const f = await createFixture(t, {
    payments: [
      { parent: ids.parent, driver: ids.driver, amount: 100, currency: 'PHP', method: 'cash', status: 'pending' },
      { parent: ids.parent, driver: ids.driver, amount: 200, currency: 'PHP', method: 'cash', status: 'verified', verifiedAt: new Date(midnight.getTime() - 1) },
      { parent: ids.parent, driver: ids.driver, amount: 300, currency: 'PHP', method: 'cash', status: 'verified', verifiedAt: midnight },
    ],
  });
  const response = await f.request('GET', '/driver', ids.driver);
  assert.equal(response.body.summary.pendingCount, 1);
  assert.equal(response.body.summary.pendingAmount, 100);
  assert.equal(response.body.summary.verifiedToday, 1);
  assert.equal(response.body.summary.verifiedTotal, 500);
});

test('admin endpoints are read-only and reject non-admins', async (t) => {
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
    ['POST', '/', { vanRequestIds: [ids.request], method: 'cash' }],
  ]) {
    assert.equal((await f.request(method, route, null, body)).status, 401);
  }
});

test('payment model keeps the reference index limited to pending and verified references', () => {
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
