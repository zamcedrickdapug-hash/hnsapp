import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useSocket } from '../hooks/useSocket';

/**
 * NotificationContext
 * Manages real-time trip notifications (7-stage workflow)
 * Listens to Socket.IO events and displays professional toasts
 */

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const { socket } = useSocket(localStorage.getItem('token'));
  const [toasts, setToasts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

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
   * Setup Socket.IO listeners for 7-stage trip workflow
   */
  useEffect(() => {
    if (!socket) return;

    // STAGE 1: Searching
    const handleSearching = (data) => {
      addToast({
        _id: `notif-${data.requestId}-searching`,
        type: 'searching',
        title: '🔍 Searching for available driver...',
        message: 'We are looking for the nearest available driver in your area.',
        color: 'blue',
        icon: '🔍',
        animation: 'slide',
        metadata: data.metadata,
        sound: true,
        vibration: true,
      });
    };

    // STAGE 2: Driver Accepted
    const handleAccepted = (data) => {
      addToast({
        _id: `notif-${data.requestId}-accepted`,
        type: 'accepted',
        title: '✅ Driver Accepted Your Request',
        message: `Your driver is now preparing for pickup.`,
        color: 'green',
        icon: '✅',
        animation: 'pop',
        metadata: data.metadata,
        sound: true,
        vibration: true,
      });
      setUnreadCount((prev) => prev + 1);
    };

    // STAGE 3: On The Way
    const handleOnTheWay = (data) => {
      addToast({
        _id: `notif-${data.requestId}-on_the_way`,
        type: 'on_the_way',
        title: '🚗 Driver Is On The Way',
        message: 'Your driver is now traveling to your pickup location.',
        color: 'blue',
        icon: '🚗',
        animation: 'slide',
        metadata: data.metadata,
        sound: false,
        vibration: true,
      });
    };

    // STAGE 4: Arrived at Pickup
    const handleArrivedPickup = (data) => {
      addToast({
        _id: `notif-${data.requestId}-arrived_pickup`,
        type: 'arrived_pickup',
        title: '📍 Driver Has Arrived',
        message: `${data.metadata?.driverName || 'Driver'} is now at your pickup location.`,
        color: 'yellow',
        icon: '📍',
        animation: 'pop',
        metadata: data.metadata,
        sound: true,
        vibration: true,
      });
    };

    // STAGE 5: Student Picked Up
    const handlePickedUp = (data) => {
      addToast({
        _id: `notif-${data.requestId}-picked_up`,
        type: 'picked_up',
        title: '🚐 Student Picked Up',
        message: 'Your child is now on the way to school.',
        color: 'blue',
        icon: '🚐',
        animation: 'slide',
        metadata: data.metadata,
        sound: false,
        vibration: true,
      });
    };

    // STAGE 6: Heading to School
    const handleHeadingSchool = (data) => {
      addToast({
        _id: `notif-${data.requestId}-heading_school`,
        type: 'heading_school',
        title: '🏫 Heading To School',
        message: `The school van is now traveling to school.`,
        color: 'blue',
        icon: '🏫',
        animation: 'slide',
        metadata: data.metadata,
        sound: false,
        vibration: true,
      });
    };

    // STAGE 7 (FINAL): Arrived at School
    const handleArrivedSchool = (data) => {
      addToast({
        _id: `notif-${data.requestId}-arrived_school`,
        type: 'arrived_school',
        title: '✅ Arrived At School',
        message: 'Your child has safely arrived at school.',
        color: 'green',
        icon: '✅',
        animation: 'pop',
        metadata: data.metadata,
        sound: true,
        vibration: true,
      });
      setUnreadCount((prev) => prev + 1);
    };

    // Register listeners
    socket.on('notification:new', (data) => {
      switch (data.type) {
        case 'searching':
          handleSearching(data);
          break;
        case 'accepted':
          handleAccepted(data);
          break;
        case 'on_the_way':
          handleOnTheWay(data);
          break;
        case 'arrived_pickup':
          handleArrivedPickup(data);
          break;
        case 'picked_up':
          handlePickedUp(data);
          break;
        case 'heading_school':
          handleHeadingSchool(data);
          break;
        case 'arrived_school':
          handleArrivedSchool(data);
          break;
        default:
          addToast(data);
      }
    });

    socket.on('driver:gps_started_to_parent', handleOnTheWay);
    socket.on('driver:arrived_at_pickup', handleArrivedPickup);
    socket.on('student:picked_up', handlePickedUp);
    socket.on('driver:gps_started_to_school', handleHeadingSchool);
    socket.on('driver:arrived_at_school', handleArrivedSchool);

    return () => {
      socket.off('notification:new');
      socket.off('driver:gps_started_to_parent', handleOnTheWay);
      socket.off('driver:arrived_at_pickup', handleArrivedPickup);
      socket.off('student:picked_up', handlePickedUp);
      socket.off('driver:gps_started_to_school', handleHeadingSchool);
      socket.off('driver:arrived_at_school', handleArrivedSchool);
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
