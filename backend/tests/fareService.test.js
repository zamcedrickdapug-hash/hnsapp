const { test } = require('node:test');
const assert = require('node:assert/strict');
const { computeFare, haversineKm } = require('../services/fareService');

const pointAtKm = (distanceKm) => ({
  pickup: { latitude: 0, longitude: 0 },
  destination: { latitude: distanceKm / 111.195, longitude: 0 },
});

test('haversine distance and fare use the minimum for a zero-distance trip', () => {
  const result = computeFare(pointAtKm(0));
  assert.equal(haversineKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0 }), 0);
  assert.deepEqual(result, { distanceKm: 0, fare: 50 });
});

test('fare examples scale for about 3, 8, and 15 straight-line kilometers', () => {
  const threeKm = computeFare(pointAtKm(3));
  const eightKm = computeFare(pointAtKm(8));
  const fifteenKm = computeFare(pointAtKm(15));
  assert.deepEqual(threeKm, { distanceKm: 3, fare: 70 });
  assert.deepEqual(eightKm, { distanceKm: 8, fare: 135 });
  assert.deepEqual(fifteenKm, { distanceKm: 15, fare: 225 });
});

test('long distance is capped at the configured maximum fare', () => {
  assert.equal(computeFare(pointAtKm(1000)).fare, 300);
});

test('missing or invalid coordinates use the fallback fare', () => {
  assert.deepEqual(computeFare({ pickup: null, destination: { latitude: 1, longitude: 1 } }), {
    distanceKm: null,
    fare: 100,
  });
  assert.deepEqual(computeFare({
    pickup: { latitude: 91, longitude: 0 },
    destination: { latitude: 1, longitude: 1 },
  }), { distanceKm: null, fare: 100 });
});
