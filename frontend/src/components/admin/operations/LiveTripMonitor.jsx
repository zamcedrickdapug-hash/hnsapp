/**
 * Live Trip Monitor Component
 * 
 * PURPOSE:
 * Real-time display of active trips on the operations dashboard
 * Shows current trips with driver, vehicle, students, status
 * 
 * FEATURES:
 * - Auto-refresh via WebSocket
 * - Live GPS coordinates
 * - Real-time status updates
 * - Click to view trip details
 * - Color-coded status indicators
 */

import React, { useState, useEffect } from 'react';
import { MapPin, Clock, Users, AlertCircle } from 'lucide-react';

const LiveTripMonitor = ({ socket, trips = [] }) => {
  const [activeTrips, setActiveTrips] = useState(trips);
  const [expandedTripId, setExpandedTripId] = useState(null);

  useEffect(() => {
    if (!socket) return;

    // Listen for trip updates via WebSocket
    socket.on('trip_updated', (updatedTrip) => {
      setActiveTrips((prev) =>
        prev.map((trip) => (trip._id === updatedTrip._id ? updatedTrip : trip))
      );
    });

    socket.on('new_trip_assigned', (newTrip) => {
      setActiveTrips((prev) => [newTrip, ...prev]);
    });

    socket.on('trip_completed', (tripId) => {
      setActiveTrips((prev) => prev.filter((trip) => trip._id !== tripId));
    });

    return () => {
      socket.off('trip_updated');
      socket.off('new_trip_assigned');
      socket.off('trip_completed');
    };
  }, [socket]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/20 text-green-700 border-green-500';
      case 'in_progress':
        return 'bg-blue-500/20 text-blue-700 border-blue-500';
      case 'pickup':
        return 'bg-yellow-500/20 text-yellow-700 border-yellow-500';
      case 'pending_approval':
        return 'bg-gray-500/20 text-gray-700 border-gray-500';
      default:
        return 'bg-slate-500/20 text-slate-700 border-slate-500';
    }
  };

  const getTripDuration = (createdAt) => {
    const diff = Date.now() - new Date(createdAt).getTime();
    const minutes = Math.floor(diff / 60000);
    return minutes > 0 ? `${minutes}m` : '<1m';
  };

  if (activeTrips.length === 0) {
    return (
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg p-6 border border-slate-700 min-h-[300px] flex items-center justify-center">
        <p className="text-slate-400 text-center">No active trips at this time</p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg border border-slate-700 overflow-hidden">
      <div className="p-6 border-b border-slate-700">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <MapPin className="w-5 h-5 text-blue-400" />
          Active Trips ({activeTrips.length})
        </h2>
      </div>

      <div className="max-h-[600px] overflow-y-auto">
        {activeTrips.map((trip) => (
          <div
            key={trip._id}
            className="p-4 border-b border-slate-700 hover:bg-slate-700/50 transition cursor-pointer"
            onClick={() => setExpandedTripId(expandedTripId === trip._id ? null : trip._id)}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(
                      trip.status
                    )}`}
                  >
                    {trip.status?.replace('_', ' ').toUpperCase() || 'PENDING'}
                  </span>
                  <span className="text-sm text-slate-400">{getTripDuration(trip.createdAt)}</span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-slate-400">Driver</p>
                    <p className="text-white font-semibold">{trip.driverName || 'Unassigned'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Vehicle</p>
                    <p className="text-white font-semibold">{trip.plateNumber || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      Students
                    </p>
                    <p className="text-white font-semibold">{trip.studentCount || 0} of {trip.vehicleCapacity || '-'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      ETA
                    </p>
                    <p className="text-white font-semibold">
                      {trip.estimatedArrival
                        ? new Date(trip.estimatedArrival).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'N/A'}
                    </p>
                  </div>
                </div>

                {trip.hasAlerts && (
                  <div className="mt-2 flex items-center gap-2 text-orange-400 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    <span>Active Safety Alerts</span>
                  </div>
                )}
              </div>

              <div className="text-right">
                <div className="text-2xl font-bold text-blue-400">
                  {trip.currentLocation
                    ? `${trip.currentLocation.latitude.toFixed(4)}, ${trip.currentLocation.longitude.toFixed(4)}`
                    : 'N/A'}
                </div>
                <p className="text-xs text-slate-400">GPS Coordinates</p>
              </div>
            </div>

            {expandedTripId === trip._id && (
              <div className="mt-4 pt-4 border-t border-slate-700 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-400">School</p>
                  <p className="text-white">{trip.schoolName}</p>
                </div>
                <div>
                  <p className="text-slate-400">Pickup Zone</p>
                  <p className="text-white">{trip.pickupZone || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-400">Route</p>
                  <p className="text-white">{trip.routeName || 'Custom'}</p>
                </div>
                <div>
                  <p className="text-slate-400">Speed</p>
                  <p className="text-white">{trip.currentSpeed ? `${trip.currentSpeed} km/h` : 'N/A'}</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default LiveTripMonitor;
