const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Module, createRequire } = require('node:module');
const { randomBytes, randomUUID } = require('node:crypto');
const express = require('express');
const jwt = require('jsonwebtoken');

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

const copy = (value) => {
  if (Array.isArray(value)) return value.map(copy);
  if (value instanceof Date) return new Date(value.getTime());
  if (Buffer.isBuffer(value)) return Buffer.from(value);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copy(item)]));
  }
  return value;
};

const matches = (record, query) => {
  if (!record) return false;
  return Object.entries(query || {}).every(([key, expected]) => {
    if (key === '$or') return expected.some((clause) => matches(record, clause));
    const actual = record[key];
    if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
      if ('$in' in expected) return expected.$in.includes(actual);
      if ('$ne' in expected) {
        return Array.isArray(actual) ? !actual.includes(expected.$ne) : actual !== expected.$ne;
      }
      if ('$gte' in expected || '$lte' in expected) {
        const actualValue = actual instanceof Date ? actual.getTime() : new Date(actual).getTime();
        if ('$gte' in expected && actualValue < new Date(expected.$gte).getTime()) return false;
        if ('$lte' in expected && actualValue > new Date(expected.$lte).getTime()) return false;
        return true;
      }
    }
    if (expected === null) return actual == null;
    return String(actual) === String(expected);
  });
};

const applyUpdate = (record, update) => {
  for (const [key, value] of Object.entries(update.$set || {})) record[key] = copy(value);
  for (const [key, value] of Object.entries(update.$addToSet || {})) {
    const values = Array.isArray(value?.$each) ? value.$each : [value];
    const current = record[key] || (record[key] = []);
    values.forEach((item) => {
      if (!current.some((existing) => String(existing) === String(item))) current.push(item);
    });
  }
  for (const [key, value] of Object.entries(update.$push || {})) {
    (record[key] || (record[key] = [])).push(copy(value));
  }
};

const createFixture = async (t) => {
  const users = new Map();
  const requests = new Map();
  const statuses = new Map();
  const vehicles = new Map();
  const driverPhotos = new Map();
  const schools = new Map();
  const emitted = [];
  const notifications = [];
  const collectionNotifications = [];
  const pickupArrivalNotifications = [];
  const schoolArrivalNotifications = [];
  const plainUser = (user) => {
    if (!user) return null;
    return {
      _id: user._id,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      ...(user.role === 'driver' ? { status: user.status, accountState: user.accountState } : {}),
      driver: copy(user.driver),
    };
  };
  const populateRequest = (request, fields) => {
    if (!request) return request;
    const result = createDoc(request, requests);
    for (const field of fields) {
      if (['parent', 'driver'].includes(field) && typeof result[field] === 'string') {
        result[field] = plainUser(users.get(result[field]));
      } else if (field === 'vehicleId' && typeof result.vehicleId === 'string') {
        const vehicle = vehicles.get(result.vehicleId);
        result.vehicleId = vehicle ? copy(vehicle) : null;
      }
    }
    return result;
  };

  class FakeQuery {
    constructor(resolve, transform = (value) => value) {
      this.resolveValue = resolve;
      this.transform = transform;
      this.populateFields = [];
      this.sortFields = null;
      this.limitCount = null;
    }
    populate(field) { this.populateFields.push(field); return this; }
    select() { return this; }
    sort(fields) { this.sortFields = fields; return this; }
    limit(count) { this.limitCount = count; return this; }
    skip() { return this; }
    then(resolve, reject) {
      return Promise.resolve(this.resolveValue).then((value) => {
        if (Array.isArray(value)) {
          let items = value;
          if (this.sortFields) {
            items = [...items].sort((left, right) => {
              for (const [field, direction] of Object.entries(this.sortFields)) {
                const comparison = new Date(left[field]).getTime() - new Date(right[field]).getTime();
                if (comparison !== 0) return comparison * direction;
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

  const createDoc = (record, store) => {
    if (!record) return null;
    const doc = copy(record);
    doc.save = async () => {
      const stored = copy(doc);
      for (const field of ['parent', 'driver', 'vehicleId']) {
        if (stored[field] && typeof stored[field] === 'object') {
          stored[field] = stored[field]._id;
        }
      }
      store.set(String(doc._id), stored);
      return doc;
    };
    return doc;
  };

  class User {
    constructor(data) {
      Object.assign(this, {
        _id: randomBytes(12).toString('hex'),
        notifications: [],
        accountState: 'active',
      }, data);
    }
    async save() { users.set(String(this._id), this); return this; }
    getStudentList() {
      if (this.students?.length) return this.students;
      return this.student?.fullName ? [this.student] : [];
    }
    select() { return Promise.resolve(this); }
    static findById(id) {
      return new FakeQuery(users.get(String(id)) || null, (user) => user);
    }
    static findOne(query) {
      return new FakeQuery([...users.values()].find((user) => matches(user, query)) || null, (user) => user);
    }
    static find(query) {
      return new FakeQuery([...users.values()].filter((user) => matches(user, query)), (user) => user);
    }
    static async updateOne(query, update) {
      const user = [...users.values()].find((candidate) => matches(candidate, query));
      if (user) applyUpdate(user, update);
      return { matchedCount: user ? 1 : 0 };
    }
  }

  class Notification {
    static find(query) {
      return new FakeQuery(collectionNotifications.filter((notification) => matches(notification, query)));
    }
    static findOne(query) {
      return new FakeQuery(collectionNotifications.find((notification) => matches(notification, query)) || null);
    }
    static async countDocuments(query) {
      return collectionNotifications.filter((notification) => matches(notification, query)).length;
    }
    static async deleteOne(query) {
      const index = collectionNotifications.findIndex((notification) => matches(notification, query));
      if (index === -1) return { deletedCount: 0 };
      collectionNotifications.splice(index, 1);
      return { deletedCount: 1 };
    }
    static async deleteMany(query) {
      const initialLength = collectionNotifications.length;
      for (let index = collectionNotifications.length - 1; index >= 0; index -= 1) {
        if (matches(collectionNotifications[index], query)) collectionNotifications.splice(index, 1);
      }
      return { deletedCount: initialLength - collectionNotifications.length };
    }
  }

  class DriverPhoto {
    static findOne(query) {
      return new FakeQuery(driverPhotos.get(String(query.userId)) || null);
    }
    static async findOneAndUpdate(query, update) {
      const photo = { userId: String(query.userId), ...copy(update.$set) };
      driverPhotos.set(String(query.userId), photo);
      return photo;
    }
    static async deleteOne(query) {
      driverPhotos.delete(String(query.userId));
      return { deletedCount: 1 };
    }
  }

  class School {
    static async findOne(query) {
      return [...schools.values()].find((school) =>
        school.active === query.active && query.name.test(school.name)
      ) || null;
    }
  }

  class VanRequest {
    static async create(data) {
      const record = {
        _id: randomBytes(12).toString('hex'),
        rejectedBy: [],
        students: [],
        seatsNeeded: 1,
        liveLocation: null,
        vehicleId: null,
        driver: null,
        status: 'searching',
        createdAt: new Date(),
        ...copy(data),
      };
      requests.set(String(record._id), record);
      return createDoc(record, requests);
    }
    static findById(id) {
      return new FakeQuery(requests.get(String(id)) || null, populateRequest);
    }
    static findOne(query) {
      const result = [...requests.values()].find((record) => matches(record, query)) || null;
      return new FakeQuery(result, populateRequest);
    }
    static find(query) {
      const result = [...requests.values()].filter((record) => matches(record, query));
      return new FakeQuery(result, populateRequest);
    }
    static async populate(records) {
      return records;
    }
    static findOneAndUpdate(query, update) {
      const record = [...requests.values()].find((item) => matches(item, query));
      if (record) applyUpdate(record, update);
      return new FakeQuery(record, populateRequest);
    }
    static async exists(query) {
      return [...requests.values()].some((record) => matches(record, query)) ? { _id: true } : null;
    }
  }

  class DriverStatus {
    constructor(data) {
      Object.assign(this, { _id: randomBytes(12).toString('hex'), isOnline: false, status: 'offline', activeRequestId: null }, data);
    }
    async save() { statuses.set(String(this.driverId), this); return this; }
    static findOne(query) {
      return new FakeQuery([...statuses.values()].find((status) => matches(status, query)) || null);
    }
    static async findOneAndUpdate(query, update) {
      const status = [...statuses.values()].find((item) => matches(item, query));
      if (!status) return null;
      applyUpdate(status, update);
      return status;
    }
  }

  class Vehicle {
    static async findOne(query) {
      return new FakeQuery([...vehicles.values()].find((vehicle) => matches(vehicle, query)) || null);
    }
    static async findOneAndUpdate(query, update) {
      const vehicle = [...vehicles.values()].find((item) => matches(item, query));
      if (!vehicle) return null;
      applyUpdate(vehicle, update);
      return vehicle;
    }
  }

  class DriverLocation {
    constructor(data) { Object.assign(this, data); }
    async save() { return this; }
  }

  class DriverStats {
    constructor(data) { Object.assign(this, data); }
    async save() { return this; }
    static findOne() { return Promise.resolve(null); }
  }

  const socket = {
    to(room) {
      return { emit: (event, payload) => emitted.push({ room, event, payload }) };
    },
    emit: (event, payload) => emitted.push({ room: 'all', event, payload }),
  };
  const driverService = loadWithDependencies('services/driverService.js', {
    '../models/DriverStatus': DriverStatus,
    '../models/DriverLocation': DriverLocation,
    '../models/DriverStats': DriverStats,
    '../models/VanRequest': VanRequest,
    '../models/User': User,
    '../socket': {
      getIo: () => socket,
      buildTripRoomName: (id) => `trip:${String(id)}`,
      buildUserRoomName: (id) => `user:${String(id)}`,
    },
  });
  const releaseVanRequestAssignment = loadWithDependencies('services/releaseVanRequestAssignment.js', {
    '../models/DriverStatus': DriverStatus,
    '../models/Vehicle': Vehicle,
    '../models/VanRequest': VanRequest,
  });
  const driverEligibility = loadWithDependencies('services/driverEligibility.js', {
    '../models/User': User,
    '../models/DriverStatus': DriverStatus,
    '../models/Vehicle': Vehicle,
    '../models/VanRequest': VanRequest,
  });
  const identity = { verifyRegistrationIdentity: async () => { throw new Error('Registration is not part of this test.'); } };
  const noOpNotification = async (...args) => { notifications.push(args); };
  const saveArrivalNotification = (parentId, requestId, type, title, message) => {
    collectionNotifications.push({
      _id: randomBytes(12).toString('hex'),
      userId: String(parentId),
      requestId: String(requestId),
      type,
      title,
      message,
      read: false,
      createdAt: new Date(),
      async save() { return this; },
    });
  };
  const saveAcceptedNotification = async (
    parentId,
    requestId,
    driverId,
    driverName,
    driverPhone,
    plateNumber,
    vehicleType,
    studentName,
    schoolName
  ) => {
    collectionNotifications.push({
      _id: randomBytes(12).toString('hex'),
      userId: String(parentId),
      requestId: String(requestId),
      type: 'accepted',
      metadata: { driverName, driverPhone, plateNumber, vehicleType, studentName, schoolName },
      read: false,
      createdAt: new Date(),
      async save() { return this; },
    });
  };
  const routeDependencies = {
    '../models/User': User,
    '../models/DriverPhoto': DriverPhoto,
    '../models/School': School,
    '../models/Notification': Notification,
    '../models/VanRequest': VanRequest,
    '../models/Vehicle': Vehicle,
    '../models/DriverStatus': DriverStatus,
    '../models/DriverStats': DriverStats,
    '../models/DriverLocation': DriverLocation,
    '../middleware/auth': loadWithDependencies('middleware/auth.js', { '../models/User': User }),
    '../utils/firebaseIdentity': identity,
    '../utils/pushNotifications': { sendPushToUserIds: async () => {} },
    '../socket': {
      getIo: () => socket,
      buildTripRoomName: (id) => `trip:${String(id)}`,
      buildUserRoomName: (id) => `user:${String(id)}`,
    },
    '../services/notificationService': {
      notifyParentSearching: noOpNotification,
      notifyParentDriverAccepted: saveAcceptedNotification,
      notifyParentOnTheWay: noOpNotification,
      notifyParentArrivalAtPickup: async (...args) => {
        pickupArrivalNotifications.push(args);
        saveArrivalNotification(args[0], args[1], 'arrived_pickup', '📍 Driver Has Arrived', `${args[2]} is now at your pickup location.`);
      },
      notifyParentStudentPickedUp: noOpNotification,
      notifyParentHeadingToSchool: noOpNotification,
      notifyParentArrivedAtSchool: async (...args) => {
        schoolArrivalNotifications.push(args);
        saveArrivalNotification(args[0], args[1], 'arrived_school', '✅ Arrived At School', `Your child has safely arrived at ${args[4]}.`);
      },
      clearNotificationsForRequest: noOpNotification,
    },
    '../services/driverService': driverService,
    '../services/releaseVanRequestAssignment': releaseVanRequestAssignment,
    '../services/driverEligibility': driverEligibility,
  };

  const app = express();
  app.use(express.json());
  app.use('/api/parents', loadWithDependencies('routes/parent.routes.js', routeDependencies));
  app.use('/api/drivers', loadWithDependencies('routes/driver.routes.js', routeDependencies));
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  t.after(async () => new Promise((resolve) => server.close(resolve)));

  const parent = await new User({
    role: 'parent',
    status: 'approved',
    fullName: 'Parent One',
    email: 'parent@example.test',
    student: { pickupLatitude: 14.7118, pickupLongitude: 121.0679 },
  }).save();
  const driverOne = await new User({
    role: 'driver', status: 'approved', fullName: 'Driver One', email: 'driver1@example.test',
    driver: { vehicleType: 'van', plateNumber: 'ONE-123' },
  }).save();
  const driverTwo = await new User({
    role: 'driver', status: 'approved', fullName: 'Driver Two', email: 'driver2@example.test',
    driver: { vehicleType: 'mpv', plateNumber: 'TWO-123' },
  }).save();
  const addSchool = (name, active = true) => {
    const school = { _id: randomBytes(12).toString('hex'), name, active };
    schools.set(String(school._id), school);
    return school;
  };
  const addVehicle = (driver, plateNumber) => {
    driverEligibility.SERVICE_ZONE_CONFIG.vehicleZonesByPlate[plateNumber] = 'FAIRVIEW';
    const vehicle = {
      _id: randomBytes(12).toString('hex'),
      assignedDriver: driver._id,
      plateNumber,
      vehicleType: 'van',
      seatCapacity: 10,
      status: 'available',
      isAvailable: true,
    };
    vehicles.set(String(vehicle._id), vehicle);
    return vehicle;
  };
  const tokenFor = (user) => jwt.sign(
    { userId: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const request = async (route, user, { method = 'GET', body, responseType = 'json' } = {}) => {
    const response = await fetch(`${baseUrl}${route}`, {
      method,
      headers: {
        Authorization: `Bearer ${tokenFor(user)}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const responseBody = responseType === 'arrayBuffer'
      ? Buffer.from(await response.arrayBuffer())
      : await response.json();
    return {
      status: response.status,
      body: responseBody,
      contentType: response.headers.get('content-type'),
      cacheControl: response.headers.get('cache-control'),
      nosniff: response.headers.get('x-content-type-options'),
    };
  };

  return { parent, driverOne, driverTwo, User, users, requests, statuses, vehicles, schools, driverPhotos, driverEligibility, emitted, notifications, collectionNotifications, pickupArrivalNotifications, schoolArrivalNotifications, addSchool, addVehicle, request, baseUrl };
};

const createRequest = (fixture, data = {}) => fixture.request('/api/parents/van-requests', fixture.parent, {
  method: 'POST',
  body: {
    studentName: 'Student One',
    pickupZone: '12 Example Street',
    schoolName: 'Example School',
    destinationLocation: { latitude: 14.6, longitude: 121.0 },
    ...data,
  },
});

const createNotification = (user, overrides = {}) => ({
  _id: randomBytes(12).toString('hex'),
  userId: user._id,
  type: 'on_the_way',
  title: 'Trip update',
  message: 'A trip update is available.',
  read: false,
  createdAt: new Date(),
  ...overrides,
});

const setOnline = async (fixture, driver) => fixture.request('/api/drivers/status/toggle', driver, {
  method: 'PATCH',
  body: { isOnline: true },
});

test('Parent request creation, live updates, vehicle assignment, and completion use VanRequest', async (t) => {
  const f = await createFixture(t);
  const invalidDestination = await createRequest(f, {
    destinationLocation: { latitude: 100, longitude: 121 },
  });
  assert.equal(invalidDestination.status, 400);

  const create = await createRequest(f);
  assert.equal(create.status, 201);
  assert.equal(create.body.request.studentName, 'Student One');
  assert.equal(create.body.request.seatsNeeded, 1);
  const requestId = create.body.request._id;
  assert.deepEqual(create.body.request.destinationLocation, { latitude: 14.6, longitude: 121.0, updatedAt: create.body.request.destinationLocation.updatedAt });

  const parentList = await f.request('/api/parents/van-requests', f.parent);
  assert.equal(parentList.status, 200);
  assert.equal(parentList.body.requests[0]._id, requestId);

  f.addVehicle(f.driverOne, 'ONE-123');
  f.addVehicle(f.driverTwo, 'TWO-123');
  const offlineAttempt = await f.request(`/api/drivers/requests/${requestId}/accept`, f.driverOne, { method: 'PATCH' });
  assert.equal(offlineAttempt.status, 409);

  await Promise.all([setOnline(f, f.driverOne), setOnline(f, f.driverTwo)]);
  const acceptResults = await Promise.all([
    f.request(`/api/drivers/requests/${requestId}/accept`, f.driverOne, { method: 'PATCH' }),
    f.request(`/api/drivers/requests/${requestId}/accept`, f.driverTwo, { method: 'PATCH' }),
  ]);
  assert.deepEqual(acceptResults.map((result) => result.status).sort(), [200, 409]);

  const winningResult = acceptResults.find((result) => result.status === 200);
  const assignedDriverId = String(winningResult.body.request.driver._id);
  const assignedVehicleId = String(winningResult.body.request.vehicleId._id);
  assert.equal(winningResult.body.request.status, 'accepted');
  const acceptedNotification = f.collectionNotifications.find(
    (notification) => notification.type === 'accepted' && notification.requestId === requestId
  );
  assert.ok(acceptedNotification);
  assert.equal(
    acceptedNotification.metadata.plateNumber,
    f.vehicles.get(assignedVehicleId).plateNumber
  );
  const offlineWhileBusy = await f.request('/api/drivers/status/toggle', assignedDriverId === f.driverOne._id ? f.driverOne : f.driverTwo, {
    method: 'PATCH',
    body: { isOnline: false },
  });
  assert.equal(offlineWhileBusy.status, 409);
  assert.equal(f.vehicles.get(assignedVehicleId).status, 'assigned');
  assert.ok(f.emitted.some((event) => event.room === `user:${f.parent._id}` && event.event === 'trip:request-updated'));

  const location = await f.request(`/api/drivers/requests/${requestId}/location`, assignedDriverId === f.driverOne._id ? f.driverOne : f.driverTwo, {
    method: 'PATCH',
    body: { latitude: 14.7128, longitude: 121.0689 },
  });
  assert.equal(location.status, 200);
  assert.ok(f.emitted.some((event) => event.room === `user:${f.parent._id}` && event.event === 'trip:location-updated'));

  const assignedDriver = assignedDriverId === f.driverOne._id ? f.driverOne : f.driverTwo;
  const arrived = await f.request(`/api/drivers/requests/${requestId}/arrived`, assignedDriver, { method: 'PATCH' });
  assert.equal(arrived.status, 200);
  assert.equal(arrived.body.request.status, 'arrived');
  assert.equal(f.pickupArrivalNotifications.length, 1);
  for (const room of [`trip:${requestId}`, `user:${f.parent._id}`, `user:${assignedDriverId}`]) {
    assert.ok(f.emitted.some((event) =>
      event.room === room &&
      event.event === 'trip:request-updated' &&
      event.payload.request.status === 'arrived'
    ));
  }
  const repeatedArrival = await f.request(`/api/drivers/requests/${requestId}/arrived`, assignedDriver, { method: 'PATCH' });
  assert.equal(repeatedArrival.status, 409);
  assert.equal(f.pickupArrivalNotifications.length, 1);

  const pickedUp = await f.request(`/api/drivers/requests/${requestId}/picked-up`, assignedDriver, {
    method: 'PATCH',
  });
  assert.equal(pickedUp.status, 200);
  assert.equal(pickedUp.body.request.status, 'picked_up');

  const nearSchoolLocation = await f.request(`/api/drivers/requests/${requestId}/location`, assignedDriver, {
    method: 'PATCH',
    body: { latitude: 14.6001, longitude: 121.0 },
  });
  assert.equal(nearSchoolLocation.status, 200);
  assert.equal(nearSchoolLocation.body.request.status, 'picked_up');
  assert.equal(f.schoolArrivalNotifications.length, 0);
  assert.ok(f.emitted.some((event) =>
    event.room === `user:${f.parent._id}` &&
    event.event === 'trip:location-updated' &&
    event.payload.status === 'picked_up'
  ));

  const arrivedAtSchool = await f.request(`/api/drivers/requests/${requestId}/arrived-at-school`, assignedDriver, {
    method: 'PATCH',
  });
  assert.equal(arrivedAtSchool.status, 200);
  assert.equal(arrivedAtSchool.body.requests[0].status, 'arrived_at_school');
  assert.equal(f.schoolArrivalNotifications.length, 1);
  for (const room of [`trip:${requestId}`, `user:${f.parent._id}`, `user:${assignedDriverId}`]) {
    assert.ok(f.emitted.some((event) =>
      event.room === room &&
      event.event === 'trip:request-updated' &&
      event.payload.request.status === 'arrived_at_school'
    ));
  }
  const repeatedSchoolArrival = await f.request(`/api/drivers/requests/${requestId}/arrived-at-school`, assignedDriver, {
    method: 'PATCH',
  });
  assert.equal(repeatedSchoolArrival.status, 409);
  assert.equal(f.schoolArrivalNotifications.length, 1);

  const parentNotifications = await f.request('/api/parents/notifications', f.parent);
  assert.equal(parentNotifications.status, 200);
  assert.equal(
    parentNotifications.body.notifications.filter((notification) => notification.type === 'arrived_pickup').length,
    1
  );
  assert.equal(
    parentNotifications.body.notifications.filter((notification) => notification.type === 'arrived_school').length,
    1
  );
  const pickupNotification = parentNotifications.body.notifications.find(
    (notification) => notification.type === 'arrived_pickup'
  );
  const schoolNotification = parentNotifications.body.notifications.find(
    (notification) => notification.type === 'arrived_school'
  );
  assert.equal((await f.request(`/api/parents/notifications/${pickupNotification._id}/read`, f.parent, {
    method: 'PATCH',
  })).status, 200);
  assert.equal((await f.request(`/api/parents/notifications/${schoolNotification._id}/read`, f.parent, {
    method: 'PATCH',
  })).status, 200);
  const notificationsAfterRead = await f.request('/api/parents/notifications', f.parent);
  assert.equal(
    notificationsAfterRead.body.notifications.filter(
      (notification) => ['arrived_pickup', 'arrived_school'].includes(notification.type) && !notification.read
    ).length,
    0
  );

  const completed = await f.request('/api/drivers/requests/complete-school-run', assignedDriver, {
    method: 'PATCH',
  });
  assert.equal(completed.status, 200);
  assert.ok(completed.body.completedRequestIds.includes(requestId));
  assert.equal(f.vehicles.get(assignedVehicleId).status, 'available');
  assert.equal(f.statuses.get(assignedDriverId).activeRequestId, null);
  assert.ok(f.emitted.some((event) => event.room === `user:${f.parent._id}` && event.event === 'trip:completed'));
});

test('parent can book multiple saved children attending the same school in one request', async (t) => {
  const f = await createFixture(t);
  f.parent.students = [
    {
      fullName: ' First Child ',
      gradeLevel: 'Grade 3 - A',
      schoolName: 'La Concepcion College',
      schoolLatitude: 14.81286,
      schoolLongitude: 121.07172,
    },
    {
      fullName: 'Second Child',
      gradeLevel: 'Grade 5 - B',
      schoolName: 'La Concepcion College',
      schoolLatitude: 14.81286,
      schoolLongitude: 121.07172,
    },
  ];

  const created = await createRequest(f, {
    studentNames: [' first child ', 'SECOND CHILD'],
    schoolName: 'Untrusted School',
    destinationLocation: { latitude: 0, longitude: 0 },
  });

  assert.equal(created.status, 201);
  assert.equal(created.body.request.studentName, 'First Child, Second Child');
  assert.equal(created.body.request.gradeSection, 'Grade 3 - A');
  assert.equal(created.body.request.schoolName, 'La Concepcion College');
  assert.equal(created.body.request.seatsNeeded, 2);
  assert.deepEqual(created.body.request.students, [
    { studentName: 'First Child', gradeLevel: 'Grade 3 - A' },
    { studentName: 'Second Child', gradeLevel: 'Grade 5 - B' },
  ]);
  assert.equal(created.body.request.destinationLocation.latitude, 14.81286);
  assert.equal(created.body.request.destinationLocation.longitude, 121.07172);

  f.addVehicle(f.driverOne, 'ONE-MULTI');
  await setOnline(f, f.driverOne);
  const driverRequests = await f.request('/api/drivers/requests', f.driverOne);
  const listedRequest = driverRequests.body.requests.find((request) => request._id === created.body.request._id);
  assert.deepEqual(listedRequest.students, [
    { studentName: 'First Child', gradeLevel: 'Grade 3 - A' },
    { studentName: 'Second Child', gradeLevel: 'Grade 5 - B' },
  ]);
});

test('parent cannot book selected children from different schools together', async (t) => {
  const f = await createFixture(t);
  f.parent.students = [
    { fullName: 'First Child', gradeLevel: 'Grade 3', schoolName: 'School One' },
    { fullName: 'Second Child', gradeLevel: 'Grade 4', schoolName: 'School Two' },
  ];

  const result = await createRequest(f, { studentNames: ['First Child', 'Second Child'] });
  assert.equal(result.status, 400);
  assert.equal(result.body.message, 'Selected children attend different schools. Please book them separately.');
});

test('parent cannot book a name that is not in their saved student list', async (t) => {
  const f = await createFixture(t);
  f.parent.students = [
    { fullName: 'First Child', gradeLevel: 'Grade 3', schoolName: 'School One' },
  ];

  const result = await createRequest(f, { studentNames: ['Someone Else'] });
  assert.equal(result.status, 400);
  assert.equal(result.body.message, 'One or more selected children do not belong to your account.');
});

test('school requests are visible and acceptable only to a driver assigned to that school', async (t) => {
  const f = await createFixture(t);
  const school = f.addSchool('La Concepcion College');
  const otherSchool = f.addSchool('Other School');
  f.driverOne.driver.assignedSchools = [school._id];
  f.driverTwo.driver.assignedSchools = [otherSchool._id];

  const created = await createRequest(f, { schoolName: 'la concepcion college' });
  assert.equal(created.status, 201);
  assert.equal(created.body.request.school, school._id);

  f.addVehicle(f.driverOne, 'ONE-SCHOOL');
  f.addVehicle(f.driverTwo, 'TWO-SCHOOL');
  f.driverEligibility.SERVICE_ZONE_CONFIG.vehicleZonesByPlate['ONE-SCHOOL'] = 'LCC';
  await Promise.all([setOnline(f, f.driverOne), setOnline(f, f.driverTwo)]);

  const assignedRequests = await f.request('/api/drivers/requests', f.driverOne);
  const otherRequests = await f.request('/api/drivers/requests', f.driverTwo);
  assert.ok(assignedRequests.body.requests.some((request) => request._id === created.body.request._id));
  assert.equal(otherRequests.body.requests.some((request) => request._id === created.body.request._id), false);

  const otherAccept = await f.request(`/api/drivers/requests/${created.body.request._id}/accept`, f.driverTwo, {
    method: 'PATCH',
  });
  assert.equal(otherAccept.status, 409);
  assert.equal(otherAccept.body.message, 'You are not assigned to this school.');

  const assignedAccept = await f.request(`/api/drivers/requests/${created.body.request._id}/accept`, f.driverOne, {
    method: 'PATCH',
  });
  assert.equal(assignedAccept.status, 200);
});

test('driver with no school assignments cannot see school requests', async (t) => {
  const f = await createFixture(t);
  const school = f.addSchool('La Concepcion College');
  f.driverTwo.driver.assignedSchools = [school._id];

  const created = await createRequest(f, { schoolName: 'La Concepcion College' });
  assert.equal(created.status, 201);

  f.addVehicle(f.driverOne, 'ONE-UNASSIGNED');
  await setOnline(f, f.driverOne);
  const requests = await f.request('/api/drivers/requests', f.driverOne);
  assert.equal(requests.body.requests.some((request) => request._id === created.body.request._id), false);
});

test('booking for a catalog school without an assigned active driver is rejected', async (t) => {
  const f = await createFixture(t);
  f.addSchool('La Concepcion College');

  const result = await createRequest(f, { schoolName: 'La Concepcion College' });
  assert.equal(result.status, 409);
  assert.equal(result.body.message, 'No driver is assigned to this school yet.');
});

test('school booking keeps the all-zone pickup check', async (t) => {
  const f = await createFixture(t);
  const school = f.addSchool('La Concepcion College');
  f.driverOne.driver.assignedSchools = [school._id];
  f.parent.student.pickupLatitude = 14.65;
  f.parent.student.pickupLongitude = 120.983;

  const result = await createRequest(f, { schoolName: 'La Concepcion College' });
  assert.equal(result.status, 400);
  assert.equal(result.body.message, 'Outside our service area');
});

test('requests without a catalog school keep the vehicle-zone rule', async (t) => {
  const f = await createFixture(t);
  const created = await createRequest(f, { schoolName: 'Unlisted School' });
  assert.equal(created.status, 201);
  assert.equal(created.body.request.school, null);

  f.addVehicle(f.driverOne, 'ONE-LEGACY');
  f.addVehicle(f.driverTwo, 'TWO-LEGACY');
  f.driverEligibility.SERVICE_ZONE_CONFIG.vehicleZonesByPlate['ONE-LEGACY'] = 'LCC';
  await Promise.all([setOnline(f, f.driverOne), setOnline(f, f.driverTwo)]);

  const lccRequests = await f.request('/api/drivers/requests', f.driverOne);
  const fairviewRequests = await f.request('/api/drivers/requests', f.driverTwo);
  assert.equal(lccRequests.body.requests.some((request) => request._id === created.body.request._id), false);
  assert.ok(fairviewRequests.body.requests.some((request) => request._id === created.body.request._id));

  const wrongZoneAccept = await f.request(`/api/drivers/requests/${created.body.request._id}/accept`, f.driverOne, {
    method: 'PATCH',
  });
  assert.equal(wrongZoneAccept.status, 409);
  assert.equal(wrongZoneAccept.body.message, 'This pickup is outside your service zone.');
  const correctZoneAccept = await f.request(`/api/drivers/requests/${created.body.request._id}/accept`, f.driverTwo, {
    method: 'PATCH',
  });
  assert.equal(correctZoneAccept.status, 200);
});

test('driver profile ignores client-sent assignedSchools', async (t) => {
  const f = await createFixture(t);
  const assignedSchool = f.addSchool('Assigned School');
  f.driverOne.driver.assignedSchools = [assignedSchool._id];
  const existingDriverData = { ...f.driverOne.driver };
  f.driverOne.driver.toObject = () => existingDriverData;

  const result = await f.request('/api/drivers/profile', f.driverOne, {
    method: 'PATCH',
    body: {
      assignedSchools: [randomBytes(12).toString('hex')],
      vehicleType: 'Updated Van',
    },
  });

  assert.equal(result.status, 200);
  assert.deepEqual(f.driverOne.driver.assignedSchools, [assignedSchool._id]);
});

test('parent responses, trip events, and notifications exclude private driver fields', async (t) => {
  const f = await createFixture(t);
  const canaries = [
    'PRIVATE_LICENSE_CANARY',
    'PRIVATE_BIRTHDATE_CANARY',
    'PRIVATE_ADDRESS_CANARY',
    'PRIVATE_EMAIL_CANARY',
    'PRIVATE_DOCUMENT_CANARY',
    'PRIVATE_IMAGE_CANARY',
    'PHOTO_BUFFER_CANARY',
  ];
  const rawExpiry = '2099-07-15T00:00:00.000Z';
  f.driverOne.phone = '5550100100';
  f.driverOne.email = canaries[3];
  f.driverOne.homeAddress = canaries[2];
  f.driverOne.status = 'approved';
  f.driverOne.accountState = 'active';
  f.driverOne.driver = {
    licenseNumber: canaries[0],
    dateOfBirth: canaries[1],
    licenseExpirationDate: rawExpiry,
    photoUpdatedAt: new Date('2026-03-01T00:00:00.000Z'),
    vehicleType: 'Van',
    plateNumber: 'TEST-PLATE',
    documents: {
      licenseFront: { originalName: canaries[4], path: canaries[5] },
      licenseBack: { originalName: canaries[4], path: canaries[5] },
    },
  };
  f.driverOne.validId = { originalName: canaries[4] };

  const created = await createRequest(f);
  f.addVehicle(f.driverOne, 'ONE-PUBLIC');
  await setOnline(f, f.driverOne);
  const accepted = await f.request(`/api/drivers/requests/${created.body.request._id}/accept`, f.driverOne, {
    method: 'PATCH',
  });
  assert.equal(accepted.status, 200);
  const privatePhotoBytes = Buffer.from('PHOTO_BUFFER_CANARY');
  f.driverPhotos.set(String(f.driverOne._id), {
    data: privatePhotoBytes,
    contentType: 'image/png',
    size: privatePhotoBytes.length,
  });

  const parentRequests = await f.request('/api/parents/van-requests', f.parent);
  assert.equal(parentRequests.status, 200);
  const safeRequest = parentRequests.body.requests.find((request) => request._id === created.body.request._id);
  assert.ok(safeRequest);
  assert.deepEqual(Object.keys(safeRequest.driverProfile).sort(), [
    'licenseValidUntil',
    'name',
    'phone',
    'photoVersion',
    'plateNumber',
    'vehicleType',
    'verified',
  ]);
  assert.equal(safeRequest.driverProfile.licenseValidUntil, '2099-07');
  assert.equal(safeRequest.driverProfile.photoVersion, new Date('2026-03-01T00:00:00.000Z').getTime());
  assert.equal(safeRequest.driverProfile.verified, true);
  assert.deepEqual(Object.keys(safeRequest.driver).sort(), ['_id', 'driver', 'fullName', 'phone']);
  assert.deepEqual(Object.keys(safeRequest.driver.driver).sort(), ['plateNumber', 'vehicleType']);

  const parentAndTripEvents = f.emitted.filter((event) =>
    event.event === 'trip:request-updated' &&
    [ `user:${f.parent._id}`, `trip:${created.body.request._id}` ].includes(event.room)
  );
  assert.ok(parentAndTripEvents.length > 0);
  for (const { payload } of parentAndTripEvents) {
    if (!payload.request?.driver) continue;
    assert.deepEqual(Object.keys(payload.request.driverProfile).sort(), [
      'licenseValidUntil',
      'name',
      'phone',
      'photoVersion',
      'plateNumber',
      'vehicleType',
      'verified',
    ]);
  }
  const parentNotifications = await f.request('/api/parents/notifications', f.parent);
  const acceptedNotification = parentNotifications.body.notifications.find((notification) => notification.type === 'accepted');
  assert.ok(acceptedNotification);
  assert.equal(Object.hasOwn(acceptedNotification.metadata, 'driverId'), false);
  const payloads = [
    parentRequests.body,
    parentAndTripEvents,
    parentNotifications.body.notifications,
  ];
  const serializedPayloads = JSON.stringify(payloads);
  canaries.forEach((canary, index) => {
    assert.equal(serializedPayloads.includes(canary), false, `private-field canary ${index} leaked`);
  });
  assert.equal(serializedPayloads.includes(rawExpiry), false);
  assert.equal(serializedPayloads.includes('"type":"Buffer"'), false);
  assert.equal(serializedPayloads.includes('accountState'), false);
});

test('driver photos are readable only by the trip parent or that driver', async (t) => {
  const f = await createFixture(t);
  const created = await createRequest(f);
  f.addVehicle(f.driverOne, 'ONE-PHOTO');
  await setOnline(f, f.driverOne);
  const accepted = await f.request(`/api/drivers/requests/${created.body.request._id}/accept`, f.driverOne, {
    method: 'PATCH',
  });
  assert.equal(accepted.status, 200);

  const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01]);
  f.driverPhotos.set(String(f.driverOne._id), {
    data: bytes,
    contentType: 'image/png',
    size: bytes.length,
  });

  const parentPhoto = await f.request(
    `/api/parents/van-requests/${created.body.request._id}/driver-photo`,
    f.parent,
    { responseType: 'arrayBuffer' }
  );
  assert.equal(parentPhoto.status, 200);
  assert.deepEqual(parentPhoto.body, bytes);
  assert.equal(parentPhoto.contentType, 'image/png');
  assert.equal(parentPhoto.cacheControl, 'private, max-age=300');
  assert.equal(parentPhoto.nosniff, 'nosniff');

  const secondParent = await new f.User({
    role: 'parent',
    status: 'approved',
    fullName: 'Parent Two',
    email: 'parent2@example.test',
    student: { pickupLatitude: 14.7118, pickupLongitude: 121.0679 },
  }).save();
  const forbiddenPhoto = await f.request(
    `/api/parents/van-requests/${created.body.request._id}/driver-photo`,
    secondParent,
    { responseType: 'arrayBuffer' }
  );
  assert.equal(forbiddenPhoto.status, 404);

  const noDriverRequest = await f.request('/api/parents/van-requests', secondParent, {
    method: 'POST',
    body: {
      studentName: 'Student Two',
      pickupZone: 'Second pickup',
      schoolName: 'Example School',
    },
  });
  assert.equal(noDriverRequest.status, 201);
  const noDriverRequestId = noDriverRequest.body.request._id;
  const noDriverPhoto = await f.request(
    `/api/parents/van-requests/${noDriverRequestId}/driver-photo`,
    secondParent,
    { responseType: 'arrayBuffer' }
  );
  assert.equal(noDriverPhoto.status, 404);

  const ownPhoto = await f.request('/api/drivers/me/photo', f.driverOne, { responseType: 'arrayBuffer' });
  assert.equal(ownPhoto.status, 200);
  assert.deepEqual(ownPhoto.body, bytes);
  const anotherDriversPhoto = await f.request('/api/drivers/me/photo', f.driverTwo, { responseType: 'arrayBuffer' });
  assert.equal(anotherDriversPhoto.status, 404);

  const unauthenticated = await fetch(
    `${f.baseUrl}/api/parents/van-requests/${created.body.request._id}/driver-photo`
  );
  assert.equal(unauthenticated.status, 401);
});

test('parent driver-photo route returns 404 for an invalid request id', async (t) => {
  const f = await createFixture(t);
  const response = await f.request('/api/parents/van-requests/not-an-id/driver-photo', f.parent);

  assert.equal(response.status, 404);
  assert.deepEqual(response.body, { message: 'Driver photo not found.' });
});

test('parent must select a non-empty unique list of saved children', async (t) => {
  const f = await createFixture(t);
  f.parent.students = [
    { fullName: 'First Child', gradeLevel: 'Grade 3', schoolName: 'School One' },
  ];

  const emptySelection = await createRequest(f, { studentNames: [] });
  assert.equal(emptySelection.status, 400);

  const duplicateSelection = await createRequest(f, { studentNames: ['First Child', ' first child '] });
  assert.equal(duplicateSelection.status, 400);
  assert.equal(duplicateSelection.body.message, 'Selected children must be unique.');
});

test('parent can delete an embedded notification', async (t) => {
  const f = await createFixture(t);
  const notification = createNotification(f.parent);
  f.parent.notifications.push(notification);
  await f.parent.save();

  const deleted = await f.request(`/api/parents/notifications/${notification._id}`, f.parent, {
    method: 'DELETE',
  });
  assert.equal(deleted.status, 200);
  assert.equal(f.parent.notifications.some((item) => item._id === notification._id), false);
});

test('parent can delete a collection notification', async (t) => {
  const f = await createFixture(t);
  const notification = createNotification(f.parent);
  f.collectionNotifications.push(notification);

  const deleted = await f.request(`/api/parents/notifications/${notification._id}`, f.parent, {
    method: 'DELETE',
  });
  assert.equal(deleted.status, 200);
  assert.equal(f.collectionNotifications.some((item) => item._id === notification._id), false);
});

test('parent cannot delete another parent notification', async (t) => {
  const f = await createFixture(t);
  const otherParent = await new f.User({
    role: 'parent',
    status: 'approved',
    fullName: 'Parent Two',
    notifications: [],
  }).save();
  const notification = createNotification(otherParent);
  f.collectionNotifications.push(notification);

  const response = await f.request(`/api/parents/notifications/${notification._id}`, f.parent, {
    method: 'DELETE',
  });
  assert.equal(response.status, 404);
  assert.equal(f.collectionNotifications.some((item) => item._id === notification._id), true);
});

test('clearing notifications removes both stores for only the current parent', async (t) => {
  const f = await createFixture(t);
  const otherParent = await new f.User({
    role: 'parent',
    status: 'approved',
    fullName: 'Parent Two',
    notifications: [createNotification(f.parent)],
  }).save();
  const embeddedNotification = createNotification(f.parent);
  f.parent.notifications.push(embeddedNotification);
  const collectionNotification = createNotification(f.parent);
  const otherCollectionNotification = createNotification(otherParent);
  f.collectionNotifications.push(collectionNotification, otherCollectionNotification);
  await f.parent.save();

  const response = await f.request('/api/parents/notifications', f.parent, { method: 'DELETE' });
  assert.equal(response.status, 200);
  assert.deepEqual(f.parent.notifications, []);
  assert.equal(f.collectionNotifications.some((item) => item.userId === f.parent._id), false);
  assert.equal(
    f.collectionNotifications.some((item) => item._id === otherCollectionNotification._id),
    true
  );
  assert.equal(otherParent.notifications.length, 1);
});

test('notification list limit does not limit the full unread count', async (t) => {
  const f = await createFixture(t);
  const now = Date.now();
  f.parent.notifications.push(createNotification(f.parent));
  for (let index = 0; index < 60; index += 1) {
    f.collectionNotifications.push(createNotification(f.parent, {
      createdAt: new Date(now + index * 1000),
    }));
  }
  const response = await f.request('/api/parents/notifications?limit=10', f.parent);

  assert.equal(response.status, 200);
  assert.equal(response.body.notifications.length, 10);
  assert.equal(response.body.unreadCount, 61);
  assert.ok(
    new Date(response.body.notifications[0].createdAt) >
      new Date(response.body.notifications[response.body.notifications.length - 1].createdAt)
  );
});

test('invalid notification ids return 404', async (t) => {
  const f = await createFixture(t);
  const response = await f.request('/api/parents/notifications/not-an-id', f.parent, {
    method: 'DELETE',
  });

  assert.equal(response.status, 404);
});

test('selected booking ignores client destination coordinates if the saved school has none', async (t) => {
  const f = await createFixture(t);
  f.parent.students = [
    { fullName: 'First Child', gradeLevel: 'Grade 3', schoolName: 'School One' },
  ];

  const result = await createRequest(f, {
    studentNames: ['First Child'],
    destinationLocation: { latitude: 14.6, longitude: 121.0 },
  });

  assert.equal(result.status, 201);
  assert.equal(result.body.request.destinationLocation, null);
});

test('legacy booking without studentNames keeps the singular-student request shape', async (t) => {
  const f = await createFixture(t);
  f.parent.student = {
    fullName: 'Legacy Student',
    gradeLevel: 'Grade 2 - B',
    schoolName: 'Legacy School',
    pickupLatitude: 14.7118,
    pickupLongitude: 121.0679,
  };

  const result = await createRequest(f);
  assert.equal(result.status, 201);
  assert.equal(result.body.request.studentName, 'Student One');
  assert.equal(result.body.request.gradeSection, 'Grade 2 - B');
  assert.equal(result.body.request.schoolName, 'Example School');
  assert.equal(result.body.request.seatsNeeded, 1);
  assert.deepEqual(result.body.request.students, []);
});

test('location near pickup updates position without automatically marking arrival', async (t) => {
  const f = await createFixture(t);
  const create = await createRequest(f);
  const requestId = create.body.request._id;
  f.addVehicle(f.driverOne, 'ONE-MANUAL-ARRIVAL');
  await setOnline(f, f.driverOne);

  const accepted = await f.request(`/api/drivers/requests/${requestId}/accept`, f.driverOne, { method: 'PATCH' });
  assert.equal(accepted.status, 200);

  const location = await f.request(`/api/drivers/requests/${requestId}/location`, f.driverOne, {
    method: 'PATCH',
    body: { latitude: 14.71198, longitude: 121.0679 },
  });

  assert.equal(location.status, 200);
  assert.equal(location.body.request.status, 'accepted');
  assert.equal(location.body.request.liveLocation.latitude, 14.71198);
  assert.equal(f.pickupArrivalNotifications.length, 0);
  assert.ok(f.emitted.some((event) =>
    event.room === `user:${f.parent._id}` &&
    event.event === 'trip:location-updated' &&
    event.payload.status === 'accepted'
  ));
  assert.equal(f.emitted.some((event) =>
    event.event === 'trip:request-updated' &&
    event.payload.request?._id === requestId &&
    event.payload.request?.status === 'arrived'
  ), false);
});

test('booking requires saved student pickup coordinates', async (t) => {
  const f = await createFixture(t);
  f.parent.student = {};

  const result = await createRequest(f);

  assert.equal(result.status, 400);
  assert.equal(result.body.message, 'Set your pickup location first');
});

test('booking rejects saved student pickup coordinates outside all service zones', async (t) => {
  const f = await createFixture(t);
  f.parent.student.pickupLatitude = 14.65;
  f.parent.student.pickupLongitude = 120.983;

  const result = await createRequest(f);

  assert.equal(result.status, 400);
  assert.equal(result.body.message, 'Outside our service area');
});

test('rejecting a searching request excludes that driver but leaves it available to others', async (t) => {
  const f = await createFixture(t);
  const create = await createRequest(f);
  const requestId = create.body.request._id;
  f.addVehicle(f.driverOne, 'ONE-REJECT');
  f.addVehicle(f.driverTwo, 'TWO-REJECT');
  await Promise.all([setOnline(f, f.driverOne), setOnline(f, f.driverTwo)]);

  const reject = await f.request(`/api/drivers/requests/${requestId}/reject`, f.driverOne, { method: 'PATCH' });
  assert.equal(reject.status, 200);
  assert.equal(reject.body.request.status, 'searching');
  assert.deepEqual(reject.body.request.rejectedBy, [f.driverOne._id]);

  const rejectedDriverRequests = await f.request('/api/drivers/requests', f.driverOne);
  const otherDriverRequests = await f.request('/api/drivers/requests', f.driverTwo);
  assert.equal(rejectedDriverRequests.body.requests.some((item) => item._id === requestId), false);
  assert.equal(otherDriverRequests.body.requests.some((item) => item._id === requestId), true);
});

test('an assigned driver can reject before pickup and release the request, status, and vehicle', async (t) => {
  const f = await createFixture(t);
  const create = await createRequest(f);
  const requestId = create.body.request._id;
  const vehicle = f.addVehicle(f.driverOne, 'ONE-456');
  await setOnline(f, f.driverOne);

  const accepted = await f.request(`/api/drivers/requests/${requestId}/accept`, f.driverOne, { method: 'PATCH' });
  assert.equal(accepted.status, 200);
  const unauthorizedTransition = await f.request(`/api/drivers/trip-status/${requestId}/picked_up`, f.driverTwo, { method: 'PATCH' });
  assert.equal(unauthorizedTransition.status, 403);
  const arrived = await f.request(`/api/drivers/requests/${requestId}/arrived`, f.driverOne, { method: 'PATCH' });
  assert.equal(arrived.status, 200);
  assert.equal(arrived.body.request.status, 'arrived');

  const rejected = await f.request(`/api/drivers/requests/${requestId}/reject`, f.driverOne, { method: 'PATCH' });
  assert.equal(rejected.status, 200);
  assert.equal(rejected.body.request.status, 'searching');
  assert.equal(rejected.body.request.driver, null);
  assert.equal(f.statuses.get(f.driverOne._id).activeRequestId, null);
  assert.equal(f.vehicles.get(vehicle._id).status, 'available');

  const retry = await f.request(`/api/drivers/requests/${requestId}/accept`, f.driverOne, { method: 'PATCH' });
  assert.equal(retry.status, 409);
  f.addVehicle(f.driverTwo, 'TWO-456');
  await setOnline(f, f.driverTwo);
  const otherDriverRetry = await f.request('/api/drivers/requests', f.driverTwo);
  assert.equal(otherDriverRetry.body.requests.some((item) => item._id === requestId), true);
});

test('Parent can cancel an eligible request but cannot cancel after pickup', async (t) => {
  const f = await createFixture(t);
  const create = await createRequest(f);
  const requestId = create.body.request._id;

  const cancelled = await f.request(`/api/parents/van-requests/${requestId}/cancel`, f.parent, { method: 'PATCH' });
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.body.request.status, 'cancelled');

  const second = await createRequest(f, { studentName: 'Student Two' });
  f.addVehicle(f.driverOne, 'ONE-789');
  await setOnline(f, f.driverOne);
  const accepted = await f.request(`/api/drivers/requests/${second.body.request._id}/accept`, f.driverOne, { method: 'PATCH' });
  assert.equal(accepted.status, 200);
  const acceptedCancel = await f.request(`/api/parents/van-requests/${second.body.request._id}/cancel`, f.parent, { method: 'PATCH' });
  assert.equal(acceptedCancel.status, 200);
  assert.equal(f.statuses.get(f.driverOne._id).activeRequestId, null);
  assert.equal(f.vehicles.get(accepted.body.request.vehicleId._id).status, 'available');

  const third = await createRequest(f, { studentName: 'Student Three' });
  await setOnline(f, f.driverOne);
  const thirdAccepted = await f.request(`/api/drivers/requests/${third.body.request._id}/accept`, f.driverOne, { method: 'PATCH' });
  assert.equal(thirdAccepted.status, 200);
  const thirdArrived = await f.request(`/api/drivers/requests/${third.body.request._id}/arrived`, f.driverOne, { method: 'PATCH' });
  assert.equal(thirdArrived.status, 200);
  const pickedUp = await f.request(`/api/drivers/requests/${third.body.request._id}/picked-up`, f.driverOne, { method: 'PATCH' });
  assert.equal(pickedUp.status, 200);
  const lateCancel = await f.request(`/api/parents/van-requests/${third.body.request._id}/cancel`, f.parent, { method: 'PATCH' });
  assert.equal(lateCancel.status, 409);
});
