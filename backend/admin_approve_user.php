<?php
/**
 * Admin Approval Endpoint
 * 
 * POST /admin/approve-user
 * Body: { user_id: integer, action: 'approve' | 'decline', reason?: string }
 * 
 * This script:
 * 1. Validates admin authentication
 * 2. Approves user account
 * 3. Generates 6-digit verification code
 * 4. Sends verification email via PHPMailer
 * 5. Logs the approval action
 */

require 'Database.php';
require 'MailerConfig.php';

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

/**
 * Generate 6-digit verification code
 */
function generateVerificationCode() {
    return str_pad(mt_rand(0, 999999), 6, '0', STR_PAD_LEFT);
}

/**
 * Verify admin authentication (simplified - add real auth later)
 */
function verifyAdminAuth($headers) {
    // In production, verify JWT token or session
    $authHeader = $headers['Authorization'] ?? '';
    
    if (empty($authHeader)) {
        throw new Exception('Missing authorization header');
    }
    
    // Extract bearer token and validate
    if (strpos($authHeader, 'Bearer ') !== 0) {
        throw new Exception('Invalid authorization format');
    }
    
    // TODO: Implement proper JWT verification
    // For now, just check token exists
    $token = substr($authHeader, 7);
    if (empty($token)) {
        throw new Exception('Invalid authorization token');
    }
    
    return true;
}

try {
    // Get request method
    $method = $_SERVER['REQUEST_METHOD'];
    
    if ($method !== 'POST') {
        http_response_code(405);
        throw new Exception('Method not allowed. Use POST.');
    }

    // Verify admin authentication
    $headers = getallheaders();
    verifyAdminAuth($headers);

    // Parse request body
    $input = getJsonInput();
    
    if (!$input) {
        http_response_code(400);
        throw new Exception('Invalid or missing request body');
    }

    $userId = $input['user_id'] ?? null;
    $action = $input['action'] ?? null;
    $reason = $input['reason'] ?? '';

    // Validate inputs
    if (!$userId || !is_numeric($userId)) {
        http_response_code(400);
        throw new Exception('user_id is required and must be numeric');
    }

    if (!$action || !in_array($action, ['approve', 'decline'])) {
        http_response_code(400);
        throw new Exception('action must be either "approve" or "decline"');
    }

    $userId = (int)$userId;

    // Get database instance
    $db = Database::getInstance();

    // Fetch user
    $user = $db->fetchOne(
        'SELECT id, email, full_name, status, is_approved FROM users WHERE id = ?',
        [$userId]
    );

    if (!$user) {
        http_response_code(404);
        throw new Exception('User not found');
    }

    if ($action === 'approve') {
        // Approve user
        if ($user['is_approved']) {
            http_response_code(409);
            throw new Exception('User is already approved');
        }

        // Generate 6-digit code
        $verificationCode = generateVerificationCode();
        $expiryTime = date('Y-m-d H:i:s', strtotime('+15 minutes'));

        // Update user with approval and verification code
        $db->execute(
            'UPDATE users SET is_approved = true, verification_code = ?, verification_code_expires_at = ?, status = ?, approval_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [$verificationCode, $expiryTime, 'approved', $userId]
        );

        // Send verification email
        try {
            MailerConfig::sendVerificationCode(
                $user['email'],
                $user['full_name'],
                $verificationCode
            );
        } catch (Exception $e) {
            // Rollback approval if email fails
            $db->execute(
                'UPDATE users SET is_approved = false, verification_code = NULL, verification_code_expires_at = NULL, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                ['pending', $userId]
            );
            
            http_response_code(500);
            throw new Exception('Approval successful but failed to send verification email: ' . $e->getMessage());
        }

        // Log approval action
        $db->execute(
            'INSERT INTO approval_logs (user_id, action, notes, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
            [$userId, 'approval', 'User approved and verification email sent']
        );

        http_response_code(200);
        echo json_encode([
            'success' => true,
            'message' => 'User approved successfully. Verification email sent.',
            'user_id' => $userId,
            'verification_code_expires_at' => $expiryTime,
        ]);

    } elseif ($action === 'decline') {
        // Decline user
        if ($user['status'] !== 'pending') {
            http_response_code(409);
            throw new Exception('Only pending users can be declined');
        }

        $reason = trim($reason) ?: 'Your application did not meet our requirements';

        // Update user with declined status
        $db->execute(
            'UPDATE users SET status = ?, decline_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            ['declined', $reason, $userId]
        );

        // Log decline action
        $db->execute(
            'INSERT INTO approval_logs (user_id, action, notes, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
            [$userId, 'declined', $reason]
        );

        http_response_code(200);
        echo json_encode([
            'success' => true,
            'message' => 'User application declined.',
            'user_id' => $userId,
        ]);
    }

} catch (Exception $e) {
    if (http_response_code() === 200) {
        http_response_code(500);
    }
    
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage(),
    ]);
}
