const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema(
  {
    latitude: {
      type: Number,
      min: -90,
      max: 90,
    },
    longitude: {
      type: Number,
      min: -180,
      max: 180,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const requesterLocationSchema = new mongoose.Schema(
  {
    latitude: {
      type: Number,
      min: -90,
      max: 90,
      required: true,
    },
    longitude: {
      type: Number,
      min: -180,
      max: 180,
      required: true,
    },
    accuracy: {
      type: Number,
      min: 0,
    },
    capturedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const requestStudentSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
  },
  studentName: {
    type: String,
    trim: true,
  },
  gradeLevel: {
    type: String,
    trim: true,
  },
});

const vanRequestSchema = new mongoose.Schema(
  {
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      default: null,
    },
    rejectedBy: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    studentName: {
      type: String,
      trim: true,
      required: true,
    },
    students: {
      type: [requestStudentSchema],
      default: [],
    },
    seatsNeeded: {
      type: Number,
      min: 1,
      max: 20,
      default: 1,
    },
    slot: {
      type: String,
      enum: ['AM', 'PM'],
      default: 'AM',
    },
    scheduledDate: {
      type: Date,
      default: null,
    },
    gradeSection: {
      type: String,
      trim: true,
      default: '',
    },
    schoolName: {
      type: String,
      trim: true,
      default: '',
    },
    pickupZone: {
      type: String,
      trim: true,
      required: true,
    },
    emergencyContact: {
      type: String,
      trim: true,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['searching', 'accepted', 'arrived', 'picked_up', 'arrived_at_school', 'cancelled', 'completed'],
      default: 'searching',
      index: true,
    },
    liveLocation: {
      type: locationSchema,
      default: null,
    },
    requesterLocation: {
      type: requesterLocationSchema,
      default: null,
    },
    destinationLocation: {
      type: locationSchema,
      default: null,
    },
    pickupConfirmedByParentAt: {
      type: Date,
      default: null,
    },
    pickedUpAt: {
      type: Date,
      default: null,
    },
    acceptedAt: {
      type: Date,
      default: null,
    },
    arrivedAtDestinationAt: {
      type: Date,
      default: null,
    },
    arrivedAtSchoolAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

vanRequestSchema.methods.getStudentList = function() {
  if (this.students?.length) return this.students;
  if (this.studentName) return [{ studentName: this.studentName }];
  return [];
};

const VanRequest = mongoose.model('VanRequest', vanRequestSchema);

module.exports = VanRequest;
