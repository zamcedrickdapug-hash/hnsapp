import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * useTripStatusManager Hook
 * 
 * Manages real-time trip status updates based on:
 * - Driver location
 * - Trip progress
 * - Distance remaining
 * - Route waypoints
 * 
 * Status Progression:
 * searching → accepted → arrived → picked_up → arrived_at_school → completed
 */

const calculateDistance = (from, to) => {
  if (!from || !to) return Infinity;

  const lat1 = Number(from.latitude || from[0]);
  const lon1 = Number(from.longitude || from[1]);
  const lat2 = Number(to.latitude || to[0]);
  const lon2 = Number(to.longitude || to[1]);

  if (![lat1, lon1, lat2, lon2].every(n => Number.isFinite(n))) {
    return Infinity;
  }

  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // meters
};

export const useTripStatusManager = (
  trip,
  driverLocation,
  socket,
  options = {}
) => {
  const {
    arrivalThresholdMeters = 100, // Within 100m = arrived
    pickupThresholdMeters = 50, // Within 50m = can pick up
    autoUpdateStatus = true,
  } = options;

  const [currentStatus, setCurrentStatus] = useState(trip?.status || 'searching');
  const [distanceToPickup, setDistanceToPickup] = useState(null);
  const [distanceToDestination, setDistanceToDestination] = useState(null);
  const [statusMessage, setStatusMessage] = useState('Waiting for driver...');
  const [progress, setProgress] = useState(0);
  const statusUpdateTimeoutRef = useRef(null);

  // Calculate distances
  useEffect(() => {
    if (!driverLocation || !trip) {
      setDistanceToPickup(null);
      setDistanceToDestination(null);
      return;
    }

    const pickupLoc = trip.requesterLocation;
    const destLoc = trip.status === 'picked_up'
      ? { latitude: 14.81298106386082, longitude: 121.07158042431617 } // School location
      : pickupLoc;

    const distPickup = pickupLoc ? calculateDistance(driverLocation, pickupLoc) : null;
    const distDest = destLoc ? calculateDistance(driverLocation, destLoc) : null;

    setDistanceToPickup(distPickup);
    setDistanceToDestination(distDest);

    console.log(
      `[Status] Distances - Pickup: ${(distPickup / 1000).toFixed(2)}km, Destination: ${(distDest / 1000).toFixed(2)}km`
    );
  }, [driverLocation, trip]);

  // Update status message
  useEffect(() => {
    const status = currentStatus || 'searching';

    const messages = {
      searching: 'Searching for driver...',
      accepted: 'Driver accepted. On the way to pickup!',
      arrived: 'Driver arrived at pickup location!',
      picked_up: 'Student picked up. Heading to school!',
      arrived_at_school: 'Arrived at school!',
      completed: 'Trip completed successfully!',
      cancelled: 'Trip was cancelled',
    };

    setStatusMessage(messages[status] || 'Loading...');

    // Calculate progress percentage
    let progressPercent = 0;
    switch (status) {
      case 'searching':
        progressPercent = 10;
        break;
      case 'accepted':
        progressPercent = 25;
        break;
      case 'arrived':
        progressPercent = 50;
        break;
      case 'picked_up':
        progressPercent = 75;
        break;
      case 'arrived_at_school':
        progressPercent = 95;
        break;
      case 'completed':
        progressPercent = 100;
        break;
      default:
        progressPercent = 0;
    }

    setProgress(progressPercent);
  }, [currentStatus]);

  // Auto-update status based on location proximity
  const checkAndUpdateStatus = useCallback(() => {
    if (!autoUpdateStatus || !driverLocation || !trip) {
      return;
    }

    const status = trip.status || currentStatus;

    // Check if should transition to next status
    if (status === 'accepted' && distanceToPickup !== null && distanceToPickup <= arrivalThresholdMeters) {
      console.log(`[Status] Driver arrived at pickup (${(distanceToPickup / 1000).toFixed(3)}km)`);
      
      // Emit status update to server
      if (socket && socket.connected) {
        socket.emit('trip:status-update', {
          requestId: trip._id,
          newStatus: 'arrived',
          location: driverLocation,
        });
      }
      setCurrentStatus('arrived');
    }

    if (status === 'arrived' && distanceToPickup !== null && distanceToPickup <= pickupThresholdMeters) {
      console.log(`[Status] Driver is ready to pickup (${(distanceToPickup / 1000).toFixed(3)}km)`);
      // Manual action required from driver
    }

    if (status === 'picked_up' && distanceToDestination !== null && distanceToDestination <= arrivalThresholdMeters) {
      console.log(`[Status] Driver arrived at destination (${(distanceToDestination / 1000).toFixed(3)}km)`);
      
      if (socket && socket.connected) {
        socket.emit('trip:status-update', {
          requestId: trip._id,
          newStatus: 'arrived_at_school',
          location: driverLocation,
        });
      }
      setCurrentStatus('arrived_at_school');
    }
  }, [
    autoUpdateStatus,
    driverLocation,
    trip,
    distanceToPickup,
    distanceToDestination,
    arrivalThresholdMeters,
    pickupThresholdMeters,
    socket,
    currentStatus,
  ]);

  // Check status periodically
  useEffect(() => {
    if (!autoUpdateStatus) {
      return;
    }

    checkAndUpdateStatus();

    // Check again in 2 seconds
    statusUpdateTimeoutRef.current = setTimeout(checkAndUpdateStatus, 2000);

    return () => {
      if (statusUpdateTimeoutRef.current) {
        clearTimeout(statusUpdateTimeoutRef.current);
      }
    };
  }, [checkAndUpdateStatus, autoUpdateStatus]);

  // Sync with server updates
  useEffect(() => {
    if (trip?.status) {
      setCurrentStatus(trip.status);
    }
  }, [trip?.status]);

  // Determine if status can be manually triggered
  const canPickup = currentStatus === 'arrived' && distanceToPickup !== null && distanceToPickup <= pickupThresholdMeters;
  const canCompleteSchool = currentStatus === 'picked_up' && distanceToDestination !== null && distanceToDestination <= pickupThresholdMeters;

  return {
    currentStatus,
    statusMessage,
    progress,
    distanceToPickup: distanceToPickup ? Math.round(distanceToPickup) : null, // meters
    distanceToDestination: distanceToDestination ? Math.round(distanceToDestination) : null, // meters
    canPickup,
    canCompleteSchool,
  };
};

export default useTripStatusManager;
