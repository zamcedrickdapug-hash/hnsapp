/**
 * Professional License Validation Component
 * Handles driver license validation with strict safety rules
 * For HNSAPP school transportation platform
 */

export const DRIVER_LICENSE_VALIDATION = {
  MINIMUM_AGE: 21,
  LICENSE_EXPIRY_DAYS_WARNING: 30,
  MAX_FILE_SIZE_MB: 10,
  ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png', 'application/pdf'],
};

const LICENSE_TYPES = [
  {
    value: 'professional',
    label: 'Professional Driver\'s License',
    description: 'Required for school transportation',
    recommended: true,
  },
  {
    value: 'nonprofessional',
    label: 'Non-Professional License',
    description: 'Not eligible for school transportation',
    recommended: false,
  },
];

/**
 * Calculate age from date of birth
 */
export function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return null;
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
 * Validate driver age
 */
export function validateAge(dateOfBirth) {
  const age = calculateAge(dateOfBirth);
  
  if (age === null) {
    return { valid: false, message: 'Date of birth is required', age: null };
  }
  
  if (age < DRIVER_LICENSE_VALIDATION.MINIMUM_AGE) {
    return {
      valid: false,
      message: `Applicants must be at least ${DRIVER_LICENSE_VALIDATION.MINIMUM_AGE} years old. You are ${age} years old.`,
      age,
    };
  }
  
  return { valid: true, message: null, age };
}

/**
 * Validate license expiration date
 */
export function validateLicenseExpiration(expirationDate) {
  if (!expirationDate) {
    return {
      valid: false,
      message: 'License expiration date is required',
      daysUntilExpiry: null,
      isExpired: true,
      expiringSoon: false,
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(expirationDate);
  expiry.setHours(0, 0, 0, 0);

  const timeDiff = expiry.getTime() - today.getTime();
  const daysUntilExpiry = Math.ceil(timeDiff / (1000 * 3600 * 24));

  if (daysUntilExpiry <= 0) {
    return {
      valid: false,
      message: 'Your driver\'s license is expired. Please renew your license before applying.',
      daysUntilExpiry: 0,
      isExpired: true,
      expiringSoon: false,
    };
  }

  const expiringSoon = daysUntilExpiry <= DRIVER_LICENSE_VALIDATION.LICENSE_EXPIRY_DAYS_WARNING;

  return {
    valid: true,
    message: null,
    daysUntilExpiry,
    isExpired: false,
    expiringSoon,
    expiryDate: expiry.toISOString().split('T')[0],
  };
}

/**
 * Validate file upload
 */
export function validateFileUpload(file) {
  if (!file) {
    return { valid: false, message: 'File is required' };
  }

  const fileSizeMB = file.size / (1024 * 1024);
  if (fileSizeMB > DRIVER_LICENSE_VALIDATION.MAX_FILE_SIZE_MB) {
    return {
      valid: false,
      message: `File exceeds ${DRIVER_LICENSE_VALIDATION.MAX_FILE_SIZE_MB}MB limit.`,
    };
  }

  if (!DRIVER_LICENSE_VALIDATION.ALLOWED_FILE_TYPES.includes(file.type)) {
    return {
      valid: false,
      message: 'Invalid file type. Please upload JPG, PNG, or PDF.',
    };
  }

  return { valid: true, message: null };
}

/**
 * Format date for input type="date"
 */
export function formatDateForInput(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

/**
 * Get minimum date for license expiration (today + 1)
 */
export function getMinimumLicenseExpirationDate() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
}

/**
 * Get maximum date for date of birth (21 years ago from today)
 */
export function getMaximumDateOfBirth() {
  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() - DRIVER_LICENSE_VALIDATION.MINIMUM_AGE);
  return maxDate.toISOString().split('T')[0];
}

/**
 * Format license type for display
 */
export function getLicenseTypeLabel(licenseType) {
  const type = LICENSE_TYPES.find((t) => t.value === licenseType);
  return type ? type.label : licenseType;
}

/**
 * Get all license types for dropdown
 */
export function getLicenseTypes() {
  return LICENSE_TYPES;
}

/**
 * Get professional license type only (required for school transportation)
 */
export function getProfessionalLicenseType() {
  return LICENSE_TYPES.filter((t) => t.value === 'professional');
}

/**
 * Validate all driver application data
 */
export function validateDriverApplication(formData) {
  const errors = [];

  // Validate date of birth
  const ageValidation = validateAge(formData.dateOfBirth);
  if (!ageValidation.valid) {
    errors.push(ageValidation.message);
  }

  // Validate license type
  if (!formData.licenseType) {
    errors.push('License type is required');
  }

  // Validate license expiration
  const expirationValidation = validateLicenseExpiration(formData.licenseExpirationDate);
  if (!expirationValidation.valid) {
    errors.push(expirationValidation.message);
  }

  // Validate license number
  if (!formData.licenseNumber || formData.licenseNumber.trim().length === 0) {
    errors.push('License number is required');
  }

  // Validate required documents
  if (!formData.documents.licenseFront) {
    errors.push('License front photo is required');
  }
  if (!formData.documents.licenseBack) {
    errors.push('License back photo is required');
  }
  if (!formData.documents.selfieVerification) {
    errors.push('Selfie verification is required');
  }
  if (!formData.documents.nbiClearance) {
    errors.push('NBI clearance is required');
  }
  if (!formData.documents.vehicleOrCr) {
    errors.push('Vehicle OR/CR is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export default {
  DRIVER_LICENSE_VALIDATION,
  LICENSE_TYPES,
  calculateAge,
  validateAge,
  validateLicenseExpiration,
  validateFileUpload,
  formatDateForInput,
  getMinimumLicenseExpirationDate,
  getMaximumDateOfBirth,
  getLicenseTypeLabel,
  getLicenseTypes,
  getProfessionalLicenseType,
  validateDriverApplication,
};
