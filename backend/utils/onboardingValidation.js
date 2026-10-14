/**
 * Onboarding Validation Utilities for HNSAPP
 * Parent signup, driver application, and general validation
 */

/**
 * PARENT SIGNUP VALIDATION
 */

const { isValidPhoneNumber, normalizePhoneNumber } = require('./validation');

/**
 * Validate local and international Philippine mobile formats.
 */
function validatePhoneNumber(phone) {
  if (!phone) {
    return {
      valid: false,
      message: 'Phone number is required',
    };
  }

  if (!isValidPhoneNumber(phone)) {
    return {
      valid: false,
      message: 'Enter a valid Philippine mobile number.',
    };
  }

  return {
    valid: true,
    message: 'Valid phone number',
    formattedNumber: normalizePhoneNumber(phone),
  };
}

/**
 * Validate email address
 */
function validateEmail(email) {
  if (!email) {
    return {
      valid: false,
      message: 'Email is required',
    };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    return {
      valid: false,
      message: 'Invalid email format',
    };
  }

  return {
    valid: true,
    message: 'Valid email',
  };
}

/**
 * Validate password strength
 * Requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
function validatePasswordStrength(password) {
  if (!password) {
    return {
      valid: false,
      message: 'Password is required',
      strength: 0,
    };
  }

  const requirements = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  };

  const metRequirements = Object.values(requirements).filter(Boolean).length;
  const strength = Math.ceil((metRequirements / 5) * 100);

  if (!requirements.length) {
    return {
      valid: false,
      message: 'Password must be at least 8 characters',
      strength,
      requirements,
    };
  }

  if (!requirements.uppercase) {
    return {
      valid: false,
      message: 'Password must contain at least one uppercase letter',
      strength,
      requirements,
    };
  }

  if (!requirements.lowercase) {
    return {
      valid: false,
      message: 'Password must contain at least one lowercase letter',
      strength,
      requirements,
    };
  }

  if (!requirements.number) {
    return {
      valid: false,
      message: 'Password must contain at least one number',
      strength,
      requirements,
    };
  }

  if (!requirements.special) {
    return {
      valid: false,
      message: 'Password must contain at least one special character (!@#$%^&*)',
      strength,
      requirements,
    };
  }

  return {
    valid: true,
    message: 'Strong password',
    strength: 100,
    requirements,
  };
}

/**
 * Validate names (first name, last name)
 */
function validateName(name, fieldName = 'Name') {
  if (!name || name.trim().length === 0) {
    return {
      valid: false,
      message: `${fieldName} is required`,
    };
  }

  if (name.length < 2) {
    return {
      valid: false,
      message: `${fieldName} must be at least 2 characters`,
    };
  }

  if (name.length > 50) {
    return {
      valid: false,
      message: `${fieldName} must be less than 50 characters`,
    };
  }

  if (!/^[a-zA-Z\s\-']+$/.test(name)) {
    return {
      valid: false,
      message: `${fieldName} can only contain letters, spaces, hyphens, and apostrophes`,
    };
  }

  return {
    valid: true,
    message: `${fieldName} is valid`,
  };
}

/**
 * Validate gender selection
 */
function validateGender(gender) {
  const validGenders = ['male', 'female', 'other'];

  if (!gender || !validGenders.includes(gender.toLowerCase())) {
    return {
      valid: false,
      message: 'Please select a valid gender',
    };
  }

  return {
    valid: true,
    message: 'Gender selected',
  };
}

/**
 * CHILD INFORMATION VALIDATION
 */

/**
 * Validate child age
 */
function validateChildAge(age) {
  const ageNum = parseInt(age);

  if (!age || isNaN(ageNum)) {
    return {
      valid: false,
      message: 'Age is required',
    };
  }

  if (ageNum < 3) {
    return {
      valid: false,
      message: 'Child must be at least 3 years old',
    };
  }

  if (ageNum > 25) {
    return {
      valid: false,
      message: 'Age seems invalid. Maximum 25 years',
    };
  }

  return {
    valid: true,
    message: 'Valid age',
    age: ageNum,
  };
}

/**
 * Validate school information
 */
function validateSchoolInfo(schoolName, gradeLevel) {
  if (!schoolName || schoolName.trim().length === 0) {
    return {
      valid: false,
      message: 'School name is required',
    };
  }

  if (!gradeLevel || gradeLevel.trim().length === 0) {
    return {
      valid: false,
      message: 'Grade level is required',
    };
  }

  if (schoolName.length > 100) {
    return {
      valid: false,
      message: 'School name is too long',
    };
  }

  return {
    valid: true,
    message: 'School information valid',
  };
}

/**
 * Validate address
 */
function validateAddress(address) {
  if (!address || address.trim().length === 0) {
    return {
      valid: false,
      message: 'Address is required',
    };
  }

  if (address.length < 5) {
    return {
      valid: false,
      message: 'Address must be at least 5 characters',
    };
  }

  if (address.length > 200) {
    return {
      valid: false,
      message: 'Address is too long',
    };
  }

  return {
    valid: true,
    message: 'Valid address',
  };
}

/**
 * DRIVER APPLICATION VALIDATION
 */

/**
 * Validate years of driving experience
 */
function validateDrivingExperience(years) {
  const yearsNum = parseInt(years);

  if (isNaN(yearsNum)) {
    return {
      valid: false,
      message: 'Years of experience is required',
    };
  }

  if (yearsNum < 1) {
    return {
      valid: false,
      message: 'Driver must have at least 1 year of driving experience',
    };
  }

  if (yearsNum > 60) {
    return {
      valid: false,
      message: 'Years of experience seems invalid',
    };
  }

  return {
    valid: true,
    message: 'Valid driving experience',
    years: yearsNum,
  };
}

/**
 * Validate license number format
 */
function validateLicenseNumber(licenseNumber) {
  if (!licenseNumber || licenseNumber.trim().length === 0) {
    return {
      valid: false,
      message: 'License number is required',
    };
  }

  if (licenseNumber.length < 5) {
    return {
      valid: false,
      message: 'Invalid license number format',
    };
  }

  if (licenseNumber.length > 20) {
    return {
      valid: false,
      message: 'License number too long',
    };
  }

  return {
    valid: true,
    message: 'Valid license number',
  };
}

/**
 * Validate vehicle details
 */
function validateVehicleDetails(vehicleType, brand, color, plateNumber) {
  const validTypes = ['van', 'suv', 'minibus', 'school_vehicle'];

  if (!vehicleType || !validTypes.includes(vehicleType.toLowerCase())) {
    return {
      valid: false,
      message: 'Please select a valid vehicle type',
    };
  }

  if (!brand || brand.trim().length === 0) {
    return {
      valid: false,
      message: 'Vehicle brand is required',
    };
  }

  if (!color || color.trim().length === 0) {
    return {
      valid: false,
      message: 'Vehicle color is required',
    };
  }

  if (!plateNumber || plateNumber.trim().length === 0) {
    return {
      valid: false,
      message: 'Plate number is required',
    };
  }

  // Basic plate number validation (can be customized for PH format)
  const plateRegex = /^[A-Z]{3}-\d{3,4}|[A-Z]{1,2}\d{3,5}$/;
  if (!plateRegex.test(plateNumber.toUpperCase())) {
    return {
      valid: false,
      message: 'Invalid plate number format',
    };
  }

  return {
    valid: true,
    message: 'Vehicle details valid',
  };
}

/**
 * Validate seating capacity
 */
function validateSeatingCapacity(capacity) {
  const capacityNum = parseInt(capacity);

  if (isNaN(capacityNum)) {
    return {
      valid: false,
      message: 'Seating capacity is required',
    };
  }

  if (capacityNum < 3) {
    return {
      valid: false,
      message: 'Vehicle must have at least 3 seats',
    };
  }

  if (capacityNum > 50) {
    return {
      valid: false,
      message: 'Seating capacity seems invalid',
    };
  }

  return {
    valid: true,
    message: 'Valid seating capacity',
    capacity: capacityNum,
  };
}

/**
 * Comprehensive parent signup validation
 */
function validateParentSignup(data) {
  const errors = [];

  // Validate names
  const firstNameVal = validateName(data.firstName, 'First Name');
  if (!firstNameVal.valid) errors.push(firstNameVal.message);

  const lastNameVal = validateName(data.lastName, 'Last Name');
  if (!lastNameVal.valid) errors.push(lastNameVal.message);

  // Validate gender
  const genderVal = validateGender(data.gender);
  if (!genderVal.valid) errors.push(genderVal.message);

  // Validate email
  const emailVal = validateEmail(data.email);
  if (!emailVal.valid) errors.push(emailVal.message);

  // Validate phone
  const phoneVal = validatePhoneNumber(data.contactNumber);
  if (!phoneVal.valid) errors.push(phoneVal.message);

  // Validate password
  const passwordVal = validatePasswordStrength(data.password);
  if (!passwordVal.valid) errors.push(passwordVal.message);

  // Validate password confirmation
  if (data.password !== data.confirmPassword) {
    errors.push('Passwords do not match');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

module.exports = {
  // Phone & Email
  validatePhoneNumber,
  validateEmail,

  // Password & Names
  validatePasswordStrength,
  validateName,
  validateGender,

  // Child Info
  validateChildAge,
  validateSchoolInfo,
  validateAddress,

  // Driver Info
  validateDrivingExperience,
  validateLicenseNumber,
  validateVehicleDetails,
  validateSeatingCapacity,

  // Comprehensive
  validateParentSignup,
};
