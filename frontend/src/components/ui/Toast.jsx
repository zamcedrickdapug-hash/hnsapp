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

  const handleClose = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      onClose(notification._id);
    }, 300);
  }, [notification._id, onClose]);

  const colorClass = `toast--${notification.color}`;
  const animationClass = `toast--${notification.animation || 'slide'}`;

  return (
    <div
      className={`toast ${colorClass} ${animationClass} ${isExiting ? 'toast--exiting' : 'toast--entering'}`}
      onClick={handleClose}
      role="alert"
      aria-live="polite"
    >
      {/* Left color indicator bar */}
      <div className="toast__color-bar" />

      {/* Icon section */}
      <div className="toast__icon-section">
        <span className="toast__icon" role="img" aria-label={notification.title}>
          {notification.icon || '📦'}
        </span>
      </div>

      {/* Content section */}
      <div className="toast__content-section">
        {/* Title */}
        <h4 className="toast__title">{notification.title}</h4>

        {/* Message */}
        <p className="toast__message">{notification.message}</p>

        {/* Metadata display (driver name, student, plate number, etc.) */}
        {notification.metadata && (
          <div className="toast__metadata">
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
          </div>
        )}

        {/* Timestamp */}
        {notification.timestamp && (
          <div className="toast__timestamp">
            {new Date(notification.timestamp).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </div>
        )}
      </div>

      {/* Close button */}
      <button
        className="toast__close"
        onClick={(e) => {
          e.stopPropagation();
          handleClose();
        }}
        aria-label="Close notification"
        type="button"
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
export const ToastContainer = ({ toasts = [], onClose, position = 'top-right' }) => {
  return (
    <div className={`toast-container toast-container--${position}`}>
      {toasts.map((notification) => (
        <Toast
          key={notification._id}
          notification={notification}
          onClose={onClose}
          autoCloseDuration={5000}
        />
      ))}
    </div>
  );
};

export default Toast;
