/**
 * Transportation Routes
 * 
 * Main routing for transportation system operations:
 * - Trip management (booking, assignment, status)
 * - Incident reporting (reports, investigations, driver strikes)
 * - Vehicle management (fleet, capacity, maintenance)
 * - Real-time tracking and status updates
 * 
 * All routes require authentication
 * Role-based access control applied via middleware
 */

const express = require('express');
const router = express.Router();

// Controllers
const TripManagementController = require('../controllers/tripManagementController');
const IncidentManagementController = require('../controllers/incidentManagementController');
const VehicleManagementController = require('../controllers/vehicleManagementController');

// Middleware
const { authMiddleware } = require('../middleware/authMiddleware');

// All transportation routes require authentication
router.use(authMiddleware);

// ====== TRIP MANAGEMENT ======

/**
 * Create new trip
 * POST /api/transportation/trips
 * 
 * Body: { pickupPoints, schoolId, schoolName, schoolLocation, tripType, preferredDriverId? }
 * Response: { trip, assignmentDetails, routeDetails }
 */
router.post('/trips', TripManagementController.createTrip);

/**
 * Get trip details
 * GET /api/transportation/trips/:tripId
 * 
 * Response: { trip }
 */
router.get('/trips/:tripId', TripManagementController.getTrip);

/**
 * Update trip status
 * PATCH /api/transportation/trips/:tripId/status
 * 
 * Body: { newStatus, reason? }
 * Response: { trip, message }
 */
router.patch('/trips/:tripId/status', TripManagementController.updateTripStatus);

/**
 * Get trip history with filters
 * GET /api/transportation/trips
 * 
 * Query: status?, driverId?, schoolId?, startDate?, endDate?, limit?, skip?
 * Response: { trips[], pagination }
 */
router.get('/trips', TripManagementController.getTripHistory);

// ====== INCIDENT MANAGEMENT ======

/**
 * Report incident
 * POST /api/incidents/report
 * 
 * Body: { tripId, incidentType, severity, description, location, affectedStudents?, evidenceUrls? }
 * Response: { report, message }
 */
router.post('/incidents/report', IncidentManagementController.reportIncident);

/**
 * Get incident details
 * GET /api/incidents/:reportId
 * 
 * Response: { report }
 */
router.get('/incidents/:reportId', IncidentManagementController.getIncident);

/**
 * Start incident investigation
 * POST /api/incidents/:reportId/investigate
 * 
 * Admin/Operator only
 * Response: { report, message }
 */
router.post('/incidents/:reportId/investigate', IncidentManagementController.startInvestigation);

/**
 * Add investigation note
 * POST /api/incidents/:reportId/notes
 * 
 * Body: { note, attachmentUrl? }
 * Response: { report, message }
 */
router.post('/incidents/:reportId/notes', IncidentManagementController.addInvestigationNote);

/**
 * Complete investigation
 * POST /api/incidents/:reportId/complete
 * 
 * Body: { findings: { driverAtFault, faultDescription, complianceIssue, safetyRisk } }
 * Response: { report, actionsRecommended }
 */
router.post(
  '/incidents/:reportId/complete',
  IncidentManagementController.completeInvestigation
);

/**
 * Resolve incident
 * POST /api/incidents/:reportId/resolve
 * 
 * Body: { resolutionSummary }
 * Response: { report, message }
 */
router.post('/incidents/:reportId/resolve', IncidentManagementController.resolveIncident);

/**
 * Get incident history
 * GET /api/incidents
 * 
 * Query: status?, driverId?, incidentType?, startDate?, endDate?, limit?, skip?
 * Response: { reports[], pagination }
 */
router.get('/incidents', IncidentManagementController.getIncidentHistory);

/**
 * Get incident statistics
 * GET /api/incidents/statistics
 * 
 * Query: days?
 * Response: { statistics }
 */
router.get('/incidents/statistics', IncidentManagementController.getIncidentStatistics);

/**
 * Get driver safety profile
 * GET /api/drivers/:driverId/safety
 * 
 * Response: { profile }
 */
router.get('/drivers/:driverId/safety', IncidentManagementController.getDriverSafetyProfile);

// ====== VEHICLE MANAGEMENT ======

/**
 * Register new vehicle
 * POST /api/vehicles
 * 
 * Body: { plateNumber, vehicleType, seatCapacity, vin?, manufacturer?, model?, yearManufactured?, color?, licenseExpiry, insurancePolicyNumber?, insuranceExpiry?, gpsDeviceId?, maxTravelRadius?, maxEstimatedDelay? }
 * Response: { vehicle, message }
 */
router.post('/vehicles', VehicleManagementController.registerVehicle);

/**
 * Get vehicle details
 * GET /api/vehicles/:vehicleId
 * 
 * Response: { vehicle, activeTrips }
 */
router.get('/vehicles/:vehicleId', VehicleManagementController.getVehicle);

/**
 * Assign driver to vehicle
 * POST /api/vehicles/:vehicleId/assign-driver
 * 
 * Body: { driverId }
 * Response: { vehicle, message }
 */
router.post('/vehicles/:vehicleId/assign-driver', VehicleManagementController.assignDriver);

/**
 * Remove driver from vehicle
 * POST /api/vehicles/:vehicleId/remove-driver
 * 
 * Response: { vehicle, message }
 */
router.post('/vehicles/:vehicleId/remove-driver', VehicleManagementController.removeDriver);

/**
 * Update vehicle location
 * PATCH /api/vehicles/:vehicleId/location
 * 
 * Body: { latitude, longitude, address? }
 * Response: { vehicle }
 */
router.patch('/vehicles/:vehicleId/location', VehicleManagementController.updateLocation);

/**
 * Get fleet capacity status
 * GET /api/vehicles/fleet/capacity
 * 
 * Response: { fleetStatus }
 */
router.get('/fleet/capacity', VehicleManagementController.getFleetCapacity);

/**
 * Get vehicle maintenance status
 * GET /api/vehicles/:vehicleId/maintenance
 * 
 * Response: { maintenanceStatus }
 */
router.get('/vehicles/:vehicleId/maintenance', VehicleManagementController.getMaintenanceStatus);

/**
 * Schedule maintenance
 * POST /api/vehicles/:vehicleId/maintenance
 * 
 * Body: { maintenanceDate, description, type? }
 * Response: { vehicle, message }
 */
router.post('/vehicles/:vehicleId/maintenance', VehicleManagementController.scheduleMaintenance);

/**
 * Complete maintenance
 * POST /api/vehicles/:vehicleId/maintenance/complete
 * 
 * Response: { vehicle, message }
 */
router.post(
  '/vehicles/:vehicleId/maintenance/complete',
  VehicleManagementController.completeMaintenance
);

/**
 * List fleet vehicles
 * GET /api/vehicles
 * 
 * Query: status?, vehicleType?, limit?, skip?
 * Response: { vehicles[], pagination }
 */
router.get('/', VehicleManagementController.listVehicles);

// ====== ERROR HANDLING ======

router.use((err, req, res, next) => {
  console.error('Transportation route error:', err);
  
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Transportation operation failed',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

module.exports = router;
