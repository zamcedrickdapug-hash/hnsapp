const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const School = require('../models/School');

const seedSchools = async () => {
  try {
    const schools = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../data/schools.json'), 'utf8')
    );
    const mongoUri = process.env.MONGO_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/hnsapp';
    await mongoose.connect(mongoUri);
    for (const school of schools) {
      await School.updateOne(
        { name: school.name },
        { $set: { ...school, active: true } },
        { upsert: true, runValidators: true }
      );
    }
    console.log(`Seeded ${schools.length} school(s).`);
  } catch (error) {
    console.error('School catalog seed failed:', error.name || 'UnknownError');
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  }
};

seedSchools();
