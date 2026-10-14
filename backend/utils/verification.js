const nodemailer = require('nodemailer');

/**
 * Generate 6-digit code
 */
const generateVerificationCode = () => {
	return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Send SMS code (temporary placeholder)
 */
const sendSmsCode = async (phoneNumber, code) => {
	console.log('SMS Code:', code, 'to', phoneNumber);

	return {
		success: true,
		isDevelopment: true,
		code,
	};
};

/**
 * Send email verification code
 */
const sendEmailCode = async (email, code) => {
	try {
		const transporter = nodemailer.createTransport({
			host: process.env.SMTP_HOST,
			port: process.env.SMTP_PORT,
			secure: false,
			auth: {
				user: process.env.SMTP_USERNAME,
				pass: process.env.SMTP_PASSWORD,
			},
		});

		await transporter.sendMail({
			from: `"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_FROM_EMAIL}>`,
			to: email,
			subject: 'Your Verification Code',
			html: `
				<div style="font-family: Arial, sans-serif;">
					<h2>HNS Booking Verification</h2>
					<p>Your verification code is:</p>
					<h1>${code}</h1>
					<p>This code will expire in 10 minutes.</p>
				</div>
			`,
		});

		console.log('Verification email sent to:', email);

		return {
			success: true,
		};
	} catch (error) {
		console.error('Email sending error:', error);

		return {
			success: false,
			error: error.message,
		};
	}
};

/**
 * Validate phone number
 */
const isValidPhoneNumber = (phone) => {
	const phoneRegex = /^\+?[1-9]\d{1,14}$/;
	return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
};

/**
 * Validate email
 */
const isValidEmail = (email) => {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return emailRegex.test(email);
};

module.exports = {
	generateVerificationCode,
	sendSmsCode,
	sendEmailCode,
	isValidPhoneNumber,
	isValidEmail,
};