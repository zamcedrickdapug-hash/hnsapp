const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    referenceNo: {
      type: String,
      unique: true,
      sparse: true,
      default: undefined,
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    vanRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VanRequest',
      default: null,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    currency: {
      type: String,
      required: true,
      default: 'PHP',
      enum: ['PHP'],
    },
    method: {
      type: String,
      required: true,
      enum: ['cash', 'gcash'],
    },
    externalRef: {
      type: String,
      trim: true,
      maxlength: 40,
      default: undefined,
      required() {
        return this.method === 'gcash';
      },
    },
    note: {
      type: String,
      trim: true,
      maxlength: 200,
      default: '',
    },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending',
      index: true,
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    submittedByRole: {
      type: String,
      required: true,
      enum: ['parent', 'driver'],
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    rejectReason: {
      type: String,
      trim: true,
      maxlength: 200,
      default: '',
    },
  },
  { timestamps: true }
);

paymentSchema.index(
  { driver: 1, externalRef: 1 },
  {
    unique: true,
    partialFilterExpression: { externalRef: { $type: 'string' } },
  }
);

module.exports = mongoose.model('Payment', paymentSchema);
