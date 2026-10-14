/**
 * Script to create admin user with email and password
 * Usage: node scripts/create-admin.js
 * 
 * This will:
 * 1. Connect to MongoDB
 * 2. Check if admin already exists
 * 3. Create new admin user with hashed password
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
require('dotenv').config({ path: require('path').resolve(__dirname, '../..', '.env') });

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@hnsapp.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_NAME = process.env.ADMIN_NAME || 'HNS Administrator';

async function createAdminUser() {
  if (!ADMIN_PASSWORD || !ADMIN_PASSWORD.trim()) {
    console.error('ADMIN_PASSWORD must be set in the environment before creating an admin account.');
    process.exitCode = 1;
    return;
  }

  try {
    // Connect to MongoDB - use MONGO_URL from environment (same as backend)
    const mongoUri = process.env.MONGO_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/hnsapp';
    await mongoose.connect(mongoUri);
    console.log('✓ Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: ADMIN_EMAIL.toLowerCase() });
    if (existingAdmin) {
      console.log('An account with this email already exists.');
      await mongoose.connection.close();
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);

    // Create admin user
    const admin = new User({
      email: ADMIN_EMAIL.toLowerCase(),
      fullName: ADMIN_NAME,
      role: 'admin',
      passwordHash: hashedPassword,
      phone: '',
      homeAddress: '',
      status: 'approved',
      accountState: 'active',
      isVerified: true,
      signupMethod: 'email',
    });

    await admin.save();

    console.log('Admin account created successfully.');

    await mongoose.connection.close();
  } catch (error) {
    console.error('Admin account creation failed.');
    process.exit(1);
  }
}

createAdminUser();
