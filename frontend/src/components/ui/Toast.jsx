import React, { useState, useEffect, useCallback } from 'react';
import './Toast.scss';

/**
 * Professional Toast Notification Component
 * Real-time notifications for 7-stage trip workflow
 * Designed like TikTok/Shopee/Facebook Messenger
 */

export const Toast = ({
  notification,
  onClose,
  onNotificationClick,
  autoCloseDuration = 5000,
}) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (autoCloseDuration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, autoCloseDuration);

      return () => clearTimeout(timer);
    }
  }, [autoCloseDuration]);

  const handleClose = useCallback((event) => {
    event?.stopPropagation();
    setIsExiting(true);
    setTimeout(() => {
      onClose(notification._id);
    }, 300);
  }, [notification._id, onClose]);

  const handleNotificationClick = useCallback(() => {
    if (onNotificationClick?.(notification)) handleClose();
  }, [handleClose, notification, onNotificationClick]);

  const colorClass = `toast--${notification.color}`;
  const animationClass = `toast--${notification.animation || 'slide'}`;

  return (
    <div
      className={`toast ${colorClass} ${animationClass} ${isExiting ? 'toast--exiting' : 'toast--entering'}`}
      role="alert"
      aria-live="polite"
    >
      {/* Left color indicator bar */}
      <div className="toast__color-bar" />

      <button className="toast__navigation" onClick={handleNotificationClick} type="button">
        <span className="toast__icon-section">
          <span className="toast__icon" role="img" aria-label={notification.title}>
            {notification.icon || '📦'}
          </span>
        </span>

        <span className="toast__content-section">
          <span className="toast__title">{notification.title}</span>
          <span className="toast__message">{notification.message}</span>
          {notification.metadata && (
            <span className="toast__metadata">
              {notification.metadata.driverName && (
                <span className="toast__meta-badge">
                  <span className="toast__meta-icon">🚗</span>
                  <span className="toast__meta-text">{notification.metadata.driverName}</span>
                </span>
              )}
              {notification.metadata.plateNumber && (
                <span className="toast__meta-badge">
                  <span className="toast__meta-icon">🔢</span>
                  <span className="toast__meta-text">{notification.metadata.plateNumber}</span>
                </span>
              )}
              {notification.metadata.studentName && (
                <span className="toast__meta-badge">
                  <span className="toast__meta-icon">👶</span>
                  <span className="toast__meta-text">{notification.metadata.studentName}</span>
                </span>
              )}
              {notification.metadata.schoolName && (
                <span className="toast__meta-badge">
                  <span className="toast__meta-icon">🏫</span>
                  <span className="toast__meta-text">{notification.metadata.schoolName}</span>
                </span>
              )}
            </span>
          )}
          {notification.timestamp && (
            <span className="toast__timestamp">
              {new Date(notification.timestamp).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </span>
          )}
        </span>
      </button>

      {/* Close button */}
      <button
        type="button"
        className="toast__close"
        onClick={handleClose}
        aria-label="Close notification"
      >
        ✕
      </button>

      {/* Progress bar for auto-dismiss */}
      <div
        className="toast__progress"
        style={{
          animation: `toast-progress ${autoCloseDuration}ms linear forwards`,
        }}
      />
    </div>
  );
};

/**
 * Toast Container - manages multiple toasts with stacking
 */
export const ToastContainer = ({ toasts = [], onClose, onNotificationClick, position = 'top-right' }) => {
  return (
    <div className={`toast-container toast-container--${position}`}>
      {toasts.map((notification) => (
        <Toast
          key={notification._id}
          notification={notification}
          onClose={onClose}
          onNotificationClick={onNotificationClick}
          autoCloseDuration={5000}
        />
      ))}
    </div>
  );
};

export default Toast;
