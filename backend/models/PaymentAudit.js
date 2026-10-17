const mongoose = require('mongoose');

const paymentAuditSchema = new mongoose.Schema({
  payment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    required: true,
    index: true,
  },
  referenceNo: {
    type: String,
    default: null,
  },
  action: {
    type: String,
    required: true,
    enum: ['submitted', 'recorded_cash', 'verified', 'rejected'],
  },
  actor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  actorRole: {
    type: String,
    required: true,
    enum: ['parent', 'driver', 'admin'],
  },
  fromStatus: {
    type: String,
    default: null,
  },
  toStatus: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  at: {
    type: Date,
    required: true,
    default: Date.now,
  },
});

module.exports = mongoose.model('PaymentAudit', paymentAuditSchema);
