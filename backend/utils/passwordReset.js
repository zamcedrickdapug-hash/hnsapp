const nodemailer = require('nodemailer');
const crypto = require('crypto');

/**
 * Generate a secure random token (32 bytes = 256 bits)
 */
const generateResetToken = () => {
	return crypto.randomBytes(32).toString('hex');
};

/**
 * Generate a 6-digit OTP code
 */
const generateResetCode = () => {
	return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Send password reset email with token link
 */
const sendPasswordResetEmail = async (email, resetToken, userName = 'User') => {
	try {
		// Validate environment variables
		const smtpHost = process.env.SMTP_HOST;
		const smtpPort = process.env.SMTP_PORT;
		const smtpUsername = process.env.SMTP_USERNAME;
		const smtpPassword = process.env.SMTP_PASSWORD;
		const mailFromEmail = process.env.MAIL_FROM_EMAIL;
		const mailFromName = process.env.MAIL_FROM_NAME || 'HNS App';

		if (!smtpHost || !smtpPort || !smtpUsername || !smtpPassword) {
			console.error('[Password Reset] SMTP configuration missing:', {
				hasSmtpHost: !!smtpHost,
				hasSmtpPort: !!smtpPort,
				hasSmtpUsername: !!smtpUsername,
				hasSmtpPassword: !!smtpPassword,
			});
			return {
				success: false,
				error: 'Email service is not configured. Please contact administrator.',
			};
		}

		console.log('[Password Reset] Creating mail transporter with SMTP:', {
			host: smtpHost,
			port: smtpPort,
			secure: process.env.SMTP_SECURE === 'true',
		});

		const transporter = nodemailer.createTransport({
			host: smtpHost,
			port: parseInt(smtpPort, 10),
			secure: process.env.SMTP_SECURE === 'true' || smtpPort === '465',
			auth: {
				user: smtpUsername,
				pass: smtpPassword,
			},
			// Add timeout configuration
			connectionTimeout: 10000,
			socketTimeout: 10000,
		});

		// Test the connection
		try {
			await transporter.verify();
			console.log('[Password Reset] SMTP connection verified successfully');
		} catch (verifyError) {
			console.error('[Password Reset] SMTP verification failed:', verifyError.message);
			return {
				success: false,
				error: `SMTP connection failed: ${verifyError.message}`,
			};
		}

		const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password/${resetToken}`;

		const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Reset Your Password - H&S Booking System</title>
	<style>
		* {
			margin: 0;
			padding: 0;
			box-sizing: border-box;
		}
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
			background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
			padding: 20px;
			min-height: 100vh;
			display: flex;
			align-items: center;
			justify-content: center;
		}
		.container {
			max-width: 600px;
			width: 100%;
			background: #ffffff;
			border-radius: 12px;
			box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
			overflow: hidden;
		}
		.header {
			background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
			color: white;
			padding: 40px 20px;
			text-align: center;
		}
		.header h1 {
			font-size: 28px;
			margin-bottom: 10px;
			font-weight: 600;
		}
		.header p {
			font-size: 14px;
			opacity: 0.9;
		}
		.content {
			padding: 40px;
		}
		.content h2 {
			font-size: 18px;
			color: #1f2937;
			margin-bottom: 15px;
		}
		.content p {
			font-size: 14px;
			color: #6b7280;
			line-height: 1.6;
			margin-bottom: 20px;
		}
		.button-container {
			margin: 30px 0;
			text-align: center;
		}
		.reset-button {
			display: inline-block;
			padding: 14px 40px;
			background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
			color: white;
			text-decoration: none;
			border-radius: 8px;
			font-weight: 600;
			font-size: 16px;
			transition: transform 0.2s, box-shadow 0.2s;
		}
		.reset-button:hover {
			transform: translateY(-2px);
			box-shadow: 0 5px 20px rgba(30, 58, 138, 0.4);
		}
		.link-text {
			font-size: 12px;
			color: #9ca3af;
			margin-top: 15px;
			word-break: break-all;
		}
		.warning {
			background: #fef3c7;
			border-left: 4px solid #f59e0b;
			padding: 15px;
			margin: 20px 0;
			border-radius: 4px;
			font-size: 13px;
			color: #92400e;
		}
		.footer {
			background: #f9fafb;
			padding: 20px;
			text-align: center;
			border-top: 1px solid #e5e7eb;
			font-size: 12px;
			color: #9ca3af;
		}
		.footer a {
			color: #3b82f6;
			text-decoration: none;
		}
		.footer a:hover {
			text-decoration: underline;
		}
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<h1>🔐 Reset Your Password</h1>
			<p>H&S Booking System</p>
		</div>
		<div class="content">
			<h2>Hello ${userName},</h2>
			<p>We received a request to reset the password for your account. Click the button below to create a new password.</p>
			
			<div class="button-container">
				<a href="${resetLink}" class="reset-button">Reset Password</a>
			</div>
			
			<p>Or copy and paste this link in your browser:</p>
			<p class="link-text">${resetLink}</p>
			
			<div class="warning">
				<strong>⏱️ Important:</strong> This link will expire in 30 minutes. If you didn't request a password reset, please ignore this email.
			</div>
			
			<p style="margin-top: 30px; font-size: 13px; color: #9ca3af;">If you have any questions or need further assistance, please contact our support team.</p>
		</div>
		<div class="footer">
			<p>&copy; 2026 H&S Booking System. All rights reserved.</p>
			<p style="margin-top: 10px;">
				<a href="#">Privacy Policy</a> | 
				<a href="#">Terms of Service</a>
			</p>
		</div>
	</div>
</body>
</html>
		`;

		console.log('[Password Reset] Sending email to:', email);
		
		await transporter.sendMail({
			from: `"${mailFromName}" <${mailFromEmail}>`,
			to: email,
			subject: '🔐 Reset Your Password - H&S Booking System',
			html: htmlContent,
		});

		console.log('[Password Reset] Email sent successfully to:', email);

		return {
			success: true,
			message: 'Password reset email sent successfully',
		};
	} catch (error) {
		console.error('[Password Reset] Email sending error:', {
			message: error.message,
			code: error.code,
			statusCode: error.statusCode,
		});

		return {
			success: false,
			error: `Failed to send email: ${error.message}`,
		};
	}
};

/**
 * Send password reset email with OTP code
 */
const sendPasswordResetCodeEmail = async (email, code, userName = 'User') => {
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

		const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Your Password Reset Code - H&S Booking System</title>
	<style>
		* {
			margin: 0;
			padding: 0;
			box-sizing: border-box;
		}
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
			background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
			padding: 20px;
			min-height: 100vh;
			display: flex;
			align-items: center;
			justify-content: center;
		}
		.container {
			max-width: 600px;
			width: 100%;
			background: #ffffff;
			border-radius: 12px;
			box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
			overflow: hidden;
		}
		.header {
			background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
			color: white;
			padding: 40px 20px;
			text-align: center;
		}
		.header h1 {
			font-size: 28px;
			margin-bottom: 10px;
			font-weight: 600;
		}
		.content {
			padding: 40px;
		}
		.content h2 {
			font-size: 18px;
			color: #1f2937;
			margin-bottom: 15px;
		}
		.content p {
			font-size: 14px;
			color: #6b7280;
			line-height: 1.6;
			margin-bottom: 20px;
		}
		.code-box {
			background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
			border: 2px solid #0ea5e9;
			border-radius: 8px;
			padding: 20px;
			margin: 30px 0;
			text-align: center;
		}
		.code {
			font-family: 'Courier New', monospace;
			font-size: 36px;
			font-weight: bold;
			color: #0ea5e9;
			letter-spacing: 5px;
		}
		.code-label {
			font-size: 12px;
			color: #0369a1;
			margin-top: 10px;
			font-weight: 500;
		}
		.warning {
			background: #fef3c7;
			border-left: 4px solid #f59e0b;
			padding: 15px;
			margin: 20px 0;
			border-radius: 4px;
			font-size: 13px;
			color: #92400e;
		}
		.footer {
			background: #f9fafb;
			padding: 20px;
			text-align: center;
			border-top: 1px solid #e5e7eb;
			font-size: 12px;
			color: #9ca3af;
		}
		.footer a {
			color: #3b82f6;
			text-decoration: none;
		}
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<h1>🔐 Password Reset Code</h1>
			<p>H&S Booking System</p>
		</div>
		<div class="content">
			<h2>Hello ${userName},</h2>
			<p>We received a request to reset the password for your account. Use the code below to reset your password.</p>
			
			<div class="code-box">
				<div class="code">${code}</div>
				<div class="code-label">Enter this code in the reset password form</div>
			</div>
			
			<div class="warning">
				<strong>⏱️ Important:</strong> This code will expire in 15 minutes. If you didn't request a password reset, please ignore this email.
			</div>
			
			<p style="margin-top: 30px; font-size: 13px; color: #9ca3af;">If you have any questions or need further assistance, please contact our support team.</p>
		</div>
		<div class="footer">
			<p>&copy; 2026 H&S Booking System. All rights reserved.</p>
		</div>
	</div>
</body>
</html>
		`;

		await transporter.sendMail({
			from: `"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_FROM_EMAIL}>`,
			to: email,
			subject: '🔐 Your Password Reset Code - H&S Booking System',
			html: htmlContent,
		});

		console.log('[Password Reset] Code email sent to:', email);

		return {
			success: true,
			message: 'Password reset code email sent successfully',
		};
	} catch (error) {
		console.error('[Password Reset] Email sending error:', error);

		return {
			success: false,
			error: error.message,
		};
	}
};

module.exports = {
	generateResetToken,
	generateResetCode,
	sendPasswordResetEmail,
	sendPasswordResetCodeEmail,
};
