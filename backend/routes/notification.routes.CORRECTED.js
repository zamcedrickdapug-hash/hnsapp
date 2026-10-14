// ============================================================================
// NOTIFICATION ROUTES - FIXED AND CORRECTED
// backend/routes/notification.routes.js
// ============================================================================

const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { requireAuth } = require('../middleware/auth');  // ✅ FIXED: Destructured properly

// Debug logging to verify middleware is loaded
console.log('Notification routes - requireAuth type:', typeof requireAuth, requireAuth ? 'loaded' : 'MISSING');

// ============================================================================
// ENDPOINT 1: Get all notifications (paginated, newest first)
// ============================================================================
router.get('/', requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    const userId = req.user._id;

    let query = { userId };

    if (unreadOnly === 'true') {
      query.read = false;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.getUnreadCount(userId);

    return res.json({
      notifications,
      unreadCount,
      total,
      pages: Math.ceil(total / limit),
      currentPage: parseInt(page),
    });
  } catch (error) {
    console.error('Get notifications error:', error.message);
    return res.status(500).json({ message: 'Error fetching notifications' });
  }
});

// ============================================================================
// ENDPOINT 2: Get unread notification count
// ============================================================================
router.get('/unread/count', requireAuth, async (req, res) => {
  try {
    const unreadCount = await Notification.getUnreadCount(req.user._id);
    return res.json({ unreadCount });
  } catch (error) {
    console.error('Get unread count error:', error.message);
    return res.status(500).json({ message: 'Error fetching unread count' });
  }
});

// ============================================================================
// ENDPOINT 3: Get single notification by ID
// ============================================================================
router.get('/:notificationId', requireAuth, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.notificationId);

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    if (String(notification.userId) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    return res.json(notification);
  } catch (error) {
    console.error('Get notification error:', error.message);
    return res.status(500).json({ message: 'Error fetching notification' });
  }
});

// ============================================================================
// ENDPOINT 4: Mark notification as read
// ============================================================================
router.patch('/:notificationId/read', requireAuth, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.notificationId);

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    if (String(notification.userId) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    await notification.markAsRead();
    return res.json({ message: 'Notification marked as read', notification });
  } catch (error) {
    console.error('Mark as read error:', error.message);
    return res.status(500).json({ message: 'Error updating notification' });
  }
});

// ============================================================================
// ENDPOINT 5: Mark all notifications as read
// ============================================================================
router.patch('/mark-all/read', requireAuth, async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { userId: req.user._id, read: false },
      { read: true, readAt: new Date() }
    );

    return res.json({
      message: 'All notifications marked as read',
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error('Mark all as read error:', error.message);
    return res.status(500).json({ message: 'Error updating notifications' });
  }
});

// ============================================================================
// ENDPOINT 6: Delete single notification
// ============================================================================
router.delete('/:notificationId', requireAuth, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.notificationId);

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    if (String(notification.userId) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    await Notification.findByIdAndDelete(req.params.notificationId);
    return res.json({ message: 'Notification deleted' });
  } catch (error) {
    console.error('Delete notification error:', error.message);
    return res.status(500).json({ message: 'Error deleting notification' });
  }
});

// ============================================================================
// ENDPOINT 7: Delete all notifications for user
// ============================================================================
router.delete('/clear/all', requireAuth, async (req, res) => {
  try {
    const result = await Notification.deleteMany({ userId: req.user._id });

    return res.json({
      message: 'All notifications deleted',
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error('Clear all notifications error:', error.message);
    return res.status(500).json({ message: 'Error clearing notifications' });
  }
});

module.exports = router;

// ============================================================================
// MIDDLEWARE - middleware/auth.js (NO CHANGES NEEDED)
// ============================================================================
/*
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const getTokenFromHeader = (req) => {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
};

const requireAuth = async (req, res, next) => {
  try {
    const token = getTokenFromHeader(req);

    if (!token) {
      return res.status(401).json({ message: 'Authentication token is required.' });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.userId);

    if (!user) {
      return res.status(401).json({ message: 'Invalid authentication token.' });
    }

    if (user.role !== 'admin' && ['suspended', 'banned'].includes(String(user.accountState || 'active'))) {
      return res.status(403).json({
        message: user.accountState === 'banned'
          ? 'Your account has been banned. Please contact support.'
          : 'Your account has been suspended. Please contact support.',
        accountState: user.accountState,
      });
    }

    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Authentication failed.' });
  }
};

// Export as object (notification.routes.js destructures this)
module.exports = {
  requireAuth,
  requireAdmin,
  requireParent,
  requireApplicant,
};
*/

// ============================================================================
// HOW TO USE IN APP - backend/index.js
// ============================================================================
/*
// Register notification routes
app.use('/api/notifications', notificationRoutes);

// This makes the routes accessible at:
// GET    /api/notifications
// GET    /api/notifications/unread/count
// GET    /api/notifications/:id
// PATCH  /api/notifications/:id/read
// PATCH  /api/notifications/mark-all/read
// DELETE /api/notifications/:id
// DELETE /api/notifications/clear/all
*/

// ============================================================================
// FRONTEND USAGE - frontend/src/context/NotificationContext.jsx
// ============================================================================
/*
const fetchNotifications = useCallback(async (page = 1, unreadOnly = false) => {
  setIsLoading(true);
  try {
    const response = await fetch(
      `/api/notifications?page=${page}&limit=20&unreadOnly=${unreadOnly}`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      }
    );

    if (!response.ok) throw new Error('Failed to fetch notifications');

    const data = await response.json();
    setNotifications(data.notifications);
    setUnreadCount(data.unreadCount);
    setHasMore(page < data.pages);
    setCurrentPage(page);
  } catch (error) {
    console.error('Error fetching notifications:', error);
  } finally {
    setIsLoading(false);
  }
}, []);
*/
