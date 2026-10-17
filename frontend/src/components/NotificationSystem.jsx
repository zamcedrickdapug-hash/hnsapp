import React, { useState, useEffect, useCallback } from 'react';
import { useNotifications } from '../context/NotificationContext';
import useNotificationSocket from '../hooks/useNotificationSocket';
import { ToastContainer } from './ui/Toast';
import NotificationHistory from './ui/NotificationHistory';
import './NotificationSystem.scss';

/**
 * NotificationSystem Component
 * Integrates real-time notifications, toasts, and history
 */
export const NotificationSystem = ({ socket }) => {
  const {
    toasts,
    removeToast,
    notifications,
    unreadCount,
    isLoading,
    hasMore,
    fetchNotifications,
    loadMoreNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
    navigateFromNotification,
  } = useNotifications();

  const [showHistory, setShowHistory] = useState(false);

  // Set up socket listeners
  useNotificationSocket(socket);

  // Load notifications on mount
  useEffect(() => {
    fetchNotifications(1);
  }, [fetchNotifications]);

  // Close history when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      const historyPanel = document.querySelector('.notification-system__history-panel');
      const toggleButton = document.querySelector('.notification-system__toggle');

      if (
        historyPanel &&
        !historyPanel.contains(e.target) &&
        toggleButton &&
        !toggleButton.contains(e.target) &&
        showHistory
      ) {
        setShowHistory(false);
      }
    };

    if (showHistory) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showHistory]);

  return (
    <div className="notification-system">
      {/* Toast Container - Shows temporary popups */}
      <ToastContainer
        toasts={toasts}
        onClose={removeToast}
        onNotificationClick={navigateFromNotification}
        position="top-right"
      />

      {/* Notification History Toggle Button */}
      <button
        className="notification-system__toggle"
        onClick={() => setShowHistory(!showHistory)}
        title="View notifications"
      >
        <span className="notification-system__toggle-icon">🔔</span>
        {unreadCount > 0 && (
          <span className="notification-system__toggle-badge">{unreadCount}</span>
        )}
      </button>

      {/* Notification History Panel */}
      {showHistory && (
        <div className="notification-system__history-panel">
          <NotificationHistory
            notifications={notifications}
            unreadCount={unreadCount}
            onNotificationClick={navigateFromNotification}
            onMarkAsRead={markAsRead}
            onMarkAllAsRead={markAllAsRead}
            onDelete={deleteNotification}
            onDeleteAll={deleteAllNotifications}
            isLoading={isLoading}
            onLoadMore={loadMoreNotifications}
            hasMore={hasMore}
          />
        </div>
      )}

      {/* Mobile overlay when panel is open */}
      {showHistory && <div className="notification-system__overlay" />}
    </div>
  );
};

export default NotificationSystem;
