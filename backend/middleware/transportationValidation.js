/**
 * Transportation Validation Middleware
 * 
 * Validates requests for transportation operations:
 * - Route/trip data validation
 * - Capacity constraint checks
 * - Safety requirement verification
 * - Authorization checks for sensitive operations
 */

const Vehicle = require('../models/Vehicle');
const SafetyProfile = require('../models/SafetyProfile');

/**
 * Validate trip creation request
 */
const validateTripCreation = (req, res, next) => {
  const { pickupPoints, schoolLocation, schoolName } = req.body;
  
  // Validate pickup points
  if (!Array.isArray(pickupPoints) || pickupPoints.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'At least one pickup point is required',
    });
  }
  
  // Validate each pickup point
  for (let i = 0; i < pickupPoints.length; i++) {
    const point = pickupPoints[i];
    
    if (!point.studentName) {
      return res.status(400).json({
        success: false,
        error: `Pickup ${i + 1}: Student name required`,
      });
    }
    
    if (!point.pickupLocation || !point.pickupLocation.latitude || !point.pickupLocation.longitude) {
      return res.status(400).json({
        success: false,
        error: `Pickup ${i + 1}: Valid location required`,
      });
    }
    
    if (!point.parentId) {
      return res.status(400).json({
        success: false,
        error: `Pickup ${i + 1}: Parent ID required`,
      });
    }
  }
  
  // Validate school location
  if (
    !schoolLocation ||
    !schoolLocation.latitude ||
    !schoolLocation.longitude ||
    !schoolName
  ) {
    return res.status(400).json({
      success: false,
      error: 'School location and name required',
    });
  }
  
  // Validate GPS coordinates are reasonable
  for (const point of pickupPoints) {
    const { latitude, longitude } = point.pickupLocation;
    
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({
        success: false,
        error: `Invalid coordinates for ${point.studentName}`,
      });
    }
  }
  
  next();
};

/**
 * Validate incident report creation
 */
const validateIncidentReport = (req, res, next) => {
  const { incidentType, severity, description, affectedStudents } = req.body;
  
  if (!incidentType || !severity || !description) {
    return res.status(400).json({
      success: false,
      error: 'Incident type, severity, and description are required',
    });
  }
  
  const validIncidentTypes = [
    'speeding',
    'reckless_driving',
    'traffic_violation',
    'unsafe_behavior',
    'misconduct',
    'late_arrival',
    'wrong_route',
    'passenger_safety',
    'vehicle_maintenance',
    'communication_failure',
    'unauthorized_stop',
    'route_deviation',
    'equipment_failure',
    'accident',
    'near_miss',
    'other',
  ];
  
  const validSeverities = ['low', 'medium', 'high', 'critical'];
  
  if (!validIncidentTypes.includes(incidentType)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid incident type',
      validTypes: validIncidentTypes,
    });
  }
  
  if (!validSeverities.includes(severity)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid severity level',
      validSeverities,
    });
  }
  
  if (description.trim().length < 10) {
    return res.status(400).json({
      success: false,
      error: 'Description must be at least 10 characters',
    });
  }
  
  next();
};

/**
 * Validate vehicle registration
 */
const validateVehicleRegistration = (req, res, next) => {
  const { plateNumber, vehicleType, seatCapacity, licenseExpiry } = req.body;
  
  if (!plateNumber || !vehicleType || !seatCapacity) {
    return res.status(400).json({
      success: false,
      error: 'Plate number, vehicle type, and seat capacity are required',
    });
  }
  
  // Validate plate number format (basic)
  if (!plateNumber.match(/^[A-Z0-9]{4,10}$/)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid plate number format',
    });
  }
  
  const validVehicleTypes = ['sedan', 'mpv', 'van', 'minibus'];
  if (!validVehicleTypes.includes(vehicleType)) {
    return res.status(400).json({
      success: false,
      error: `Invalid vehicle type. Valid types: ${validVehicleTypes.join(', ')}`,
    });
  }
  
  // Validate seat capacity
  if (seatCapacity < 3 || seatCapacity > 50) {
    return res.status(400).json({
      success: false,
      error: 'Seat capacity must be between 3 and 50',
    });
  }
  
  // Validate license expiry
  if (licenseExpiry && new Date(licenseExpiry) < new Date()) {
    return res.status(400).json({
      success: false,
      error: 'License expiry date cannot be in the past',
    });
  }
  
  next();
};

/**
 * Check vehicle capacity before assignment
 */
const checkVehicleCapacity = async (req, res, next) => {
  const { vehicleId } = req.params;
  const { studentCount } = req.body;
  
  try {
    const vehicle = await Vehicle.findById(vehicleId).select('seatCapacity currentPassengers');
    
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle not found',
      });
    }
    
    const availableSeats = vehicle.seatCapacity - vehicle.currentPassengers;
    
    if (studentCount && availableSeats < studentCount) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient vehicle capacity',
        available: availableSeats,
        requested: studentCount,
      });
    }
    
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Capacity check error',
      message: error.message,
    });
  }
};

/**
 * Verify driver safety status
 */
const verifyDriverSafety = async (req, res, next) => {
  const { driverId } = req.params || req.body;
  
  if (!driverId) {
    return next();
  }
  
  try {
    const safetyProfile = await SafetyProfile.findOne({ driverId }).select(
      'isSuspended isEligibleToDrive licenseExpiry nbiClearanceExpiry'
    );
    
    if (!safetyProfile) {
      return res.status(400).json({
        success: false,
        error: 'Driver safety profile not found',
      });
    }
    
    if (safetyProfile.isSuspended) {
      return res.status(400).json({
        success: false,
        error: 'Driver is currently suspended',
      });
    }
    
    if (!safetyProfile.isEligibleToDrive) {
      return res.status(400).json({
        success: false,
        error: 'Driver is not eligible to drive',
        status: safetyProfile.eligibilityStatus,
      });
    }
    
    if (new Date() > safetyProfile.licenseExpiry) {
      return res.status(400).json({
        success: false,
        error: 'Driver license has expired',
      });
    }
    
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Safety verification error',
      message: error.message,
    });
  }
};

/**
 * Authorize incident investigation
 * Only admin or operator can investigate
 */
const authorizeInvestigation = (req, res, next) => {
  if (!['admin', 'operator'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      error: 'Only admin or operator can conduct investigations',
    });
  }
  
  next();
};

/**
 * Authorize incident resolution
 * Only admin can resolve critical incidents
 */
const authorizeResolution = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Only admin can resolve incidents',
    });
  }
  
  next();
};

/**
 * Validate status transition
 */
const validateStatusTransition = (validTransitions) => {
  return (req, res, next) => {
    const { newStatus } = req.body;
    
    if (!newStatus) {
      return res.status(400).json({
        success: false,
        error: 'New status is required',
      });
    }
    
    if (!validTransitions[newStatus]) {
      return res.status(400).json({
        success: false,
        error: `Invalid status: ${newStatus}`,
        validTransitions: Object.keys(validTransitions),
      });
    }
    
    next();
  };
};

/**
 * Check for duplicate plate number
 */
const checkUniquePlateNumber = async (req, res, next) => {
  const { plateNumber } = req.body;
  const { vehicleId } = req.params;
  
  if (!plateNumber) {
    return next();
  }
  
  try {
    const existing = await Vehicle.findOne({
      plateNumber: plateNumber.toUpperCase(),
      _id: { $ne: vehicleId }, // Allow same vehicle if updating
    }).select('_id');
    
    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'A vehicle with this plate number already exists',
      });
    }
    
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Plate number validation error',
      message: error.message,
    });
  }
};

module.exports = {
  validateTripCreation,
  validateIncidentReport,
  validateVehicleRegistration,
  checkVehicleCapacity,
  verifyDriverSafety,
  authorizeInvestigation,
  authorizeResolution,
  validateStatusTransition,
  checkUniquePlateNumber,
};
