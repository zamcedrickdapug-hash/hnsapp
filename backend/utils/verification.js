const twilio = require('twilio');

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER || '';
const TWILIO_EMAIL_SERVICE_SID = process.env.TWILIO_EMAIL_SERVICE_SID || '';

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

/**
 * Generate a 6-digit verification code
 */
const generateVerificationCode = () => {
	return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Send SMS verification code to phone number
 */
const sendSmsCode = async (phoneNumber, code) => {
	if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
		console.warn('Twilio SMS not configured. In development, code is:', code);
		return { success: true, isDevelopment: true, code };
	}

	try {
		const message = await client.messages.create({
			body: `Your verification code is: ${code}. This code expires in 10 minutes.`,
			from: TWILIO_PHONE_NUMBER,
			to: phoneNumber,
		});

		console.log('SMS sent successfully:', message.sid);
		return { success: true, messageSid: message.sid };
	} catch (error) {
		console.error('Failed to send SMS:', error);
		return { success: false, error: error.message };
	}
};

/**
 * Send email verification code using Twilio SendGrid
 */
const sendEmailCode = async (email, code) => {
	if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_EMAIL_SERVICE_SID) {
		console.warn('Twilio Email not configured. In development, code is:', code);
		return { success: true, isDevelopment: true, code };
	}

	try {
		const message = await client.messages.create({
			contentSid: TWILIO_EMAIL_SERVICE_SID,
			to: email,
			contentVariables: JSON.stringify({
				code: code,
			}),
		});

		console.log('Email sent successfully:', message.sid);
		return { success: true, messageSid: message.sid };
	} catch (error) {
		console.error('Failed to send email:', error);
		return { success: false, error: error.message };
	}
};

/**
 * Validate phone number format (basic international format)
 */
const isValidPhoneNumber = (phone) => {
	const phoneRegex = /^\+?[1-9]\d{1,14}$/;
	return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
};

/**
 * Validate email format
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
