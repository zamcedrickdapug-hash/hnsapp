/**
 * Live Operations Dashboard
 * 
 * PURPOSE:
 * Real-time admin operations center for:
 * - Monitoring active trips
 * - Emergency response
 * - Fleet management
 * - Safety oversight
 * - Performance analytics
 * 
 * ARCHITECTURE:
 * - WebSocket real-time updates
 * - Dashboard widgets with independent refresh
 * - Responsive layout (desktop-first)
 * - Real-time alert audio notifications
 * 
 * FEATURES:
 * - Auto-refresh metrics
 * - Critical alerts with sound
 * - Trip map integration
 * - Quick actions
 * - Dark mode (optimized for operations center)
 */

import React, { useState, useEffect } from 'react';
import { RefreshCw, Settings, Phone, MoreVertical } from 'lucide-react';
import LiveTripMonitor from './LiveTripMonitor';
import FleetStatusCard from './FleetStatusCard';
import EmergencyAlertPanel from './EmergencyAlertPanel';
import OperationsAnalyticsCard from './OperationsAnalyticsCard';
import DriverSafetyLeaderboard from './DriverSafetyLeaderboard';
import { resolveApiUrl } from '../../../api';

const LiveOperationsDashboard = ({ socket, userId }) => {
  const [realTimeMetrics, setRealTimeMetrics] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch real-time metrics
  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch(resolveApiUrl('/api/analytics/real-time'), {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setRealTimeMetrics(data.data);
          setLastUpdate(new Date());
        }
      } catch (error) {
        console.error('Error fetching real-time metrics:', error);
      }
    };

    fetchMetrics();

    // Auto-refresh every 10 seconds if enabled
    const interval = autoRefresh ? setInterval(fetchMetrics, 10000) : null;
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  // Fetch analytics
  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const response = await fetch(
          resolveApiUrl(`/api/analytics/summary?startDate=${today}T00:00:00Z&endDate=${today}T23:59:59Z`),
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.data && data.data.length > 0) {
            setAnalytics(data.data[0]);
          }
        }
      } catch (error) {
        console.error('Error fetching analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  // WebSocket listeners for real-time updates
  useEffect(() => {
    if (!socket) return;

    socket.on('real_time_metrics', (metrics) => {
      setRealTimeMetrics(metrics);
      setLastUpdate(new Date());
    });

    socket.on('trip_updated', (trip) => {
      setTrips((prev) => {
        const updated = prev.map((t) => (t._id === trip._id ? trip : t));
        return updated.some((t) => t._id === trip._id) ? updated : [trip, ...prev];
      });
    });

    socket.on('driver_online', (driverId) => {
      setDrivers((prev) =>
        prev.map((d) => (d._id === driverId ? { ...d, status: 'online' } : d))
      );
    });

    socket.on('driver_offline', (driverId) => {
      setDrivers((prev) =>
        prev.map((d) => (d._id === driverId ? { ...d, status: 'offline' } : d))
      );
    });

    return () => {
      socket.off('real_time_metrics');
      socket.off('trip_updated');
      socket.off('driver_online');
      socket.off('driver_offline');
    };
  }, [socket]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-slate-700 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading Operations Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-4xl font-bold text-white">Live Operations Center</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => window.location.reload()}
              className="p-2 hover:bg-slate-700 rounded-lg transition"
              title="Refresh Dashboard"
            >
              <RefreshCw className="w-5 h-5 text-slate-400 hover:text-white" />
            </button>
            <button className="p-2 hover:bg-slate-700 rounded-lg transition">
              <Settings className="w-5 h-5 text-slate-400 hover:text-white" />
            </button>
            <button
              onClick={() => {
                /* Call supervisor */
              }}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition"
            >
              <Phone className="w-4 h-4" />
              <span>Escalate</span>
            </button>
          </div>
        </div>
        <p className="text-slate-400">
          Last update: {lastUpdate?.toLocaleTimeString() || 'Loading...'} {autoRefresh && '🔄'}
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Left Column: Active Trips + Emergency Alerts */}
        <div className="lg:col-span-2 space-y-6">
          <LiveTripMonitor socket={socket} trips={trips} />
          <EmergencyAlertPanel socket={socket} adminId={userId} />
        </div>

        {/* Right Column: Status + Safety Leaderboard */}
        <div className="space-y-6">
          <FleetStatusCard metrics={realTimeMetrics} />
          <DriverSafetyLeaderboard drivers={drivers} />
        </div>
      </div>

      {/* Analytics Row */}
      <OperationsAnalyticsCard analytics={analytics} />

      {/* Quick Actions */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
        <button className="p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition text-white text-sm font-semibold">
          📋 View All Alerts
        </button>
        <button className="p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition text-white text-sm font-semibold">
          🗺️ View Live Map
        </button>
        <button className="p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition text-white text-sm font-semibold">
          📊 Full Analytics
        </button>
        <button className="p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition text-white text-sm font-semibold">
          ⚙️ Driver Controls
        </button>
      </div>

      {/* Footer Info */}
      <div className="mt-8 p-4 bg-slate-800/50 border border-slate-700 rounded-lg text-center">
        <p className="text-xs text-slate-500">
          Operations Dashboard | Real-time data | Updates every 10 seconds | Emergency hotline: 1-800-HNS-SAFE
        </p>
      </div>
    </div>
  );
};

export default LiveOperationsDashboard;
