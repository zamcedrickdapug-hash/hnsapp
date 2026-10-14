/**
 * License validation middleware for HNSAPP
 * Ensures all driver-related endpoints check license validity
 */

const { isLicenseExpired } = require('../utils/licenseValidation');

/**
 * Middleware: Check if driver's license is valid
 * Used for driver application submission and active driver endpoints
 */
const checkDriverLicenseValidity = (req, res, next) => {
  try {
    const { licenseExpirationDate } = req.body;

    if (licenseExpirationDate && isLicenseExpired(licenseExpirationDate)) {
      return res.status(400).json({
        error: 'EXPIRED_LICENSE',
        message: 'Your driver\'s license is expired. Please renew your license before applying.',
      });
    }

    next();
  } catch (error) {
    console.error('[LICENSE_VALIDATION]', error);
    res.status(500).json({ error: 'Validation error' });
  }
};

/**
 * Middleware: Prevent suspended drivers from accepting trips
 * Checks if driver is suspended due to license expiry
 */
const preventSuspendedDriver = (req, res, next) => {
  try {
    if (req.user && req.user.role === 'driver') {
      if (req.user.accountState === 'suspended') {
        return res.status(403).json({
          error: 'DRIVER_SUSPENDED',
          message: `Driver account is suspended: ${req.user.suspensionReason || 'Administrative action'}`,
          suspensionReason: req.user.suspensionReason,
        });
      }
    }

    next();
  } catch (error) {
    console.error('[SUSPENSION_CHECK]', error);
    res.status(500).json({ error: 'Suspension check error' });
  }
};

/**
 * Middleware: Auto-suspend drivers with expired licenses
 * Should run periodically or on driver login
 */
const autoSuspendExpiredLicenses = (req, res, next) => {
  try {
    if (req.user && req.user.role === 'driver' && req.user.accountState === 'active') {
      if (req.user.driver && req.user.driver.licenseExpirationDate) {
        if (isLicenseExpired(req.user.driver.licenseExpirationDate)) {
          // Mark for suspension in next save
          req.suspendReason = 'license_expired';
        }
      }
    }

    next();
  } catch (error) {
    console.error('[AUTO_SUSPEND_CHECK]', error);
    next(); // Don't block request on error
  }
};

module.exports = {
  checkDriverLicenseValidity,
  preventSuspendedDriver,
  autoSuspendExpiredLicenses,
};
