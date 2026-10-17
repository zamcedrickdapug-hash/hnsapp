const express = require('express')
const { requireAuth, requireAdmin } = require('../middleware/auth')
const User = require('../models/User')
const { Issue } = require('../models/Issue')

const router = express.Router()

/**
 * POST /api/issues/create-report
 * Create a new issue report from a parent about a trip/driver
 */
router.post('/create-report', requireAuth, async (req, res) => {
	try {
		const { tripId, category, description, screenshot, driverId } = req.body
		const parentId = req.user._id

		// Validate required fields
		if (!category || !description) {
			return res.status(400).json({
				success: false,
				message: 'Category and description are required',
			})
		}

		// Validate category
		const validCategories = [
			'driver-behavior',
			'vehicle-issue',
			'route-issue',
			'safety-concern',
			'payment-issue',
			'lost-item',
			'other',
		]
		if (!validCategories.includes(category)) {
			return res.status(400).json({
				success: false,
				message: 'Invalid issue category',
			})
		}

		// Create the issue document
		const issue = new Issue({
			parentId,
			driverId,
			tripId,
			category,
			description,
			screenshot: screenshot || null,
			status: 'pending',
			createdAt: new Date(),
			updatedAt: new Date(),
		})

		await issue.save()

		// Optionally: Create a notification for the driver/admin
		// const parent = await User.findById(parentId)
		// Send notification to driver about the report

		res.status(201).json({
			success: true,
			message: 'Issue report created successfully',
			issue: {
				id: issue._id,
				category: issue.category,
				status: issue.status,
				createdAt: issue.createdAt,
			},
		})
	} catch (error) {
		console.error('Error creating issue report:', error)
		res.status(500).json({
			success: false,
			message: error.message || 'Failed to create issue report',
		})
	}
})

/**
 * GET /api/issues
 * Get all issue reports for a parent or admin
 */
router.get('/', requireAdmin, async (req, res) => {
	try {
		const issues = await Issue.find({})
			.populate('parentId', 'fullName phone email')
			.populate('driverId', 'fullName phone vehicleType plateNumber')
			.sort({ createdAt: -1 })
			.limit(100)

		res.json({
			success: true,
			issues,
		})
	} catch (error) {
		console.error('Error fetching issues:', error)
		res.status(500).json({
			success: false,
			message: error.message || 'Failed to fetch issues',
		})
	}
})

/**
 * GET /api/issues/:id
 * Get a specific issue report
 */
router.get('/:id', requireAuth, async (req, res) => {
	try {
		const issue = await Issue.findById(req.params.id)
			.populate('parentId', 'fullName phone email')
			.populate('driverId', 'fullName phone vehicleType plateNumber')

		if (!issue) {
			return res.status(404).json({
				success: false,
				message: 'Issue not found',
			})
		}

		// Check authorization - parent can view their own, admin can view all
		const issueOwnerId = issue.parentId?._id || issue.parentId
		if (req.user.role !== 'admin' && String(issueOwnerId) !== String(req.user._id)) {
			return res.status(403).json({
				success: false,
				message: 'Not authorized to view this issue',
			})
		}

		res.json({
			success: true,
			issue,
		})
	} catch (error) {
		console.error('Error fetching issue:', error)
		res.status(500).json({
			success: false,
			message: error.message || 'Failed to fetch issue',
		})
	}
})

/**
 * PATCH /api/issues/:id/status
 * Update the status of an issue report (admin only)
 */
router.patch('/:id/status', requireAdmin, async (req, res) => {
	try {
		const { status, resolution } = req.body
		const validStatuses = ['pending', 'reviewing', 'resolved', 'closed']

		if (!validStatuses.includes(status)) {
			return res.status(400).json({
				success: false,
				message: 'Invalid status',
			})
		}

		const issue = await Issue.findByIdAndUpdate(
			req.params.id,
			{
				status,
				resolution: resolution || null,
				updatedAt: new Date(),
			},
			{ returnDocument: 'after' }
		)

		if (!issue) {
			return res.status(404).json({
				success: false,
				message: 'Issue not found',
			})
		}

		res.json({
			success: true,
			message: 'Issue status updated',
			issue,
		})
	} catch (error) {
		console.error('Error updating issue:', error)
		res.status(500).json({
			success: false,
			message: error.message || 'Failed to update issue',
		})
	}
})

module.exports = router
