import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useSocket } from '../hooks/useSocket';
import { SESSION_CONFIG } from '../constants/authConstants';

/**
 * NotificationContext
 * Manages real-time trip notifications (7-stage workflow)
 * Listens to Socket.IO events and displays professional toasts
 */

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const { socket } = useSocket(localStorage.getItem(SESSION_CONFIG.TOKEN_KEY));
  const [toasts, setToasts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const handledNotificationIds = useRef(new Set());

  /**
   * Play notification sound using Web Audio API
   */
  const playNotificationSound = useCallback(() => {
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
      console.error('Error playing notification sound:', error);
    }
  }, []);

  /**
   * Add toast notification
   */
  const addToast = useCallback((notification) => {
    const id = notification._id || `toast-${Date.now()}-${Math.random()}`;
    if (notification._id && handledNotificationIds.current.has(String(notification._id))) {
      return id;
    }
    if (notification._id) {
      handledNotificationIds.current.add(String(notification._id));
      setUnreadCount((prev) => prev + 1);
    }

    const toast = {
      ...notification,
      _id: id,
      timestamp: notification.timestamp || new Date().toISOString(),
    };

    setToasts((prev) => [...prev, toast]);

    // Play sound
    if (notification.sound !== false) {
      playNotificationSound();
    }

    // Vibrate
    if (notification.vibration !== false && navigator.vibrate) {
      navigator.vibrate(200);
    }

    return id;
  }, [playNotificationSound]);

  /**
   * Remove toast
   */
  const removeToast = useCallback((toastId) => {
    setToasts((prev) => prev.filter((t) => t._id !== toastId));
  }, []);

  /**
   * Display each persisted notification once.
   */
  useEffect(() => {
    if (!socket) return;

    const handleNotification = (data) => addToast(data);
    socket.on('notification:new', handleNotification);

    return () => {
      socket.off('notification:new', handleNotification);
    };
  }, [socket, addToast]);

  return (
    <NotificationContext.Provider
      value={{
        toasts,
        removeToast,
        notifications,
        unreadCount,
        setUnreadCount,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

/**
 * Hook to use notifications
 */
export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};

export default NotificationContext;
