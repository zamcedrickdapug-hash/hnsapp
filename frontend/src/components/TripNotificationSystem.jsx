import React from 'react';
import { ToastContainer } from './ui/Toast';
import { useNotifications } from '../context/NotificationContext';

/**
 * NotificationSystem Component
 * Main integration point for displaying toast notifications
 * Displays real-time trip notifications from Socket.IO
 */

const NotificationSystem = () => {
  const { toasts, removeToast, navigateFromNotification } = useNotifications();

  return (
    <>
      {/* Toast notification popups */}
      <ToastContainer
        toasts={toasts}
        onClose={removeToast}
        onNotificationClick={navigateFromNotification}
        position="top-right"
      />
    </>
  );
};

export default NotificationSystem;
