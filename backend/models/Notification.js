const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VanRequest',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'searching',        // Parent requests van
        'accepted',         // Driver accepts request
        'on_the_way',       // Driver starting GPS to parent
        'arrived_pickup',   // Driver arrived at parent location
        'picked_up',        // Student picked up
        'heading_school',   // Driver starting GPS to school
        'arrived_school',   // Driver arrived at school (FINAL NOTIFICATION)
      ],
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    metadata: {
      driverId: mongoose.Schema.Types.ObjectId,
      driverName: String,
      driverPhone: String,
      plateNumber: String,
      vehicleType: String,
      studentName: String,
      schoolName: String,
      pickupLocation: String,
      schoolLocation: String,
      eta: Number,
      gpsCoordinates: {
        latitude: Number,
        longitude: Number,
      },
    },
    readAt: {
      type: Date,
      default: null,
    },
    animation: {
      type: String,
      enum: ['slide', 'pop', 'fade'],
      default: 'slide',
    },
    color: {
      type: String,
      enum: ['blue', 'green', 'yellow', 'orange', 'red'],
      default: 'blue',
    },
    icon: {
      type: String,
      default: '📦',
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      // Index defined at schema level with TTL (see below)
    },
  },
  {
    timestamps: true,
  }
);

// ✅ Single source of truth for expiresAt TTL index with expireAfterSeconds
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Method to mark as read
notificationSchema.methods.markAsRead = async function () {
  this.read = true;
  this.readAt = new Date();
  return this.save();
};

// Static method to get unread count
notificationSchema.statics.getUnreadCount = async function (userId) {
  return this.countDocuments({ userId, read: false });
};

// Static method to create notification with deduplication
notificationSchema.statics.createNotification = async function (data) {
  const {
    userId,
    requestId,
    type,
    title,
    message,
    metadata = {},
    color = 'blue',
    icon = '📦',
    animation = 'slide',
  } = data;

  // Prevent duplicate notifications within 3 seconds
  const recent = await this.findOne({
    userId,
    requestId,
    type,
    createdAt: { $gte: new Date(Date.now() - 3000) },
  });

  if (recent) {
    return recent; // Return existing notification instead of creating duplicate
  }

  const notification = new this({
    userId,
    requestId,
    type,
    title,
    message,
    metadata,
    color,
    icon,
    animation,
  });

  return notification.save();
};

module.exports = mongoose.model('Notification', notificationSchema);
