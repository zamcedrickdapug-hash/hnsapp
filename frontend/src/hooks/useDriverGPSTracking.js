import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useDriverGPSTracking Hook
 * 
 * Manages real-time GPS tracking for drivers using navigator.geolocation.watchPosition()
 * Emits location updates to Socket.io for real-time parent/admin tracking
 * 
 * Features:
 * - Continuous GPS tracking with configurable update interval
 * - Error handling for GPS permission denied, unavailable, etc.
 * - Offline state detection
 * - Speed and heading calculation
 * - Automatic cleanup on unmount
 */

const GPS_UPDATE_INTERVAL = 2000; // Update every 2 seconds
const GPS_ACCURACY_THRESHOLD = 100; // Only use readings with <100m accuracy

export const useDriverGPSTracking = (socket, requestId, options = {}) => {
  const {
    enabled = false,
    minAccuracy = GPS_ACCURACY_THRESHOLD,
    updateInterval = GPS_UPDATE_INTERVAL,
  } = options;

  const [location, setLocation] = useState(null);
  const [speed, setSpeed] = useState(0);
  const [heading, setHeading] = useState(0);
  const [accuracy, setAccuracy] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const watchIdRef = useRef(null);
  const lastLocationRef = useRef(null);
  const lastUpdateTimeRef = useRef(0);
  const locationHistoryRef = useRef([]);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      console.log('[GPS] Device is online');
      setIsOnline(true);
    };
    const handleOffline = () => {
      console.log('[GPS] Device is offline');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Calculate bearing between two points
  const calculateBearing = useCallback((from, to) => {
    if (!from || !to) return 0;

    const dLon = to.longitude - from.longitude;
    const y = Math.sin(dLon) * Math.cos(to.latitude);
    const x =
      Math.cos(from.latitude) * Math.sin(to.latitude) -
      Math.sin(from.latitude) * Math.cos(to.latitude) * Math.cos(dLon);

    const bearing = Math.atan2(y, x);
    return ((bearing * 180) / Math.PI + 360) % 360;
  }, []);

  // Calculate speed from location history
  const calculateSpeed = useCallback((current, previous) => {
    if (!current || !previous) return 0;

    const lat1 = previous.latitude;
    const lon1 = previous.longitude;
    const lat2 = current.latitude;
    const lon2 = current.longitude;

    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    // Calculate time difference in hours
    const timeDiff = (current.timestamp - previous.timestamp) / 3600000;

    return timeDiff > 0 ? distance / timeDiff : 0; // Speed in km/h
  }, []);

  // Handle successful geolocation update
  const handleLocationSuccess = useCallback(
    (position) => {
      const {
        coords: {
          latitude,
          longitude,
          accuracy: gpsAccuracy,
          speed: gpsSpeed,
          heading: gpsHeading,
        },
        timestamp,
      } = position;

      setError(null);

      // Skip if accuracy is too low
      if (gpsAccuracy > minAccuracy) {
        console.warn(`[GPS] Accuracy too low: ${gpsAccuracy}m (threshold: ${minAccuracy}m)`);
        return;
      }

      const newLocation = {
        latitude,
        longitude,
        accuracy: gpsAccuracy,
        timestamp,
      };

      // Check if enough time has passed since last update
      const now = Date.now();
      if (now - lastUpdateTimeRef.current < updateInterval) {
        return;
      }

      // Update location history for speed calculation
      locationHistoryRef.current.push(newLocation);
      if (locationHistoryRef.current.length > 5) {
        locationHistoryRef.current.shift();
      }

      // Calculate metrics
      const calculatedSpeed = gpsSpeed !== null ? gpsSpeed * 3.6 : calculateSpeed(newLocation, lastLocationRef.current); // Convert m/s to km/h
      const calculatedHeading = gpsHeading !== null ? gpsHeading : calculateBearing(lastLocationRef.current, newLocation);

      setLocation(newLocation);
      setSpeed(Math.round(calculatedSpeed * 10) / 10); // Round to 1 decimal
      setHeading(Math.round(calculatedHeading));
      setAccuracy(Math.round(gpsAccuracy));

      lastLocationRef.current = newLocation;
      lastUpdateTimeRef.current = now;

      console.log(`[GPS] Location updated: ${latitude.toFixed(6)}, ${longitude.toFixed(6)} | Speed: ${calculatedSpeed.toFixed(1)} km/h`);

      // Emit to Socket.io if connected and enabled
      if (socket && socket.connected && requestId && isOnline) {
        socket.emit('gps:location-update', {
          requestId,
          latitude,
          longitude,
          speed: Math.round(calculatedSpeed * 10) / 10,
          heading: Math.round(calculatedHeading),
          accuracy: Math.round(gpsAccuracy),
          timestamp: new Date(timestamp).toISOString(),
        });
      }
    },
    [socket, requestId, calculateSpeed, calculateBearing, updateInterval, minAccuracy, isOnline]
  );

  // Handle geolocation errors
  const handleLocationError = useCallback((error) => {
    let errorMessage = 'Unknown GPS error';

    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = 'GPS permission denied. Enable location in settings.';
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = 'GPS unavailable. Check your device settings.';
        break;
      case error.TIMEOUT:
        errorMessage = 'GPS request timeout. Try again in a moment.';
        break;
      default:
        errorMessage = `GPS error: ${error.message}`;
    }

    console.error(`[GPS] Error: ${errorMessage}`);
    setError(errorMessage);
  }, []);

  // Start/Stop GPS tracking
  useEffect(() => {
    if (!enabled || !('geolocation' in navigator)) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setIsTracking(false);
      return;
    }

    // Start watching position
    const watchOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0, // Don't cache position
    };

    try {
      watchIdRef.current = navigator.geolocation.watchPosition(
        handleLocationSuccess,
        handleLocationError,
        watchOptions
      );
      setIsTracking(true);
      setError(null);
      console.log('[GPS] Tracking started');
    } catch (err) {
      console.error('[GPS] Failed to start tracking:', err);
      setError('Failed to start GPS tracking');
      setIsTracking(false);
    }

    // Cleanup on unmount or when disabled
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
        setIsTracking(false);
        console.log('[GPS] Tracking stopped');
      }
    };
  }, [enabled, handleLocationSuccess, handleLocationError]);

  // Return API
  return {
    location,
    speed,
    heading,
    accuracy,
    isTracking,
    error,
    isOnline,
    hasGeoLocation: 'geolocation' in navigator,
  };
};

export default useDriverGPSTracking;
