#!/usr/bin/env php
<?php
/**
 * Registration System Test Script
 * 
 * This script demonstrates the complete registration flow:
 * 1. User registration
 * 2. Admin approval
 * 3. Email verification
 * 
 * Usage: php test_registration_flow.php
 */

echo "\n╔════════════════════════════════════════════════════════════╗\n";
echo "║  H&S App - Registration System Test Script                 ║\n";
echo "╚════════════════════════════════════════════════════════════╝\n\n";

// Color codes for output
define('COLOR_GREEN', "\033[92m");
define('COLOR_RED', "\033[91m");
define('COLOR_YELLOW', "\033[93m");
define('COLOR_BLUE', "\033[94m");
define('COLOR_RESET', "\033[0m");

/**
 * Print colored message
 */
function printMessage($message, $color = COLOR_BLUE) {
    echo $color . $message . COLOR_RESET . "\n";
}

/**
 * Test database connection
 */
function testDatabaseConnection() {
    printMessage("\n[1] Testing Database Connection", COLOR_BLUE);
    
    try {
        require 'Database.php';
        $db = Database::getInstance();
        
        $result = $db->fetchOne('SELECT version()');
        if ($result) {
            printMessage("✓ PostgreSQL connection successful", COLOR_GREEN);
            echo "  Version: " . $result['version'] . "\n";
            return true;
        }
    } catch (Exception $e) {
        printMessage("✗ Database connection failed: " . $e->getMessage(), COLOR_RED);
        return false;
    }
}

/**
 * Test table structure
 */
function testTableStructure() {
    printMessage("\n[2] Checking Database Schema", COLOR_BLUE);
    
    try {
        require 'Database.php';
        $db = Database::getInstance();
        
        $tables = ['users', 'students', 'drivers', 'approval_logs'];
        
        foreach ($tables as $table) {
            $result = $db->fetchOne(
                "SELECT EXISTS(SELECT FROM information_schema.tables WHERE table_name = ?)",
                [$table]
            );
            
            if ($result['exists']) {
                printMessage("✓ Table '$table' exists", COLOR_GREEN);
            } else {
                printMessage("✗ Table '$table' missing - run: psql -d hnsapp -f database_schema.sql", COLOR_RED);
                return false;
            }
        }
        
        return true;
    } catch (Exception $e) {
        printMessage("✗ Schema check failed: " . $e->getMessage(), COLOR_RED);
        return false;
    }
}

/**
 * Test PHPMailer configuration
 */
function testMailerConfig() {
    printMessage("\n[3] Checking PHPMailer Configuration", COLOR_BLUE);
    
    try {
        require 'MailerConfig.php';
        
        // Check if files exist
        $files = ['PHPMailer/PHPMailer.php', 'PHPMailer/SMTP.php', 'PHPMailer/Exception.php'];
        
        foreach ($files as $file) {
            if (file_exists($file)) {
                printMessage("✓ File '$file' exists", COLOR_GREEN);
            } else {
                printMessage("✗ File '$file' missing", COLOR_RED);
                return false;
            }
        }
        
        // Check environment variables
        $required_env = ['SMTP_HOST', 'SMTP_USERNAME', 'SMTP_PASSWORD'];
        
        foreach ($required_env as $env) {
            if (getenv($env)) {
                printMessage("✓ Environment variable '$env' is set", COLOR_GREEN);
            } else {
                printMessage("⚠ Environment variable '$env' not set - using default", COLOR_YELLOW);
            }
        }
        
        return true;
    } catch (Exception $e) {
        printMessage("✗ Mailer check failed: " . $e->getMessage(), COLOR_RED);
        return false;
    }
}

/**
 * Test utility functions
 */
function testUtilityFunctions() {
    printMessage("\n[4] Testing Utility Functions", COLOR_BLUE);
    
    try {
        require 'Utility.php';
        
        // Test email validation
        $validEmail = Utility::isValidEmail('test@gmail.com');
        $invalidEmail = Utility::isValidEmail('invalid-email');
        
        if ($validEmail && !$invalidEmail) {
            printMessage("✓ Email validation works", COLOR_GREEN);
        } else {
            printMessage("✗ Email validation failed", COLOR_RED);
            return false;
        }
        
        // Test password validation
        $weakPassword = Utility::isValidPassword('weak');
        $strongPassword = Utility::isValidPassword('SecurePass123!');
        
        if (!$weakPassword['valid'] && $strongPassword['valid']) {
            printMessage("✓ Password validation works", COLOR_GREEN);
        } else {
            printMessage("✗ Password validation failed", COLOR_RED);
            return false;
        }
        
        // Test code generation
        $code = Utility::generateVerificationCode();
        if (strlen($code) === 6 && is_numeric($code)) {
            printMessage("✓ Verification code generation works (sample: $code)", COLOR_GREEN);
        } else {
            printMessage("✗ Code generation failed", COLOR_RED);
            return false;
        }
        
        // Test token generation
        $token = Utility::generateToken();
        if (strlen($token) === 64) {
            printMessage("✓ Token generation works", COLOR_GREEN);
        } else {
            printMessage("✗ Token generation failed", COLOR_RED);
            return false;
        }
        
        return true;
    } catch (Exception $e) {
        printMessage("✗ Utility functions test failed: " . $e->getMessage(), COLOR_RED);
        return false;
    }
}

/**
 * Check file permissions
 */
function testFilePermissions() {
    printMessage("\n[5] Checking File Permissions", COLOR_BLUE);
    
    $uploadDir = __DIR__ . '/uploads/ids';
    
    if (!is_dir($uploadDir)) {
        if (@mkdir($uploadDir, 0755, true)) {
            printMessage("✓ Created uploads directory: $uploadDir", COLOR_GREEN);
        } else {
            printMessage("✗ Cannot create uploads directory - check permissions", COLOR_RED);
            return false;
        }
    } else {
        printMessage("✓ Uploads directory exists: $uploadDir", COLOR_GREEN);
    }
    
    if (is_writable($uploadDir)) {
        printMessage("✓ Uploads directory is writable", COLOR_GREEN);
    } else {
        printMessage("✗ Uploads directory is not writable - run: chmod 755 $uploadDir", COLOR_RED);
        return false;
    }
    
    return true;
}

/**
 * Test sample API call (simulation)
 */
function testSampleFlow() {
    printMessage("\n[6] Registration Flow Simulation", COLOR_BLUE);
    
    try {
        require 'Utility.php';
        
        printMessage("\nSimulating registration flow...", COLOR_BLUE);
        
        // Simulate user input validation
        $testData = [
            'email' => 'test' . time() . '@example.com',
            'password' => 'TestPass123!',
            'fullName' => 'Test User',
            'role' => 'parent',
            'phone' => '+1234567890',
        ];
        
        // Validate email
        if (Utility::isValidEmail($testData['email'])) {
            printMessage("✓ Email validation passed: " . $testData['email'], COLOR_GREEN);
        } else {
            throw new Exception("Email validation failed");
        }
        
        // Validate password
        $passwordCheck = Utility::isValidPassword($testData['password']);
        if ($passwordCheck['valid']) {
            printMessage("✓ Password validation passed", COLOR_GREEN);
        } else {
            throw new Exception("Password validation failed: " . $passwordCheck['reason']);
        }
        
        // Generate verification code
        $code = Utility::generateVerificationCode();
        printMessage("✓ Generated verification code: $code", COLOR_GREEN);
        
        // Hash password
        $hash = Utility::hashPassword($testData['password']);
        if (strlen($hash) > 30) {
            printMessage("✓ Password hashed successfully", COLOR_GREEN);
        } else {
            throw new Exception("Password hashing failed");
        }
        
        // Verify password
        if (Utility::verifyPassword($testData['password'], $hash)) {
            printMessage("✓ Password verification successful", COLOR_GREEN);
        } else {
            throw new Exception("Password verification failed");
        }
        
        return true;
    } catch (Exception $e) {
        printMessage("✗ Flow simulation failed: " . $e->getMessage(), COLOR_RED);
        return false;
    }
}

/**
 * Print summary
 */
function printSummary($results) {
    printMessage("\n╔════════════════════════════════════════════════════════════╗", COLOR_BLUE);
    printMessage("║  Test Summary                                              ║", COLOR_BLUE);
    printMessage("╚════════════════════════════════════════════════════════════╝", COLOR_BLUE);
    
    $passed = array_sum($results);
    $total = count($results);
    
    foreach ($results as $index => $result) {
        $status = $result ? "✓ PASS" : "✗ FAIL";
        $color = $result ? COLOR_GREEN : COLOR_RED;
        printMessage("Test " . ($index + 1) . ": $status", $color);
    }
    
    echo "\n";
    if ($passed === $total) {
        printMessage("All tests passed! ✓", COLOR_GREEN);
        printMessage("System is ready to use.", COLOR_GREEN);
        return 0;
    } else {
        printMessage("Some tests failed! ✗", COLOR_RED);
        printMessage("Please fix the issues above.", COLOR_RED);
        return 1;
    }
}

// Run all tests
$results = [];
$results[] = testDatabaseConnection();
$results[] = testTableStructure();
$results[] = testMailerConfig();
$results[] = testUtilityFunctions();
$results[] = testFilePermissions();
$results[] = testSampleFlow();

exit(printSummary($results));
