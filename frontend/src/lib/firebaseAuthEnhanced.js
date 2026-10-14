/**
 * Enhanced Firebase Authentication Configuration
 * 
 * This module configures Firebase Auth settings for better email verification
 * delivery, improved sender reputation, and professional email appearance.
 */

import { initializeAuth, connectAuthEmulator } from 'firebase/auth';

/**
 * Configure Firebase Auth settings for improved email verification
 * 
 * @param {object} firebaseApp - Initialized Firebase app instance
 * @returns {object} Configured auth instance
 */
export const configureEnhancedAuth = (firebaseApp) => {
	// Initialize auth
	const auth = initializeAuth(firebaseApp, {
		persistence: ['LOCAL', 'SESSION', 'NONE'],
	});

	// Set language to English for consistency
	auth.languageCode = 'en';

	// In development, connect to auth emulator if running
	if (process.env.NODE_ENV === 'development' && window.location.hostname === 'localhost') {
		try {
			connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
		} catch (e) {
			// Auth emulator not running, continue without it
		}
	}

	return auth;
};

/**
 * Best practices for Firebase email verification delivery
 */
export const emailVerificationBestPractices = {
	/**
	 * Send verification email with recommended settings
	 * 
	 * Note: Firebase SDK has limited customization for email templates.
	 * For better results, configure email templates in Firebase Console.
	 */
	async sendVerificationEmailWithRetry(user, maxRetries = 3) {
		const { sendEmailVerification } = await import('firebase/auth');

		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				await sendEmailVerification(user, {
					url: `${window.location.origin}/verify-email`,
					handleCodeInApp: true,
				});

				console.log(`✅ Verification email sent successfully on attempt ${attempt}`);
				return {
					success: true,
					attempt,
					message: 'Verification email sent. Please check your inbox and spam folder.',
				};
			} catch (error) {
				console.warn(`⚠️ Verification email attempt ${attempt} failed:`, error.message);

				// Check if this is a retriable error
				if (error.code === 'auth/network-request-failed' && attempt < maxRetries) {
					// Wait before retrying
					await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
					continue;
				}

				// If not retriable or last attempt
				if (attempt === maxRetries) {
					return {
						success: false,
						attempt,
						error: error.message,
						code: error.code,
					};
				}
			}
		}
	},

	/**
	 * Wait for user to verify email with timeout
	 */
	async waitForEmailVerification(user, timeoutMs = 600000) {
		// 10 minutes default
		const { reload } = await import('firebase/auth');

		const startTime = Date.now();
		const pollInterval = 2000; // Check every 2 seconds

		while (Date.now() - startTime < timeoutMs) {
			await new Promise((resolve) => setTimeout(resolve, pollInterval));
			await reload(user);

			if (user.emailVerified) {
				return {
					verified: true,
					message: 'Email verified successfully!',
				};
			}
		}

		return {
			verified: false,
			message: 'Email verification timeout. Please refresh the page.',
		};
	},

	/**
	 * Handle verification status checks
	 */
	async checkVerificationStatus(user) {
		const { reload } = await import('firebase/auth');

		try {
			await reload(user);

			return {
				isVerified: user.emailVerified,
				email: user.email,
				message: user.emailVerified
					? 'Email verified successfully'
					: 'Email verification pending',
			};
		} catch (error) {
			return {
				isVerified: false,
				error: error.message,
				code: error.code,
			};
		}
	},
};

/**
 * Configuration recommendations to implement in Firebase Console
 */
export const firebaseConsoleConfiguration = {
	emailTemplate: {
		subject: 'Verify Your Email Address - H&S Booking System',
		description: 'Use the professional HTML template provided in firebaseEmailVerification.js',
		senderName: 'H&S Booking System',
		senderEmail: 'noreply@hnsapp.com (if custom domain available)',
	},
	customDomain: {
		enabled: false,
		description: 'Optional but highly recommended for better deliverability',
		steps: [
			'1. In Firebase Console, go to Authentication > Templates',
			'2. Click "Manage custom domains"',
			'3. Add your custom domain (e.g., noreply.hnsapp.com)',
			'4. Verify domain ownership via DNS records',
			'5. Configure SPF, DKIM, DMARC records',
			'6. Wait for Firebase to verify and activate',
		],
	},
	dnsRecords: {
		SPF: 'v=spf1 include:sendgrid.net ~all',
		DKIM: 'Add Firebase-provided DKIM record',
		DMARC: 'v=DMARC1; p=quarantine; rua=mailto:noreply@hnsapp.com',
	},
};

/**
 * Verification email user instructions
 */
export const verificationEmailInstructions = {
	title: 'Verification Email Not Received?',
	tips: [
		'Check your email inbox and spam/junk folder',
		'Wait a few minutes (emails can take 5-10 minutes to arrive)',
		'Check under "Promotions" or "Social" tabs if using Gmail',
		'Verify the email address you entered was correct',
		'Check if your email provider is blocking Firebase emails',
		'Request a new verification email from the login page',
	],
	support: {
		email: 'support@hnsapp.com',
		response_time: '24 hours',
		includeDetails: ['Email address used', 'When you signed up', 'Any error messages'],
	},
};

/**
 * Enhanced signup verification message
 */
export const getVerificationMessage = (accountType) => {
	const baseMessage =
		'Verification email sent! Please check your inbox and verify your email address.';
	const spamMessage = 'Check your spam/promotions folder if you don\'t see it in your inbox.';
	const timeMessage = 'The verification link will expire in 24 hours.';

	return {
		title: `${accountType.charAt(0).toUpperCase() + accountType.slice(1)} Account Created`,
		message: `${baseMessage} ${spamMessage} ${timeMessage}`,
		instructions: [
			'Open the verification email from H&S Booking System',
			'Click the "Verify Email Address" button',
			'Log in to your account',
			'If the link expired, request a new one from the login page',
		],
		troubleshooting: verificationEmailInstructions,
	};
};

export default {
	configureEnhancedAuth,
	emailVerificationBestPractices,
	firebaseConsoleConfiguration,
	verificationEmailInstructions,
	getVerificationMessage,
};
