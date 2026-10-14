/**
 * Notification Service - Professional Real-Time Trip Notifications
 * Handles 7-stage trip workflow with real-time Socket.IO events
 * 
 * Stages:
 * 1. searching - Parent requests van
 * 2. accepted - Driver accepts request
 * 3. on_the_way - Driver starting GPS to parent
 * 4. arrived_pickup - Driver arrived at parent location
 * 5. picked_up - Student picked up
 * 6. heading_school - Driver starting GPS to school
 * 7. arrived_school - Driver arrived at school (FINAL)
 */

const Notification = require('../models/Notification');
const { getIo, buildUserRoomName } = require('../socket');

/**
 * Emit realtime notification via Socket.IO
 */
const emitNotificationToUser = (userId, notification) => {
  const io = getIo();
  if (!io) return;

  const userRoom = buildUserRoomName(userId);
  io.to(userRoom).emit('notification:new', {
    _id: notification._id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    metadata: notification.metadata,
    color: notification.color,
    icon: notification.icon,
    animation: notification.animation,
    timestamp: notification.createdAt,
  });
};

/**
 * STAGE 1: Parent requests van - "Searching for available driver..."
 */
const notifyParentSearching = async (parentId, requestId, studentName, schoolName, pickupLocation) => {
  try {
    const notification = await Notification.createNotification({
      userId: parentId,
      requestId,
      type: 'searching',
      title: '🔍 Searching for available driver...',
      message: 'We are looking for the nearest available driver in your area.',
      metadata: {
        studentName,
        schoolName,
        pickupLocation,
      },
      color: 'blue',
      icon: '🔍',
      animation: 'slide',
    });

    emitNotificationToUser(parentId, notification);
    console.log(`[Notification] Searching - Parent ${parentId}, Request ${requestId}`);
    return notification;
  } catch (error) {
    console.error('[Notification Error] Searching:', error.message);
  }
};

/**
 * STAGE 2: Driver accepts request - "Driver Accepted Your Request"
 */
const notifyParentDriverAccepted = async (
  parentId,
  requestId,
  driverId,
  driverName,
  driverPhone,
  plateNumber,
  vehicleType,
  studentName,
  schoolName
) => {
  try {
    const notification = await Notification.createNotification({
      userId: parentId,
      requestId,
      type: 'accepted',
      title: '✅ Driver Accepted Your Request',
      message: `Your driver ${driverName} is now preparing for pickup.`,
      metadata: {
        driverId,
        driverName,
        driverPhone,
        plateNumber,
        vehicleType,
        studentName,
        schoolName,
      },
      color: 'green',
      icon: '✅',
      animation: 'pop',
    });

    emitNotificationToUser(parentId, notification);
    console.log(`[Notification] Driver Accepted - Parent ${parentId}, Driver ${driverId}`);
    return notification;
  } catch (error) {
    console.error('[Notification Error] Driver Accepted:', error.message);
  }
};

/**
 * STAGE 3: Driver starting GPS to parent - "Driver Is On The Way"
 */
const notifyParentOnTheWay = async (
  parentId,
  requestId,
  driverName,
  plateNumber,
  eta,
  studentName,
  schoolName
) => {
  try {
    const notification = await Notification.createNotification({
      userId: parentId,
      requestId,
      type: 'on_the_way',
      title: '🚗 Driver Is On The Way',
      message: `${driverName} is now traveling to your pickup location.`,
      metadata: {
        driverName,
        plateNumber,
        eta,
        studentName,
        schoolName,
      },
      color: 'blue',
      icon: '🚗',
      animation: 'slide',
    });

    emitNotificationToUser(parentId, notification);
    console.log(`[Notification] On The Way - Parent ${parentId}, Request ${requestId}`);
    return notification;
  } catch (error) {
    console.error('[Notification Error] On The Way:', error.message);
  }
};

/**
 * STAGE 4 (Optional): Driver arrived at parent pickup location
 * This is optional - small notification only
 */
const notifyParentArrivalAtPickup = async (
  parentId,
  requestId,
  driverName,
  plateNumber,
  studentName,
  schoolName
) => {
  try {
    const notification = await Notification.createNotification({
      userId: parentId,
      requestId,
      type: 'arrived_pickup',
      title: '📍 Driver Has Arrived',
      message: `${driverName} is now at your pickup location.`,
      metadata: {
        driverName,
        plateNumber,
        studentName,
        schoolName,
      },
      color: 'yellow',
      icon: '📍',
      animation: 'pop',
    });

    emitNotificationToUser(parentId, notification);
    console.log(`[Notification] Arrival at Pickup - Parent ${parentId}, Request ${requestId}`);
    return notification;
  } catch (error) {
    console.error('[Notification Error] Arrival at Pickup:', error.message);
  }
};

/**
 * STAGE 5: Student picked up - "Student Picked Up"
 */
const notifyParentStudentPickedUp = async (
  parentId,
  requestId,
  driverName,
  studentName,
  schoolName,
  eta
) => {
  try {
    const notification = await Notification.createNotification({
      userId: parentId,
      requestId,
      type: 'picked_up',
      title: '🚐 Student Picked Up',
      message: `Your child is now on the way to school with ${driverName}.`,
      metadata: {
        driverName,
        studentName,
        schoolName,
        eta,
      },
      color: 'blue',
      icon: '🚐',
      animation: 'slide',
    });

    emitNotificationToUser(parentId, notification);
    console.log(`[Notification] Student Picked Up - Parent ${parentId}, Request ${requestId}`);
    return notification;
  } catch (error) {
    console.error('[Notification Error] Student Picked Up:', error.message);
  }
};

/**
 * STAGE 6: Driver starting GPS to school - "Heading To School"
 */
const notifyParentHeadingToSchool = async (
  parentId,
  requestId,
  driverName,
  schoolName,
  studentName,
  eta
) => {
  try {
    const notification = await Notification.createNotification({
      userId: parentId,
      requestId,
      type: 'heading_school',
      title: '🏫 Heading To School',
      message: `The school van is now traveling to ${schoolName}.`,
      metadata: {
        driverName,
        schoolName,
        studentName,
        eta,
      },
      color: 'blue',
      icon: '🏫',
      animation: 'slide',
    });

    emitNotificationToUser(parentId, notification);
    console.log(`[Notification] Heading To School - Parent ${parentId}, Request ${requestId}`);
    return notification;
  } catch (error) {
    console.error('[Notification Error] Heading To School:', error.message);
  }
};

/**
 * STAGE 7 (FINAL): Driver arrived at school - "Arrived At School"
 * THIS IS THE ONLY FINAL NOTIFICATION - Key stage!
 */
const notifyParentArrivedAtSchool = async (
  parentId,
  requestId,
  driverName,
  studentName,
  schoolName,
  completedAt
) => {
  try {
    const notification = await Notification.createNotification({
      userId: parentId,
      requestId,
      type: 'arrived_school',
      title: '✅ Arrived At School',
      message: `Your child has safely arrived at ${schoolName}.`,
      metadata: {
        driverName,
        studentName,
        schoolName,
        completedAt: completedAt || new Date(),
      },
      color: 'green',
      icon: '✅',
      animation: 'pop',
    });

    emitNotificationToUser(parentId, notification);
    console.log(`[Notification] Arrived At School - Parent ${parentId}, Request ${requestId}`);
    return notification;
  } catch (error) {
    console.error('[Notification Error] Arrived At School:', error.message);
  }
};

/**
 * Mark notification as read
 */
const markNotificationAsRead = async (notificationId, userId) => {
  try {
    const notification = await Notification.findById(notificationId);
    if (!notification) return null;

    if (String(notification.userId) !== String(userId)) {
      throw new Error('Unauthorized');
    }

    await notification.markAsRead();
    return notification;
  } catch (error) {
    console.error('[Notification Error] Mark as Read:', error.message);
    throw error;
  }
};

/**
 * Get all notifications for user
 */
const getUserNotifications = async (userId, page = 1, limit = 20, unreadOnly = false) => {
  try {
    let query = { userId };

    if (unreadOnly) {
      query.read = false;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit)
      .lean();

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.getUnreadCount(userId);

    return {
      notifications,
      unreadCount,
      total,
      pages: Math.ceil(total / limit),
      currentPage: page,
    };
  } catch (error) {
    console.error('[Notification Error] Get Notifications:', error.message);
    throw error;
  }
};

/**
 * Clear all old notifications for completed trips
 */
const clearNotificationsForRequest = async (requestId) => {
  try {
    const result = await Notification.deleteMany({ requestId });
    console.log(`[Notification] Cleared ${result.deletedCount} notifications for request ${requestId}`);
    return result;
  } catch (error) {
    console.error('[Notification Error] Clear for Request:', error.message);
  }
};

module.exports = {
  notifyParentSearching,
  notifyParentDriverAccepted,
  notifyParentOnTheWay,
  notifyParentArrivalAtPickup,
  notifyParentStudentPickedUp,
  notifyParentHeadingToSchool,
  notifyParentArrivedAtSchool,
  markNotificationAsRead,
  getUserNotifications,
  clearNotificationsForRequest,
  emitNotificationToUser,
};
