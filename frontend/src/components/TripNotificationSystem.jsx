import React from 'react';
import { ToastContainer } from './ui/Toast';
import { useNotifications } from '../context/NotificationContext';

/**
 * NotificationSystem Component
 * Main integration point for displaying toast notifications
 * Displays real-time trip notifications from Socket.IO
 */

const NotificationSystem = () => {
  const { toasts, removeToast } = useNotifications();

  return (
    <>
      {/* Toast notification popups */}
      <ToastContainer
        toasts={toasts}
        onClose={removeToast}
        position="top-right"
      />
    </>
  );
};

export default NotificationSystem;
