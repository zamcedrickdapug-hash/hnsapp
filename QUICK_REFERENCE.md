# Quick Reference Guide

## 🚀 5-Minute Setup

### 1. Database
```bash
createdb hnsapp
psql -d hnsapp -f backend/database_schema.sql
```

### 2. Configuration
```bash
cp backend/.env.example backend/.env
# Edit with your PostgreSQL and Gmail credentials
```

### 3. Test
```bash
php backend/test_registration_flow.php
```

---

## 📡 API Quick Reference

### Register User
```bash
curl -X POST http://localhost:3000/register \
  -F "email=user@gmail.com" \
  -F "password=SecurePass123!" \
  -F "confirmPassword=SecurePass123!" \
  -F "fullName=John Doe" \
  -F "role=parent" \
  -F "phone=+1234567890" \
  -F "homeAddress=123 Main St" \
  -F "validId=@id.jpg"
```

### Approve User (Admin)
```bash
curl -X POST http://localhost:3000/admin/approve-user \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{"user_id": 1, "action": "approve"}'
```

### Verify Email
```bash
curl -X POST http://localhost:3000/verify \
  -H "Content-Type: application/json" \
  -d '{"email": "user@gmail.com", "verification_code": "123456"}'
```

---

## 🗂️ Key Files

| File | Purpose |
|------|---------|
| `Database.php` | PostgreSQL connection |
| `MailerConfig.php` | Email configuration |
| `register.php` | Sign up endpoint |
| `admin_approve_user.php` | Admin approval endpoint |
| `verify.php` | Verification endpoint |
| `verification_form.html` | Verification form UI |
| `database_schema.sql` | Database setup |
| `.env.example` | Configuration template |

---

## 📋 Database Status Check

```sql
-- Check pending users
SELECT email, created_at FROM users WHERE status = 'pending';

-- Check approved but not verified
SELECT email, verification_code FROM users 
WHERE is_approved = TRUE AND is_verified = FALSE;

-- Check fully verified users
SELECT email FROM users WHERE is_verified = TRUE;
```

---

## 🔐 Password Requirements

- ✓ Minimum 8 characters
- ✓ At least 1 uppercase letter (A-Z)
- ✓ At least 1 number (0-9)
- ✓ At least 1 special character (!@#$%^&*)

**Example**: `SecurePass123!`

---

## 📧 Email Setup (Gmail)

1. Go to https://myaccount.google.com/security
2. Enable "2-Step Verification" if not enabled
3. Go to https://myaccount.google.com/apppasswords
4. Select "Mail" and "Windows Computer"
5. Copy the 16-character password
6. Add to `.env` as: `SMTP_PASSWORD=xxxx xxxx xxxx xxxx`

---

## ⏱️ Key Timings

| Event | Timing |
|-------|--------|
| Verification code expiry | 15 minutes |
| Database indexes | Automatic |
| Password hash strength | 12 (bcrypt) |

---

## 🔍 Troubleshooting Quick Links

**Email not sending?**
- Check `.env` SMTP credentials
- Verify Gmail App Password
- Ensure 2FA enabled on Gmail

**Database connection error?**
- Verify PostgreSQL running: `psql --version`
- Check credentials in `.env`
- Run schema: `psql -d hnsapp -f database_schema.sql`

**File upload failing?**
- File must be < 5MB
- Allowed types: jpg, jpeg, png, webp, pdf
- Check directory permissions: `chmod 755 backend/uploads/ids/`

---

## 📂 Directory Structure

```
backend/
├── Database.php                 ← Database connection
├── MailerConfig.php             ← Email setup
├── Utility.php                  ← Helper functions
├── register.php                 ← Sign up
├── admin_approve_user.php       ← Admin approval
├── verify.php                   ← Verification
├── verification_form.html       ← Verification UI
├── database_schema.sql          ← Database setup
├── .env.example                 ← Config template
├── README.md                    ← Full documentation
├── SETUP_GUIDE.md               ← Setup steps
├── test_registration_flow.php   ← Test script
└── uploads/ids/                 ← Uploaded files
```

---

## 💾 Environment Variables

```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=hnsapp
DB_USER=postgres
DB_PASSWORD=your_password

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-16-char-app-password
MAIL_FROM_EMAIL=noreply@hnsapp.com
MAIL_FROM_NAME=H&S App
```

---

## 🧪 Test Commands

```bash
# Run automated tests
php backend/test_registration_flow.php

# Test database
psql -d hnsapp -c "SELECT COUNT(*) FROM users;"

# Test with curl
curl http://localhost:3000/register [see API section]
```

---

## ✅ Verification Flow

```
1. User registers → /register → Status: PENDING
2. Admin approves → /admin/approve-user → Email sent + Code generated
3. User verifies → /verify with 6-digit code → Status: VERIFIED ✓
```

---

## 🎯 Next Steps

1. **Set up database** - Run schema migration
2. **Configure environment** - Fill in `.env`
3. **Test system** - Run `test_registration_flow.php`
4. **Integrate frontend** - Use `verification_form.html`
5. **Add JWT auth** - Secure admin endpoints (optional)

---

## 📞 Support Resources

- `README.md` - Full documentation
- `SETUP_GUIDE.md` - Detailed setup
- `IMPLEMENTATION_SUMMARY.md` - What was created
- `test_registration_flow.php` - Run tests

---

## 🔐 Security Checklist

- ✓ Use HTTPS in production
- ✓ Store `.env` outside git
- ✓ Use strong database password
- ✓ Enable 2FA on Gmail
- ✓ Keep PHPMailer updated
- ✓ Validate all user input
- ✓ Use prepared statements
- ✓ Hash all passwords with bcrypt

---

**Last Updated**: May 2, 2026
**System**: H&S App Registration System
**Technology**: PHP + PostgreSQL + PHPMailer
