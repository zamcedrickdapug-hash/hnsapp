/**
 * Driver Application Routes for HNSAPP
 * Handles driver registration with professional license validation
 */

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const {
  validateDriverAge,
  validateLicenseExpiration,
  validateLicenseType,
  validateRequiredDocuments,
  validateDriverApplication,
} = require('../utils/licenseValidation');
const { requireAuth, requireDriver } = require('../middleware/auth');
const { checkDriverLicenseValidity, preventSuspendedDriver } = require('../middleware/licenseValidation');

/**
 * POST /api/drivers/apply
 * Submit driver application with license validation
 * Strict validation: age, license expiration, documents
 */
router.post('/apply', async (req, res) => {
  try {
    const {
      dateOfBirth,
      licenseNumber,
      licenseType,
      licenseExpirationDate,
      documents,
      userId,
    } = req.body;

    console.log('[DRIVER_APPLICATION] New application:', {
      userId,
      licenseType,
      dateOfBirth,
      licenseExpirationDate,
    });

    // Validate date of birth and age
    const ageValidation = validateDriverAge(dateOfBirth);
    if (!ageValidation.isValid) {
      return res.status(400).json({
        error: 'INVALID_AGE',
        message: ageValidation.message,
        age: ageValidation.age,
      });
    }

    // Validate license expiration
    const expirationValidation = validateLicenseExpiration(licenseExpirationDate);
    if (!expirationValidation.isValid) {
      return res.status(400).json({
        error: 'EXPIRED_LICENSE',
        message: expirationValidation.message,
        daysUntilExpiry: expirationValidation.daysUntilExpiry,
      });
    }

    // Validate license type
    const licenseTypeValidation = validateLicenseType(licenseType, true);
    if (!licenseTypeValidation.isValid) {
      return res.status(400).json({
        error: 'INVALID_LICENSE_TYPE',
        message: licenseTypeValidation.message,
      });
    }

    // Validate required documents exist (backend check)
    const documentsValidation = validateRequiredDocuments(documents);
    if (!documentsValidation.isValid) {
      return res.status(400).json({
        error: 'MISSING_DOCUMENTS',
        message: documentsValidation.message,
        missingDocuments: documentsValidation.missingDocuments,
      });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    if (user.role !== 'driver') {
      return res.status(403).json({
        error: 'INVALID_ROLE',
        message: 'Only drivers can submit applications',
      });
    }

    // Update driver information
    user.driver = {
      dateOfBirth: new Date(dateOfBirth),
      licenseNumber,
      licenseType,
      licenseExpirationDate: new Date(licenseExpirationDate),
      licenseVerified: false,
      documents: documents, // In real implementation, handle file uploads properly
      documentStatus: 'pending',
    };

    // Set application status to pending review
    user.status = 'reviewing';
    user.accountState = 'active'; // Can be active while reviewing

    await user.save();

    console.log('[DRIVER_APPLICATION] Application accepted:', {
      userId,
      status: 'reviewing',
      ageValidation: ageValidation.age,
      expirationValidation: expirationValidation.daysUntilExpiry,
    });

    res.status(201).json({
      message: 'Driver application submitted successfully',
      driver: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        status: user.status,
        driver: {
          age: ageValidation.age,
          licenseType,
          licenseNumber,
          licenseExpirationDate,
          daysUntilExpiry: expirationValidation.daysUntilExpiry,
        },
      },
    });
  } catch (error) {
    console.error('[DRIVER_APPLICATION_ERROR]', error);
    res.status(500).json({
      error: 'APPLICATION_ERROR',
      message: 'Failed to submit application',
    });
  }
});

/**
 * GET /api/drivers/:driverId
 * Get driver information for admin review
 * Shows license status, age, document verification
 */
router.get('/:driverId', async (req, res) => {
  try {
    const { driverId } = req.params;

    const driver = await User.findById(driverId);
    if (!driver || driver.role !== 'driver') {
      return res.status(404).json({
        error: 'DRIVER_NOT_FOUND',
        message: 'Driver not found',
      });
    }

    // Calculate age
    const driverData = driver.driver || {};
    const ageValidation = validateDriverAge(driverData.dateOfBirth);
    const expirationValidation = validateLicenseExpiration(driverData.licenseExpirationDate);

    // Determine license status
    let licenseStatus = 'pending';
    if (expirationValidation.isExpired) {
      licenseStatus = 'expired';
    } else if (expirationValidation.expiringSoon) {
      licenseStatus = 'expiring_soon';
    } else if (driverData.licenseVerified) {
      licenseStatus = 'verified';
    }

    res.json({
      id: driver._id,
      fullName: driver.fullName,
      email: driver.email,
      phone: driver.phone,
      status: driver.status,
      accountState: driver.accountState,
      suspensionReason: driver.suspensionReason,
      age: ageValidation.age,
      licenseStatus,
      daysUntilExpiry: expirationValidation.daysUntilExpiry,
      driver: {
        dateOfBirth: driverData.dateOfBirth,
        licenseNumber: driverData.licenseNumber,
        licenseType: driverData.licenseType,
        licenseExpirationDate: driverData.licenseExpirationDate,
        licenseVerified: driverData.licenseVerified,
        documents: driverData.documents,
        documentStatus: driverData.documentStatus,
        documentRejectionReason: driverData.documentRejectionReason,
      },
    });
  } catch (error) {
    console.error('[DRIVER_GET_ERROR]', error);
    res.status(500).json({
      error: 'FETCH_ERROR',
      message: 'Failed to fetch driver information',
    });
  }
});

/**
 * PUT /api/drivers/:driverId/approve
 * Admin approves driver application
 * Validates license before approval
 */
router.put('/:driverId/approve', async (req, res) => {
  try {
    const { driverId } = req.params;

    const driver = await User.findById(driverId);
    if (!driver || driver.role !== 'driver') {
      return res.status(404).json({
        error: 'DRIVER_NOT_FOUND',
        message: 'Driver not found',
      });
    }

    // Validate license before approving
    const driverData = driver.driver || {};
    const expirationValidation = validateLicenseExpiration(driverData.licenseExpirationDate);

    if (expirationValidation.isExpired) {
      return res.status(400).json({
        error: 'EXPIRED_LICENSE',
        message: 'Cannot approve driver with expired license',
      });
    }

    driver.status = 'approved';
    driver.accountState = 'active';
    driver.driver.licenseVerified = true;
    driver.driver.documentStatus = 'verified';

    await driver.save();

    console.log('[DRIVER_APPROVED]', driverId);

    res.json({
      message: 'Driver application approved',
      driver: {
        id: driver._id,
        status: driver.status,
        accountState: driver.accountState,
      },
    });
  } catch (error) {
    console.error('[DRIVER_APPROVE_ERROR]', error);
    res.status(500).json({
      error: 'APPROVAL_ERROR',
      message: 'Failed to approve driver',
    });
  }
});

/**
 * PUT /api/drivers/:driverId/decline
 * Admin declines driver application
 */
router.put('/:driverId/decline', async (req, res) => {
  try {
    const { driverId } = req.params;
    const { reason } = req.body;

    const driver = await User.findById(driverId);
    if (!driver || driver.role !== 'driver') {
      return res.status(404).json({
        error: 'DRIVER_NOT_FOUND',
        message: 'Driver not found',
      });
    }

    driver.status = 'declined';
    driver.declineReason = reason || 'Application did not meet requirements';
    driver.accountState = 'suspended';
    driver.suspensionReason = 'application_declined';

    await driver.save();

    console.log('[DRIVER_DECLINED]', driverId);

    res.json({
      message: 'Driver application declined',
      driver: {
        id: driver._id,
        status: driver.status,
        declineReason: driver.declineReason,
      },
    });
  } catch (error) {
    console.error('[DRIVER_DECLINE_ERROR]', error);
    res.status(500).json({
      error: 'DECLINE_ERROR',
      message: 'Failed to decline driver',
    });
  }
});

/**
 * PUT /api/drivers/:driverId/suspend-license-expired
 * Auto-suspend driver when license expires
 * Called by scheduled job or manually
 */
router.put('/:driverId/suspend-license-expired', async (req, res) => {
  try {
    const { driverId } = req.params;

    const driver = await User.findById(driverId);
    if (!driver || driver.role !== 'driver') {
      return res.status(404).json({
        error: 'DRIVER_NOT_FOUND',
        message: 'Driver not found',
      });
    }

    const driverData = driver.driver || {};
    const expirationValidation = validateLicenseExpiration(driverData.licenseExpirationDate);

    if (!expirationValidation.isExpired) {
      return res.status(400).json({
        error: 'LICENSE_NOT_EXPIRED',
        message: 'License has not expired yet',
      });
    }

    driver.accountState = 'suspended';
    driver.suspensionReason = 'license_expired';

    await driver.save();

    console.log('[DRIVER_SUSPENDED_LICENSE_EXPIRED]', driverId);

    res.json({
      message: 'Driver suspended due to expired license',
      driver: {
        id: driver._id,
        accountState: driver.accountState,
        suspensionReason: driver.suspensionReason,
      },
    });
  } catch (error) {
    console.error('[DRIVER_SUSPEND_ERROR]', error);
    res.status(500).json({
      error: 'SUSPEND_ERROR',
      message: 'Failed to suspend driver',
    });
  }
});

/**
 * GET /api/drivers
 * Get all drivers (admin only)
 * Returns list with license status indicators
 */
router.get('/', async (req, res) => {
  try {
    const drivers = await User.find({ role: 'driver' });

    const driversWithStatus = drivers.map((driver) => {
      const driverData = driver.driver || {};
      const expirationValidation = validateLicenseExpiration(driverData.licenseExpirationDate);

      let licenseStatus = 'pending';
      if (expirationValidation.isExpired) {
        licenseStatus = 'expired';
      } else if (expirationValidation.expiringSoon) {
        licenseStatus = 'expiring_soon';
      } else if (driverData.licenseVerified) {
        licenseStatus = 'verified';
      }

      return {
        id: driver._id,
        fullName: driver.fullName,
        email: driver.email,
        status: driver.status,
        accountState: driver.accountState,
        licenseStatus,
        daysUntilExpiry: expirationValidation.daysUntilExpiry,
      };
    });

    res.json(driversWithStatus);
  } catch (error) {
    console.error('[DRIVERS_LIST_ERROR]', error);
    res.status(500).json({
      error: 'FETCH_ERROR',
      message: 'Failed to fetch drivers',
    });
  }
});

module.exports = router;
