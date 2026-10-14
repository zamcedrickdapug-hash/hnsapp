/**
 * Operations Analytics Card Component
 * 
 * PURPOSE:
 * Display key transportation metrics and KPIs:
 * - On-time performance percentage
 * - Trip completion rate
 * - Safety score
 * - Average delay
 * - Response time to alerts
 * 
 * FEATURES:
 * - Visual progress indicators
 * - Color-coded performance levels
 * - Real-time metric updates
 */

import React, { useState, useEffect } from 'react';
import { BarChart3, CheckCircle, AlertTriangle, Clock } from 'lucide-react';

const OperationsAnalyticsCard = ({ analytics = {} }) => {
  const [metrics, setMetrics] = useState({
    onTimePercentage: 0,
    completionRate: 0,
    safetyScore: 100,
    averageDelayMinutes: 0,
    alertResponseTimeSeconds: 0,
    tripsSoFarToday: 0,
    averagePassengersPerTrip: 0,
  });

  useEffect(() => {
    if (analytics && Object.keys(analytics).length > 0) {
      setMetrics(analytics);
    }
  }, [analytics]);

  const MetricGauge = ({ label, value, max = 100, unit = '%', icon: Icon }) => {
    const percentage = Math.min((value / max) * 100, 100);
    const getColor = () => {
      if (percentage >= 80) return 'from-green-500 to-green-600';
      if (percentage >= 60) return 'from-yellow-500 to-yellow-600';
      return 'from-red-500 to-red-600';
    };

    return (
      <div className="bg-slate-700/50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-slate-400 text-sm">{label}</p>
          {Icon && <Icon className="w-5 h-5 text-slate-500" />}
        </div>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <div className="w-full bg-slate-600 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${getColor()} transition-all duration-500 rounded-full`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
          <p className={`text-2xl font-bold text-right ${percentage >= 80 ? 'text-green-400' : percentage >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
            {value}
            {unit}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg border border-slate-700 p-6">
      <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-purple-400" />
        Operations Analytics
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MetricGauge
          label="On-Time Performance"
          value={Math.round(metrics.onTimePercentage)}
          max={100}
          unit="%"
          icon={Clock}
        />

        <MetricGauge
          label="Trip Completion Rate"
          value={Math.round(metrics.completionRate)}
          max={100}
          unit="%"
          icon={CheckCircle}
        />

        <MetricGauge
          label="Safety Score"
          value={Math.round(metrics.safetyScore)}
          max={100}
          unit=""
          icon={AlertTriangle}
        />

        <div className="bg-slate-700/50 rounded-lg p-4">
          <p className="text-slate-400 text-sm mb-2">Average Delay</p>
          <p className="text-2xl font-bold text-orange-400">
            {metrics.averageDelayMinutes.toFixed(1)} <span className="text-sm">min</span>
          </p>
          <p className="text-xs text-slate-500 mt-2">Per pickup</p>
        </div>

        <div className="bg-slate-700/50 rounded-lg p-4">
          <p className="text-slate-400 text-sm mb-2">Alert Response Time</p>
          <p className="text-2xl font-bold text-blue-400">
            {metrics.alertResponseTimeSeconds} <span className="text-sm">sec</span>
          </p>
          <p className="text-xs text-slate-500 mt-2">Average</p>
        </div>

        <div className="bg-slate-700/50 rounded-lg p-4">
          <p className="text-slate-400 text-sm mb-2">Trips (Today)</p>
          <p className="text-2xl font-bold text-cyan-400">{metrics.tripsSoFarToday}</p>
          <p className="text-xs text-slate-500 mt-2">Completed</p>
        </div>

        <div className="bg-slate-700/50 rounded-lg p-4">
          <p className="text-slate-400 text-sm mb-2">Avg. Passengers/Trip</p>
          <p className="text-2xl font-bold text-purple-400">
            {metrics.averagePassengersPerTrip.toFixed(1)}
          </p>
          <p className="text-xs text-slate-500 mt-2">Students</p>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-slate-700">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-green-400">✓</p>
            <p className="text-xs text-slate-400">Excellent</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-yellow-400">○</p>
            <p className="text-xs text-slate-400">Good</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-red-400">✕</p>
            <p className="text-xs text-slate-400">Needs Review</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OperationsAnalyticsCard;
