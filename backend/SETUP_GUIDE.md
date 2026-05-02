# PHP Registration System - Setup Guide

## Overview

This system implements a three-stage user registration flow:

1. **Sign Up**: User registers with email (status: pending, is_approved: false, is_verified: false)
2. **Admin Approval**: Admin reviews and approves account, triggering verification email with 6-digit code
3. **Email Verification**: User enters code to activate account (is_verified: true)

---

## Prerequisites

- PHP 7.4+ with PostgreSQL PDO extension
- PostgreSQL database
- PHPMailer (already manually installed in `/backend/PHPMailer/`)
- Gmail account with App Password configured

---

## Database Setup

### 1. Create PostgreSQL Database

```bash
createdb hnsapp
```

### 2. Run Schema Migration

Execute the SQL in `database_schema.sql`:

```bash
psql -U postgres -d hnsapp -f backend/database_schema.sql
```

This creates:
- `users` table with `is_approved`, `is_verified`, `verification_code`, etc.
- `students` table (for parent accounts)
- `drivers` table (for driver accounts)
- `approval_logs` table (audit trail)

---

## Environment Configuration

### 1. Create `.env` file in backend root

```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=hnsapp
DB_USER=postgres
DB_PASSWORD=your_db_password

# SMTP Configuration (Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
MAIL_FROM_EMAIL=noreply@hnsapp.com
MAIL_FROM_NAME=H&S App
```

### 2. Generate Gmail App Password

1. Enable 2-Factor Authentication on your Gmail account
2. Go to https://myaccount.google.com/apppasswords
3. Select "Mail" and "Windows Computer"
4. Copy the generated 16-character password
5. Use this as `SMTP_PASSWORD` in `.env`

---

## API Endpoints

### 1. User Registration
**Endpoint**: `POST /register`

**Request** (multipart/form-data):
```json
{
  "email": "user@gmail.com",
  "password": "Password123",
  "confirmPassword": "Password123",
  "fullName": "John Doe",
  "role": "parent",
  "phone": "+1234567890",
  "homeAddress": "123 Main St",
  "studentFullName": "Jane Doe",
  "age": "10",
  "gradeLevel": "5",
  "studentNumber": "STU123",
  "schoolName": "Central School",
  "validId": <file>
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "message": "Registration submitted successfully. Your account is pending approval.",
  "user_id": 1,
  "status": "pending"
}
```

---

### 2. Admin Approval & Send Verification Email
**Endpoint**: `POST /admin/approve-user`

**Headers**:
```
Authorization: Bearer <admin-jwt-token>
Content-Type: application/json
```

**Request**:
```json
{
  "user_id": 1,
  "action": "approve"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "User approved successfully. Verification email sent.",
  "user_id": 1,
  "verification_code_expires_at": "2026-05-02T23:00:00"
}
```

**Decline Request**:
```json
{
  "user_id": 1,
  "action": "decline",
  "reason": "License expired"
}
```

---

### 3. Verify Email with Code
**Endpoint**: `POST /verify`

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

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Account verified successfully! You can now log in.",
  "user_id": 1,
  "email": "user@gmail.com"
}
```

---

## File Structure

```
backend/
├── Database.php                 # PostgreSQL connection class
├── MailerConfig.php             # PHPMailer SMTP setup
├── register.php                 # User registration endpoint
├── admin_approve_user.php       # Admin approval endpoint
├── verify.php                   # Email verification endpoint
├── verification_form.html       # Frontend verification form
├── database_schema.sql          # PostgreSQL schema
├── PHPMailer/                   # Manual PHPMailer installation
│   ├── PHPMailer.php
│   ├── SMTP.php
│   └── Exception.php
└── uploads/
    └── ids/                     # Valid ID file uploads
```

---

## Frontend Integration

### Registration Form (React)
Already configured in `frontend/src/page/signup/signup-fixed.jsx`
- Posts to `/api/parents/register` or `/api/drivers/register`
- Handles file upload for valid ID

### Verification Form
Use the provided HTML form at `backend/verification_form.html`
- User enters email and 6-digit code
- Submits to `/verify` endpoint
- Redirects to login on success

---

## Security Considerations

✅ **Implemented**:
- Bcrypt password hashing (cost: 12)
- PDO prepared statements (SQL injection protection)
- Verification code expiry (15 minutes)
- File upload validation (MIME type & size)
- Email-based flow (no direct admin contact)

⚠️ **To Implement**:
- JWT authentication for admin endpoints
- Rate limiting on verification attempts
- CSRF protection
- HTTPS enforcement
- Session timeout
- Audit logging for all admin actions

---

## Testing

### 1. Test User Registration
```bash
curl -X POST http://localhost:3000/register \
  -F "email=test@gmail.com" \
  -F "password=TestPass123" \
  -F "confirmPassword=TestPass123" \
  -F "fullName=Test User" \
  -F "role=parent" \
  -F "phone=+1234567890" \
  -F "homeAddress=123 Main St" \
  -F "studentFullName=Test Student" \
  -F "age=10" \
  -F "gradeLevel=5" \
  -F "studentNumber=STU001" \
  -F "schoolName=Central School" \
  -F "validId=@/path/to/id.jpg"
```

### 2. Test Admin Approval
```bash
curl -X POST http://localhost:3000/admin/approve-user \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"user_id": 1, "action": "approve"}'
```

### 3. Check Email
- Admin approval sends verification code to user's Gmail
- User should receive email with 6-digit code

### 4. Test Email Verification
```bash
curl -X POST http://localhost:3000/verify \
  -H "Content-Type: application/json" \
  -d '{"email": "test@gmail.com", "verification_code": "123456"}'
```

---

## Troubleshooting

### Email Not Sending
- Check SMTP credentials in `.env`
- Verify Gmail App Password is correct
- Check email logs in `approval_logs` table
- Ensure 2FA is enabled on Gmail account

### Database Connection Failed
- Verify PostgreSQL is running
- Check credentials in `.env`
- Ensure `pgsql` PDO extension is installed

### Verification Code Mismatch
- Code expires after 15 minutes
- User must request new approval if code expired
- Check database for correct code in `verification_code` column

---

## Database Queries Reference

```sql
-- Get pending users
SELECT id, email, full_name, created_at FROM users WHERE status = 'pending';

-- Get approved but not verified users
SELECT id, email, full_name FROM users WHERE is_approved = true AND is_verified = false;

-- Get fully verified users
SELECT id, email, full_name FROM users WHERE is_verified = true;

-- View approval history
SELECT user_id, action, notes, created_at FROM approval_logs ORDER BY created_at DESC;

-- Check verification code
SELECT id, email, verification_code, verification_code_expires_at FROM users WHERE id = 1;
```

---

## Next Steps

1. Set up PostgreSQL database
2. Configure `.env` with your credentials
3. Run schema migration
4. Test registration flow
5. Implement JWT authentication for admin endpoints
6. Deploy to production with HTTPS
