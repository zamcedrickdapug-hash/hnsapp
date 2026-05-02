<?php
/**
 * Updated Send Verification Email Script
 * 
 * This script sends verification emails using the new MailerConfig class
 * with environment variables for security
 * 
 * Usage:
 * php send_verification.php --email=user@gmail.com --name="User Name" --code=123456
 */

require 'MailerConfig.php';

// Parse command line arguments
$options = getopt('', ['email:', 'name:', 'code:']);

$email = $options['email'] ?? null;
$name = $options['name'] ?? 'User';
$code = $options['code'] ?? null;

if (!$email || !$code) {
    die("Usage: php send_verification.php --email=user@gmail.com --name='User Name' --code=123456\n");
}

try {
    MailerConfig::sendVerificationCode($email, $name, $code);
    echo "✓ Verification email sent successfully to $email\n";
} catch (Exception $e) {
    echo "✗ Error: " . $e->getMessage() . "\n";
    exit(1);
}
