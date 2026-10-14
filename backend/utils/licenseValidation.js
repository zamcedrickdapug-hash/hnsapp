/**
 * Professional Driver License Validation Utility
 * Handles all driver license validation rules for HNSAPP
 * Safety-first school transportation validation
 */

const DRIVER_VALIDATION_RULES = {
  MINIMUM_AGE: 21,
  MAXIMUM_AGE: 75,
  LICENSE_EXPIRY_DAYS_WARNING: 30, // Warn if expiring within 30 days
  MAX_FILE_SIZE_MB: 10,
  ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png', 'application/pdf'],
  ALLOWED_FILE_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.pdf'],
};

const REQUIRED_DOCUMENTS = [
  'licenseFront',
  'licenseBack',
  'selfieVerification',
  'nbiClearance',
  'vehicleOrCr', // OR/CR - Official Receipt / Certificate of Registration
];

/**
 * Calculate age from date of birth
 * @param {Date|string} dateOfBirth
 * @returns {number} Age in years
 */
function calculateAge(dateOfBirth) {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
}

/**
 * Validate driver is at least minimum age
 * @param {Date|string} dateOfBirth
 * @returns {object} { isValid, message, age }
 */
function validateDriverAge(dateOfBirth) {
  if (!dateOfBirth) {
    return {
      isValid: false,
      message: 'Date of birth is required',
      age: null,
    };
  }

  const age = calculateAge(dateOfBirth);

  if (age < DRIVER_VALIDATION_RULES.MINIMUM_AGE) {
    return {
      isValid: false,
      message: `Applicants must be at least ${DRIVER_VALIDATION_RULES.MINIMUM_AGE} years old to apply as a school service driver. You are currently ${age} years old.`,
      age,
    };
  }

  if (age > DRIVER_VALIDATION_RULES.MAXIMUM_AGE) {
    return {
      isValid: false,
      message: `Applicants must be under ${DRIVER_VALIDATION_RULES.MAXIMUM_AGE} years old. You are currently ${age} years old.`,
      age,
    };
  }

  return {
    isValid: true,
    message: null,
    age,
  };
}

/**
 * Validate license expiration date
 * @param {Date|string} expirationDate
 * @returns {object} { isValid, message, daysUntilExpiry, isExpired, expiringsoon }
 */
function validateLicenseExpiration(expirationDate) {
  if (!expirationDate) {
    return {
      isValid: false,
      message: 'License expiration date is required',
      daysUntilExpiry: null,
      isExpired: true,
      expiringSoon: false,
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of today

  const expiry = new Date(expirationDate);
  expiry.setHours(0, 0, 0, 0); // Start of expiration date

  const timeDiff = expiry.getTime() - today.getTime();
  const daysUntilExpiry = Math.ceil(timeDiff / (1000 * 3600 * 24));

  // Expired or expiring today
  if (daysUntilExpiry <= 0) {
    return {
      isValid: false,
      message: 'Your driver\'s license is expired. Please renew your license before applying.',
      daysUntilExpiry: 0,
      isExpired: true,
      expiringsoon: false,
    };
  }

  // Expiring within warning period
  const isExpiringSoon = daysUntilExpiry <= DRIVER_VALIDATION_RULES.LICENSE_EXPIRY_DAYS_WARNING;

  return {
    isValid: true,
    message: null,
    daysUntilExpiry,
    isExpired: false,
    expiringsSoon: isExpiringsSoon,
    expiryDate: expiry.toISOString().split('T')[0],
  };
}

/**
 * Validate license type
 * @param {string} licenseType - 'professional' or 'nonprofessional'
 * @param {boolean} requireProfessional - If true, reject non-professional licenses
 * @returns {object} { isValid, message }
 */
function validateLicenseType(licenseType, requireProfessional = true) {
  const validTypes = ['professional', 'nonprofessional'];

  if (!licenseType || !validTypes.includes(licenseType.toLowerCase())) {
    return {
      isValid: false,
      message: 'Please select a valid license type (Professional or Non-Professional)',
    };
  }

  if (requireProfessional && licenseType.toLowerCase() === 'nonprofessional') {
    return {
      isValid: false,
      message: 'School transportation requires a Professional Driver\'s License.',
    };
  }

  return {
    isValid: true,
    message: null,
  };
}

/**
 * Validate uploaded file
 * @param {object} file - File object with size, type, name
 * @returns {object} { isValid, message, fileSize }
 */
function validateUploadedFile(file) {
  if (!file) {
    return {
      isValid: false,
      message: 'File is required',
    };
  }

  // Check file size
  const fileSizeMB = file.size / (1024 * 1024);
  if (fileSizeMB > DRIVER_VALIDATION_RULES.MAX_FILE_SIZE_MB) {
    return {
      isValid: false,
      message: `File size exceeds ${DRIVER_VALIDATION_RULES.MAX_FILE_SIZE_MB}MB limit. Please upload a smaller file.`,
      fileSize: fileSizeMB,
    };
  }

  // Check file type
  if (!DRIVER_VALIDATION_RULES.ALLOWED_FILE_TYPES.includes(file.type)) {
    return {
      isValid: false,
      message: 'Invalid file type. Please upload an image (JPG, PNG) or PDF.',
    };
  }

  // Check file extension
  const fileName = file.name || '';
  const fileExtension = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
  if (!DRIVER_VALIDATION_RULES.ALLOWED_FILE_EXTENSIONS.includes(fileExtension)) {
    return {
      isValid: false,
      message: 'Invalid file extension. Please upload an image (JPG, PNG) or PDF.',
    };
  }

  return {
    isValid: true,
    message: null,
    fileName,
  };
}

/**
 * Validate all required driver documents are uploaded
 * @param {object} documents - Object containing uploaded documents
 * @returns {object} { isValid, message, missingDocuments }
 */
function validateRequiredDocuments(documents) {
  const missingDocuments = [];

  REQUIRED_DOCUMENTS.forEach((docKey) => {
    if (!documents || !documents[docKey]) {
      missingDocuments.push(docKey);
    }
  });

  if (missingDocuments.length > 0) {
    const docNames = missingDocuments.map((doc) => {
      const nameMap = {
        licenseFront: 'License Front',
        licenseBack: 'License Back',
        selfieVerification: 'Selfie Verification',
        nbiClearance: 'NBI Clearance',
        vehicleOrCr: 'Vehicle OR/CR',
      };
      return nameMap[doc] || doc;
    });

    return {
      isValid: false,
      message: `Missing required documents: ${docNames.join(', ')}`,
      missingDocuments,
    };
  }

  return {
    isValid: true,
    message: null,
    missingDocuments: [],
  };
}

/**
 * Comprehensive driver application validation
 * Validates all aspects of driver application at once
 * @param {object} driverData - Driver application data
 * @returns {object} { isValid, errors, warnings, age }
 */
function validateDriverApplication(driverData) {
  const errors = [];
  const warnings = [];
  let age = null;

  // Validate date of birth and age
  const ageValidation = validateDriverAge(driverData.dateOfBirth);
  age = ageValidation.age;
  if (!ageValidation.isValid) {
    errors.push(ageValidation.message);
  }

  // Validate license expiration
  const expirationValidation = validateLicenseExpiration(driverData.licenseExpirationDate);
  if (!expirationValidation.isValid) {
    errors.push(expirationValidation.message);
  } else if (expirationValidation.expiringsSoon) {
    warnings.push(`Your license is expiring soon (${expirationValidation.daysUntilExpiry} days). Please renew after approval.`);
  }

  // Validate license type
  const licenseTypeValidation = validateLicenseType(driverData.licenseType, true);
  if (!licenseTypeValidation.isValid) {
    errors.push(licenseTypeValidation.message);
  }

  // Validate required documents
  const documentsValidation = validateRequiredDocuments(driverData.documents);
  if (!documentsValidation.isValid) {
    errors.push(documentsValidation.message);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    age,
  };
}

/**
 * Check if active driver's license has expired (for auto-suspension)
 * @param {Date} licenseExpirationDate
 * @returns {boolean} True if license is expired
 */
function isLicenseExpired(licenseExpirationDate) {
  if (!licenseExpirationDate) return true;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const expiry = new Date(licenseExpirationDate);
  expiry.setHours(0, 0, 0, 0);
  
  return expiry.getTime() < today.getTime();
}

/**
 * Check if license is expiring soon
 * @param {Date} licenseExpirationDate
 * @returns {boolean} True if expiring within warning period
 */
function isLicenseExpiringSoon(licenseExpirationDate) {
  if (!licenseExpirationDate) return true;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const expiry = new Date(licenseExpirationDate);
  expiry.setHours(0, 0, 0, 0);
  
  const timeDiff = expiry.getTime() - today.getTime();
  const daysUntilExpiry = Math.ceil(timeDiff / (1000 * 3600 * 24));
  
  return daysUntilExpiry > 0 && daysUntilExpiry <= DRIVER_VALIDATION_RULES.LICENSE_EXPIRY_DAYS_WARNING;
}

module.exports = {
  DRIVER_VALIDATION_RULES,
  REQUIRED_DOCUMENTS,
  calculateAge,
  validateDriverAge,
  validateLicenseExpiration,
  validateLicenseType,
  validateUploadedFile,
  validateRequiredDocuments,
  validateDriverApplication,
  isLicenseExpired,
  isLicenseExpiringSoon,
};
