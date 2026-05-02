<?php
/**
 * User Registration Endpoint
 * 
 * POST /register
 * Body: { email, password, full_name, role, phone?, home_address?, ... }
 * 
 * This script:
 * 1. Validates registration data
 * 2. Checks if email already exists
 * 3. Hashes password with bcrypt
 * 4. Creates user with is_approved = false, is_verified = false
 * 5. Returns success message
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

/**
 * Validate email format
 */
function isValidEmail($email) {
    return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
}

/**
 * Validate password strength
 */
function isValidPassword($password) {
    // At least 8 characters, 1 uppercase, 1 number
    if (strlen($password) < 8) {
        return ['valid' => false, 'reason' => 'Password must be at least 8 characters'];
    }
    
    if (!preg_match('/[A-Z]/', $password)) {
        return ['valid' => false, 'reason' => 'Password must contain at least one uppercase letter'];
    }
    
    if (!preg_match('/[0-9]/', $password)) {
        return ['valid' => false, 'reason' => 'Password must contain at least one number'];
    }
    
    return ['valid' => true];
}

/**
 * Handle file upload for valid ID
 */
function handleFileUpload() {
    if (!isset($_FILES['validId'])) {
        return ['success' => false, 'error' => 'No file uploaded'];
    }

    $file = $_FILES['validId'];
    $allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    $allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];

    // Validate file
    if ($file['error'] !== UPLOAD_ERR_OK) {
        return ['success' => false, 'error' => 'File upload error'];
    }

    if ($file['size'] > 5 * 1024 * 1024) {
        return ['success' => false, 'error' => 'File size must not exceed 5MB'];
    }

    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);

    if (!in_array($mimeType, $allowedMimes)) {
        return ['success' => false, 'error' => 'Invalid file type'];
    }

    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, $allowedExtensions)) {
        return ['success' => false, 'error' => 'Invalid file extension'];
    }

    // Create uploads directory if not exists
    $uploadsDir = __DIR__ . '/uploads/ids';
    if (!is_dir($uploadsDir)) {
        mkdir($uploadsDir, 0755, true);
    }

    // Generate unique filename
    $filename = date('Y-m-d-') . uniqid() . '.' . $ext;
    $filepath = $uploadsDir . '/' . $filename;

    if (!move_uploaded_file($file['tmp_name'], $filepath)) {
        return ['success' => false, 'error' => 'Failed to save uploaded file'];
    }

    return [
        'success' => true,
        'filename' => $filename,
        'path' => $filepath,
    ];
}

try {
    // Get request method
    $method = $_SERVER['REQUEST_METHOD'];
    
    if ($method !== 'POST') {
        http_response_code(405);
        throw new Exception('Method not allowed. Use POST.');
    }

    // Check if multipart form data
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    
    if (strpos($contentType, 'multipart/form-data') === false) {
        http_response_code(400);
        throw new Exception('Request must be multipart/form-data');
    }

    // Get form data
    $data = $_POST;
    
    // Validate required fields
    $email = trim($data['email'] ?? '');
    $password = $data['password'] ?? '';
    $confirmPassword = $data['confirmPassword'] ?? '';
    $fullName = trim($data['fullName'] ?? '');
    $role = trim($data['role'] ?? '');
    $phone = trim($data['phone'] ?? '');
    $homeAddress = trim($data['homeAddress'] ?? '');

    $errors = [];

    if (empty($email)) {
        $errors[] = 'Email is required';
    } elseif (!isValidEmail($email)) {
        $errors[] = 'Email format is invalid';
    }

    if (empty($password)) {
        $errors[] = 'Password is required';
    } elseif ($password !== $confirmPassword) {
        $errors[] = 'Passwords do not match';
    } else {
        $passwordCheck = isValidPassword($password);
        if (!$passwordCheck['valid']) {
            $errors[] = $passwordCheck['reason'];
        }
    }

    if (empty($fullName)) {
        $errors[] = 'Full name is required';
    }

    if (empty($role) || !in_array($role, ['parent', 'driver'])) {
        $errors[] = 'Valid role is required (parent or driver)';
    }

    if (empty($phone)) {
        $errors[] = 'Phone number is required';
    }

    if (empty($homeAddress)) {
        $errors[] = 'Home address is required';
    }

    // Handle file upload
    $fileResult = handleFileUpload();
    if (!$fileResult['success']) {
        $errors[] = 'Valid ID: ' . $fileResult['error'];
    }

    if (!empty($errors)) {
        http_response_code(400);
        throw new Exception(implode('; ', $errors));
    }

    // Get database instance
    $db = Database::getInstance();

    // Check if email already exists
    $existingUser = $db->fetchOne(
        'SELECT id FROM users WHERE email = ?',
        [strtolower($email)]
    );

    if ($existingUser) {
        http_response_code(409);
        throw new Exception('This email address is already registered');
    }

    // Hash password
    $passwordHash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);

    // Insert user
    $db->execute(
        'INSERT INTO users (role, full_name, email, phone, home_address, password_hash, valid_id_filename, valid_id_path, is_approved, is_verified, status, account_state, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, false, false, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        [
            $role,
            $fullName,
            strtolower($email),
            $phone,
            $homeAddress,
            $passwordHash,
            $fileResult['filename'],
            $fileResult['path'],
            'pending',
            'active',
        ]
    );

    $userId = $db->lastInsertId();

    // Handle role-specific data
    if ($role === 'parent') {
        $studentName = trim($data['studentFullName'] ?? '');
        $studentAge = $data['age'] ?? null;
        $gradeLevel = trim($data['gradeLevel'] ?? '');
        $studentNumber = trim($data['studentNumber'] ?? '');
        $schoolName = trim($data['schoolName'] ?? '');

        $db->execute(
            'INSERT INTO students (user_id, full_name, age, grade_level, student_number, school_name, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
            [
                $userId,
                $studentName,
                $studentAge ? (int)$studentAge : null,
                $gradeLevel,
                $studentNumber,
                $schoolName,
            ]
        );
    } elseif ($role === 'driver') {
        $licenseNumber = trim($data['licenseNumber'] ?? '');
        $licenseExpiry = $data['licenseExpiry'] ?? null;
        $vehicleType = trim($data['vehicleType'] ?? '');
        $plateNumber = trim($data['plateNumber'] ?? '');
        $yearsOfExperience = $data['yearsOfExperience'] ?? null;

        $db->execute(
            'INSERT INTO drivers (user_id, license_number, license_expiry, vehicle_type, plate_number, years_of_experience, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
            [
                $userId,
                $licenseNumber,
                $licenseExpiry,
                $vehicleType,
                $plateNumber,
                $yearsOfExperience ? (int)$yearsOfExperience : null,
            ]
        );
    }

    http_response_code(201);
    echo json_encode([
        'success' => true,
        'message' => 'Registration submitted successfully. Your account is pending approval.',
        'user_id' => $userId,
        'status' => 'pending',
        'next_step' => 'Wait for admin approval and you will receive a verification email',
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
