/**
 * Driver Safety Leaderboard Component
 * 
 * PURPOSE:
 * Display driver safety rankings:
 * - Top performing drivers (high safety scores)
 * - Bottom performers (safety concerns)
 * - Rating averages
 * - Incident counts
 * 
 * FEATURES:
 * - Sortable rankings
 * - Color-coded status
 * - Quick view driver details
 * - Action buttons for admin intervention
 */

import React, { useState, useEffect } from 'react';
import { Trophy, AlertTriangle, Star, TrendingDown } from 'lucide-react';

const DriverSafetyLeaderboard = ({ drivers = [] }) => {
  const [topDrivers, setTopDrivers] = useState([]);
  const [bottomDrivers, setBottomDrivers] = useState([]);
  const [selectedTab, setSelectedTab] = useState('top');

  useEffect(() => {
    if (drivers.length > 0) {
      const sorted = [...drivers].sort((a, b) => (b.safetyScore || 0) - (a.safetyScore || 0));
      setTopDrivers(sorted.slice(0, 5));
      setBottomDrivers(sorted.reverse().slice(0, 5));
    }
  }, [drivers]);

  const DriverRow = ({ rank, driver, isTop = true }) => {
    const safetyScore = driver.safetyScore || 0;
    const rating = driver.avgRating || 0;

    return (
      <div className="flex items-center justify-between p-4 border-b border-slate-700 hover:bg-slate-700/30 transition">
        <div className="flex items-center gap-3 flex-1">
          <div className="text-center">
            {isTop ? (
              <Trophy className="w-5 h-5 text-yellow-400 mx-auto" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-400 mx-auto" />
            )}
            <p className="text-xs text-slate-400 mt-1">#{rank}</p>
          </div>

          <div>
            <p className="font-semibold text-white">{driver.name}</p>
            <p className="text-xs text-slate-400">{driver.vehiclePlate || 'Vehicle'}</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-sm text-slate-400">Safety Score</p>
            <p className={`text-lg font-bold ${safetyScore >= 80 ? 'text-green-400' : safetyScore >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
              {safetyScore.toFixed(0)}
            </p>
          </div>

          <div className="text-right">
            <p className="text-sm text-slate-400">Rating</p>
            <div className="flex items-center justify-end gap-1 mt-1">
              <Star className="w-4 h-4 text-yellow-400" />
              <p className="font-semibold text-white">{rating.toFixed(1)}</p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-sm text-slate-400">Incidents</p>
            <p className={`text-lg font-bold ${driver.incidentCount > 0 ? 'text-red-400' : 'text-green-400'}`}>
              {driver.incidentCount || 0}
            </p>
          </div>

          {!isTop && driver.incidentCount > 0 && (
            <button className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded text-sm transition">
              Review
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg border border-slate-700">
      <div className="p-6 border-b border-slate-700">
        <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
          <Trophy className="w-5 h-5 text-yellow-400" />
          Driver Safety Leaderboard
        </h2>

        <div className="flex gap-2">
          <button
            onClick={() => setSelectedTab('top')}
            className={`px-4 py-2 rounded-lg font-semibold transition ${
              selectedTab === 'top'
                ? 'bg-green-500/30 text-green-400 border border-green-500/50'
                : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
            }`}
          >
            ⭐ Top Performers ({topDrivers.length})
          </button>
          <button
            onClick={() => setSelectedTab('bottom')}
            className={`px-4 py-2 rounded-lg font-semibold transition ${
              selectedTab === 'bottom'
                ? 'bg-red-500/30 text-red-400 border border-red-500/50'
                : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
            }`}
          >
            ⚠️ Needs Review ({bottomDrivers.length})
          </button>
        </div>
      </div>

      <div className="max-h-[400px] overflow-y-auto">
        {selectedTab === 'top' ? (
          topDrivers.length > 0 ? (
            topDrivers.map((driver, index) => (
              <DriverRow key={driver._id} rank={index + 1} driver={driver} isTop={true} />
            ))
          ) : (
            <div className="p-8 text-center text-slate-400">No driver data available</div>
          )
        ) : bottomDrivers.length > 0 ? (
          bottomDrivers.map((driver, index) => (
            <DriverRow key={driver._id} rank={index + 1} driver={driver} isTop={false} />
          ))
        ) : (
          <div className="p-8 text-center text-slate-400">No drivers need review</div>
        )}
      </div>

      <div className="p-4 border-t border-slate-700 bg-slate-700/20">
        <p className="text-xs text-slate-500 text-center">
          Safety scores based on ratings, incident reports, and driving behavior analysis
        </p>
      </div>
    </div>
  );
};

export default DriverSafetyLeaderboard;
