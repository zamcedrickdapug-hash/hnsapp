/**
 * Email Service for HNSAPP
 * Handles sending OTP codes, verification emails, and notifications
 */

const nodemailer = require('nodemailer');

// Email configuration
const emailConfig = {
  service: process.env.EMAIL_SERVICE || 'gmail',
  user: process.env.EMAIL_USER,
  password: process.env.EMAIL_PASSWORD,
};

// Create transporter
let transporter = null;

try {
  transporter = nodemailer.createTransport({
    service: emailConfig.service,
    auth: {
      user: emailConfig.user,
      pass: emailConfig.password,
    },
  });
} catch (error) {
  console.error('[EMAIL_SERVICE] Failed to initialize transporter:', error.message);
}

/**
 * Send OTP email to user
 * @param {string} email - Recipient email
 * @param {string} code - OTP code (6 digits)
 * @returns {object} { success, message }
 */
async function sendOTPEmail(email, code) {
  if (!transporter) {
    console.warn('[EMAIL_SERVICE] Email service not initialized');
    return {
      success: false,
      message: 'Email service unavailable',
    };
  }

  try {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; color: #1e40af; margin-bottom: 30px; }
            .code-box { 
              background: #f3f4f6; 
              border: 2px solid #3b82f6; 
              border-radius: 8px; 
              padding: 20px; 
              text-align: center; 
              margin: 30px 0;
            }
            .code { 
              font-size: 32px; 
              font-weight: bold; 
              color: #1e40af; 
              letter-spacing: 5px;
              font-family: 'Courier New', monospace;
            }
            .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚌 HNSAPP Verification</h1>
            </div>
            
            <p>Hello,</p>
            <p>Your OTP verification code is:</p>
            
            <div class="code-box">
              <div class="code">${code}</div>
            </div>
            
            <p>This code will expire in <strong>5 minutes</strong>.</p>
            <p>If you did not request this code, please ignore this email.</p>
            
            <div class="footer">
              <p>© 2026 HNSAPP - Professional School Transportation</p>
              <p>Never share your OTP code with anyone.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const mailOptions = {
      from: emailConfig.user,
      to: email,
      subject: '🔐 Your HNSAPP Verification Code',
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);

    console.log('[EMAIL_SERVICE] OTP sent successfully:', {
      email,
      messageId: info.messageId,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      message: 'OTP sent successfully',
      timestamp: new Date(),
    };
  } catch (error) {
    console.error('[EMAIL_SERVICE] Failed to send OTP email:', error.message);
    return {
      success: false,
      message: 'Failed to send OTP email',
      error: error.message,
    };
  }
}

/**
 * Send password reset email
 * @param {string} email - Recipient email
 * @param {string} resetToken - Reset token
 * @returns {object} { success, message }
 */
async function sendPasswordResetEmail(email, resetToken, resetLink) {
  if (!transporter) {
    console.warn('[EMAIL_SERVICE] Email service not initialized');
    return {
      success: false,
      message: 'Email service unavailable',
    };
  }

  try {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; color: #1e40af; margin-bottom: 30px; }
            .button { 
              background: #3b82f6; 
              color: white; 
              padding: 12px 30px; 
              border-radius: 6px; 
              text-decoration: none;
              display: inline-block;
              margin: 30px 0;
            }
            .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚌 HNSAPP Password Reset</h1>
            </div>
            
            <p>Hello,</p>
            <p>You requested a password reset. Click the button below to reset your password:</p>
            
            <div style="text-align: center;">
              <a href="${resetLink}" class="button">Reset Password</a>
            </div>
            
            <p>This link will expire in <strong>1 hour</strong>.</p>
            <p>If you did not request this, please ignore this email.</p>
            
            <div class="footer">
              <p>© 2026 HNSAPP - Professional School Transportation</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const mailOptions = {
      from: emailConfig.user,
      to: email,
      subject: '🔐 Reset Your HNSAPP Password',
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);

    console.log('[EMAIL_SERVICE] Password reset email sent:', {
      email,
      messageId: info.messageId,
    });

    return {
      success: true,
      message: 'Password reset email sent',
    };
  } catch (error) {
    console.error('[EMAIL_SERVICE] Failed to send password reset email:', error.message);
    return {
      success: false,
      message: 'Failed to send password reset email',
    };
  }
}

/**
 * Send account approval notification to driver
 * @param {string} email - Driver email
 * @param {object} driverData - Driver information
 * @returns {object} { success, message }
 */
async function sendDriverApprovalEmail(email, driverData) {
  if (!transporter) {
    return { success: false, message: 'Email service unavailable' };
  }

  try {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; color: #10b981; margin-bottom: 30px; }
            .success-badge { 
              background: #d1fae5; 
              border: 2px solid #10b981; 
              border-radius: 8px; 
              padding: 20px; 
              text-align: center;
              margin: 30px 0;
            }
            .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ Driver Application Approved!</h1>
            </div>
            
            <div class="success-badge">
              <h2 style="color: #10b981;">Congratulations!</h2>
              <p>Your driver application has been approved.</p>
            </div>
            
            <p>Hello ${driverData.fullName || 'Driver'},</p>
            <p>Your application to join HNSAPP has been reviewed and approved.</p>
            
            <p>You can now:</p>
            <ul>
              <li>Login to your driver dashboard</li>
              <li>View available trips</li>
              <li>Accept bookings from parents</li>
              <li>Track your earnings</li>
            </ul>
            
            <p>Thank you for being part of HNSAPP's professional driver network.</p>
            
            <div class="footer">
              <p>© 2026 HNSAPP - Professional School Transportation</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const mailOptions = {
      from: emailConfig.user,
      to: email,
      subject: '✅ Your HNSAPP Driver Application Approved!',
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);

    console.log('[EMAIL_SERVICE] Driver approval email sent:', { email });

    return {
      success: true,
      message: 'Approval email sent',
    };
  } catch (error) {
    console.error('[EMAIL_SERVICE] Failed to send driver approval email:', error.message);
    return {
      success: false,
      message: 'Failed to send approval email',
    };
  }
}

/**
 * Send notification email (generic)
 * @param {string} email - Recipient email
 * @param {string} subject - Email subject
 * @param {string} htmlContent - HTML content
 * @returns {object} { success, message }
 */
async function sendNotificationEmail(email, subject, htmlContent) {
  if (!transporter) {
    return { success: false, message: 'Email service unavailable' };
  }

  try {
    const mailOptions = {
      from: emailConfig.user,
      to: email,
      subject,
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);

    return {
      success: true,
      message: 'Email sent successfully',
    };
  } catch (error) {
    console.error('[EMAIL_SERVICE] Failed to send notification email:', error.message);
    return {
      success: false,
      message: 'Failed to send email',
    };
  }
}

module.exports = {
  sendOTPEmail,
  sendPasswordResetEmail,
  sendDriverApprovalEmail,
  sendNotificationEmail,
};
