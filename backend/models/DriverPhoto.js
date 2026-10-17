const mongoose = require('mongoose');

const driverPhotoSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  data: {
    type: Buffer,
    required: true,
    select: false,
  },
  contentType: {
    type: String,
    enum: ['image/jpeg', 'image/png', 'image/webp'],
    required: true,
  },
  size: {
    type: Number,
    required: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('DriverPhoto', driverPhotoSchema);
