const mongoose = require('mongoose');

const validIdDocumentSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    originalName: {
      type: String,
      required: true,
      trim: true,
    },
    mimeType: {
      type: String,
      required: true,
      enum: ['image/jpeg', 'image/png', 'application/pdf'],
    },
    size: {
      type: Number,
      required: true,
      min: 1,
      max: 2 * 1024 * 1024,
    },
    data: {
      type: Buffer,
      required: true,
      select: false,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ValidIdDocument', validIdDocumentSchema);
