const DriverStatus = require('../models/DriverStatus');
const Vehicle = require('../models/Vehicle');
const VanRequest = require('../models/VanRequest');

const releaseVanRequestAssignment = async ({ driverId, requestId, vehicleId }) => {
  if (!driverId || !requestId) return;

  const remainingRequests = await VanRequest.find({
    driver: driverId,
    status: { $in: ['accepted', 'arrived', 'picked_up'] },
  }).sort({ acceptedAt: 1, _id: 1 }).select('_id');

  if (remainingRequests.length > 0) {
    await DriverStatus.findOneAndUpdate(
      { driverId },
      {
        $set: {
          activeRequestId: remainingRequests[0]._id,
          status: 'on-trip',
          isOnline: true,
          lastStatusUpdate: new Date(),
        },
      }
    );

    await Vehicle.findOneAndUpdate(
      { assignedDriver: driverId },
      { $set: { status: 'assigned', isAvailable: false } }
    );
    return;
  }

  await DriverStatus.findOneAndUpdate(
    { driverId },
    {
      $set: {
        activeRequestId: null,
        status: 'online',
        isOnline: true,
        lastStatusUpdate: new Date(),
      },
    }
  );

  await Vehicle.findOneAndUpdate(
    {
      ...(vehicleId ? { _id: vehicleId } : {}),
      assignedDriver: driverId,
    },
    { $set: { status: 'available', isAvailable: true } }
  );
};

module.exports = { releaseVanRequestAssignment };
