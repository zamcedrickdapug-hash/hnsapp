const mongoose = require('mongoose')
const bcryptjs = require('bcryptjs')
const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../.env') })
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') })

const User = require('../models/User')

const createTestDriver = async () => {
	const testDriverPassword = process.env.TEST_DRIVER_PASSWORD
	if (!testDriverPassword || !testDriverPassword.trim()) {
		console.error('TEST_DRIVER_PASSWORD must be set in backend/.env or the process environment before creating a test driver.')
		process.exitCode = 1
		return
	}

	try {
		const mongoUri = process.env.MONGO_URL || 'mongodb://localhost:27017/hnsapp'
		await mongoose.connect(mongoUri)
		console.log('✓ Connected to MongoDB')

		const testDriverEmail = 'testdriver@gmail.com'
		// Check if driver already exists
		const existingDriver = await User.findOne({ email: testDriverEmail })
		if (existingDriver) {
			console.log('Driver already exists, marking as verified...')
			existingDriver.isVerified = true
			await existingDriver.save()
			console.log('✓ Driver marked as verified')
			process.exit(0)
		}

		// Hash password
		const hashedPassword = await bcryptjs.hash(testDriverPassword, 10)

		// Create test driver
		const driver = new User({
			email: testDriverEmail.toLowerCase(),
			fullName: 'Test Driver',
			role: 'driver',
			phone: '09123456789',
			homeAddress: '123 Driver St',
			vehicleType: 'Van',
			plateNumber: 'ABC 1234',
			licenseNumber: 'D1234567',
			licenseExpiry: '2030-12-31',
			emergencyContact: '09198765432',
			passwordHash: hashedPassword,
			status: 'approved',
			accountState: 'active',
			isVerified: true,
			signupMethod: 'email',
			firebaseUid: null,
		})

		await driver.save()
		console.log('✓ Test driver created successfully!')
		console.log('\nTest Driver Account:')
		console.log('────────────────────────────────────────')
		console.log(`Email:    ${testDriverEmail}`)
		console.log('Password is configured through TEST_DRIVER_PASSWORD and was not displayed.')
		console.log('────────────────────────────────────────')

		await mongoose.connection.close()
		console.log('\n✓ Connection closed')
	} catch (error) {
		console.error('Error:', error.message)
		process.exit(1)
	}
}

createTestDriver()
