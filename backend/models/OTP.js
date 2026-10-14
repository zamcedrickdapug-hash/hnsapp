/**
 * OTP (One-Time Password) Model for Email Verification
 * Handles secure OTP generation, storage, and verification
 */

const mongoose = require('mongoose');
const crypto = require('crypto');

const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
      // Store hashed OTP for security
      select: false,
    },
    codeHash: {
      type: String,
      required: true,
      // This is what we actually compare against
      select: false,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 }, // Auto-delete expired OTPs
    },
    verified: {
      type: Boolean,
      default: false,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    attempts: {
      type: Number,
      default: 0,
      max: 5, // Max 5 verification attempts
    },
    lastAttemptAt: {
      type: Date,
      default: null,
    },
    purpose: {
      type: String,
      enum: ['email_verification', 'password_reset'],
      default: 'email_verification',
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Static method to generate and save OTP
 * @param {string} email - Email address
 * @param {number} expiryMinutes - OTP expiry in minutes (default: 5)
 * @returns {object} { code, email } - Plaintext code (for sending via email)
 */
otpSchema.statics.generateOTP = async function (email, expiryMinutes = 5) {
  // Generate 6-digit OTP
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  // Hash the code for storage
  const codeHash = crypto.createHash('sha256').update(code).digest('hex');

  // Calculate expiration time
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

  // Delete any existing OTP for this email
  await this.deleteMany({ email });

  // Create new OTP
  const otp = await this.create({
    email,
    code,
    codeHash,
    expiresAt,
  });

  return {
    code, // Return plaintext code to send via email
    email: otp.email,
    expiresAt: otp.expiresAt,
  };
};

/**
 * Instance method to verify OTP
 * @param {string} code - OTP code to verify
 * @returns {object} { isValid, message }
 */
otpSchema.methods.verifyOTP = function (code) {
  // Check if OTP has expired
  if (new Date() > this.expiresAt) {
    return {
      isValid: false,
      message: 'OTP has expired. Please request a new one.',
    };
  }

  // Check if max attempts exceeded
  if (this.attempts >= 5) {
    return {
      isValid: false,
      message: 'Maximum verification attempts exceeded. Please request a new OTP.',
    };
  }

  // Hash provided code and compare
  const providedHash = crypto.createHash('sha256').update(code).digest('hex');

  if (providedHash !== this.codeHash) {
    this.attempts += 1;
    this.lastAttemptAt = new Date();
    this.save();

    return {
      isValid: false,
      message: `Invalid OTP. You have ${5 - this.attempts} attempts remaining.`,
      attemptsRemaining: 5 - this.attempts,
    };
  }

  return {
    isValid: true,
    message: 'OTP verified successfully',
  };
};

/**
 * Instance method to mark OTP as verified
 */
otpSchema.methods.markAsVerified = async function () {
  this.verified = true;
  this.verifiedAt = new Date();
  return await this.save();
};

/**
 * Static method to check if OTP is still valid and not verified
 * @param {string} email
 * @returns {object} OTP document or null
 */
otpSchema.statics.findValidOTP = async function (email) {
  return await this.findOne({
    email,
    verified: false,
    expiresAt: { $gt: new Date() },
  }).select('+codeHash +code');
};

/**
 * Static method to get remaining time for OTP expiry
 * @param {string} email
 * @returns {number} Seconds remaining (or 0 if expired)
 */
otpSchema.statics.getTimeRemaining = async function (email) {
  const otp = await this.findOne({ email, verified: false });
  if (!otp) return 0;

  const remaining = Math.max(0, Math.floor((otp.expiresAt - new Date()) / 1000));
  return remaining;
};

/**
 * Static method to check resend cooldown (60 seconds)
 * @param {string} email
 * @returns {object} { canResend, secondsRemaining }
 */
otpSchema.statics.checkResendCooldown = async function (email) {
  const recentOTP = await this.findOne({ email })
    .sort({ createdAt: -1 });

  if (!recentOTP) {
    return { canResend: true, secondsRemaining: 0 };
  }

  const secondsSinceCreation = Math.floor((new Date() - recentOTP.createdAt) / 1000);
  const cooldownSeconds = 60;

  if (secondsSinceCreation < cooldownSeconds) {
    return {
      canResend: false,
      secondsRemaining: cooldownSeconds - secondsSinceCreation,
    };
  }

  return { canResend: true, secondsRemaining: 0 };
};

const OTP = mongoose.model('OTP', otpSchema);

module.exports = OTP;
