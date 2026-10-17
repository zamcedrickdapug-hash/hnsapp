const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildPublicDriverProfile } = require('../services/driverPublicProfile');

test('public profile does not verify a driver whose account is not approved', () => {
  const profile = buildPublicDriverProfile({
    fullName: 'Test Driver',
    phone: '5550000100',
    status: 'pending',
    accountState: 'active',
    driver: { vehicleType: 'Van', plateNumber: 'TEST-PLATE' },
  });

  assert.equal(profile.verified, false);
});

test('public profile exposes license expiry only as a year and month', () => {
  const profile = buildPublicDriverProfile({
    status: 'approved',
    driver: { licenseExpirationDate: new Date('2099-07-15T00:00:00.000Z') },
  });

  assert.equal(profile.licenseValidUntil, '2099-07');
  assert.equal(Object.hasOwn(profile, 'licenseExpirationDate'), false);
  assert.equal(Object.hasOwn(profile, 'licenseExpired'), false);
});

test('public profile marks an expired license', () => {
  const profile = buildPublicDriverProfile({
    status: 'approved',
    driver: { licenseExpirationDate: new Date('2000-01-15T00:00:00.000Z') },
  });

  assert.equal(profile.licenseValidUntil, '2000-01');
  assert.equal(profile.licenseExpired, true);
});
