/**
 * Fleet Status Card Component
 * 
 * PURPOSE:
 * Display real-time fleet status metrics including:
 * - Online/offline drivers
 * - Active/available vehicles
 * - Capacity utilization
 * - Safety incidents
 * 
 * FEATURES:
 * - Real-time updates via WebSocket
 * - Trend indicators (up/down)
 * - Color-coded status
 */

import React, { useState, useEffect } from 'react';
import { Truck, Users, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';

const FleetStatusCard = ({ metrics = {} }) => {
  const [status, setStatus] = useState({
    onlineDrivers: 0,
    totalDrivers: 0,
    activeVehicles: 0,
    totalVehicles: 0,
    capacityUtilization: 0,
    studentsActive: 0,
    safetyIncidents: 0,
  });

  useEffect(() => {
    if (metrics && Object.keys(metrics).length > 0) {
      setStatus(metrics);
    }
  }, [metrics]);

  const StatItem = ({ icon: Icon, label, value, subValue, trend, color }) => (
    <div className="bg-slate-700/50 rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-400 text-sm">{label}</p>
          <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
          {subValue && <p className="text-xs text-slate-400 mt-1">{subValue}</p>}
        </div>
        {Icon && <Icon className={`w-6 h-6 ${color} opacity-60`} />}
      </div>
      {trend !== undefined && (
        <div className="mt-2 flex items-center gap-1">
          {trend > 0 ? (
            <TrendingUp className="w-4 h-4 text-green-400" />
          ) : (
            <TrendingDown className="w-4 h-4 text-red-400" />
          )}
          <span className={trend > 0 ? 'text-green-400' : 'text-red-400'} style={{ fontSize: '0.75rem' }}>
            {Math.abs(trend)}%
          </span>
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg border border-slate-700 p-6">
      <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        <Truck className="w-5 h-5 text-blue-400" />
        Fleet Status
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatItem
          icon={Users}
          label="Drivers Online"
          value={status.onlineDrivers}
          subValue={`of ${status.totalDrivers}`}
          color="text-green-400"
        />

        <StatItem
          icon={Truck}
          label="Vehicles Active"
          value={status.activeVehicles}
          subValue={`of ${status.totalVehicles}`}
          color="text-blue-400"
        />

        <StatItem
          icon={Users}
          label="Students in Transit"
          value={status.studentsActive}
          color="text-cyan-400"
        />

        <StatItem
          icon={AlertCircle}
          label="Safety Incidents (24h)"
          value={status.safetyIncidents}
          color={status.safetyIncidents > 0 ? 'text-orange-400' : 'text-green-400'}
        />

        <div className="md:col-span-2">
          <div className="bg-slate-700/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-slate-400 text-sm">Fleet Capacity Utilization</p>
              <p className="text-2xl font-bold text-yellow-400">{status.capacityUtilization}%</p>
            </div>
            <div className="w-full bg-slate-600 rounded-full h-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  status.capacityUtilization > 80
                    ? 'bg-red-500'
                    : status.capacityUtilization > 50
                      ? 'bg-yellow-500'
                      : 'bg-green-500'
                }`}
                style={{ width: `${status.capacityUtilization}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-slate-700">
        <p className="text-xs text-slate-500">Last updated: {new Date().toLocaleTimeString()}</p>
      </div>
    </div>
  );
};

export default FleetStatusCard;
