import { useEffect, useCallback } from 'react';
import { useNotifications } from '../context/NotificationContext';

/**
 * Hook to listen for real-time notifications via Socket.IO
 */
export const useNotificationSocket = (socket) => {
  const { handleSocketNotification } = useNotifications();

  useEffect(() => {
    if (!socket) return;

    /**
     * Listen for incoming notifications
     */
    const handleNotificationReceived = (notification) => {
      console.log('[Socket] Notification received:', notification);

      // Ensure notification has required fields
      if (notification && notification._id) {
        handleSocketNotification({
          ...notification,
          read: notification.read || false,
          timestamp: notification.sentAt || new Date().toISOString(),
        });
      }
    };

    /**
     * Listen for trip completed events
     */
    const handleTripCompleted = (data) => {
      console.log('[Socket] Trip completed:', data);

      const notification = {
        _id: `trip-completed-${data.requestId}-${Date.now()}`,
        type: 'trip_completed',
        title: '✅ Trip Completed',
        message: data.message || 'Your trip has been completed successfully.',
        priority: 'high',
        icon: 'check',
        color: 'green',
        sound: true,
        vibration: true,
        read: false,
        requestId: data.requestId,
        metadata: data,
        timestamp: data.timestamp || new Date().toISOString(),
      };

      handleSocketNotification(notification);
    };

    /**
     * Listen for trip request updated events
     */
    const handleTripRequestUpdated = (data) => {
      console.log('[Socket] Trip request updated:', data);

      if (data.request?.status === 'completed') {
        const notification = {
          _id: `trip-updated-${data.request._id}-${Date.now()}`,
          type: 'trip_completed',
          title: '✅ Student Arrived at School',
          message: `${data.request.studentName} has safely arrived at ${data.request.schoolName}.`,
          priority: 'urgent',
          icon: 'destination',
          color: 'green',
          sound: true,
          vibration: true,
          read: false,
          requestId: data.request._id,
          metadata: {
            studentName: data.request.studentName,
            schoolName: data.request.schoolName,
            driverName: data.request.driver?.fullName,
            arrivedAtSchoolAt: data.request.arrivedAtSchoolAt,
          },
          timestamp: new Date().toISOString(),
        };

        handleSocketNotification(notification);
      }
    };

    /**
     * Listen for GPS stopped events
     */
    const handleGpsStopped = (data) => {
      console.log('[Socket] GPS stopped:', data);

      const notification = {
        _id: `gps-stopped-${data.requestId}-${Date.now()}`,
        type: 'system_message',
        title: '📍 Live Tracking Ended',
        message: 'Live GPS tracking for this trip has ended.',
        priority: 'normal',
        icon: 'location',
        color: 'blue',
        sound: false,
        vibration: false,
        read: false,
        requestId: data.requestId,
        metadata: data,
        timestamp: data.timestamp || new Date().toISOString(),
      };

      handleSocketNotification(notification);
    };

    /**
     * Listen for trip completion notifications
     */
    const handleTripCompletionNotification = (data) => {
      console.log('[Socket] Trip completion notification:', data);

      const notification = {
        _id: `completion-notif-${data.requestId}-${Date.now()}`,
        type: 'arrived_at_school',
        title: '✅ Student Arrived at School',
        message: `${data.studentName} has safely arrived at ${data.destination}.`,
        priority: 'urgent',
        icon: 'destination',
        color: 'green',
        sound: true,
        vibration: true,
        read: false,
        requestId: data.requestId,
        metadata: {
          driverId: data.driverId,
          driverName: data.driverName,
          studentName: data.studentName,
          destination: data.destination,
          completedAt: data.completedAt,
        },
        timestamp: data.completedAt || new Date().toISOString(),
      };

      handleSocketNotification(notification);
    };

    /**
     * Listen for error events
     */
    const handleSocketError = (error) => {
      console.error('[Socket] Notification error:', error);

      const notification = {
        _id: `error-${Date.now()}`,
        type: 'system_message',
        title: '⚠️ Notification Error',
        message: error.message || 'An error occurred while processing notifications.',
        priority: 'normal',
        icon: 'info',
        color: 'yellow',
        sound: false,
        vibration: false,
        read: false,
        timestamp: new Date().toISOString(),
      };

      handleSocketNotification(notification);
    };

    // Register event listeners
    socket.on('notification:received', handleNotificationReceived);
    socket.on('trip:completed', handleTripCompleted);
    socket.on('trip:request-updated', handleTripRequestUpdated);
    socket.on('gps_stopped', handleGpsStopped);
    socket.on('trip:completion-notification', handleTripCompletionNotification);
    socket.on('error', handleSocketError);

    // Cleanup
    return () => {
      socket.off('notification:received', handleNotificationReceived);
      socket.off('trip:completed', handleTripCompleted);
      socket.off('trip:request-updated', handleTripRequestUpdated);
      socket.off('gps_stopped', handleGpsStopped);
      socket.off('trip:completion-notification', handleTripCompletionNotification);
      socket.off('error', handleSocketError);
    };
  }, [socket, handleSocketNotification]);
};

export default useNotificationSocket;
