/**
 * Firebase Email Verification Enhancement
 * 
 * This module provides customizable email verification templates and best practices
 * for Firebase Authentication to improve email deliverability and reduce spam folder placement.
 * 
 * Note: Firebase Email Verification has limited customization through the client SDK.
 * The email template shown here is for reference and to guide Firebase project settings.
 */

/**
 * Get the professional HTML email template for Firebase verification
 * Use this in Firebase Console under "Email Templates" for custom branding
 * 
 * @param {string} verificationLink - The Firebase-provided verification link
 * @param {string} userEmail - The user's email address
 * @returns {string} HTML email template
 */
const getFirebaseVerificationEmailTemplate = (verificationLink, userEmail) => {
	return `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Verify Your Email Address - H&S Booking System</title>
	<style>
		* {
			margin: 0;
			padding: 0;
			box-sizing: border-box;
		}
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
			background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
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
			box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
			overflow: hidden;
		}
		.header {
			background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
			padding: 40px 20px;
			text-align: center;
			color: white;
		}
		.header-icon {
			font-size: 48px;
			margin-bottom: 15px;
		}
		.header h1 {
			font-size: 28px;
			font-weight: 700;
			margin-bottom: 8px;
			letter-spacing: -0.5px;
		}
		.header p {
			font-size: 14px;
			opacity: 0.95;
			font-weight: 500;
		}
		.content {
			padding: 40px 30px;
		}
		.greeting {
			font-size: 16px;
			color: #1f2937;
			margin-bottom: 20px;
			line-height: 1.6;
		}
		.greeting strong {
			font-weight: 600;
		}
		.message {
			font-size: 15px;
			color: #4b5563;
			line-height: 1.8;
			margin-bottom: 30px;
		}
		.cta-button {
			display: inline-block;
			background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
			color: white;
			text-decoration: none;
			padding: 14px 32px;
			border-radius: 8px;
			font-weight: 600;
			font-size: 15px;
			letter-spacing: 0.5px;
			text-transform: uppercase;
			box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
			transition: all 0.3s ease;
		}
		.cta-button:hover {
			background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
			box-shadow: 0 6px 20px rgba(37, 99, 235, 0.4);
		}
		.button-wrapper {
			text-align: center;
			margin: 35px 0;
		}
		.link-alternative {
			margin: 25px 0;
			padding: 15px;
			background: #f8f9fa;
			border-left: 4px solid #2563eb;
			border-radius: 4px;
		}
		.link-alternative p {
			font-size: 13px;
			color: #4b5563;
			margin-bottom: 8px;
		}
		.link-alternative a {
			color: #2563eb;
			text-decoration: none;
			word-break: break-all;
			font-weight: 500;
		}
		.security-note {
			margin: 30px 0;
			padding: 15px;
			background: #eff6ff;
			border: 1px solid #bfdbfe;
			border-radius: 8px;
			font-size: 13px;
			color: #1e40af;
			line-height: 1.6;
		}
		.security-note strong {
			display: block;
			margin-bottom: 5px;
		}
		.footer {
			background: #f8f9fa;
			padding: 30px;
			text-align: center;
			border-top: 1px solid #e5e7eb;
		}
		.footer p {
			font-size: 13px;
			color: #6b7280;
			margin-bottom: 10px;
			line-height: 1.6;
		}
		.footer-links {
			font-size: 12px;
			color: #9ca3af;
		}
		.footer-links a {
			color: #2563eb;
			text-decoration: none;
			margin: 0 5px;
		}
		.divider {
			height: 1px;
			background: #e5e7eb;
			margin: 20px 0;
		}
		@media (max-width: 600px) {
			.header {
				padding: 30px 15px;
			}
			.header h1 {
				font-size: 22px;
			}
			.content {
				padding: 25px 15px;
			}
			.cta-button {
				padding: 12px 24px;
				font-size: 14px;
			}
		}
	</style>
</head>
<body>
	<div class="container">
		<!-- Header -->
		<div class="header">
			<div class="header-icon">🚐</div>
			<h1>H&S Booking System</h1>
			<p>Safe and Reliable School Services</p>
		</div>

		<!-- Main Content -->
		<div class="content">
			<p class="greeting">
				Hello,
			</p>

			<p class="message">
				Thank you for signing up! To complete your registration and access H&S Booking System, please verify your email address by clicking the button below.
			</p>

			<div class="button-wrapper">
				<a href="${verificationLink}" class="cta-button">Verify Email Address</a>
			</div>

			<p class="message" style="margin-top: 25px;">
				Or if the button above doesn't work, copy and paste this link into your browser:
			</p>

			<div class="link-alternative">
				<p><strong>Verification Link:</strong></p>
				<a href="${verificationLink}">${verificationLink}</a>
			</div>

			<div class="security-note">
				<strong>⏱️ Link Expiration:</strong>
				This verification link will expire in 24 hours. If your link has expired, you can request a new verification email from the login page.
			</div>

			<div class="security-note" style="background: #fef3c7; border-color: #fcd34d; color: #92400e;">
				<strong>🔒 Security Tip:</strong>
				We will never ask for your password via email. If you did not create this account, please ignore this email or contact our support team.
			</div>

			<div class="divider"></div>

			<p class="message" style="font-size: 14px; color: #6b7280; margin: 15px 0;">
				<strong>Having trouble?</strong> If you continue to have issues verifying your email, contact our support team at <a href="mailto:support@hnsapp.com" style="color: #2563eb; text-decoration: none;">support@hnsapp.com</a>
			</p>
		</div>

		<!-- Footer -->
		<div class="footer">
			<p>
				<strong>H&S Booking System</strong><br>
				Safe and reliable school service booking for parents, drivers, and administrators
			</p>
			<div class="divider"></div>
			<div class="footer-links">
				<a href="https://hnsapp.com">Website</a> • 
				<a href="https://hnsapp.com/privacy">Privacy Policy</a> • 
				<a href="https://hnsapp.com/terms">Terms of Service</a>
			</div>
			<p style="margin-top: 15px; font-size: 11px; color: #d1d5db;">
				This is an automated email. Please do not reply directly to this message.
			</p>
		</div>
	</div>
</body>
</html>
	`;
};

/**
 * Configuration recommendations for Firebase Authentication email settings
 * These should be implemented in Firebase Console
 */
const firebaseEmailConfigRecommendations = {
	projectSetup: {
		title: 'Firebase Project Configuration',
		steps: [
			'Go to Firebase Console > Project Settings > Authentication',
			'Under "Email Templates", click on "Verify email address"',
			'Use the professional template above',
			'Set sender name to "H&S Booking System"',
			'Configure custom domain if available (see below)',
		],
	},
	customDomain: {
		title: 'Custom Domain Configuration (Recommended)',
		benefits: [
			'Improves email deliverability',
			'Builds brand trust and recognition',
			'Reduces spam folder placement',
			'Better SPF/DKIM/DMARC alignment',
		],
		steps: [
			'Set up custom domain (e.g., noreply@hnsapp.com)',
			'Configure DNS records (SPF, DKIM, DMARC)',
			'Verify domain ownership in Firebase Console',
			'Test email delivery with feedback loop',
		],
		dnsRecords: {
			SPF: 'v=spf1 include:sendgrid.net ~all',
			DKIM: 'Configure in Firebase Console after domain verification',
			DMARC: 'v=DMARC1; p=none; rua=mailto:noreply@hnsapp.com',
		},
	},
	bestPractices: {
		emailContent: [
			'Keep email subject professional: "Verify Your Email - H&S Booking System"',
			'Use clear, concise language in body',
			'Include security notices about never asking for passwords',
			'Provide alternative link if button doesn\'t work',
			'Add support contact information',
			'Include expiration time for verification link',
		],
		deliverability: [
			'Use custom domain instead of firebase.com',
			'Ensure proper SPF/DKIM/DMARC records are configured',
			'Avoid spam-triggering words (FREE, URGENT, LIMITED TIME, etc.)',
			'Use professional formatting with proper styling',
			'Include unsubscribe/preference center link',
			'Monitor delivery metrics and bounce rates',
			'Use dedicated IP if high volume expected',
		],
		technical: [
			'Set authentication timeout: 24 hours',
			'Enable email verification requirement for parents/drivers',
			'Disable for admin accounts',
			'Set up bounce handling',
			'Configure complaint handling',
			'Monitor failed delivery attempts',
		],
	},
};

/**
 * Get Firebase authentication rules for different account types
 */
const getEmailVerificationRules = () => {
	return {
		parent: {
			requiresVerification: true,
			description: 'Parents MUST verify email before account access',
			blockedUntilVerified: true,
		},
		driver: {
			requiresVerification: true,
			description: 'Drivers MUST verify email before account access',
			blockedUntilVerified: true,
		},
		admin: {
			requiresVerification: false,
			description: 'Admins do NOT require email verification',
			blockedUntilVerified: false,
		},
	};
};

/**
 * Get environment variables needed for proper email configuration
 */
const getRequiredEnvVariables = () => {
	return {
		// Firebase Configuration
		FIREBASE_API_KEY: {
			description: 'Firebase API key from project settings',
			example: 'AIzaSyD...',
			required: true,
		},
		FIREBASE_AUTH_DOMAIN: {
			description: 'Firebase auth domain (e.g., project.firebaseapp.com)',
			example: 'hnsapp-f9f67.firebaseapp.com',
			required: true,
		},
		FIREBASE_PROJECT_ID: {
			description: 'Firebase project ID',
			example: 'hnsapp-f9f67',
			required: true,
		},

		// Email Configuration for Verification Emails
		MAIL_FROM_NAME: {
			description: 'Sender name for verification emails',
			example: 'H&S Booking System',
			required: true,
			recommendation: 'Use professional name like "H&S Booking System" instead of generic names',
		},
		MAIL_FROM_EMAIL: {
			description: 'Sender email address (should use custom domain)',
			example: 'noreply@hnsapp.com',
			required: false,
			recommendation: 'Use custom domain if possible, not firebase.com domain',
		},

		// Firebase Custom Domain (Optional but Recommended)
		FIREBASE_CUSTOM_DOMAIN: {
			description: 'Custom domain for email verification (if configured in Firebase)',
			example: 'noreply@hnsapp.com',
			required: false,
			recommendation: 'Configure in Firebase Console for better deliverability',
		},
	};
};

module.exports = {
	getFirebaseVerificationEmailTemplate,
	firebaseEmailConfigRecommendations,
	getEmailVerificationRules,
	getRequiredEnvVariables,
};
