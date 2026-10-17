const User = require('../models/User');
const DriverStatus = require('../models/DriverStatus');
const Vehicle = require('../models/Vehicle');
const VanRequest = require('../models/VanRequest');

const SERVICE_ZONE_CONFIG = {
  zones: {
    LCC: { latitude: 14.8129, longitude: 121.0716, radiusMeters: 6000 },
    FAIRVIEW: { latitude: 14.7118, longitude: 121.0679, radiusMeters: 6000 },
  },
  vehicleZonesByPlate: { NAB4827: 'FAIRVIEW' },
  defaultVehicleZone: 'LCC',
};

const ACTIVE_REQUEST_STATUSES = ['accepted', 'arrived', 'picked_up'];

const distanceInMeters = (first, second) => {
  const coordinates = [
    first?.latitude,
    first?.longitude,
    second?.latitude,
    second?.longitude,
  ];
  const [lat1, lon1, lat2, lon2] = coordinates.map(Number);

  if (
    coordinates.some((coordinate) =>
      coordinate === null ||
      coordinate === undefined ||
      (typeof coordinate === 'string' && coordinate.trim() === '') ||
      typeof coordinate === 'boolean'
    ) ||
    ![lat1, lon1, lat2, lon2].every((value) => Number.isFinite(value)) ||
    lat1 < -90 ||
    lat1 > 90 ||
    lat2 < -90 ||
    lat2 > 90 ||
    lon1 < -180 ||
    lon1 > 180 ||
    lon2 < -180 ||
    lon2 > 180
  ) {
    return Number.POSITIVE_INFINITY;
  }

  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const getVehicleServiceZone = (vehicle) => {
  const plateNumber = String(vehicle?.plateNumber || '').trim().toUpperCase();
  const zoneName = SERVICE_ZONE_CONFIG.vehicleZonesByPlate[plateNumber]
    || SERVICE_ZONE_CONFIG.defaultVehicleZone;
  return SERVICE_ZONE_CONFIG.zones[zoneName];
};

const isLocationWithinZone = (location, zone) =>
  distanceInMeters(location, zone) <= zone.radiusMeters;

const isPickupInAnyServiceZone = (location) =>
  Object.values(SERVICE_ZONE_CONFIG.zones).some((zone) => isLocationWithinZone(location, zone));

const isDriverAssignedToSchool = (driver, school) => {
  if (!school) return true;
  const schoolId = String(school?._id || school);
  return (driver?.driver?.assignedSchools || []).some((assignedSchool) =>
    String(assignedSchool?._id || assignedSchool) === schoolId
  );
};

const areScheduleDetailsCompatible = (request, activeRequests) => {
  const requestedSlot = request.slot || 'AM';
  const requestedDate = request.scheduledDate ? new Date(request.scheduledDate).getTime() : null;

  return activeRequests.every((activeRequest) => {
    const activeSlot = activeRequest.slot || 'AM';
    const activeDate = activeRequest.scheduledDate ? new Date(activeRequest.scheduledDate).getTime() : null;
    return activeSlot === requestedSlot && activeDate === requestedDate;
  });
};

const getDriverEligibility = async (driverId, request) => {
  const [driver, driverStatus, vehicle, activeRequests] = await Promise.all([
    User.findById(driverId).select('role status accountState driver.assignedSchools'),
    DriverStatus.findOne({ driverId }).select('isOnline'),
    Vehicle.findOne({ assignedDriver: driverId }),
    VanRequest.find({
      driver: driverId,
      status: { $in: ACTIVE_REQUEST_STATUSES },
    }).select('seatsNeeded slot scheduledDate acceptedAt'),
  ]);

  const usedSeats = activeRequests.reduce(
    (total, activeRequest) => total + Math.max(1, Number(activeRequest.seatsNeeded) || 1),
    0
  );
  const freeSeats = vehicle ? vehicle.seatCapacity - usedSeats : 0;
  const slotDateCompatible = request
    ? areScheduleDetailsCompatible(request, activeRequests)
    : true;
  const schoolAssigned = request
    ? isDriverAssignedToSchool(driver, request.school)
    : true;
  const isApprovedAndActive = driver?.role === 'driver'
    && driver.status === 'approved'
    && (driver.accountState || 'active') === 'active';
  const isOnline = driverStatus?.isOnline === true;
  const pickupWithinServiceZone = request
    ? Boolean(vehicle && (
      request.school
        ? isPickupInAnyServiceZone(request.requesterLocation)
        : isLocationWithinZone(request.requesterLocation, getVehicleServiceZone(vehicle))
    ))
    : true;

  return {
    driver,
    vehicle,
    activeRequests,
    usedSeats,
    freeSeats,
    slotDateCompatible,
    schoolAssigned,
    isApprovedAndActive,
    isOnline,
    pickupWithinServiceZone,
    eligible: isApprovedAndActive
      && isOnline
      && Boolean(vehicle)
      && freeSeats >= (request ? Math.max(1, Number(request.seatsNeeded) || 1) : 1)
      && slotDateCompatible
      && schoolAssigned
      && pickupWithinServiceZone,
  };
};

module.exports = {
  SERVICE_ZONE_CONFIG,
  distanceInMeters,
  getDriverEligibility,
  isPickupInAnyServiceZone,
  areScheduleDetailsCompatible,
};
