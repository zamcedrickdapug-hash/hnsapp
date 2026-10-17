/**
 * Vehicle Management Controller
 * 
 * Manages fleet operations:
 * - Register and configure vehicles
 * - Monitor capacity and availability
 * - Track maintenance
 * - Manage vehicle-driver assignments
 * - Monitor vehicle health and compliance
 */

const Vehicle = require('../models/Vehicle');
const User = require('../models/User');
const TripAssignment = require('../models/TripAssignment');
const VehicleCapacityService = require('../services/vehicleCapacityService');
const { getIo } = require('../socket');

class VehicleManagementController {
  /**
   * Register new vehicle
   * 
   * POST /api/vehicles
   */
  static async registerVehicle(req, res) {
    try {
      const {
        plateNumber,
        vehicleType,
        seatCapacity,
        vin,
        manufacturer,
        model,
        yearManufactured,
        color,
        licenseExpiry,
        insurancePolicyNumber,
        insuranceExpiry,
        gpsDeviceId,
        maxTravelRadius,
        maxEstimatedDelay,
      } = req.body;
      
      const operatorId = req.user._id;
      
      // Validation
      if (!plateNumber || !vehicleType || !seatCapacity) {
        return res.status(400).json({
          success: false,
          error: 'Plate number, vehicle type, and seat capacity are required',
        });
      }
      
      const validVehicleTypes = ['sedan', 'mpv', 'van', 'minibus'];
      if (!validVehicleTypes.includes(vehicleType)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid vehicle type',
          validTypes: validVehicleTypes,
        });
      }
      
      // Check plate number unique
      const existing = await Vehicle.findOne({ plateNumber });
      if (existing) {
        return res.status(400).json({
          success: false,
          error: 'Vehicle with this plate number already exists',
        });
      }
      
      // Create vehicle
      const vehicle = new Vehicle({
        plateNumber,
        vehicleType,
        seatCapacity,
        vin,
        manufacturer,
        model,
        yearManufactured,
        color,
        operatorId,
        licenseExpiry,
        insurancePolicyNumber,
        insuranceExpiry,
        gpsDeviceId,
        maxTravelRadius: maxTravelRadius || 50,
        maxEstimatedDelay: maxEstimatedDelay || 15,
        hasGPSTracker: !!gpsDeviceId,
      });
      
      await vehicle.save();
      
      res.status(201).json({
        success: true,
        vehicle: this._formatVehicleResponse(vehicle),
        message: 'Vehicle registered successfully',
      });
    } catch (error) {
      console.error('Vehicle registration error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to register vehicle',
        message: error.message,
      });
    }
  }
  
  /**
   * Get vehicle details
   * 
   * GET /api/vehicles/:vehicleId
   */
  static async getVehicle(req, res) {
    try {
      const { vehicleId } = req.params;
      
      const vehicle = await Vehicle.findById(vehicleId).populate('assignedDriver', 'fullName');
      
      if (!vehicle) {
        return res.status(404).json({
          success: false,
          error: 'Vehicle not found',
        });
      }
      
      // Get active trips
      const activeTrips = await TripAssignment.find({
        vehicleId,
        status: { $in: ['assigned', 'confirmed', 'in_progress'] },
      }).select('tripNumber studentName pickupPoints');
      
      res.json({
        success: true,
        vehicle: this._formatVehicleResponse(vehicle),
        activeTrips: activeTrips.map(t => ({
          tripId: t._id,
          tripNumber: t.tripNumber,
          pickupCount: t.pickupPoints.length,
        })),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch vehicle',
        message: error.message,
      });
    }
  }
  
  /**
   * Assign driver to vehicle
   * 
   * POST /api/vehicles/:vehicleId/assign-driver
   */
  static async assignDriver(req, res) {
    try {
      const { vehicleId } = req.params;
      const { driverId } = req.body;
      
      const vehicle = await Vehicle.findById(vehicleId);
      if (!vehicle) {
        return res.status(404).json({
          success: false,
          error: 'Vehicle not found',
        });
      }
      
      const driver = await User.findOne({ _id: driverId, role: 'driver', status: 'approved' });
      if (!driver) {
        return res.status(404).json({
          success: false,
          error: 'Driver not found or not approved',
        });
      }
      
      // Check driver not already assigned
      const alreadyAssigned = await Vehicle.findOne({
        assignedDriver: driverId,
        _id: { $ne: vehicleId },
      });
      
      if (alreadyAssigned) {
        return res.status(400).json({
          success: false,
          error: 'Driver already assigned to another vehicle',
        });
      }
      
      vehicle.assignedDriver = driverId;
      await vehicle.save();
      
      res.json({
        success: true,
        vehicle: this._formatVehicleResponse(vehicle),
        message: 'Driver assigned successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to assign driver',
        message: error.message,
      });
    }
  }
  
  /**
   * Remove driver assignment
   * 
   * POST /api/vehicles/:vehicleId/remove-driver
   */
  static async removeDriver(req, res) {
    try {
      const { vehicleId } = req.params;
      
      const vehicle = await Vehicle.findById(vehicleId);
      if (!vehicle) {
        return res.status(404).json({
          success: false,
          error: 'Vehicle not found',
        });
      }
      
      vehicle.assignedDriver = null;
      vehicle.status = 'available';
      await vehicle.save();
      
      res.json({
        success: true,
        vehicle: this._formatVehicleResponse(vehicle),
        message: 'Driver removed successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to remove driver',
        message: error.message,
      });
    }
  }
  
  /**
   * Update vehicle location
   * 
   * PATCH /api/vehicles/:vehicleId/location
   */
  static async updateLocation(req, res) {
    try {
      const { vehicleId } = req.params;
      const { latitude, longitude, address } = req.body;
      
      if (!latitude || !longitude) {
        return res.status(400).json({
          success: false,
          error: 'Latitude and longitude required',
        });
      }
      
      const vehicle = await Vehicle.findByIdAndUpdate(
        vehicleId,
        {
          currentLocation: {
            type: 'Point',
            coordinates: [longitude, latitude],
            address: address || '',
            updatedAt: new Date(),
          },
        },
        { returnDocument: 'after' }
      );
      
      if (!vehicle) {
        return res.status(404).json({
          success: false,
          error: 'Vehicle not found',
        });
      }
      
      res.json({
        success: true,
        vehicle: this._formatVehicleResponse(vehicle),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to update location',
        message: error.message,
      });
    }
  }
  
  /**
   * Get fleet capacity status
   * 
   * GET /api/vehicles/fleet/capacity
   */
  static async getFleetCapacity(req, res) {
    try {
      const operatorId = req.user._id;
      
      const status = await VehicleCapacityService.getFleetCapacityStatus(operatorId);
      
      res.json({
        success: true,
        fleetStatus: status,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch fleet status',
        message: error.message,
      });
    }
  }
  
  /**
   * Get vehicle maintenance status
   * 
   * GET /api/vehicles/:vehicleId/maintenance
   */
  static async getMaintenanceStatus(req, res) {
    try {
      const { vehicleId } = req.params;
      
      const status = await VehicleCapacityService.getMaintenanceStatus(vehicleId);
      
      if (!status) {
        return res.status(404).json({
          success: false,
          error: 'Vehicle not found',
        });
      }
      
      res.json({
        success: true,
        maintenanceStatus: status,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch maintenance status',
        message: error.message,
      });
    }
  }
  
  /**
   * Schedule maintenance
   * 
   * POST /api/vehicles/:vehicleId/maintenance
   */
  static async scheduleMaintenance(req, res) {
    try {
      const { vehicleId } = req.params;
      const { maintenanceDate, description, type } = req.body;
      
      const vehicle = await Vehicle.findById(vehicleId);
      if (!vehicle) {
        return res.status(404).json({
          success: false,
          error: 'Vehicle not found',
        });
      }
      
      vehicle.maintenanceHistory.push({
        date: new Date(),
        type: type || 'preventive',
        description,
      });
      
      vehicle.lastMaintenanceDate = new Date();
      vehicle.nextMaintenanceDate = new Date(maintenanceDate);
      
      if (maintenanceDate < new Date()) {
        vehicle.status = 'maintenance';
      }
      
      await vehicle.save();
      
      res.json({
        success: true,
        vehicle: this._formatVehicleResponse(vehicle),
        message: 'Maintenance scheduled',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to schedule maintenance',
        message: error.message,
      });
    }
  }
  
  /**
   * Complete maintenance
   * 
   * POST /api/vehicles/:vehicleId/maintenance/complete
   */
  static async completeMaintenance(req, res) {
    try {
      const { vehicleId } = req.params;
      
      const vehicle = await Vehicle.findById(vehicleId);
      if (!vehicle) {
        return res.status(404).json({
          success: false,
          error: 'Vehicle not found',
        });
      }
      
      vehicle.status = 'available';
      vehicle.nextMaintenanceDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days
      
      await vehicle.save();
      
      res.json({
        success: true,
        vehicle: this._formatVehicleResponse(vehicle),
        message: 'Maintenance completed',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to complete maintenance',
        message: error.message,
      });
    }
  }
  
  /**
   * List fleet vehicles
   * 
   * GET /api/vehicles?status=...&type=...
   */
  static async listVehicles(req, res) {
    try {
      const { status, vehicleType, limit = 50, skip = 0 } = req.query;
      const operatorId = req.user._id;
      
      const filter = { operatorId };
      if (status) filter.status = status;
      if (vehicleType) filter.vehicleType = vehicleType;
      
      const vehicles = await Vehicle.find(filter)
        .populate('assignedDriver', 'fullName phone')
        .sort({ plateNumber: 1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip));
      
      const total = await Vehicle.countDocuments(filter);
      
      res.json({
        success: true,
        vehicles: vehicles.map(v => this._formatVehicleResponse(v)),
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip),
          remaining: Math.max(0, total - (parseInt(skip) + parseInt(limit))),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch vehicles',
        message: error.message,
      });
    }
  }
  
  /**
   * Format vehicle response
   */
  static _formatVehicleResponse(vehicle) {
    return {
      id: vehicle._id,
      plateNumber: vehicle.plateNumber,
      type: vehicle.vehicleType,
      capacity: {
        total: vehicle.seatCapacity,
        current: vehicle.currentPassengers,
        available: vehicle.availableSeats,
        utilization: parseFloat(((vehicle.currentPassengers / vehicle.seatCapacity) * 100).toFixed(1)),
      },
      details: {
        manufacturer: vehicle.manufacturer,
        model: vehicle.model,
        year: vehicle.yearManufactured,
        color: vehicle.color,
        vin: vehicle.vin,
      },
      assignment: {
        driver: vehicle.assignedDriver,
        activeTrips: vehicle.activeTrips?.length || 0,
      },
      location: vehicle.currentLocation,
      status: vehicle.status,
      availability: vehicle.isAvailable,
      compliance: {
        licenseExpiry: vehicle.licenseExpiry,
        insurancePolicyNumber: vehicle.insurancePolicyNumber,
        insuranceExpiry: vehicle.insuranceExpiry,
        gpsTracker: vehicle.hasGPSTracker,
        sos: vehicle.hasSOS,
        childSeatBelts: vehicle.hasChildSeatBelts,
      },
      maintenance: {
        lastMaintenance: vehicle.lastMaintenanceDate,
        nextMaintenance: vehicle.nextMaintenanceDate,
        history: vehicle.maintenanceHistory.slice(0, 5),
      },
      stats: {
        totalTrips: vehicle.totalTripsCompleted,
        totalDistance: vehicle.totalDistanceTraveled,
        averageRating: vehicle.averageRating,
      },
    };
  }
}

module.exports = VehicleManagementController;
