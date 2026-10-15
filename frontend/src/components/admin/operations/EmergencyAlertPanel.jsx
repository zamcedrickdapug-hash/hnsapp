/**
 * Emergency Alert Panel Component
 * 
 * PURPOSE:
 * Display critical and urgent safety alerts requiring immediate admin action
 * Shows emergency SOS, speed violations, route deviations, etc.
 * 
 * FEATURES:
 * - Real-time alert updates via WebSocket
 * - Severity-based color coding
 * - Alert dismissal/acknowledgement
 * - Quick action buttons
 * - Sound notifications for critical alerts
 */

import React, { useState, useEffect } from 'react';
import { AlertTriangle, X, Check, Phone, Navigation } from 'lucide-react';
import { resolveApiUrl } from '../../../api';

const EmergencyAlertPanel = ({ socket, adminId }) => {
  const [alerts, setAlerts] = useState([]);
  const [acknowledgingAlertId, setAcknowledgingAlertId] = useState(null);

  useEffect(() => {
    if (!socket) return;

    // Listen for critical alerts
    socket.on('critical_safety_alert', (alert) => {
      setAlerts((prev) => [alert, ...prev]);
      playAlertSound();
    });

    socket.on('alert_acknowledged', (alertId) => {
      setAlerts((prev) =>
        prev.map((a) => (a._id === alertId ? { ...a, acknowledged: true } : a))
      );
    });

    socket.on('alert_resolved', (alertId) => {
      setAlerts((prev) => prev.filter((a) => a._id !== alertId));
    });

    return () => {
      socket.off('critical_safety_alert');
      socket.off('alert_acknowledged');
      socket.off('alert_resolved');
    };
  }, [socket]);

  const playAlertSound = () => {
    // Create a simple beep sound or use Web Audio API
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
      console.error('Error playing alert sound:', error);
    }
  };

  const getSeverityStyles = (severity) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500/20 border-red-500 text-red-100';
      case 'urgent':
        return 'bg-orange-500/20 border-orange-500 text-orange-100';
      case 'warning':
        return 'bg-yellow-500/20 border-yellow-500 text-yellow-100';
      default:
        return 'bg-blue-500/20 border-blue-500 text-blue-100';
    }
  };

  const getSeverityIcon = (severity) => {
    return <AlertTriangle className="w-5 h-5" />;
  };

  const handleAcknowledge = async (alertId) => {
    setAcknowledgingAlertId(alertId);

    try {
      const response = await fetch(resolveApiUrl(`/api/trip-safety/alert/${alertId}/acknowledge`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          adminId,
          notes: 'Acknowledged by admin',
        }),
      });

      if (response.ok) {
        socket?.emit('admin_acknowledged_alert', alertId);
      }
    } catch (error) {
      console.error('Error acknowledging alert:', error);
    } finally {
      setAcknowledgingAlertId(null);
    }
  };

  if (alerts.length === 0) {
    return (
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg p-6 border border-slate-700">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-green-400" />
          Emergency Alerts
        </h2>
        <p className="text-slate-400 text-center py-8">✓ No critical alerts</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-red-400 animate-pulse" />
        Emergency Alerts ({alerts.length})
      </h2>

      {alerts.map((alert) => (
        <div
          key={alert._id}
          className={`rounded-lg p-4 border-l-4 transition ${getSeverityStyles(alert.severity)}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1">
              {getSeverityIcon(alert.severity)}
              <div className="flex-1">
                <h3 className="font-bold text-white">{alert.title}</h3>
                <p className="text-sm opacity-90 mt-1">{alert.description}</p>

                <div className="grid grid-cols-2 gap-2 mt-2 text-xs opacity-75">
                  <div>
                    <span className="text-slate-300">Trip:</span>
                    <span className="ml-2">{alert.tripId}</span>
                  </div>
                  <div>
                    <span className="text-slate-300">Driver:</span>
                    <span className="ml-2">{alert.driverId}</span>
                  </div>
                </div>

                <p className="text-sm font-semibold mt-3 bg-black/30 p-2 rounded">
                  {alert.recommendedAction}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleAcknowledge(alert._id)}
                disabled={acknowledgingAlertId === alert._id}
                className="p-2 hover:bg-white/20 rounded transition disabled:opacity-50"
                title="Acknowledge Alert"
              >
                {acknowledgingAlertId === alert._id ? (
                  <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                ) : (
                  <Check className="w-5 h-5" />
                )}
              </button>

              <button
                onClick={() => setAlerts((prev) => prev.filter((a) => a._id !== alert._id))}
                className="p-2 hover:bg-white/20 rounded transition"
                title="Dismiss"
              >
                <X className="w-5 h-5" />
              </button>

              {alert.driverId && (
                <button
                  className="p-2 hover:bg-white/20 rounded transition"
                  title="Call Driver"
                >
                  <Phone className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default EmergencyAlertPanel;
