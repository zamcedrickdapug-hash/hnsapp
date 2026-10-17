const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  requestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VanRequest',
    required: true,
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  senderRole: {
    type: String,
    enum: ['parent', 'driver'],
    required: true,
  },
  text: {
    type: String,
    required: true,
    trim: true,
    minlength: 1,
    maxlength: 500,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  readAt: {
    type: Date,
    default: null,
  },
});

messageSchema.index({ requestId: 1, createdAt: 1, _id: 1 });
messageSchema.index({ recipientId: 1, readAt: 1, requestId: 1 });

// History is retained; a retention policy can be added later if needed.

module.exports = mongoose.models.Message || mongoose.model('Message', messageSchema);
