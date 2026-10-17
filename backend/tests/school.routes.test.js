const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Module, createRequire } = require('node:module');
const { randomBytes } = require('node:crypto');
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

test('GET /api/schools requires auth and returns active schools with escaped search', async (t) => {
  const userId = randomBytes(12).toString('hex');
  const user = { _id: userId, role: 'parent', status: 'approved', accountState: 'active' };
  const schools = [
    { _id: '03', name: 'Zeta Academy', area: 'San Jose del Monte', active: true },
    { _id: '02', name: 'La Concepcion College', area: 'San Jose del Monte, Bulacan', active: true },
    { _id: '01', name: 'Inactive School', area: 'San Jose del Monte', active: false },
  ];
  const User = {
    findById: async (id) => String(id) === userId ? user : null,
  };
  const School = {
    find(query) {
      let results = schools.filter((school) => school.active === query.active);
      if (query.$or) {
        results = results.filter((school) => query.$or.some((condition) => {
          const field = Object.keys(condition)[0];
          return condition[field].test(school[field] || '');
        }));
      }
      return {
        sort({ name }) {
          results.sort((first, second) => name * first.name.localeCompare(second.name));
          return this;
        },
        async lean() {
          return results;
        },
      };
    },
  };
  const middleware = loadWithDependencies('middleware/auth.js', { '../models/User': User });
  const app = express();
  app.use('/api/schools', loadWithDependencies('routes/school.routes.js', {
    '../models/School': School,
    '../middleware/auth': middleware,
  }));
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  t.after(async () => new Promise((resolve) => server.close(resolve)));

  const baseUrl = 'http://127.0.0.1:' + server.address().port + '/api/schools';
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const request = async (url, authToken) => {
    const headers = authToken ? { Authorization: 'Bearer ' + authToken } : {};
    const response = await fetch(url, { headers });
    return { status: response.status, body: await response.json() };
  };

  assert.equal((await request(baseUrl)).status, 401);

  const allSchools = await request(baseUrl, token);
  assert.equal(allSchools.status, 200);
  assert.deepEqual(allSchools.body.schools.map((school) => school.name), [
    'La Concepcion College',
    'Zeta Academy',
  ]);

  const areaSearch = await request(baseUrl + '?q=' + encodeURIComponent('BULACAN'), token);
  assert.deepEqual(areaSearch.body.schools.map((school) => school.name), ['La Concepcion College']);

  const escapedSearch = await request(baseUrl + '?q=' + encodeURIComponent('.*'), token);
  assert.deepEqual(escapedSearch.body.schools, []);
});
