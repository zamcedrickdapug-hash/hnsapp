<?php
/**
 * User Verification Endpoint
 * 
 * POST /verify
 * Body: { email, verification_code }
 * 
 * This script:
 * 1. Validates verification code format
 * 2. Checks if code matches and hasn't expired
 * 3. Marks user as verified
 * 4. Returns success message
 */

require 'Database.php';

header('Content-Type: application/json');

// Enable error reporting for debugging (disable in production)
ini_set('display_errors', 0);

/**
 * Validate and get JSON request body
 */
function getJsonInput() {
    $input = file_get_contents('php://input');
    $decoded = json_decode($input, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        return null;
    }
    
    return $decoded;
}

try {
    // Get request method
    $method = $_SERVER['REQUEST_METHOD'];
    
    if ($method !== 'POST') {
        http_response_code(405);
        throw new Exception('Method not allowed. Use POST.');
    }

    // Parse request body
    $input = getJsonInput();
    
    if (!$input) {
        http_response_code(400);
        throw new Exception('Invalid or missing request body');
    }

    $email = trim($input['email'] ?? '');
    $verificationCode = trim($input['verification_code'] ?? '');

    // Validate inputs
    if (empty($email)) {
        http_response_code(400);
        throw new Exception('Email is required');
    }

    if (empty($verificationCode)) {
        http_response_code(400);
        throw new Exception('Verification code is required');
    }

    if (!preg_match('/^\d{6}$/', $verificationCode)) {
        http_response_code(400);
        throw new Exception('Verification code must be exactly 6 digits');
    }

    // Get database instance
    $db = Database::getInstance();

    // Fetch user by email
    $user = $db->fetchOne(
        'SELECT id, email, full_name, is_verified, verification_code, verification_code_expires_at FROM users WHERE LOWER(email) = LOWER(?)',
        [$email]
    );

    if (!$user) {
        http_response_code(404);
        throw new Exception('User not found');
    }

    // Check if already verified
    if ($user['is_verified']) {
        http_response_code(409);
        throw new Exception('This account is already verified');
    }

    // Check if verification code exists
    if (!$user['verification_code']) {
        http_response_code(400);
        throw new Exception('No verification code has been issued for this account. Contact admin for approval.');
    }

    // Check if code matches
    if ($user['verification_code'] !== $verificationCode) {
        http_response_code(400);
        throw new Exception('Verification code is incorrect');
    }

    // Check if code has expired
    $expiryTime = new DateTime($user['verification_code_expires_at']);
    $currentTime = new DateTime();
    
    if ($currentTime > $expiryTime) {
        http_response_code(400);
        throw new Exception('Verification code has expired. Request a new one from admin.');
    }

    // Mark user as verified
    $db->execute(
        'UPDATE users SET is_verified = true, verification_date = CURRENT_TIMESTAMP, verification_code = NULL, verification_code_expires_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [$user['id']]
    );

    // Log verification action
    $db->execute(
        'INSERT INTO approval_logs (user_id, action, notes, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
        [$user['id'], 'verification_sent', 'User successfully verified email address']
    );

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'Account verified successfully! You can now log in.',
        'user_id' => $user['id'],
        'email' => $user['email'],
    ]);

} catch (Exception $e) {
    if (http_response_code() === 200) {
        http_response_code(500);
    }
    
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage(),
    ]);
}
