const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Module, createRequire } = require('node:module');
const { randomBytes } = require('node:crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

if (!process.env.JWT_SECRET?.trim()) {
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
}

const loadWithDependencies = (relativePath, dependencies) => {
  const filename = path.resolve(__dirname, '..', relativePath);
  const loaded = new Module(filename, module);
  const realRequire = createRequire(filename);
  loaded.require = (name) => Object.hasOwn(dependencies, name) ? dependencies[name] : realRequire(name);
  loaded._compile(fs.readFileSync(filename, 'utf8'), filename);
  return loaded.exports;
};

const idString = (value) => String(value?._id || value);

const matches = (record, query = {}) => Object.entries(query).every(([key, expected]) => {
  if (key === '$or') return expected.some((clause) => matches(record, clause));
  const actual = record[key];
  if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
    if ('$ne' in expected) return actual == null ? expected.$ne != null : idString(actual) !== idString(expected.$ne);
    if ('$in' in expected) return expected.$in.some((value) => idString(value) === idString(actual));
    if ('$lt' in expected) {
      if (actual instanceof Date || expected.$lt instanceof Date) {
        return new Date(actual).getTime() < new Date(expected.$lt).getTime();
      }
      return idString(actual).localeCompare(idString(expected.$lt)) < 0;
    }
  }
  if (expected instanceof Date) return new Date(actual).getTime() === expected.getTime();
  if (expected === null) return actual == null;
  return idString(actual) === idString(expected);
});

class FakeQuery {
  constructor(resolve) {
    this.resolveValue = resolve;
    this.sortSpec = null;
    this.limitValue = null;
    this.cloneValue = false;
  }
  select() { return this; }
  sort(spec) { this.sortSpec = spec; return this; }
  limit(value) { this.limitValue = value; return this; }
  lean() { this.cloneValue = true; return this; }
  then(resolve, reject) {
    return Promise.resolve(typeof this.resolveValue === 'function' ? this.resolveValue() : this.resolveValue)
      .then((value) => {
        if (Array.isArray(value) && this.sortSpec) {
          const [[field, direction]] = Object.entries(this.sortSpec);
          value.sort((left, right) => {
            const leftValue = field === '_id' ? idString(left[field]) : left[field];
            const rightValue = field === '_id' ? idString(right[field]) : right[field];
            const comparison = leftValue instanceof Date || rightValue instanceof Date
              ? new Date(leftValue).getTime() - new Date(rightValue).getTime()
              : String(leftValue).localeCompare(String(rightValue));
            return comparison * direction;
          });
        }
        if (Array.isArray(value) && this.limitValue !== null) value = value.slice(0, this.limitValue);
        if (this.cloneValue) value = structuredClone(value);
        return value;
      }).then(resolve, reject);
  }
}

const createFixture = async (t, { socketUnavailable = false } = {}) => {
  const users = new Map();
  const requests = new Map();
  const messages = new Map();
  const emitted = [];
  let rateLimitOptions;

  class User {
    static findById(id) {
      return new FakeQuery(users.get(idString(id)) || null);
    }
  }

  class VanRequest {
    static findById(id) {
      return new FakeQuery(requests.get(idString(id)) || null);
    }
    static find(query) {
      return new FakeQuery(() => [...requests.values()].filter((request) => matches(request, query)));
    }
  }

  class Message {
    static create(data) {
      const message = {
        _id: new mongoose.Types.ObjectId().toString(),
        readAt: null,
        createdAt: new Date(),
        ...structuredClone(data),
      };
      messages.set(message._id, message);
      return Promise.resolve(message);
    }
    static find(query) {
      return new FakeQuery(() => [...messages.values()].filter((message) => matches(message, query)));
    }
    static findOne(query) {
      return new FakeQuery(() => [...messages.values()].find((message) => matches(message, query)) || null);
    }
    static async aggregate(pipeline) {
      const requestIds = pipeline[0].$match.requestId.$in.map(idString);
      const userId = pipeline[2].$group.unreadCount.$sum.$cond[0].$and[0].$eq[1];
      const matching = [...messages.values()]
        .filter((message) => requestIds.includes(idString(message.requestId)))
        .sort((left, right) =>
          new Date(right.createdAt) - new Date(left.createdAt) ||
          idString(right._id).localeCompare(idString(left._id))
        );
      const grouped = new Map();
      for (const message of matching) {
        const key = idString(message.requestId);
        if (!grouped.has(key)) {
          grouped.set(key, { _id: message.requestId, lastMessage: message, unreadCount: 0 });
        }
        if (idString(message.recipientId) === idString(userId) && !message.readAt) {
          grouped.get(key).unreadCount += 1;
        }
      }
      return [...grouped.values()]
        .sort((left, right) =>
          new Date(right.lastMessage.createdAt) - new Date(left.lastMessage.createdAt) ||
          idString(right.lastMessage._id).localeCompare(idString(left.lastMessage._id))
        )
        .slice(0, pipeline.at(-1).$limit);
    }
    static async updateMany(query, update) {
      let modifiedCount = 0;
      for (const message of messages.values()) {
        if (matches(message, query)) {
          Object.assign(message, structuredClone(update.$set));
          modifiedCount += 1;
        }
      }
      return { modifiedCount };
    }
  }

  const auth = loadWithDependencies('middleware/auth.js', { '../models/User': User });
  const router = loadWithDependencies('routes/messages.routes.js', {
    '../models/Message': Message,
    '../models/VanRequest': VanRequest,
    '../models/User': User,
    '../middleware/auth': auth,
    '../socket': {
      getIo: () => socketUnavailable ? null : ({
        to: (room) => ({ emit: (event, payload) => emitted.push({ room, event, payload }) }),
      }),
      buildUserRoomName: (id) => `user:${idString(id)}`,
    },
    'express-rate-limit': {
      rateLimit: (options) => {
        rateLimitOptions = options;
        return (_req, _res, next) => next();
      },
    },
  });

  const app = express();
  app.use(express.json());
  app.use('/api/messages', router);
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  t.after(async () => new Promise((resolve) => server.close(resolve)));

  const addUser = (role, fullName) => {
    const user = {
      _id: new mongoose.Types.ObjectId().toString(),
      role,
      fullName,
      status: 'approved',
      accountState: 'active',
      phone: 'not-returned',
      email: 'not-returned@example.test',
      driver: { licenseNumber: 'not-returned' },
    };
    users.set(user._id, user);
    return user;
  };
  const parent = addUser('parent', 'Parent Example');
  const driver = addUser('driver', 'Driver Example');
  const otherParent = addUser('parent', 'Other Parent');
  const otherDriver = addUser('driver', 'Other Driver');
  const admin = addUser('admin', 'Admin Example');
  const applicant = addUser('applicant', 'Applicant Example');

  const addRequest = ({ owner = parent, assignedDriver = driver, status = 'accepted' } = {}) => {
    const request = {
      _id: new mongoose.Types.ObjectId().toString(),
      parent: owner._id,
      driver: assignedDriver?._id || null,
      status,
      studentName: 'Student Example',
      schoolName: 'School Example',
    };
    requests.set(request._id, request);
    return request;
  };

  const tokenFor = (user) => jwt.sign(
    { userId: user._id },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const call = async (route, user, { method = 'GET', body } = {}) => {
    const response = await fetch(`${baseUrl}${route}`, {
      method,
      headers: {
        ...(user ? { Authorization: `Bearer ${tokenFor(user)}` } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };
  const addMessage = (request, sender, recipient, text, createdAt, readAt = null) => {
    const message = {
      _id: new mongoose.Types.ObjectId().toString(),
      requestId: request._id,
      senderId: sender._id,
      recipientId: recipient._id,
      senderRole: sender.role,
      text,
      createdAt,
      readAt,
    };
    messages.set(message._id, message);
    return message;
  };

  return {
    addMessage, addRequest, addUser, admin, applicant, call, driver, emitted, messages,
    otherDriver, otherParent, parent, rateLimitOptions: () => rateLimitOptions,
  };
};

test('parent and assigned driver can chat, page oldest-first, and emit only to participant user rooms', async (t) => {
  const f = await createFixture(t);
  const request = f.addRequest();
  const base = Date.now();
  const first = f.addMessage(request, f.parent, f.driver, 'first', new Date(base - 3000));
  const second = f.addMessage(request, f.driver, f.parent, 'second', new Date(base - 2000));
  const third = f.addMessage(request, f.parent, f.driver, 'third', new Date(base - 1000));

  const firstPage = await f.call(
    `/api/messages/threads/${request._id}/messages?limit=2`,
    f.parent
  );
  assert.equal(firstPage.status, 200);
  assert.deepEqual(firstPage.body.messages.map((message) => message.text), ['second', 'third']);
  assert.equal(firstPage.body.hasMore, true);

  const olderPage = await f.call(
    `/api/messages/threads/${request._id}/messages?limit=2&before=${second._id}`,
    f.driver
  );
  assert.equal(olderPage.status, 200);
  assert.deepEqual(olderPage.body.messages.map((message) => message.text), ['first']);
  assert.equal(olderPage.body.hasMore, false);

  const sent = await f.call(`/api/messages/threads/${request._id}/messages`, f.parent, {
    method: 'POST',
    body: {
      text: '  hello driver  ',
      senderId: f.otherParent._id,
      recipientId: f.otherDriver._id,
      senderRole: 'driver',
    },
  });
  assert.equal(sent.status, 201);
  assert.equal(sent.body.message.text, 'hello driver');
  assert.equal(sent.body.message.senderId, f.parent._id);
  assert.equal(sent.body.message.recipientId, f.driver._id);
  assert.equal(sent.body.message.senderRole, 'parent');
  assert.equal(f.emitted.length, 2);
  assert.deepEqual(f.emitted.map((entry) => entry.room).sort(), [
    `user:${f.driver._id}`,
    `user:${f.parent._id}`,
  ].sort());
  assert.ok(f.emitted.every((entry) => entry.event === 'trip:message'));
  assert.equal(f.rateLimitOptions().limit, 20);
  assert.equal(f.rateLimitOptions().windowMs, 60_000);
  assert.equal(typeof f.rateLimitOptions().keyGenerator, 'function');
  assert.equal(f.rateLimitOptions().keyGenerator({ user: f.parent }), f.parent._id);
  assert.ok(f.messages.has(first._id));
  assert.ok(f.messages.has(third._id));
});

test('saved message returns 201 when the socket is unavailable', async (t) => {
  const f = await createFixture(t, { socketUnavailable: true });
  const request = f.addRequest();

  const sent = await f.call(`/api/messages/threads/${request._id}/messages`, f.parent, {
    method: 'POST',
    body: { text: 'persisted without socket' },
  });

  assert.equal(sent.status, 201);
  assert.equal(sent.body.message.text, 'persisted without socket');
  assert.equal(f.messages.size, 1);
  assert.equal(f.emitted.length, 0);
});

test('threads show only safe names, last-message data, and per-recipient unread counts', async (t) => {
  const f = await createFixture(t);
  const request = f.addRequest();
  f.addMessage(request, f.parent, f.driver, 'for driver', new Date(Date.now() - 2000));
  f.addMessage(request, f.driver, f.parent, 'for parent', new Date(Date.now() - 1000));

  const parentThreads = await f.call('/api/messages/threads', f.parent);
  const driverThreads = await f.call('/api/messages/threads', f.driver);
  assert.equal(parentThreads.status, 200);
  assert.equal(driverThreads.status, 200);
  assert.equal(parentThreads.body.threads[0].unreadCount, 1);
  assert.equal(driverThreads.body.threads[0].unreadCount, 1);
  assert.deepEqual(parentThreads.body.threads[0].otherParty, { name: 'Driver Example', role: 'driver' });
  assert.deepEqual(driverThreads.body.threads[0].otherParty, { name: 'Parent Example', role: 'parent' });
  assert.deepEqual(Object.keys(parentThreads.body.threads[0]).sort(), [
    'lastMessage', 'otherParty', 'requestId', 'schoolName', 'status', 'studentName', 'unreadCount',
  ]);
  assert.deepEqual(Object.keys(parentThreads.body.threads[0].otherParty).sort(), ['name', 'role']);
  assert.doesNotMatch(JSON.stringify(parentThreads.body), /phone|email|license/i);

  const marked = await f.call(`/api/messages/threads/${request._id}/read`, f.parent, { method: 'PATCH' });
  assert.deepEqual(marked, { status: 200, body: { updated: 1 } });
  const refreshedParent = await f.call('/api/messages/threads', f.parent);
  const refreshedDriver = await f.call('/api/messages/threads', f.driver);
  assert.equal(refreshedParent.body.threads[0].unreadCount, 0);
  assert.equal(refreshedDriver.body.threads[0].unreadCount, 1);
});

test('nonparticipants cannot read or send, and admin/applicant/anonymous access is denied', async (t) => {
  const f = await createFixture(t);
  const request = f.addRequest();
  const read = `/api/messages/threads/${request._id}/messages`;
  const send = `/api/messages/threads/${request._id}/messages`;

  for (const user of [f.otherParent, f.otherDriver]) {
    assert.equal((await f.call(read, user)).status, 404);
    assert.equal((await f.call(send, user, { method: 'POST', body: { text: 'no access' } })).status, 404);
  }
  for (const user of [f.admin, f.applicant]) {
    assert.equal((await f.call(read, user)).status, 403);
    assert.equal((await f.call(send, user, { method: 'POST', body: { text: 'no access' } })).status, 403);
  }
  assert.equal((await f.call(read, null)).status, 401);
  assert.equal((await f.call(send, null, { method: 'POST', body: { text: 'no access' } })).status, 401);
  assert.equal((await f.call('/api/messages/threads/not-an-id/messages', f.parent)).status, 404);
  assert.equal((await f.call('/api/messages/threads/not-an-id/messages', f.parent, {
    method: 'POST',
    body: { text: 'no access' },
  })).status, 404);
});

test('message validation, no-driver trips, and trip status restrict sending but preserve old history', async (t) => {
  const f = await createFixture(t);
  const request = f.addRequest();
  const route = `/api/messages/threads/${request._id}/messages`;

  for (const text of ['', '   ', 'x'.repeat(501), 17, null]) {
    assert.equal((await f.call(route, f.parent, { method: 'POST', body: { text } })).status, 400);
  }
  assert.equal((await f.call(route, f.parent, {
    method: 'POST',
    body: { text: 'valid', senderId: 'attacker', recipientId: 'attacker', senderRole: 'driver' },
  })).status, 201);

  for (const status of ['searching', 'completed', 'cancelled']) {
    request.status = status;
    assert.equal((await f.call(route, f.parent, { method: 'POST', body: { text: 'closed' } })).status, 409);
  }
  request.status = 'completed';
  f.addMessage(request, f.driver, f.parent, 'historical', new Date());
  const historicalRead = await f.call(route, f.parent);
  assert.equal(historicalRead.status, 200);
  assert.ok(historicalRead.body.messages.some((message) => message.text === 'historical'));

  const noDriverRequest = f.addRequest({ assignedDriver: null });
  assert.equal((await f.call(`/api/messages/threads/${noDriverRequest._id}/messages`, f.parent)).status, 404);
  assert.equal((await f.call(`/api/messages/threads/${noDriverRequest._id}/messages`, f.parent, {
    method: 'POST',
    body: { text: 'not available' },
  })).status, 409);
});
