const DriverStatus = require('../models/DriverStatus');
const Vehicle = require('../models/Vehicle');

const releaseVanRequestAssignment = async ({ driverId, requestId, vehicleId }) => {
  if (!driverId || !requestId) return;

  await DriverStatus.findOneAndUpdate(
    { driverId, activeRequestId: requestId },
    {
      $set: {
        activeRequestId: null,
        status: 'online',
        isOnline: true,
        lastStatusUpdate: new Date(),
      },
    }
  );

  if (vehicleId) {
    await Vehicle.findOneAndUpdate(
      { _id: vehicleId, assignedDriver: driverId, status: 'assigned' },
      { $set: { status: 'available', isAvailable: true } }
    );
  }
};

module.exports = { releaseVanRequestAssignment };
