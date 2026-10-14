const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Module, createRequire } = require('node:module');
const { randomBytes, randomUUID } = require('node:crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { isValidPhoneNumber, normalizePhoneNumber } = require('../utils/validation');
const { validatePhoneNumber } = require('../utils/onboardingValidation');

if (!process.env.JWT_SECRET?.trim()) {
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
}

// Load the real routes with in-memory database/provider boundaries. No MongoDB,
// Firebase account, email, or existing application data is touched by these tests.
const loadWithDependencies = (relativePath, dependencies) => {
  const filename = path.resolve(__dirname, '..', relativePath);
  const loaded = new Module(filename, module);
  const realRequire = createRequire(filename);
  loaded.require = (name) => Object.hasOwn(dependencies, name) ? dependencies[name] : realRequire(name);
  loaded._compile(fs.readFileSync(filename, 'utf8'), filename);
  return loaded.exports;
};

const createFixture = async (t) => {
  const users = new Map();
  const identities = new Map();
  const uploads = fs.mkdtempSync(path.join(os.tmpdir(), 'hnsapp-auth-test-'));
  const password = randomUUID();
  const passwordHash = await bcrypt.hash(password, 4);
  const selections = [];

  class User {
    constructor(data) {
      Object.assign(this, { _id: randomBytes(12).toString('hex'), notifications: [], accountState: 'active' }, data);
    }
    async save() { users.set(this._id, this); return this; }
    async comparePassword(value) { return bcrypt.compare(value, this.passwordHash); }
    static findOne(query) {
      const found = [...users.values()].find((user) => Object.entries(query).every(([key, value]) => (
        value && typeof value === 'object' && '$in' in value ? value.$in.includes(user[key]) : user[key] === value
      ))) || null;
      const result = Promise.resolve(found);
      result.select = async (fields) => { selections.push(fields); return found; };
      return result;
    }
    static async findById(id) { return users.get(String(id)) || null; }
  }

  const identity = loadWithDependencies('utils/firebaseIdentity.js', {
    'firebase-admin': {
      apps: [{}],
      auth: () => ({
        verifyIdToken: async (token) => {
          if (!identities.has(token)) throw new Error('Invalid test identity');
          return identities.get(token);
        },
      }),
    },
  });
  const middleware = loadWithDependencies('middleware/auth.js', { '../models/User': User });
  const dependencies = {
    '../models/User': User,
    '../models/VanRequest': {},
    '../models/DriverStatus': {},
    '../models/DriverStats': {},
    '../models/DriverLocation': {},
    '../middleware/auth': middleware,
    '../utils/firebaseIdentity': identity,
    '../utils/pushNotifications': {},
    '../socket': {},
    '../services/notificationService': {},
    '../services/driverService': {},
    path: { ...path, resolve: (...parts) => parts.at(-1) === '../uploads/ids' ? uploads : path.resolve(...parts) },
  };

  const app = express();
  app.use(express.json());
  app.use('/api/auth', loadWithDependencies('routes/auth.routes.js', dependencies));
  app.use('/api/parents', loadWithDependencies('routes/parent.routes.js', dependencies));
  app.use('/api/drivers', loadWithDependencies('routes/driver.routes.js', dependencies));
  app.use('/api/admin', loadWithDependencies('routes/admin.routes.js', dependencies));
  app.use('/api/routing', loadWithDependencies('routes/routing.js', dependencies));
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    // Remove only files created in this fixture's uniquely allocated directory.
    for (const filename of fs.readdirSync(uploads)) fs.unlinkSync(path.join(uploads, filename));
    fs.rmdirSync(uploads);
  });

  const request = async (route, body, token, method = body === undefined ? 'GET' : 'POST') => {
    const multipart = body instanceof FormData;
    const response = await fetch(`${baseUrl}${route}`, {
      method,
      headers: {
        ...(multipart ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : multipart ? body : JSON.stringify(body),
    });
    const contentType = response.headers.get('content-type') || '';
    const responseBody = contentType.includes('application/json')
      ? await response.json()
      : await response.text();
    return { status: response.status, body: responseBody };
  };

  const addUser = async (data = {}) => new User({
    role: 'parent', fullName: 'Test Account', email: `${randomUUID()}@gmail.com`,
    status: 'approved', passwordHash, ...data,
  }).save();
  const firebaseToken = (email, data = {}) => {
    const idToken = randomUUID();
    const decoded = { email, uid: randomUUID(), email_verified: true, ...data };
    identities.set(idToken, decoded);
    return { idToken, firebaseUid: decoded.uid, email };
  };
  const sessionToken = (user, data = {}) => jwt.sign(
    { userId: user._id, role: user.role, ...data },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  const driverForm = (identityFields, data = {}, file = new Blob(['sample ID'], { type: 'image/png' }), filename = 'id.png') => {
    const form = new FormData();
    const expiry = new Date();
    expiry.setFullYear(expiry.getFullYear() + 2);
    const fields = {
      fullName: 'Test Driver', phone: '+639171234567', homeAddress: '123 Test Road',
      licenseNumber: 'N01-123456', licenseExpiry: expiry.toISOString().slice(0, 10),
      vehicleType: 'School van', plateNumber: 'ABC-123', yearsOfExperience: '0',
      ...identityFields, ...data,
    };
    for (const [key, value] of Object.entries(fields)) form.append(key, value);
    if (file) form.append('validId', file, filename);
    return form;
  };

  return { users, User, password, selections, uploads, baseUrl, request, addUser, firebaseToken, sessionToken, driverForm };
};

test('frontend and backend phone validators accept only supported Philippine mobile formats', async () => {
  const frontend = await import('../../frontend/src/constants/authConstants.js');
  const validNumbers = ['09701713972', '09171234567', '+639171234567', '639171234567'];
  const invalidNumbers = ['0917123456', '0817123456', 'phone09171234567'];

  for (const phone of validNumbers) {
    assert.equal(isValidPhoneNumber(phone), true, `backend should accept ${phone}`);
    assert.equal(frontend.isValidPhoneNumber(phone), true, `frontend should accept ${phone}`);
    assert.equal(validatePhoneNumber(phone).valid, true, `shared onboarding validation should accept ${phone}`);
    assert.match(normalizePhoneNumber(phone), /^\+639\d{9}$/);
    assert.equal(frontend.normalizePhoneNumber(phone), normalizePhoneNumber(phone));
  }

  for (const phone of invalidNumbers) {
    assert.equal(isValidPhoneNumber(phone), false, `backend should reject ${phone}`);
    assert.equal(frontend.isValidPhoneNumber(phone), false, `frontend should reject ${phone}`);
    assert.equal(validatePhoneNumber(phone).valid, false, `shared onboarding validation should reject ${phone}`);
    assert.equal(normalizePhoneNumber(phone), '');
  }

  assert.equal(isValidPhoneNumber('0970-171-3972'), true);
  assert.equal(frontend.isValidPhoneNumber('0970 171 3972'), true);
});

test('parent and driver profile routes store valid phone numbers in +63 format', async (t) => {
  const f = await createFixture(t);
  const numbers = ['09701713972', '09171234567', '+639171234567', '639171234567'];

  for (const [index, phone] of numbers.entries()) {
    const driverIdentity = f.firebaseToken(`driver-${index}@gmail.com`);
    const driver = await f.request(
      '/api/drivers/create-profile',
      f.driverForm(driverIdentity, { phone }),
    );
    assert.equal(driver.status, 201, `driver route should accept ${phone}`);
    assert.equal(f.users.get(driver.body.user.id).phone, normalizePhoneNumber(phone));

    const parentIdentity = f.firebaseToken(`parent-${index}@gmail.com`);
    const parent = await f.request('/api/parents/create-profile', {
      fullName: 'Test Parent',
      phone,
      ...parentIdentity,
    });
    assert.equal(parent.status, 201, `parent route should accept ${phone}`);
    assert.equal(f.users.get(parent.body.user.id).phone, normalizePhoneNumber(phone));
  }
});

test('parent profile endpoint reads and persists editable parent and student details', async (t) => {
  const f = await createFixture(t);
  const parent = await f.addUser({ phone: '+639171234567', homeAddress: 'Old pickup zone' });
  const token = f.sessionToken(parent);

  assert.equal((await f.request('/api/parents/profile')).status, 401);
  assert.equal((await f.request('/api/parents/profile', undefined, f.sessionToken(
    await f.addUser({ role: 'driver' })
  ))).status, 403);

  const initial = await f.request('/api/parents/profile', undefined, token);
  assert.equal(initial.status, 200);
  assert.equal(initial.body.profile.parentName, 'Test Account');
  assert.equal(initial.body.profile.pickupZone, 'Old pickup zone');
  assert.equal(initial.body.profile.studentName, '');

  const update = await f.request('/api/parents/profile', {
    parentName: ' Updated Parent ',
    contactNumber: '09701713972',
    studentName: 'Student Example',
    gradeSection: 'Grade 5 - A',
    schoolName: 'Example School',
    pickupZone: 'New pickup zone',
    schoolLatitude: '14.5995',
    schoolLongitude: '120.9842',
  }, token, 'PUT');
  assert.equal(update.status, 200);
  assert.deepEqual(update.body.profile, {
    parentName: 'Updated Parent',
    contactNumber: '+639701713972',
    studentName: 'Student Example',
    gradeSection: 'Grade 5 - A',
    schoolName: 'Example School',
    pickupZone: 'New pickup zone',
    schoolLatitude: 14.5995,
    schoolLongitude: 120.9842,
  });
  assert.equal(parent.student.fullName, 'Student Example');
  assert.equal(parent.phone, '+639701713972');

  const invalidPhone = await f.request('/api/parents/profile', {
    parentName: 'Updated Parent',
    contactNumber: '0817123456',
  }, token, 'PUT');
  assert.equal(invalidPhone.status, 400);
  assert.equal(parent.phone, '+639701713972');

  const incompleteCoordinates = await f.request('/api/parents/profile', {
    parentName: 'Updated Parent',
    contactNumber: '+639701713972',
    schoolLatitude: '14.5',
    schoolLongitude: '',
  }, token, 'PUT');
  assert.equal(incompleteCoordinates.status, 400);
});

test('one password login returns each stored role and a compatible session token', async (t) => {
  const f = await createFixture(t);
  for (const role of ['parent', 'driver', 'admin']) {
    const user = await f.addUser({ role, email: `${role}@example.test` });
    const login = await f.request('/api/auth/login', { email: ` ${user.email.toUpperCase()} `, password: f.password, role: 'admin' });
    assert.equal(login.status, 200, `${role}: ${JSON.stringify(login.body)}`);
    assert.equal(login.body.user.role, role);
    assert.equal(login.body.user.passwordHash, undefined);
    const me = await f.request('/api/auth/me', undefined, login.body.token);
    assert.equal(me.status, 200);
    assert.equal(me.body.user.id, user._id);
    assert.equal(me.body.user.role, role);
  }
  assert.deepEqual(f.selections, ['+passwordHash', '+passwordHash', '+passwordHash']);
});

test('invalid, missing, and Firebase-only credentials share a generic 401', async (t) => {
  const f = await createFixture(t);
  const wrongPassword = await f.addUser();
  const firebaseOnly = await f.addUser({ passwordHash: undefined });
  const linked = await f.addUser({ firebaseUid: randomUUID() });
  for (const user of [wrongPassword, firebaseOnly, linked, { email: 'missing@gmail.com' }]) {
    const result = await f.request('/api/auth/login', {
      email: user.email, password: user === wrongPassword ? randomUUID() : f.password,
    });
    assert.equal(result.status, 401);
    assert.deepEqual(result.body, { message: 'Invalid email or password.' });
  }
  const invalidInput = await f.request('/api/auth/login', { email: { $ne: null }, password: f.password });
  assert.equal(invalidInput.status, 400);
});

test('routing endpoints require an authenticated account', async (t) => {
  const f = await createFixture(t);
  const result = await f.request('/api/routing/route', { start: [1, 1], end: [2, 2] });
  assert.equal(result.status, 401);
});

test('routing endpoints enforce the configured per-minute rate limit', async (t) => {
  const f = await createFixture(t);
  const user = await f.addUser();
  const token = f.sessionToken(user);

  for (let requestNumber = 0; requestNumber < 60; requestNumber += 1) {
    const result = await f.request('/api/routing/route', { start: [], end: [] }, token);
    assert.equal(result.status, 400);
  }

  const limited = await f.request('/api/routing/route', { start: [], end: [] }, token);
  assert.equal(limited.status, 429);
});

test('pending, reviewing, and declined drivers cannot log in or reuse existing sessions', async (t) => {
  const f = await createFixture(t);
  for (const status of ['pending', 'reviewing', 'declined']) {
    const user = await f.addUser({ role: 'driver', status });
    const login = await f.request('/api/auth/login', { email: user.email, password: f.password });
    assert.equal(login.status, 403);
    assert.equal(login.body.accountStatus, status);
    assert.equal(login.body.token, undefined);
    const me = await f.request('/api/auth/me', undefined, f.sessionToken(user));
    assert.equal(me.status, 403);
    const dashboard = await f.request('/api/drivers/requests', undefined, f.sessionToken(user));
    assert.equal(dashboard.status, 403);
  }
});

test('suspended and banned accounts are blocked on login and refresh, including admins', async (t) => {
  const f = await createFixture(t);
  for (const role of ['parent', 'driver', 'admin']) {
    for (const accountState of ['suspended', 'banned']) {
      const user = await f.addUser({ role, accountState });
      const login = await f.request('/api/auth/login', { email: user.email, password: f.password });
      assert.equal(login.status, 403);
      assert.equal(login.body.accountState, accountState);
      assert.equal((await f.request('/api/auth/me', undefined, f.sessionToken(user))).status, 403);
    }
  }
});

test('dedicated admin login remains compatible and protected routes use the database role', async (t) => {
  const f = await createFixture(t);
  const parent = await f.addUser();
  const admin = await f.addUser({ role: 'admin', email: 'admin@example.test' });
  assert.equal((await f.request('/api/auth/admin-login', { email: parent.email, password: f.password })).status, 401);
  const adminLogin = await f.request('/api/auth/admin-login', { email: admin.email, password: f.password });
  assert.equal(adminLogin.status, 200);
  assert.equal((await f.request('/api/auth/me', undefined, adminLogin.body.token)).status, 200);
  assert.equal((await f.request('/api/admin/users')).status, 401);
  assert.equal((await f.request('/api/admin/users', undefined, f.sessionToken(parent))).status, 403);
  const forbidden = await f.request('/api/admin/registrations/id/status', { status: 'approved' }, f.sessionToken(parent, { role: 'admin' }), 'PATCH');
  assert.equal(forbidden.status, 403);
  assert.equal((await f.request('/api/auth/me')).status, 401);
  assert.equal((await f.request('/api/auth/me', undefined, 'invalid-token')).status, 401);
});

test('authentication middleware distinguishes token, database, and unexpected failures', async (t) => {
  const f = await createFixture(t);
  const user = await f.addUser();
  const originalFindById = f.User.findById;

  const missing = await f.request('/api/auth/me');
  const expiredToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: -1 });
  const expired = await f.request('/api/auth/me', undefined, expiredToken);
  assert.equal(missing.status, 401);
  assert.equal(expired.status, 401);

  f.User.findById = async () => {
    const error = new Error('private database detail');
    error.name = 'MongoServerSelectionError';
    throw error;
  };
  try {
    const unavailable = await f.request('/api/auth/me', undefined, f.sessionToken(user));
    assert.equal(unavailable.status, 503);
    assert.deepEqual(unavailable.body, { message: 'Authentication service is temporarily unavailable.' });

    f.User.findById = async () => {
      throw new Error('private internal detail');
    };
    const unexpected = await f.request('/api/auth/me', undefined, f.sessionToken(user));
    assert.equal(unexpected.status, 500);
    assert.deepEqual(unexpected.body, { message: 'Unable to authenticate this request.' });
  } finally {
    f.User.findById = originalFindById;
  }
});

test('admin socket handshake authenticates the token and checks the database role', async (t) => {
  const f = await createFixture(t);
  const parent = await f.addUser({ role: 'parent' });
  const admin = await f.addUser({ role: 'admin' });
  let socketMiddleware;

  class TestSocketServer {
    constructor() { this.engine = { on() {} }; }
    use(handler) { socketMiddleware = handler; }
    on() {}
  }

  const socketModule = loadWithDependencies('socket.js', {
    'socket.io': { Server: TestSocketServer },
    './models/User': {
      findById: (id) => ({ select: async () => f.users.get(String(id)) || null }),
    },
    './models/VanRequest': {},
    './utils/jwtSecret': { getJwtSecret: () => process.env.JWT_SECRET },
  });
  socketModule.initSocketServer({});

  const connect = async (account, claimRole, scope) => {
    const token = jwt.sign({ userId: account._id, role: claimRole }, process.env.JWT_SECRET);
    const socket = {
      handshake: { auth: { token, ...(scope ? { scope } : {}) } },
      join() {},
    };
    return new Promise((resolve) => socketMiddleware(socket, resolve));
  };

  assert.equal(await connect(admin, 'admin', 'admin'), undefined);
  assert.equal((await connect(parent, 'admin', 'admin')).message, 'Admin access is required.');
  assert.equal(await connect(parent, 'parent'), undefined);
});

test('Firebase login detects the stored role, links legacy profiles, and never creates accounts', async (t) => {
  const f = await createFixture(t);
  for (const role of ['parent', 'driver']) {
    const user = await f.addUser({ role, passwordHash: undefined });
    const identity = f.firebaseToken(user.email);
    const result = await f.request('/api/auth/verify-firebase-token', { idToken: identity.idToken, accountType: 'admin' });
    assert.equal(result.status, 200);
    assert.equal(result.body.user.role, role);
    assert.equal(user.firebaseUid, identity.firebaseUid);
    assert.equal(user.isVerified, true);
    assert.equal((await f.request('/api/auth/me', undefined, result.body.token)).status, 200);
  }
  const missing = f.firebaseToken('missing@gmail.com');
  const before = f.users.size;
  const result = await f.request('/api/auth/verify-firebase-token', { idToken: missing.idToken, accountType: 'driver' });
  assert.equal(result.status, 403);
  assert.equal(f.users.size, before);
});

test('Firebase cannot bypass email verification, driver approval, identity binding, or admin passwords', async (t) => {
  const f = await createFixture(t);
  for (const data of [
    { role: 'admin' },
    { role: 'driver', status: 'pending' },
    { role: 'driver', status: 'reviewing' },
    { role: 'driver', status: 'declined' },
    { accountState: 'suspended' },
    { firebaseUid: 'another-identity' },
  ]) {
    const user = await f.addUser(data);
    const identity = f.firebaseToken(user.email);
    const result = await f.request('/api/auth/verify-firebase-token', { idToken: identity.idToken });
    assert.equal(result.status, 403);
    assert.equal(result.body.token, undefined);
  }
  const parent = await f.addUser();
  const unverified = f.firebaseToken(parent.email, { email_verified: false });
  const result = await f.request('/api/auth/verify-firebase-token', { idToken: unverified.idToken });
  assert.equal(result.status, 403);
  assert.match(result.body.message, /verify your Gmail/);
  assert.equal((await f.request('/api/auth/verify-firebase-token', { idToken: 'invalid' })).status, 401);
});

test('parent registration validates the Firebase identity and preserves role/status on retries', async (t) => {
  const f = await createFixture(t);
  const identity = f.firebaseToken('new-parent@gmail.com', { email_verified: false });
  const body = { ...identity, fullName: 'New Parent', phone: '+639171234567', role: 'admin', status: 'approved' };
  const mismatch = await f.request('/api/parents/create-profile', { ...body, firebaseUid: 'someone-else' });
  assert.equal(mismatch.status, 403);
  assert.equal(f.users.size, 0);
  const missing = await f.request('/api/parents/create-profile', { ...body, idToken: undefined });
  assert.equal(missing.status, 400);
  const created = await f.request('/api/parents/create-profile', body);
  assert.equal(created.status, 201);
  assert.equal(created.body.user.role, 'parent');
  assert.equal(created.body.user.status, 'pending');
  assert.equal((await f.request('/api/parents/create-profile', body)).status, 200);
  assert.equal(f.users.size, 1);
  const user = [...f.users.values()][0];
  assert.equal(user.accountState, 'active');
  assert.equal(user.isVerified, false);
  const verifiedIdentity = f.firebaseToken(user.email, { uid: identity.firebaseUid });
  const pendingLogin = await f.request('/api/auth/verify-firebase-token', { idToken: verifiedIdentity.idToken });
  assert.equal(pendingLogin.status, 403);
  assert.equal(pendingLogin.body.accountStatus, 'pending');
  assert.match(pendingLogin.body.message, /awaiting administrator approval/i);
  assert.equal(pendingLogin.body.token, undefined);
  user.role = 'driver';
  assert.equal((await f.request('/api/parents/create-profile', body)).status, 409);
  assert.equal(user.role, 'driver');
});

test('retired duplicate registration endpoints are not mounted', async (t) => {
  const f = await createFixture(t);
  const endpoints = [
    ['/api/parents/register', 404],
    ['/api/drivers/register', 401],
    ['/api/auth/create-parent-profile', 404],
    ['/api/parent/register', 404],
    ['/api/driver/register', 404],
    ['/api/auth/register', 404],
  ];

  for (const [endpoint, expectedStatus] of endpoints) {
    const response = await f.request(endpoint, {});
    assert.equal(response.status, expectedStatus, `${endpoint} should not create an account`);
    assert.equal(f.users.size, 0, `${endpoint} must not create a MongoDB user`);
  }
});

test('Parent access requires verified Firebase login, approved status, and an active account', async (t) => {
  const f = await createFixture(t);

  for (const status of ['pending', 'reviewing', 'declined']) {
    const user = await f.addUser({ role: 'parent', status, firebaseUid: randomUUID() });
    const identity = f.firebaseToken(user.email, { uid: user.firebaseUid });
    const login = await f.request('/api/auth/verify-firebase-token', { idToken: identity.idToken });
    assert.equal(login.status, 403);
    assert.equal(login.body.accountStatus, status);
    assert.equal(login.body.token, undefined);
    assert.equal((await f.request('/api/auth/me', undefined, f.sessionToken(user))).status, 403);
    assert.equal((await f.request('/api/parents/notifications', undefined, f.sessionToken(user))).status, 403);
  }

  const approvedParent = await f.addUser({
    role: 'parent',
    status: 'approved',
    firebaseUid: randomUUID(),
  });
  const unverified = f.firebaseToken(approvedParent.email, {
    uid: approvedParent.firebaseUid,
    email_verified: false,
  });
  assert.equal((await f.request('/api/auth/verify-firebase-token', { idToken: unverified.idToken })).status, 403);

  const verified = f.firebaseToken(approvedParent.email, { uid: approvedParent.firebaseUid });
  const login = await f.request('/api/auth/verify-firebase-token', { idToken: verified.idToken });
  assert.equal(login.status, 200);
  assert.equal((await f.request('/api/parents/notifications', undefined, login.body.token)).status, 200);
});

test('only Admins can approve or reject Parent applications through valid transitions', async (t) => {
  const f = await createFixture(t);
  const admin = await f.addUser({ role: 'admin' });
  const parentActor = await f.addUser({ role: 'parent' });
  const driverActor = await f.addUser({ role: 'driver' });
  const parent = await f.addUser({ role: 'parent', status: 'pending' });
  const parentPath = `/api/admin/registrations/${parent._id}/status`;

  for (const actor of [parentActor, driverActor]) {
    const denied = await f.request(parentPath, { status: 'approved' }, f.sessionToken(actor), 'PATCH');
    assert.equal(denied.status, 403);
  }

  const approved = await f.request(parentPath, { status: 'approved' }, f.sessionToken(admin), 'PATCH');
  assert.equal(approved.status, 200);
  assert.equal(approved.body.registration.role, 'parent');
  assert.equal(approved.body.registration.status, 'approved');
  assert.equal((await f.request('/api/parents/notifications', undefined, f.sessionToken(parent))).status, 200);

  const invalidTransition = await f.request(parentPath, { status: 'declined' }, f.sessionToken(admin), 'PATCH');
  assert.equal(invalidTransition.status, 409);

  const rejectedParent = await f.addUser({
    role: 'parent',
    status: 'reviewing',
    firebaseUid: randomUUID(),
  });
  const rejected = await f.request(
    `/api/admin/registrations/${rejectedParent._id}/status`,
    { status: 'declined', reason: 'Application does not meet requirements.' },
    f.sessionToken(admin),
    'PATCH'
  );
  assert.equal(rejected.status, 200);
  assert.equal(rejected.body.registration.status, 'declined');

  const rejectedIdentity = f.firebaseToken(rejectedParent.email, { uid: rejectedParent.firebaseUid });
  const rejectedLogin = await f.request('/api/auth/verify-firebase-token', { idToken: rejectedIdentity.idToken });
  assert.equal(rejectedLogin.status, 403);
  assert.match(rejectedLogin.body.message, /rejected/i);
  assert.equal((await f.request('/api/parents/notifications', undefined, f.sessionToken(rejectedParent))).status, 403);
});

test('driver application keeps uploaded ID and vehicle/license information until admin approval', async (t) => {
  const f = await createFixture(t);
  const identity = f.firebaseToken('new-driver@gmail.com', { email_verified: false });
  const created = await f.request('/api/drivers/create-profile', f.driverForm(identity, { role: 'admin', status: 'approved' }));
  assert.equal(created.status, 201);
  const driver = [...f.users.values()][0];
  assert.equal(driver.role, 'driver');
  assert.equal(driver.status, 'pending');
  assert.equal(driver.firebaseUid, identity.firebaseUid);
  assert.equal(driver.driver.yearsOfExperience, 0);
  assert.equal(driver.driver.vehicleType, 'School van');
  assert.ok(driver.driver.licenseExpirationDate instanceof Date);
  assert.equal(driver.driver.licenseExpiry, undefined);
  assert.equal(driver.validId.mimeType, 'image/png');
  assert.equal(fs.readFileSync(driver.validId.path, 'utf8'), 'sample ID');
  assert.equal(driver.passwordHash, undefined);

  const verified = f.firebaseToken(driver.email, { uid: identity.firebaseUid });
  assert.equal((await f.request('/api/auth/verify-firebase-token', { idToken: verified.idToken })).status, 403);
  const admin = await f.addUser({ role: 'admin' });
  const approved = await f.request(`/api/admin/registrations/${driver._id}/status`, { status: 'approved' }, f.sessionToken(admin), 'PATCH');
  assert.equal(approved.status, 200);
  const login = await f.request('/api/auth/verify-firebase-token', { idToken: verified.idToken });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.role, 'driver');
  assert.equal((await f.request('/api/auth/me', undefined, login.body.token)).status, 200);
  await f.request(`/api/admin/registrations/${driver._id}/status`, { status: 'declined', reason: 'Review required' }, f.sessionToken(admin), 'PATCH');
  assert.equal((await f.request('/api/auth/me', undefined, login.body.token)).status, 403);
});

test('driver registration enforces uploads, identity, expiry, experience, and duplicate protection', async (t) => {
  const f = await createFixture(t);
  const identity = f.firebaseToken('driver-validation@gmail.com', { email_verified: false });
  const invalidForms = [
    f.driverForm(identity, {}, null),
    f.driverForm(identity, { licenseExpiry: '2000-01-01' }),
    f.driverForm(identity, { yearsOfExperience: '2.5' }),
    f.driverForm(identity, { yearsOfExperience: '61' }),
    f.driverForm(identity, { vehicleType: '' }),
    f.driverForm(identity, {}, new Blob(['bad'], { type: 'text/html' }), 'id.html'),
    f.driverForm(identity, {}, new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: 'image/png' })),
  ];
  for (const form of invalidForms) {
    const result = await f.request('/api/drivers/create-profile', form);
    assert.equal(result.status, 400);
    assert.equal(f.users.size, 0);
    assert.equal(fs.readdirSync(f.uploads).length, 0);
  }
  const invalidType = await f.request(
    '/api/drivers/create-profile',
    f.driverForm(identity, {}, new Blob(['bad'], { type: 'text/html' }), 'id.html'),
  );
  assert.match(invalidType.body.message, /Only JPG, PNG, WEBP images, or PDF files are allowed/i);

  const oversized = await f.request(
    '/api/drivers/create-profile',
    f.driverForm(identity, {}, new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: 'image/png' })),
  );
  assert.match(oversized.body.message, /5MB or smaller/i);

  const unexpectedFieldForm = f.driverForm(identity);
  unexpectedFieldForm.append('otherFile', new Blob(['unexpected'], { type: 'image/png' }), 'other.png');
  const unexpectedField = await f.request('/api/drivers/create-profile', unexpectedFieldForm);
  assert.equal(unexpectedField.status, 400);
  assert.match(unexpectedField.body.message, /Unexpected upload field.*validId/i);
  assert.equal(fs.readdirSync(f.uploads).length, 0);

  assert.equal((await f.request('/api/drivers/create-profile', f.driverForm(identity, { firebaseUid: 'another-user' }))).status, 403);
  assert.equal(fs.readdirSync(f.uploads).length, 0);
  assert.equal((await f.request('/api/drivers/create-profile', f.driverForm(identity))).status, 201);
  assert.equal((await f.request('/api/drivers/create-profile', f.driverForm(identity))).status, 200);
  assert.equal(f.users.size, 1);
  assert.equal(fs.readdirSync(f.uploads).length, 1);
  const other = f.firebaseToken(identity.email);
  assert.equal((await f.request('/api/drivers/create-profile', f.driverForm(other))).status, 409);
  assert.equal(fs.readdirSync(f.uploads).length, 1);
});

test('the real MongoDB schema retains Firebase UID, uploaded ID, and license expiration', async () => {
  const User = require('../models/User');
  const user = new User({
    role: 'driver', fullName: 'Schema Test', email: 'schema@gmail.com', firebaseUid: randomUUID(),
    driver: { licenseExpirationDate: new Date('2035-01-01'), yearsOfExperience: 0 },
    validId: { originalName: 'id.png', filename: 'stored.png', path: 'test/id.png', mimeType: 'image/png', size: 9 },
    student: { schoolLatitude: 14.5995, schoolLongitude: 120.9842 },
  });
  await user.validate();
  assert.ok(user.toObject().firebaseUid);
  assert.ok(user.toObject().driver.licenseExpirationDate instanceof Date);
  assert.equal(user.toObject().validId.originalName, 'id.png');
  assert.equal(user.toObject().student.schoolLatitude, 14.5995);
});
