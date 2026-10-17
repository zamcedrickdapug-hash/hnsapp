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
    }
    populate(field) { this.populateFields.push(field); return this; }
    select() { return this; }
    sort() { return this; }
    limit() { return this; }
    skip() { return this; }
    then(resolve, reject) {
      return Promise.resolve(this.resolveValue).then((value) => {
        if (Array.isArray(value)) {
          return value.map((item) => this.transform(item, this.populateFields));
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
  const routeDependencies = {
    '../models/User': User,
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
      notifyParentDriverAccepted: noOpNotification,
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
  const request = async (route, user, { method = 'GET', body } = {}) => {
    const response = await fetch(`${baseUrl}${route}`, {
      method,
      headers: {
        Authorization: `Bearer ${tokenFor(user)}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return {
      status: response.status,
      body: await response.json(),
    };
  };

  return { parent, driverOne, driverTwo, users, requests, statuses, vehicles, emitted, notifications, collectionNotifications, pickupArrivalNotifications, schoolArrivalNotifications, addVehicle, request };
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
