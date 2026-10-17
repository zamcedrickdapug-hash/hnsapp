const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateDriverPhoto } = require('../scripts/set-driver-photo');

test('photo type is detected from bytes, not a jpg filename', () => {
  const notAnImage = Buffer.from('plain text pretending to be an image');

  assert.throws(
    () => validateDriverPhoto({ user: { role: 'driver' }, buffer: notAnImage, filename: 'fake.jpg' }),
    /JPEG, PNG, or WebP/
  );
});

test('photo larger than 300 KB is rejected', () => {
  const oversizedJpeg = Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff]),
    Buffer.alloc(300 * 1024 - 2),
  ]);

  assert.throws(
    () => validateDriverPhoto({ user: { role: 'driver' }, buffer: oversizedJpeg }),
    /300 KB or smaller/
  );
});

test('non-driver account is rejected', () => {
  assert.throws(
    () => validateDriverPhoto({
      user: { role: 'parent' },
      buffer: Buffer.from([0xff, 0xd8, 0xff]),
    }),
    /not a driver/
  );
});

test('supported image signatures map to explicit content types', () => {
  assert.equal(validateDriverPhoto({
    user: { role: 'driver' },
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0x01]),
  }).contentType, 'image/jpeg');
  assert.equal(validateDriverPhoto({
    user: { role: 'driver' },
    buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  }).contentType, 'image/png');
  assert.equal(validateDriverPhoto({
    user: { role: 'driver' },
    buffer: Buffer.from('RIFF0000WEBP'),
  }).contentType, 'image/webp');
});
