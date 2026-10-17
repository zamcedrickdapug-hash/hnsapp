require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
require('dotenv').config({ path: require('path').resolve(__dirname, '../..', '.env') });

const fs = require('node:fs/promises');
const mongoose = require('mongoose');
const User = require('../models/User');
const DriverPhoto = require('../models/DriverPhoto');

const MAX_PHOTO_SIZE = 300 * 1024;

const detectDriverPhotoType = (buffer) => {
  if (!Buffer.isBuffer(buffer)) return null;
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  )) {
    return 'image/png';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
};

const validateDriverPhoto = ({ user, buffer }) => {
  if (!user || user.role !== 'driver') {
    throw new Error('The specified account is not a driver.');
  }
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('The photo file is empty or invalid.');
  }
  if (buffer.length > MAX_PHOTO_SIZE) {
    throw new Error('The photo must be 300 KB or smaller.');
  }
  const contentType = detectDriverPhotoType(buffer);
  if (!contentType) {
    throw new Error('The photo must be a JPEG, PNG, or WebP image.');
  }
  return { contentType, size: buffer.length };
};

async function setDriverPhoto() {
  const args = process.argv.slice(2);
  const remove = args.includes('--remove');
  const positionalArgs = args.filter((arg) => arg !== '--remove');
  const [driverEmail, imagePath] = positionalArgs;

  if (
    !driverEmail?.trim() ||
    (remove ? positionalArgs.length !== 1 : positionalArgs.length !== 2 || !imagePath.trim())
  ) {
    console.error('Usage: npm run set:driverphoto -- <driver-email> <image-file> | <driver-email> --remove');
    process.exitCode = 1;
    return;
  }

  try {
    const mongoUri = process.env.MONGO_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/hnsapp';
    await mongoose.connect(mongoUri);

    const user = await User.findOne({
      email: driverEmail.trim().toLowerCase(),
      role: 'driver',
    }).select('_id fullName role');
    if (!user) {
      console.error('Driver not found.');
      process.exitCode = 1;
      return;
    }

    if (remove) {
      await DriverPhoto.deleteOne({ userId: user._id });
      await User.updateOne(
        { _id: user._id, role: 'driver' },
        { $set: { 'driver.photoUpdatedAt': null } }
      );
      console.log(`Driver: ${user.fullName}`);
      console.log('Result: photo removed');
      return;
    }

    const data = await fs.readFile(imagePath);
    const { contentType, size } = validateDriverPhoto({ user, buffer: data });
    const updatedAt = new Date();
    await DriverPhoto.findOneAndUpdate(
      { userId: user._id },
      { $set: { data, contentType, size, updatedAt } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    await User.updateOne(
      { _id: user._id, role: 'driver' },
      { $set: { 'driver.photoUpdatedAt': updatedAt } }
    );
    console.log(`Driver: ${user.fullName}`);
    console.log('Result: photo attached');
  } catch (error) {
    const safeValidationMessages = [
      'The specified account is not a driver.',
      'The photo file is empty or invalid.',
      'The photo must be 300 KB or smaller.',
      'The photo must be a JPEG, PNG, or WebP image.',
    ];
    console.error(safeValidationMessages.includes(error.message)
      ? error.message
      : 'Unable to update driver photo.');
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  }
}

if (require.main === module) {
  setDriverPhoto();
}

module.exports = {
  detectDriverPhotoType,
  validateDriverPhoto,
};
