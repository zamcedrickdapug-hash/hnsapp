import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useETACalculation } from '../hooks/useETACalculation';
import { useTripStatusManager } from '../hooks/useTripStatusManager';
import './LiveTripTracking.scss';

/**
 * LiveTripTracking Component
 * 
 * Real-time tracking display for parents
 * Shows:
 * - Live vehicle location on map
 * - ETA to destination
 * - Trip status and progress
 * - Distance remaining
 * - Driver information
 */

const SCHOOL_LOCATION = {
  latitude: 14.81298106386082,
  longitude: 121.07158042431617,
};

export const LiveTripTracking = ({ trip, socket }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const routePolylineRef = useRef(null);
  const [speedHistory, setSpeedHistory] = useState([]);

  // Get ETA
  const destination = useMemo(() => {
    if (trip?.status === 'picked_up') {
      return SCHOOL_LOCATION;
    }
    return trip?.requesterLocation;
  }, [trip?.status, trip?.requesterLocation]);

  const {
    eta,
    etaString,
    distanceKm,
    timeMinutes,
    averageSpeed,
    confidence,
  } = useETACalculation(
    trip?.liveLocation,
    destination,
    trip?.lastSpeed || 0,
    speedHistory
  );

  // Get trip status
  const {
    currentStatus,
    statusMessage,
    progress,
    distanceToPickup,
    distanceToDestination,
  } = useTripStatusManager(trip, trip?.liveLocation, socket, {
    arrivalThresholdMeters: 100,
    pickupThresholdMeters: 50,
    autoUpdateStatus: false, // Parents don't auto-update, only view
  });

  // Listen for location updates via Socket.io
  useEffect(() => {
    if (!socket) return;

    const handleLocationUpdate = (payload) => {
      if (payload.requestId !== trip?._id) return;

      // Update speed history
      setSpeedHistory(prev => {
        const updated = [...prev, payload.speed || 0];
        return updated.slice(-20); // Keep last 20 readings
      });

      console.log(`[LiveTracking] Location update: ${payload.latitude.toFixed(6)}, ${payload.longitude.toFixed(6)}`);
    };

    socket.on('trip:location-updated', handleLocationUpdate);

    return () => {
      socket.off('trip:location-updated', handleLocationUpdate);
    };
  }, [socket, trip?._id]);

  // Update map
  useEffect(() => {
    if (!mapRef.current) return;

    // Initialize map if not already done
    if (!mapInstanceRef.current) {
      const L = window.L;
      if (!L) return; // Leaflet not loaded

      mapInstanceRef.current = L.map(mapRef.current).setView([14.5994, 120.9842], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(mapInstanceRef.current);
    }

    const map = mapInstanceRef.current;

    // Update marker position
    if (trip?.liveLocation) {
      const { latitude, longitude } = trip.liveLocation;

      if (markerRef.current) {
        markerRef.current.setLatLng([latitude, longitude]);
      } else {
        markerRef.current = window.L.marker([latitude, longitude], {
          icon: window.L.divIcon({
            className: 'live-tracking-marker',
            html: `
              <div class="marker-wrapper" style="transform: rotate(${trip.lastHeading || 0}deg)">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <circle cx="16" cy="16" r="14" fill="#3b82f6" stroke="#1e40af" stroke-width="2"/>
                  <path d="M16 4 L20 14 L16 12 L12 14 Z" fill="white"/>
                </svg>
              </div>
            `,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          }),
        }).addTo(map);
      }

      // Auto-follow vehicle
      map.panTo([latitude, longitude]);
    }

    // Draw route
    if (trip?.requesterLocation && trip?.liveLocation) {
      if (routePolylineRef.current) {
        map.removeLayer(routePolylineRef.current);
      }

      const waypoints = [
        [trip.liveLocation.latitude, trip.liveLocation.longitude],
        [trip.requesterLocation.latitude, trip.requesterLocation.longitude],
      ];

      if (trip.status === 'picked_up') {
        waypoints.push([SCHOOL_LOCATION.latitude, SCHOOL_LOCATION.longitude]);
      }

      routePolylineRef.current = window.L.polyline(waypoints, {
        color: '#3b82f6',
        weight: 3,
        opacity: 0.7,
        dashArray: '5, 5',
      }).addTo(map);
    }
  }, [trip?.liveLocation, trip?.requesterLocation, trip?.lastHeading, trip?.status]);

  // Determine status badge color
  const getStatusColor = () => {
    switch (currentStatus) {
      case 'accepted':
        return '#ff9800'; // Orange
      case 'arrived':
        return '#2196f3'; // Blue
      case 'picked_up':
        return '#4caf50'; // Green
      case 'arrived_at_school':
        return '#4caf50'; // Green
      default:
        return '#9e9e9e'; // Gray
    }
  };

  if (!trip) {
    return (
      <div className="live-tracking-container">
        <div className="empty-state">
          <p>Select a trip to view live tracking</p>
        </div>
      </div>
    );
  }

  return (
    <div className="live-tracking-container">
      {/* Map */}
      <div className="map-section">
        <div ref={mapRef} className="map-container" />

        {/* Status Badge */}
        <div className="status-badge" style={{ borderColor: getStatusColor() }}>
          <div className="status-dot" style={{ backgroundColor: getStatusColor() }} />
          <div className="status-text">
            <p className="status-label">{statusMessage}</p>
            <p className="status-progress">{progress}% Complete</p>
          </div>
        </div>

        {/* Driver Info Card */}
        {trip.driver && (
          <div className="driver-card">
            <h4>{trip.driver.fullName}</h4>
            <p className="plate-number">{trip.driver.plateNumber || 'N/A'}</p>
            <p className="vehicle-type">{trip.driver.vehicleType || 'Van'}</p>
          </div>
        )}
      </div>

      {/* Info Panel */}
      <div className="info-panel">
        {/* ETA Section */}
        <div className="section">
          <h3>Estimated Arrival</h3>
          <div className="eta-display">
            <div className="eta-time">{etaString}</div>
            <div className="eta-details">
              <p>
                <strong>Distance:</strong> {distanceKm.toFixed(1)} km
              </p>
              <p>
                <strong>Time:</strong> {timeMinutes} minutes
              </p>
              <p>
                <strong>Avg Speed:</strong> {averageSpeed.toFixed(1)} km/h
              </p>
              <p className={`confidence confidence-${confidence}`}>
                <strong>Confidence:</strong> {confidence}
              </p>
            </div>
          </div>
        </div>

        {/* Distance Section */}
        <div className="section">
          <h3>Distance Tracking</h3>
          {trip.status === 'picked_up' ? (
            <div className="distance-item">
              <span>To School:</span>
              <strong>
                {distanceToDestination ? (distanceToDestination / 1000).toFixed(1) : '--'} km
              </strong>
            </div>
          ) : (
            <div className="distance-item">
              <span>To Pickup:</span>
              <strong>
                {distanceToPickup ? (distanceToPickup / 1000).toFixed(1) : '--'} km
              </strong>
            </div>
          )}
        </div>

        {/* Trip Details */}
        <div className="section">
          <h3>Trip Details</h3>
          <div className="details-grid">
            <div>
              <small>Student</small>
              <p>{trip.studentName}</p>
            </div>
            <div>
              <small>Pickup Zone</small>
              <p>{trip.pickupZone}</p>
            </div>
            <div>
              <small>Status</small>
              <p className="status-value">{trip.status}</p>
            </div>
            <div>
              <small>School</small>
              <p>{trip.schoolName || 'N/A'}</p>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="section">
          <h3>Trip Progress</h3>
          <div className="progress-container">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <p className="progress-text">{progress}%</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveTripTracking;
