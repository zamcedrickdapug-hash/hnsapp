const mongoose = require('mongoose')

const IssueSchema = new mongoose.Schema({
	parentId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		required: true,
	},
	driverId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		default: null,
	},
	tripId: {
		type: String,
		default: null,
	},
	category: {
		type: String,
		enum: ['driver-behavior', 'vehicle-issue', 'route-issue', 'safety-concern', 'payment-issue', 'lost-item', 'other'],
		required: true,
	},
	description: {
		type: String,
		required: true,
		maxlength: 500,
	},
	screenshot: {
		type: String, // Data URL or file path
		default: null,
	},
	status: {
		type: String,
		enum: ['pending', 'reviewing', 'resolved', 'closed'],
		default: 'pending',
	},
	resolution: {
		type: String,
		default: null,
	},
	createdAt: {
		type: Date,
		default: Date.now,
	},
	updatedAt: {
		type: Date,
		default: Date.now,
	},
})

const Issue = mongoose.model('Issue', IssueSchema)

module.exports = { Issue }
