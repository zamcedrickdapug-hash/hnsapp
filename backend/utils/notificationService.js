const Notification = require('../models/Notification');

// Map notification type to UI properties
const notificationConfig = {
  searching: {
    icon: 'search',
    color: 'blue',
    priority: 'normal',
    sound: false,
  },
  driver_accepted: {
    icon: 'accept',
    color: 'blue',
    priority: 'high',
    sound: true,
  },
  driver_gps_started: {
    icon: 'gps',
    color: 'blue',
    priority: 'normal',
    sound: false,
  },
  driver_on_the_way: {
    icon: 'location',
    color: 'blue',
    priority: 'normal',
    sound: false,
  },
  student_picked_up: {
    icon: 'pickup',
    color: 'green',
    priority: 'high',
    sound: true,
  },
  arrived_at_school: {
    icon: 'destination',
    color: 'green',
    priority: 'urgent',
    sound: true,
  },
  trip_completed: {
    icon: 'check',
    color: 'green',
    priority: 'high',
    sound: true,
  },
  trip_cancelled: {
    icon: 'cancel',
    color: 'red',
    priority: 'high',
    sound: true,
  },
  emergency_alert: {
    icon: 'alert',
    color: 'red',
    priority: 'urgent',
    sound: true,
  },
  driver_delay: {
    icon: 'delay',
    color: 'orange',
    priority: 'normal',
    sound: true,
  },
  system_message: {
    icon: 'info',
    color: 'blue',
    priority: 'normal',
    sound: false,
  },
};

/**
 * Create a notification for a user
 * @param {Object} options - Notification options
 * @param {string} options.userId - User ID to receive notification
 * @param {string} options.type - Notification type from enum
 * @param {string} options.title - Notification title
 * @param {string} options.message - Notification message
 * @param {string} options.requestId - Associated van request ID (optional)
 * @param {Object} options.metadata - Additional metadata (optional)
 * @returns {Promise<Object>} Created notification
 */
async function createNotification(options) {
  const {
    userId,
    type,
    title,
    message,
    requestId = null,
    metadata = {},
  } = options;

  if (!userId || !type || !title || !message) {
    console.error('createNotification: Missing required fields', { userId, type, title, message });
    return null;
  }

  const config = notificationConfig[type] || notificationConfig.system_message;

  try {
    const notification = await Notification.createNotification({
      userId,
      requestId,
      type,
      title,
      message,
      metadata,
      priority: config.priority,
      icon: config.icon,
      color: config.color,
      sound: config.sound,
      vibration: true,
    });

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
}

/**
 * Create multiple notifications at once
 * @param {Array} notifications - Array of notification options
 * @returns {Promise<Array>} Created notifications
 */
async function createBulkNotifications(notifications) {
  return Promise.all(notifications.map((n) => createNotification(n)));
}

/**
 * Create notification when driver accepts request
 */
async function notifyDriverAccepted(parentId, requestId, driverName, vehicleType, plateNumber) {
  return createNotification({
    userId: parentId,
    type: 'driver_accepted',
    title: '🚐 Driver Accepted!',
    message: `${driverName} has accepted your request. Vehicle: ${vehicleType} (${plateNumber})`,
    requestId,
    metadata: {
      driverName,
      vehicleType,
      plateNumber,
    },
  });
}

/**
 * Create notification when driver starts GPS
 */
async function notifyGpsStarted(parentId, requestId, driverName) {
  return createNotification({
    userId: parentId,
    type: 'driver_gps_started',
    title: '📍 GPS Tracking Started',
    message: `${driverName} has started live GPS tracking. You can now see their location.`,
    requestId,
    metadata: {
      driverName,
    },
  });
}

/**
 * Create notification when driver is on the way
 */
async function notifyDriverOnTheWay(parentId, requestId, driverName, estimatedArrival) {
  return createNotification({
    userId: parentId,
    type: 'driver_on_the_way',
    title: '🚗 Driver On The Way',
    message: `${driverName} is on the way to pick up your child.`,
    requestId,
    metadata: {
      driverName,
      estimatedArrival,
    },
  });
}

/**
 * Create notification when student is picked up
 */
async function notifyStudentPickedUp(parentId, requestId, driverName, studentName) {
  return createNotification({
    userId: parentId,
    type: 'student_picked_up',
    title: '✅ Student Picked Up',
    message: `${studentName} has been picked up by ${driverName}. Safe travels!`,
    requestId,
    metadata: {
      driverName,
      studentName,
    },
  });
}

/**
 * Create notification when student arrives at school
 */
async function notifyArrivedAtSchool(
  parentId,
  requestId,
  driverName,
  studentName,
  schoolName,
  arrivalTime
) {
  return createNotification({
    userId: parentId,
    type: 'arrived_at_school',
    title: '✅ Arrived at School',
    message: `${studentName} has safely arrived at ${schoolName} at ${arrivalTime.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })}. Driver: ${driverName}`,
    requestId,
    metadata: {
      driverName,
      studentName,
      schoolName,
      completedAt: arrivalTime,
    },
  });
}

/**
 * Create notification when trip is completed
 */
async function notifyTripCompleted(parentId, requestId, driverName, studentName) {
  return createNotification({
    userId: parentId,
    type: 'trip_completed',
    title: '✅ Trip Completed',
    message: `Your trip with ${driverName} is now complete. ${studentName} is safe at school.`,
    requestId,
    metadata: {
      driverName,
      studentName,
    },
  });
}

/**
 * Create notification when trip is cancelled
 */
async function notifyTripCancelled(parentId, requestId, studentName, reason = '') {
  const message = reason
    ? `Your trip for ${studentName} has been cancelled. Reason: ${reason}`
    : `Your trip for ${studentName} has been cancelled.`;

  return createNotification({
    userId: parentId,
    type: 'trip_cancelled',
    title: '❌ Trip Cancelled',
    message,
    requestId,
    metadata: {
      studentName,
      reason,
    },
  });
}

/**
 * Create emergency alert notification
 */
async function notifyEmergencyAlert(parentId, requestId, alertMessage, metadata = {}) {
  return createNotification({
    userId: parentId,
    type: 'emergency_alert',
    title: '🚨 Emergency Alert',
    message: alertMessage,
    requestId,
    metadata,
  });
}

module.exports = {
  createNotification,
  createBulkNotifications,
  notifyDriverAccepted,
  notifyGpsStarted,
  notifyDriverOnTheWay,
  notifyStudentPickedUp,
  notifyArrivedAtSchool,
  notifyTripCompleted,
  notifyTripCancelled,
  notifyEmergencyAlert,
  notificationConfig,
};
