require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
require('dotenv').config({ path: require('path').resolve(__dirname, '../..', '.env') });

const mongoose = require('mongoose');
const User = require('../models/User');
const School = require('../models/School');

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function assignDriverSchool() {
  const args = process.argv.slice(2);
  const remove = args.includes('--remove');
  const positionalArgs = args.filter((arg) => arg !== '--remove');
  const [driverEmail, schoolName] = positionalArgs;

  if (positionalArgs.length !== 2 || !driverEmail.trim() || !schoolName.trim()) {
    console.error('Usage: npm run assign:school -- <driver-email> "<school name>" [--remove]');
    process.exitCode = 1;
    return;
  }

  try {
    const mongoUri = process.env.MONGO_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/hnsapp';
    await mongoose.connect(mongoUri);

    const driver = await User.findOne({
      email: driverEmail.trim().toLowerCase(),
      role: 'driver',
    });
    if (!driver) {
      console.error('Driver not found.');
      process.exitCode = 1;
      return;
    }

    const school = await School.findOne({
      name: new RegExp(`^${escapeRegExp(schoolName.trim())}$`, 'i'),
      active: true,
    });
    if (!school) {
      console.error('Active school not found.');
      process.exitCode = 1;
      return;
    }

    if (!driver.driver) driver.driver = {};
    const assignedSchools = driver.driver.assignedSchools || [];
    const schoolId = String(school._id);
    if (remove) {
      driver.driver.assignedSchools = assignedSchools.filter(
        (assignedSchool) => String(assignedSchool?._id || assignedSchool) !== schoolId
      );
    } else if (!assignedSchools.some(
      (assignedSchool) => String(assignedSchool?._id || assignedSchool) === schoolId
    )) {
      driver.driver.assignedSchools.push(school._id);
    }
    await driver.save();

    const updatedSchoolNames = await Promise.all(
      driver.driver.assignedSchools.map(async (assignedSchool) => {
        const assignedId = assignedSchool?._id || assignedSchool;
        const assignedSchoolDoc = await School.findById(assignedId).select('name');
        return assignedSchoolDoc?.name;
      })
    );
    console.log(`Driver: ${driver.fullName}`);
    console.log(`Schools: ${updatedSchoolNames.filter(Boolean).join(', ') || '(none)'}`);
  } catch (error) {
    console.error('Unable to update driver school assignment.');
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  }
}

assignDriverSchool();
