<?php
/**
 * Utility Class for Common Functions
 * 
 * Contains helper methods for validation, response handling, and error management
 */

class Utility {
    
    /**
     * Send JSON response with proper headers
     */
    public static function jsonResponse($data, $statusCode = 200) {
        header('Content-Type: application/json', true, $statusCode);
        echo json_encode($data);
        exit;
    }

    /**
     * Send success response
     */
    public static function success($message, $data = null, $statusCode = 200) {
        $response = [
            'success' => true,
            'message' => $message,
        ];

        if ($data !== null) {
            $response = array_merge($response, is_array($data) ? $data : ['data' => $data]);
        }

        self::jsonResponse($response, $statusCode);
    }

    /**
     * Send error response
     */
    public static function error($message, $statusCode = 400, $data = null) {
        $response = [
            'success' => false,
            'message' => $message,
        ];

        if ($data !== null) {
            $response['errors'] = is_array($data) ? $data : [$data];
        }

        self::jsonResponse($response, $statusCode);
    }

    /**
     * Get JSON input from request body
     */
    public static function getJsonInput() {
        $input = file_get_contents('php://input');
        $decoded = json_decode($input, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            return null;
        }
        
        return $decoded;
    }

    /**
     * Get all HTTP headers
     */
    public static function getHeaders() {
        if (function_exists('getallheaders')) {
            return getallheaders();
        }

        $headers = [];
        foreach ($_SERVER as $key => $value) {
            if (strpos($key, 'HTTP_') === 0) {
                $headerKey = str_replace('HTTP_', '', $key);
                $headerKey = str_replace('_', '-', $headerKey);
                $headers[$headerKey] = $value;
            }
        }
        return $headers;
    }

    /**
     * Get Authorization Bearer token
     */
    public static function getBearerToken() {
        $headers = self::getHeaders();
        $authHeader = $headers['Authorization'] ?? '';

        if (strpos($authHeader, 'Bearer ') !== 0) {
            return null;
        }

        return substr($authHeader, 7);
    }

    /**
     * Verify request method
     */
    public static function verifyMethod($method) {
        $requestMethod = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        
        if (is_array($method)) {
            return in_array($requestMethod, $method);
        }

        return $requestMethod === $method;
    }

    /**
     * Validate email format
     */
    public static function isValidEmail($email) {
        return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
    }

    /**
     * Validate password strength
     */
    public static function isValidPassword($password) {
        if (strlen($password) < 8) {
            return ['valid' => false, 'reason' => 'Password must be at least 8 characters'];
        }

        if (!preg_match('/[A-Z]/', $password)) {
            return ['valid' => false, 'reason' => 'Password must contain at least one uppercase letter'];
        }

        if (!preg_match('/[0-9]/', $password)) {
            return ['valid' => false, 'reason' => 'Password must contain at least one number'];
        }

        if (!preg_match('/[!@#$%^&*(),.?":{}|<>]/', $password)) {
            return ['valid' => false, 'reason' => 'Password must contain at least one special character'];
        }

        return ['valid' => true];
    }

    /**
     * Generate random verification code
     */
    public static function generateVerificationCode($length = 6) {
        return str_pad(mt_rand(0, pow(10, $length) - 1), $length, '0', STR_PAD_LEFT);
    }

    /**
     * Hash password with bcrypt
     */
    public static function hashPassword($password) {
        return password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
    }

    /**
     * Verify password against hash
     */
    public static function verifyPassword($password, $hash) {
        return password_verify($password, $hash);
    }

    /**
     * Sanitize input string
     */
    public static function sanitize($input) {
        return htmlspecialchars(trim($input), ENT_QUOTES, 'UTF-8');
    }

    /**
     * Generate secure random token
     */
    public static function generateToken($length = 32) {
        return bin2hex(random_bytes($length));
    }

    /**
     * Format database timestamp to readable format
     */
    public static function formatDate($timestamp, $format = 'Y-m-d H:i:s') {
        try {
            $date = new DateTime($timestamp);
            return $date->format($format);
        } catch (Exception $e) {
            return null;
        }
    }

    /**
     * Check if value is valid date
     */
    public static function isValidDate($date, $format = 'Y-m-d') {
        $d = DateTime::createFromFormat($format, $date);
        return $d && $d->format($format) === $date;
    }

    /**
     * Get file extension
     */
    public static function getFileExtension($filename) {
        return strtolower(pathinfo($filename, PATHINFO_EXTENSION));
    }

    /**
     * Check if file upload is valid
     */
    public static function isValidFileUpload($file, $maxSize = 5242880, $allowedMimes = []) {
        if (!isset($file['tmp_name']) || $file['error'] !== UPLOAD_ERR_OK) {
            return ['valid' => false, 'error' => 'File upload failed'];
        }

        if ($file['size'] > $maxSize) {
            return ['valid' => false, 'error' => 'File size exceeds limit'];
        }

        if (!empty($allowedMimes)) {
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            $mimeType = finfo_file($finfo, $file['tmp_name']);
            finfo_close($finfo);

            if (!in_array($mimeType, $allowedMimes)) {
                return ['valid' => false, 'error' => 'File type not allowed'];
            }
        }

        return ['valid' => true];
    }

    /**
     * Save uploaded file
     */
    public static function saveUploadedFile($file, $directory) {
        if (!is_dir($directory)) {
            mkdir($directory, 0755, true);
        }

        $ext = self::getFileExtension($file['name']);
        $filename = date('Y-m-d-') . uniqid() . '.' . $ext;
        $filepath = $directory . '/' . $filename;

        if (!move_uploaded_file($file['tmp_name'], $filepath)) {
            return ['success' => false, 'error' => 'Failed to save file'];
        }

        return [
            'success' => true,
            'filename' => $filename,
            'path' => $filepath,
        ];
    }

    /**
     * Log message to file
     */
    public static function log($message, $level = 'INFO', $file = null) {
        if ($file === null) {
            $file = __DIR__ . '/logs/app.log';
        }

        $directory = dirname($file);
        if (!is_dir($directory)) {
            mkdir($directory, 0755, true);
        }

        $timestamp = date('Y-m-d H:i:s');
        $logMessage = "[$timestamp] [$level] $message\n";

        file_put_contents($file, $logMessage, FILE_APPEND);
    }
}
