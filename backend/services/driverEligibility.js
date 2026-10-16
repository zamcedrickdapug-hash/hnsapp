const User = require('../models/User');
const DriverStatus = require('../models/DriverStatus');
const Vehicle = require('../models/Vehicle');
const VanRequest = require('../models/VanRequest');

const ACTIVE_REQUEST_STATUSES = ['accepted', 'arrived', 'picked_up'];

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
    User.findById(driverId).select('role status accountState'),
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
  const isApprovedAndActive = driver?.role === 'driver'
    && driver.status === 'approved'
    && (driver.accountState || 'active') === 'active';
  const isOnline = driverStatus?.isOnline === true;

  return {
    driver,
    vehicle,
    activeRequests,
    usedSeats,
    freeSeats,
    slotDateCompatible,
    isApprovedAndActive,
    isOnline,
    eligible: isApprovedAndActive
      && isOnline
      && Boolean(vehicle)
      && freeSeats >= (request ? Math.max(1, Number(request.seatsNeeded) || 1) : 1)
      && slotDateCompatible,
  };
};

module.exports = { getDriverEligibility, areScheduleDetailsCompatible };
