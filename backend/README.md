# PHP PostgreSQL Registration System with Email Verification

A complete three-stage user registration system built with PHP, PostgreSQL, and PHPMailer.

## 🎯 Features

- ✅ **User Registration** with validation and file uploads
- ✅ **Admin Approval** with verification code generation
- ✅ **Email Verification** using PHPMailer SMTP (Gmail)
- ✅ **PostgreSQL Database** with proper schema and indexes
- ✅ **Security** with bcrypt hashing and prepared statements
- ✅ **Audit Logging** for all admin actions
- ✅ **Environmental Variables** for sensitive credentials

---

## 📋 System Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. USER REGISTRATION                                        │
│ ─────────────────────────────────────────────────────────── │
│ User fills form → POST /register                            │
│ ├─ Email validation                                         │
│ ├─ Password hashing (bcrypt)                                │
│ ├─ File upload (valid ID)                                   │
│ └─ User created: is_approved=false, is_verified=false       │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. ADMIN APPROVAL                                           │
│ ─────────────────────────────────────────────────────────── │
│ Admin reviews application → POST /admin/approve-user        │
│ ├─ Check user documents                                     │
│ ├─ Approve/Decline decision                                 │
│ ├─ Generate 6-digit code (if approved)                      │
│ ├─ Send email with code (15-min expiry)                     │
│ └─ User status: is_approved=true                            │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. EMAIL VERIFICATION                                       │
│ ─────────────────────────────────────────────────────────── │
│ User enters code → POST /verify                             │
│ ├─ Email lookup                                             │
│ ├─ Code validation                                          │
│ ├─ Expiry check                                             │
│ └─ Account activated: is_verified=true                      │
└─────────────────────────────────────────────────────────────┘
                          ↓
              ✅ User can now log in
```

---

## 🚀 Quick Start

### 1. Database Setup

```bash
# Create database
createdb hnsapp

# Run schema
psql -U postgres -d hnsapp -f backend/database_schema.sql
```

### 2. Environment Configuration

```bash
# Create .env file
cp backend/.env.example backend/.env

# Edit and add your credentials:
# - DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
# - SMTP_USERNAME, SMTP_PASSWORD (Gmail App Password)
```

### 3. Gmail Setup

1. Enable 2-Factor Authentication: https://myaccount.google.com/security
2. Generate App Password: https://myaccount.google.com/apppasswords
3. Add 16-char password to `.env` as `SMTP_PASSWORD`

### 4. Test the System

```bash
# Registration
curl -X POST http://localhost:3000/register \
  -F "email=test@gmail.com" \
  -F "password=TestPass123" \
  -F "confirmPassword=TestPass123" \
  -F "fullName=Test User" \
  -F "role=parent" \
  -F "phone=+1234567890" \
  -F "homeAddress=123 Main St" \
  -F "validId=@id.jpg"

# Admin Approval (with JWT token)
curl -X POST http://localhost:3000/admin/approve-user \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"user_id": 1, "action": "approve"}'

# Verify Email
curl -X POST http://localhost:3000/verify \
  -H "Content-Type: application/json" \
  -d '{"email": "test@gmail.com", "verification_code": "123456"}'
```

---

## 📁 File Structure

```
backend/
├── Database.php                    # PostgreSQL connection
├── MailerConfig.php                # PHPMailer SMTP setup
├── Utility.php                     # Common utilities
├── register.php                    # Registration endpoint
├── admin_approve_user.php          # Admin approval endpoint
├── verify.php                      # Verification endpoint
├── send_verification.php           # CLI email sender
├── verification_form.html          # Frontend form
├── database_schema.sql             # PostgreSQL schema
├── .env.example                    # Environment template
├── SETUP_GUIDE.md                  # Detailed setup
├── README.md                       # This file
├── PHPMailer/                      # Manual PHPMailer install
│   ├── PHPMailer.php
│   ├── SMTP.php
│   └── Exception.php
└── uploads/
    └── ids/                        # Uploaded ID documents
```

---

## 🔌 API Endpoints

### POST /register
User registration with validation

**Request** (multipart/form-data):
```
- email: user@gmail.com
- password: Password123
- confirmPassword: Password123
- fullName: John Doe
- role: parent|driver
- phone: +1234567890
- homeAddress: 123 Main St
- studentFullName: Jane Doe (if parent)
- validId: <image/pdf file>
```

**Response**:
```json
{
  "success": true,
  "message": "Registration submitted successfully. Your account is pending approval.",
  "user_id": 1,
  "status": "pending"
}
```

---

### POST /admin/approve-user
Admin approves user and sends verification email

**Headers**:
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Request**:
```json
{
  "user_id": 1,
  "action": "approve|decline",
  "reason": "optional decline reason"
}
```

**Response**:
```json
{
  "success": true,
  "message": "User approved successfully. Verification email sent.",
  "user_id": 1,
  "verification_code_expires_at": "2026-05-02T23:00:00"
}
```

---

### POST /verify
User verifies email with 6-digit code

**Headers**:
```
Content-Type: application/json
```

**Request**:
```json
{
  "email": "user@gmail.com",
  "verification_code": "123456"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Account verified successfully! You can now log in.",
  "user_id": 1,
  "email": "user@gmail.com"
}
```

---

## 🗄️ Database Schema

### Users Table
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    role VARCHAR(50),              -- parent, driver, admin
    full_name VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    is_approved BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,
    verification_code VARCHAR(6),
    verification_code_expires_at TIMESTAMP,
    status VARCHAR(50),            -- pending, approved, declined
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### Key Columns
- `is_approved`: Set by admin during approval
- `is_verified`: Set after user enters correct code
- `verification_code`: 6-digit code, expires in 15 mins
- `status`: Tracks approval status
- `account_state`: active, suspended, banned

---

## 🔐 Security Features

### Password Security
- ✅ Minimum 8 characters
- ✅ At least 1 uppercase letter
- ✅ At least 1 number
- ✅ At least 1 special character
- ✅ Bcrypt hashing (cost: 12)

### Database Security
- ✅ PDO prepared statements (prevents SQL injection)
- ✅ Input validation and sanitization
- ✅ File upload validation (MIME type, size)

### Email Security
- ✅ SMTP with STARTTLS encryption
- ✅ No credentials in code (environment variables)
- ✅ Verification code expiry (15 minutes)

### To Add
- [ ] JWT authentication for admin endpoints
- [ ] Rate limiting on verification attempts
- [ ] CSRF token protection
- [ ] Session timeout
- [ ] HTTPS enforcement

---

## 🐛 Troubleshooting

### Email Not Sending
**Check**: 
1. `.env` SMTP credentials
2. Gmail 2FA enabled
3. App Password correct (16 characters)
4. Firewall allows port 587

**Debug**:
```php
// In MailerConfig.php, set:
$mail->SMTPDebug = 3;  // Enable debug output
```

### Database Connection Failed
**Check**:
1. PostgreSQL running: `psql --version`
2. Database exists: `psql -l`
3. User permissions: `psql -U postgres`
4. `.env` credentials correct

### Verification Code Invalid
**Possible causes**:
1. Code expired (15 min limit)
2. User typed wrong code
3. Code in DB doesn't match

**Fix**: Admin must approve again to generate new code

### File Upload Failed
**Check**:
1. File size < 5MB
2. File type: jpg, jpeg, png, webp, pdf
3. Permissions: `chmod 755 backend/uploads/ids/`

---

## 📊 Useful SQL Queries

```sql
-- Get all pending users
SELECT id, email, full_name, created_at 
FROM users 
WHERE status = 'pending';

-- Get approved but not verified
SELECT id, email, verification_code, verification_code_expires_at 
FROM users 
WHERE is_approved = TRUE AND is_verified = FALSE;

-- Get fully verified users
SELECT id, email, full_name 
FROM users 
WHERE is_verified = TRUE;

-- View admin approval history
SELECT user_id, action, notes, created_at 
FROM approval_logs 
ORDER BY created_at DESC;

-- Check verification code expiry
SELECT id, email, verification_code_expires_at,
       EXTRACT(EPOCH FROM (verification_code_expires_at - NOW())) as seconds_remaining
FROM users 
WHERE is_approved = TRUE AND is_verified = FALSE;
```

---

## 🔧 Configuration Reference

### .env Variables

```
DB_HOST              PostgreSQL server hostname
DB_PORT              PostgreSQL port (default: 5432)
DB_NAME              Database name
DB_USER              PostgreSQL username
DB_PASSWORD          PostgreSQL password

SMTP_HOST            SMTP server (default: smtp.gmail.com)
SMTP_PORT            SMTP port (default: 587)
SMTP_USERNAME        Gmail account email
SMTP_PASSWORD        Gmail 16-character app password
MAIL_FROM_EMAIL      Sender email address
MAIL_FROM_NAME       Sender display name

VERIFICATION_CODE_EXPIRY_MINUTES   Code validity (default: 15)
```

---

## 📝 Notes

- Verification codes valid for **15 minutes**
- Maximum file size for ID: **5MB**
- Passwords require: 8+ chars, 1 uppercase, 1 number, 1 special char
- Email addresses are case-insensitive (stored lowercase)
- All timestamps in UTC

---

## 📚 Additional Resources

- [PHPMailer Documentation](https://github.com/PHPMailer/PHPMailer)
- [PostgreSQL Manual](https://www.postgresql.org/docs/current/)
- [PHP PDO](https://www.php.net/manual/en/class.pdo.php)
- [Gmail App Passwords](https://support.google.com/accounts/answer/185833)

---

## 📄 License

This system is provided as-is for the H&S App project.

---

## 👤 Support

For issues or questions, refer to `SETUP_GUIDE.md` or check database logs in `approval_logs` table.
