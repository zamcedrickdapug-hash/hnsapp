<?php
/**
 * PHPMailer Configuration
 * 
 * Set up SMTP credentials using Gmail App Password
 * Store sensitive credentials in environment variables
 */

require 'PHPMailer/Exception.php';
require 'PHPMailer/PHPMailer.php';
require 'PHPMailer/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

class MailerConfig {
    
    /**
     * Create and configure PHPMailer instance
     */
    public static function create() {
        $mail = new PHPMailer(true);

        try {
            // Server settings
            $mail->isSMTP();
            $mail->Host = getenv('SMTP_HOST') ?: 'smtp.gmail.com';
            $mail->SMTPAuth = true;
            $mail->Username = getenv('SMTP_USERNAME') ?: 'your-email@gmail.com';
            $mail->Password = getenv('SMTP_PASSWORD') ?: 'your-app-password';
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
            $mail->Port = getenv('SMTP_PORT') ?: 587;

            // Set from address and name
            $senderEmail = getenv('MAIL_FROM_EMAIL') ?: 'noreply@hnsapp.com';
            $senderName = getenv('MAIL_FROM_NAME') ?: 'H&S App';
            $mail->setFrom($senderEmail, $senderName);

            return $mail;
        } catch (Exception $e) {
            throw new Exception("PHPMailer configuration failed: " . $e->getMessage());
        }
    }

    /**
     * Send verification code email
     */
    public static function sendVerificationCode($recipientEmail, $recipientName, $verificationCode) {
        try {
            $mail = self::create();

            $mail->addAddress($recipientEmail, $recipientName);
            $mail->isHTML(true);
            
            $mail->Subject = 'Your Account Verification Code - H&S App';
            
            // HTML email template
            $codeExpiryMinutes = 15;
            $mail->Body = "
                <html>
                    <head>
                        <style>
                            body { font-family: Arial, sans-serif; background-color: #f5f5f5; }
                            .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; padding: 20px; border-radius: 8px; }
                            .header { background-color: #007bff; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                            .content { padding: 20px; }
                            .code-box { background-color: #f0f0f0; border: 2px solid #007bff; padding: 15px; text-align: center; border-radius: 5px; margin: 20px 0; }
                            .code { font-size: 32px; font-weight: bold; color: #007bff; letter-spacing: 5px; }
                            .footer { font-size: 12px; color: #666; text-align: center; margin-top: 20px; border-top: 1px solid #eee; padding-top: 10px; }
                        </style>
                    </head>
                    <body>
                        <div class='container'>
                            <div class='header'>
                                <h1>Email Verification</h1>
                            </div>
                            <div class='content'>
                                <p>Hello <strong>$recipientName</strong>,</p>
                                <p>Your account has been approved! To complete the verification process, please use the following 6-digit code:</p>
                                <div class='code-box'>
                                    <div class='code'>$verificationCode</div>
                                </div>
                                <p><strong>Code expires in $codeExpiryMinutes minutes.</strong></p>
                                <p>If you did not request this verification code, please ignore this email.</p>
                                <div class='footer'>
                                    <p>&copy; 2026 H&S App. All rights reserved.</p>
                                </div>
                            </div>
                        </div>
                    </body>
                </html>
            ";

            // Plain text alternative
            $mail->AltBody = "Your verification code is: $verificationCode\n\nThis code expires in $codeExpiryMinutes minutes.\n\nIf you did not request this code, please ignore this email.";

            $mail->send();
            return true;
        } catch (Exception $e) {
            throw new Exception("Failed to send verification email: " . $e->getMessage());
        }
    }
}
