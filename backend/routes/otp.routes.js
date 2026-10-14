/**
 * OTP Routes for HNSAPP
 * Handles OTP generation, sending, verification, and resend
 */

const express = require('express');
const router = express.Router();
const OTP = require('../models/OTP');
const User = require('../models/User');
const { sendOTPEmail } = require('../utils/emailService');

/**
 * POST /api/otp/send
 * Generate and send OTP to email
 */
router.post('/send', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'MISSING_EMAIL',
        message: 'Email is required',
      });
    }

    // Check resend cooldown
    const cooldown = await OTP.checkResendCooldown(email);
    if (!cooldown.canResend) {
      return res.status(429).json({
        error: 'RESEND_COOLDOWN',
        message: `Please wait ${cooldown.secondsRemaining} seconds before requesting a new OTP`,
        secondsRemaining: cooldown.secondsRemaining,
      });
    }

    console.log('[OTP] Generating OTP for:', email);

    // Generate OTP
    const otpData = await OTP.generateOTP(email, 5); // 5 minutes expiry

    // Send OTP email
    const emailResult = await sendOTPEmail(email, otpData.code);

    if (!emailResult.success) {
      console.error('[OTP] Failed to send email:', emailResult.message);
      return res.status(500).json({
        error: 'EMAIL_SEND_FAILED',
        message: 'Failed to send OTP email. Please try again.',
      });
    }

    console.log('[OTP] OTP sent successfully:', {
      email,
      expiresAt: otpData.expiresAt,
    });

    res.status(200).json({
      message: 'OTP sent successfully',
      email,
      expiresIn: 300, // 5 minutes in seconds
      expiresAt: otpData.expiresAt,
    });
  } catch (error) {
    console.error('[OTP_SEND_ERROR]', error);
    res.status(500).json({
      error: 'OTP_SEND_ERROR',
      message: 'Failed to send OTP',
    });
  }
});

/**
 * POST /api/otp/verify
 * Verify OTP code
 */
router.post('/verify', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        error: 'MISSING_FIELDS',
        message: 'Email and OTP code are required',
      });
    }

    console.log('[OTP] Verifying OTP for:', email);

    // Find OTP record
    const otp = await OTP.findValidOTP(email);

    if (!otp) {
      return res.status(400).json({
        error: 'OTP_NOT_FOUND',
        message: 'No valid OTP found for this email. Please request a new one.',
      });
    }

    // Verify OTP code
    const verification = otp.verifyOTP(code);

    if (!verification.isValid) {
      return res.status(400).json({
        error: 'INVALID_OTP',
        message: verification.message,
        attemptsRemaining: verification.attemptsRemaining,
      });
    }

    // Mark OTP as verified
    await otp.markAsVerified();

    console.log('[OTP] OTP verified successfully:', { email });

    res.status(200).json({
      message: 'OTP verified successfully',
      email,
      verified: true,
    });
  } catch (error) {
    console.error('[OTP_VERIFY_ERROR]', error);
    res.status(500).json({
      error: 'OTP_VERIFY_ERROR',
      message: 'Failed to verify OTP',
    });
  }
});

/**
 * POST /api/otp/resend
 * Resend OTP (with cooldown check)
 */
router.post('/resend', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'MISSING_EMAIL',
        message: 'Email is required',
      });
    }

    // Check resend cooldown (same as /send)
    const cooldown = await OTP.checkResendCooldown(email);
    if (!cooldown.canResend) {
      return res.status(429).json({
        error: 'RESEND_COOLDOWN',
        message: `Please wait ${cooldown.secondsRemaining} seconds before requesting a new OTP`,
        secondsRemaining: cooldown.secondsRemaining,
      });
    }

    console.log('[OTP] Resending OTP for:', email);

    // Generate new OTP
    const otpData = await OTP.generateOTP(email, 5);

    // Send OTP email
    const emailResult = await sendOTPEmail(email, otpData.code);

    if (!emailResult.success) {
      return res.status(500).json({
        error: 'EMAIL_SEND_FAILED',
        message: 'Failed to send OTP email',
      });
    }

    console.log('[OTP] OTP resent successfully:', { email });

    res.status(200).json({
      message: 'OTP resent successfully',
      email,
      expiresIn: 300,
      expiresAt: otpData.expiresAt,
    });
  } catch (error) {
    console.error('[OTP_RESEND_ERROR]', error);
    res.status(500).json({
      error: 'OTP_RESEND_ERROR',
      message: 'Failed to resend OTP',
    });
  }
});

/**
 * GET /api/otp/status/:email
 * Get OTP status (time remaining, verified, etc.)
 */
router.get('/status/:email', async (req, res) => {
  try {
    const { email } = req.params;

    // Check if OTP exists and is valid
    const otp = await OTP.findOne({ email, verified: false })
      .select('-codeHash -code');

    if (!otp) {
      return res.status(200).json({
        exists: false,
        verified: true,
        message: 'No pending OTP',
      });
    }

    // Check if expired
    const now = new Date();
    const isExpired = now > otp.expiresAt;

    if (isExpired) {
      return res.status(200).json({
        exists: false,
        expired: true,
        message: 'OTP has expired',
      });
    }

    // Calculate time remaining
    const secondsRemaining = Math.floor((otp.expiresAt - now) / 1000);

    res.status(200).json({
      exists: true,
      email: otp.email,
      attemptsRemaining: 5 - otp.attempts,
      secondsRemaining,
      expiresAt: otp.expiresAt,
    });
  } catch (error) {
    console.error('[OTP_STATUS_ERROR]', error);
    res.status(500).json({
      error: 'OTP_STATUS_ERROR',
      message: 'Failed to get OTP status',
    });
  }
});

module.exports = router;
