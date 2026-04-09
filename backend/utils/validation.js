const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[+]?[-0-9()\s]{7,20}$/;
const STUDENT_ID_REGEX = /^[A-Za-z0-9-]{3,30}$/;
const DRIVER_LICENSE_REGEX = /^[A-Za-z0-9-]{5,30}$/;
const PLATE_REGEX = /^[A-Za-z0-9-]{3,15}$/;

const sanitizeText = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
};

const isStrongPassword = (password) => {
  if (typeof password !== 'string' || password.length < 8) {
    return false;
  }

  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);

  return hasUppercase && hasLowercase && hasDigit;
};

const validateRegistrationPayload = (payload) => {
  const errors = [];

  const role = sanitizeText(payload.role).toLowerCase() || 'parent';

  const fullName = sanitizeText(payload.fullName);
  const email = sanitizeText(payload.email).toLowerCase();
  const phone = sanitizeText(payload.phone);
  const homeAddress = sanitizeText(payload.homeAddress);
  const password = payload.password || '';
  const confirmPassword = payload.confirmPassword || '';

  const studentFullName = sanitizeText(payload.studentFullName);
  const ageValue = Number(payload.age);
  const gradeLevel = sanitizeText(payload.gradeLevel);
  const studentNumber = sanitizeText(payload.studentNumber);
  const schoolName = sanitizeText(payload.schoolName);

  const licenseNumber = sanitizeText(payload.licenseNumber);
  const licenseExpiry = sanitizeText(payload.licenseExpiry);
  const vehicleType = sanitizeText(payload.vehicleType);
  const plateNumber = sanitizeText(payload.plateNumber);
  const yearsOfExperienceValue = Number(payload.yearsOfExperience);

  if (!['parent', 'driver'].includes(role)) {
    errors.push('Please choose a valid role (parent or driver).');
  }

  if (!fullName) {
    errors.push('Full name is required.');
  }

  if (!EMAIL_REGEX.test(email)) {
    errors.push('A valid email address is required.');
  }

  if (!PHONE_REGEX.test(phone)) {
    errors.push('A valid phone number is required.');
  }

  if (homeAddress.length < 5) {
    errors.push('Home address is required.');
  }

  if (!isStrongPassword(password)) {
    errors.push('Password must be at least 8 characters and include uppercase, lowercase, and a number.');
  }

  if (password !== confirmPassword) {
    errors.push('Password and confirm password do not match.');
  }

  if (role === 'parent') {
    if (!studentFullName) {
      errors.push('Student full name is required.');
    }

    if (!Number.isFinite(ageValue) || ageValue < 3 || ageValue > 25) {
      errors.push('Student age must be between 3 and 25.');
    }

    if (!gradeLevel) {
      errors.push('Grade level is required.');
    }

    if (!STUDENT_ID_REGEX.test(studentNumber)) {
      errors.push('Student number must be 3-30 characters (letters, numbers, hyphen).');
    }

    if (!schoolName) {
      errors.push('School name is required.');
    }
  }

  if (role === 'driver') {
    const parsedLicenseExpiry = new Date(licenseExpiry);
    const isValidLicenseDate = !Number.isNaN(parsedLicenseExpiry.getTime());

    if (!DRIVER_LICENSE_REGEX.test(licenseNumber)) {
      errors.push('License number must be 5-30 characters (letters, numbers, hyphen).');
    }

    if (!isValidLicenseDate) {
      errors.push('A valid license expiry date is required.');
    } else if (parsedLicenseExpiry < new Date()) {
      errors.push('Driver license expiry date must be a future date.');
    }

    if (!vehicleType) {
      errors.push('Vehicle type is required.');
    }

    if (!PLATE_REGEX.test(plateNumber)) {
      errors.push('Plate number must be 3-15 characters (letters, numbers, hyphen).');
    }

    if (!Number.isFinite(yearsOfExperienceValue) || yearsOfExperienceValue < 0 || yearsOfExperienceValue > 60) {
      errors.push('Years of experience must be between 0 and 60.');
    }
  }

  return {
    errors,
    data: {
      role,
      fullName,
      email,
      phone,
      homeAddress,
      password,
      student:
        role === 'parent'
          ? {
              fullName: studentFullName,
              age: ageValue,
              gradeLevel,
              studentNumber,
              schoolName,
            }
          : undefined,
      driver:
        role === 'driver'
          ? {
              licenseNumber,
              licenseExpiry,
              vehicleType,
              plateNumber,
              yearsOfExperience: yearsOfExperienceValue,
            }
          : undefined,
    },
  };
};

module.exports = {
  sanitizeText,
  validateRegistrationPayload,
};
