/**
 * Phase 3 - Professional Onboarding Routes for HNSAPP
 * Handles multi-step parent signup and driver application workflows
 */

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const OTP = require('../models/OTP');
const { sendOTPEmail } = require('../utils/emailService');
const {
  validateEmail,
  validatePhoneNumber,
  validatePasswordStrength,
  validateParentSignup,
} = require('../utils/onboardingValidation');

/**
 * POST /api/phase3/parent/register
 * PARENT SIGNUP STEP 1 - Account Information
 * Creates parent account with basic info (email, password, phone)
 */
router.post('/parent/register', async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      gender,
      email,
      contactNumber,
      password,
      confirmPassword,
    } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !gender || !email || !contactNumber || !password) {
      return res.status(400).json({
        error: 'MISSING_FIELDS',
        message: 'All fields are required',
      });
    }

    // Comprehensive validation
    const validation = validateParentSignup({
      firstName,
      lastName,
      gender,
      email,
      contactNumber,
      password,
      confirmPassword,
    });

    if (!validation.valid) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Validation failed',
        errors: validation.errors,
      });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        error: 'EMAIL_EXISTS',
        message: 'Email already registered',
      });
    }

    console.log('[PHASE3_PARENT_REGISTER] Creating parent account:', {
      email,
      firstName,
      lastName,
    });

    // Create parent user
    const newParent = new User({
      role: 'parent',
      fullName: `${firstName} ${lastName}`,
      firstName,
      lastName,
      gender,
      email: email.toLowerCase(),
      phone: contactNumber,
      passwordHash: password,
      status: 'pending',
      accountState: 'active',
      isVerified: false,
    });

    await newParent.save();

    // Generate OTP for email verification
    const otpData = await OTP.generateOTP(email.toLowerCase(), 5); // 5 minutes

    // Send OTP email
    const emailResult = await sendOTPEmail(email.toLowerCase(), otpData.code);

    if (!emailResult.success) {
      console.warn('[PHASE3_PARENT_REGISTER] Failed to send OTP email but continuing');
    }

    console.log('[PHASE3_PARENT_REGISTER] Parent account created:', {
      userId: newParent._id,
      email: newParent.email,
    });

    res.status(201).json({
      message: 'Parent account created. Please verify your email.',
      userId: newParent._id,
      email: newParent.email,
      nextStep: 'OTP_VERIFICATION',
      otpExpiresAt: otpData.expiresAt,
      timerSeconds: 300,
    });
  } catch (error) {
    console.error('[PHASE3_PARENT_REGISTER_ERROR]', error);
    res.status(500).json({
      error: 'REGISTRATION_ERROR',
      message: 'Failed to create parent account',
    });
  }
});

/**
 * POST /api/phase3/parent/verify-email
 * PARENT SIGNUP STEP 2 - OTP Email Verification
 * Verifies OTP and marks email as verified
 */
router.post('/parent/verify-email', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        error: 'MISSING_FIELDS',
        message: 'Email and OTP code are required',
      });
    }

    // Find valid OTP
    const otp = await OTP.findValidOTP(email.toLowerCase());
    if (!otp) {
      return res.status(400).json({
        error: 'OTP_NOT_FOUND',
        message: 'No valid OTP found. Please request a new one.',
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

    // Find and update user
    const user = await User.findOne({ email: email.toLowerCase(), role: 'parent' });
    if (!user) {
      return res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'Parent account not found',
      });
    }

    // Mark email as verified
    user.isVerified = true;
    user.emailVerifiedAt = new Date();
    await user.save();

    // Mark OTP as verified
    await otp.markAsVerified();

    console.log('[PHASE3_PARENT_VERIFY] Email verified:', {
      userId: user._id,
      email: user.email,
    });

    res.status(200).json({
      message: 'Email verified successfully',
      userId: user._id,
      email: user.email,
      nextStep: 'CHILD_INFORMATION',
    });
  } catch (error) {
    console.error('[PHASE3_PARENT_VERIFY_ERROR]', error);
    res.status(500).json({
      error: 'VERIFICATION_ERROR',
      message: 'Failed to verify email',
    });
  }
});

/**
 * POST /api/phase3/parent/add-children
 * PARENT SIGNUP STEP 3 - Child Information
 * Adds one or more children to parent account
 */
router.post('/parent/add-children', async (req, res) => {
  try {
    const { userId, children } = req.body;

    if (!userId || !children || !Array.isArray(children) || children.length === 0) {
      return res.status(400).json({
        error: 'INVALID_DATA',
        message: 'User ID and at least one child are required',
      });
    }

    if (children.length > 10) {
      return res.status(400).json({
        error: 'TOO_MANY_CHILDREN',
        message: 'Maximum 10 children per account',
      });
    }

    const user = await User.findById(userId);
    if (!user || user.role !== 'parent') {
      return res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'Parent account not found',
      });
    }

    // Validate each child
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (!child.fullName || !child.age || !child.schoolName) {
        return res.status(400).json({
          error: 'INVALID_CHILD_DATA',
          message: `Child ${i + 1}: Name, age, and school name are required`,
        });
      }
    }

    // Add children to user
    user.children = children.map((child) => ({
      fullName: child.fullName,
      gender: child.gender || 'not specified',
      age: parseInt(child.age),
      schoolName: child.schoolName,
      gradeLevel: child.gradeLevel || '',
      pickupAddress: child.pickupAddress || '',
      dropoffAddress: child.dropoffAddress || '',
      medicalNotes: child.medicalNotes || '',
      addedAt: new Date(),
    }));

    await user.save();

    console.log('[PHASE3_PARENT_CHILDREN] Children added:', {
      userId: user._id,
      count: children.length,
    });

    res.status(200).json({
      message: `${children.length} child/children added successfully`,
      userId: user._id,
      childrenCount: user.children.length,
      nextStep: 'GPS_LOCATION_SETUP',
    });
  } catch (error) {
    console.error('[PHASE3_PARENT_CHILDREN_ERROR]', error);
    res.status(500).json({
      error: 'CHILDREN_ERROR',
      message: 'Failed to add children',
    });
  }
});

/**
 * POST /api/phase3/parent/set-location
 * PARENT SIGNUP STEP 4 - GPS Location Setup
 * Saves pickup location GPS coordinates
 */
router.post('/parent/set-location', async (req, res) => {
  try {
    const { userId, latitude, longitude, address } = req.body;

    if (!userId || latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        error: 'MISSING_LOCATION',
        message: 'User ID and GPS coordinates required',
      });
    }

    // Validate coordinates
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || lat < -90 || lat > 90) {
      return res.status(400).json({
        error: 'INVALID_LATITUDE',
        message: 'Invalid latitude (-90 to 90)',
      });
    }

    if (isNaN(lng) || lng < -180 || lng > 180) {
      return res.status(400).json({
        error: 'INVALID_LONGITUDE',
        message: 'Invalid longitude (-180 to 180)',
      });
    }

    const user = await User.findById(userId);
    if (!user || user.role !== 'parent') {
      return res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'Parent account not found',
      });
    }

    // Save GPS coordinates
    user.pickupLocation = {
      latitude: lat,
      longitude: lng,
      address: address || '',
      setAt: new Date(),
    };

    await user.save();

    console.log('[PHASE3_PARENT_LOCATION] GPS coordinates saved:', {
      userId: user._id,
      latitude: lat,
      longitude: lng,
    });

    res.status(200).json({
      message: 'Location saved successfully',
      userId: user._id,
      location: {
        latitude: lat,
        longitude: lng,
        address: user.pickupLocation.address,
      },
      nextStep: 'TERMS_AND_AGREEMENTS',
    });
  } catch (error) {
    console.error('[PHASE3_PARENT_LOCATION_ERROR]', error);
    res.status(500).json({
      error: 'LOCATION_ERROR',
      message: 'Failed to set location',
    });
  }
});

/**
 * POST /api/phase3/parent/accept-agreements
 * PARENT SIGNUP STEP 5 - Terms & Safety Agreements
 * Parent accepts all required agreements
 */
router.post('/parent/accept-agreements', async (req, res) => {
  try {
    const {
      userId,
      acceptTerms,
      acceptPrivacy,
      acceptSafetyAgreement,
      acceptGPSMonitoring,
    } = req.body;

    if (!userId) {
      return res.status(400).json({
        error: 'MISSING_USER_ID',
        message: 'User ID is required',
      });
    }

    // Validate all agreements are accepted
    if (!acceptTerms || !acceptPrivacy || !acceptSafetyAgreement || !acceptGPSMonitoring) {
      return res.status(400).json({
        error: 'AGREEMENTS_NOT_ACCEPTED',
        message: 'All agreements must be accepted to continue',
      });
    }

    const user = await User.findById(userId);
    if (!user || user.role !== 'parent') {
      return res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'Parent account not found',
      });
    }

    // Mark agreements as accepted
    user.agreements = {
      termsAccepted: true,
      termsAcceptedAt: new Date(),
      privacyAccepted: true,
      privacyAcceptedAt: new Date(),
      safetyAgreementAccepted: true,
      safetyAgreementAcceptedAt: new Date(),
      gpsMonitoringAccepted: true,
      gpsMonitoringAcceptedAt: new Date(),
    };

    // Complete onboarding
    user.status = 'approved';
    user.onboardingCompleted = true;
    user.onboardingCompletedAt = new Date();

    await user.save();

    console.log('[PHASE3_PARENT_ONBOARDING_COMPLETE] Parent onboarding finished:', {
      userId: user._id,
      email: user.email,
      childrenCount: user.children?.length || 0,
    });

    res.status(200).json({
      message: 'Parent onboarding completed successfully!',
      userId: user._id,
      email: user.email,
      fullName: user.fullName,
      status: user.status,
      childrenCount: user.children?.length || 0,
      nextStep: 'LOGIN_TO_DASHBOARD',
    });
  } catch (error) {
    console.error('[PHASE3_PARENT_AGREEMENTS_ERROR]', error);
    res.status(500).json({
      error: 'AGREEMENTS_ERROR',
      message: 'Failed to accept agreements',
    });
  }
});

/**
 * POST /api/phase3/driver/apply
 * DRIVER APPLICATION STEP 1-5 - Complete driver application
 * Drivers submit full application (not instant approval)
 */
router.post('/driver/apply', async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      gender,
      email,
      contactNumber,
      password,
      dateOfBirth,
      address,
      yearsExperience,
      licenseNumber,
      licenseType,
      licenseExpirationDate,
      nbiClearanceNumber,
      vehicleType,
      vehicleBrand,
      vehicleColor,
      plateNumber,
      seatingCapacity,
    } = req.body;

    // Validate all required fields
    const requiredFields = [
      'firstName', 'lastName', 'gender', 'email', 'contactNumber', 'password',
      'dateOfBirth', 'yearsExperience', 'licenseNumber', 'licenseType',
      'licenseExpirationDate', 'vehicleType', 'vehicleBrand', 'plateNumber',
      'seatingCapacity',
    ];

    const missingFields = requiredFields.filter((field) => !req.body[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'MISSING_FIELDS',
        message: 'All required fields must be provided',
        missingFields,
      });
    }

    // Validate email
    const emailVal = validateEmail(email);
    if (!emailVal.valid) {
      return res.status(400).json({
        error: 'INVALID_EMAIL',
        message: emailVal.message,
      });
    }

    // Validate phone
    const phoneVal = validatePhoneNumber(contactNumber);
    if (!phoneVal.valid) {
      return res.status(400).json({
        error: 'INVALID_PHONE',
        message: phoneVal.message,
      });
    }

    // Validate password strength
    const passwordVal = validatePasswordStrength(password);
    if (!passwordVal.valid) {
      return res.status(400).json({
        error: 'WEAK_PASSWORD',
        message: passwordVal.message,
        strength: passwordVal.strength,
      });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        error: 'EMAIL_EXISTS',
        message: 'Email already registered',
      });
    }

    console.log('[PHASE3_DRIVER_APPLY] New driver application:', {
      email,
      firstName,
      lastName,
      vehicleType,
    });

    // Create driver user with PENDING status (not approved)
    const newDriver = new User({
      role: 'driver',
      fullName: `${firstName} ${lastName}`,
      firstName,
      lastName,
      gender,
      email: email.toLowerCase(),
      phone: phoneVal.formattedNumber || contactNumber,
      passwordHash: password,
      homeAddress: address,
      driver: {
        dateOfBirth: new Date(dateOfBirth),
        licenseNumber,
        licenseType,
        licenseExpirationDate: new Date(licenseExpirationDate),
        yearsExperience: parseInt(yearsExperience),
        nbiClearanceNumber,
        vehicleDetails: {
          type: vehicleType,
          brand: vehicleBrand,
          color: vehicleColor,
          plateNumber: plateNumber.toUpperCase(),
          seatingCapacity: parseInt(seatingCapacity),
        },
      },
      status: 'reviewing', // Driver is in review status, NOT approved
      accountState: 'active',
    });

    await newDriver.save();

    console.log('[PHASE3_DRIVER_APPLY] Driver application submitted:', {
      userId: newDriver._id,
      email: newDriver.email,
      status: 'reviewing',
    });

    res.status(201).json({
      message: 'Driver application submitted successfully!',
      driverId: newDriver._id,
      email: newDriver.email,
      status: newDriver.status,
      message2: 'Your application is under review. You will receive an email once it is approved.',
      nextStep: 'WAIT_FOR_APPROVAL',
    });
  } catch (error) {
    console.error('[PHASE3_DRIVER_APPLY_ERROR]', error);
    res.status(500).json({
      error: 'APPLICATION_ERROR',
      message: 'Failed to submit driver application',
    });
  }
});

/**
 * GET /api/phase3/driver/application-status/:driverId
 * Check driver application status
 */
router.get('/driver/application-status/:driverId', async (req, res) => {
  try {
    const { driverId } = req.params;

    const driver = await User.findById(driverId);
    if (!driver || driver.role !== 'driver') {
      return res.status(404).json({
        error: 'DRIVER_NOT_FOUND',
        message: 'Driver not found',
      });
    }

    res.status(200).json({
      applicationStatus: driver.status,
      accountState: driver.accountState,
      email: driver.email,
      fullName: driver.fullName,
      canLogin: driver.status === 'approved' && driver.accountState === 'active',
      message:
        driver.status === 'approved'
          ? 'Application approved! You can now login.'
          : `Application status: ${driver.status}. Please check your email for updates.`,
    });
  } catch (error) {
    console.error('[PHASE3_DRIVER_STATUS_ERROR]', error);
    res.status(500).json({
      error: 'STATUS_ERROR',
      message: 'Failed to check application status',
    });
  }
});

module.exports = router;
