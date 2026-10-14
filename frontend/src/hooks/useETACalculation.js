import { useState, useEffect, useCallback, useMemo } from 'react';

/**
 * useETACalculation Hook
 * 
 * Calculates estimated time of arrival (ETA) based on:
 * - Current location
 * - Destination location
 * - Current speed
 * - Historical speed data
 * 
 * Features:
 * - Real-time ETA updates
 * - Speed-based adjustments
 * - Smoothed predictions
 */

const AVERAGE_CITY_SPEED_KMH = 30; // Conservative estimate for city traffic
const SPEED_CONFIDENCE_THRESHOLD = 5; // Need at least 5 data points

export const useETACalculation = (
  currentLocation,
  destination,
  speed = 0,
  speedHistory = []
) => {
  const [eta, setEta] = useState(null);
  const [distanceKm, setDistanceKm] = useState(0);
  const [timeMinutes, setTimeMinutes] = useState(0);
  const [confidence, setConfidence] = useState('low');

  // Calculate haversine distance between two points
  const calculateDistance = useCallback((from, to) => {
    if (!from || !to) return 0;

    const lat1 = Number(from.latitude);
    const lon1 = Number(from.longitude);
    const lat2 = Number(to.latitude);
    const lon2 = Number(to.longitude);

    if (![lat1, lon1, lat2, lon2].every(n => Number.isFinite(n))) {
      return 0;
    }

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
    return R * c;
  }, []);

  // Calculate average speed
  const avgSpeed = useMemo(() => {
    if (speedHistory.length < SPEED_CONFIDENCE_THRESHOLD) {
      // Use current speed or fallback to average city speed
      return speed > 0 ? speed : AVERAGE_CITY_SPEED_KMH;
    }

    const validSpeeds = speedHistory.filter(s => s > 0 && Number.isFinite(s));
    if (validSpeeds.length === 0) {
      return AVERAGE_CITY_SPEED_KMH;
    }

    return validSpeeds.reduce((a, b) => a + b, 0) / validSpeeds.length;
  }, [speedHistory, speed]);

  // Calculate ETA
  useEffect(() => {
    if (!currentLocation || !destination) {
      setEta(null);
      setDistanceKm(0);
      setTimeMinutes(0);
      setConfidence('low');
      return;
    }

    // Calculate distance
    const distKm = calculateDistance(currentLocation, destination);
    setDistanceKm(Number(distKm.toFixed(2)));

    if (distKm === 0) {
      setEta(null);
      setTimeMinutes(0);
      setConfidence('low');
      return;
    }

    // Calculate time in minutes
    const effectiveSpeed = Math.max(avgSpeed, 5); // At least 5 km/h
    const timeHours = distKm / effectiveSpeed;
    const timeMin = Math.round(timeHours * 60);

    setTimeMinutes(Math.max(1, timeMin)); // At least 1 minute

    // Calculate ETA time
    const now = new Date();
    const etaTime = new Date(now.getTime() + timeMin * 60 * 1000);
    setEta(etaTime);

    // Set confidence based on speed data
    let conf = 'low';
    if (speedHistory.length >= SPEED_CONFIDENCE_THRESHOLD) {
      conf = 'medium';
      if (speedHistory.length >= SPEED_CONFIDENCE_THRESHOLD * 2) {
        conf = 'high';
      }
    } else if (speed > 0) {
      conf = 'medium';
    }

    setConfidence(conf);

    console.log(
      `[ETA] Distance: ${distKm.toFixed(2)}km, Speed: ${effectiveSpeed.toFixed(1)}km/h, ETA: ${timeMin}min, Confidence: ${conf}`
    );
  }, [currentLocation, destination, avgSpeed, calculateDistance, speedHistory]);

  // Format ETA for display
  const etaString = useMemo(() => {
    if (!eta) return 'Calculating...';

    return eta.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  }, [eta]);

  // Return API
  return {
    eta,
    etaString,
    distanceKm,
    timeMinutes,
    averageSpeed: Number(avgSpeed.toFixed(1)),
    confidence,
    isCalculated: eta !== null,
  };
};

export default useETACalculation;
