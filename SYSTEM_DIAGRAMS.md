# H&S App Registration System - Architecture & Flow Diagrams

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Frontend Application                             │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  React App (signup-fixed.jsx)                                    │   │
│  │  - Registration form with role selection                         │   │
│  │  - File upload for valid ID                                      │   │
│  │  - Password validation                                           │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────────────────┘
                         │
                         │ HTTP Requests (JSON/FormData)
                         │
┌────────────────────────▼────────────────────────────────────────────────┐
│                      PHP Backend (Backend Services)                      │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ API Endpoints (REST)                                             │   │
│  │ ┌─────────────────────────────────────────────────────────────┐  │   │
│  │ │ 1. POST /register                                           │  │   │
│  │ │    - Input: email, password, role, files                    │  │   │
│  │ │    - Validation: Email, password strength, file type/size   │  │   │
│  │ │    - Output: user_id, status=pending                        │  │   │
│  │ │                                                               │  │   │
│  │ │ 2. POST /admin/approve-user                                 │  │   │
│  │ │    - Input: user_id, action (approve/decline)               │  │   │
│  │ │    - Generate: 6-digit code, 15-min expiry                  │  │   │
│  │ │    - Action: Send email via SMTP                            │  │   │
│  │ │    - Output: verification_code_expires_at                   │  │   │
│  │ │                                                               │  │   │
│  │ │ 3. POST /verify                                             │  │   │
│  │ │    - Input: email, verification_code                        │  │   │
│  │ │    - Validation: Code format, expiry, match                 │  │   │
│  │ │    - Output: success, user fully verified                   │  │   │
│  │ └─────────────────────────────────────────────────────────────┘  │   │
│  │                                                                    │   │
│  │ Helper Classes                                                     │   │
│  │ ┌─────────────────────────────────────────────────────────────┐  │   │
│  │ │ Database.php (PDO + PostgreSQL)                            │  │   │
│  │ │  - Singleton connection instance                            │  │   │
│  │ │  - Prepared statements (SQL injection protection)           │  │   │
│  │ │  - Methods: execute(), fetchOne(), fetchAll()               │  │   │
│  │ │                                                               │  │   │
│  │ │ MailerConfig.php (PHPMailer SMTP)                          │  │   │
│  │ │  - Gmail SMTP configuration                                 │  │   │
│  │ │  - Environment variable credentials                         │  │   │
│  │ │  - HTML email templates                                     │  │   │
│  │ │                                                               │  │   │
│  │ │ Utility.php (25+ Helper Functions)                         │  │   │
│  │ │  - Validation (email, password, files)                      │  │   │
│  │ │  - Hashing (bcrypt password, generate tokens)               │  │   │
│  │ │  - Code generation (6-digit verification code)              │  │   │
│  │ │  - File handling (upload, validation)                       │  │   │
│  │ └─────────────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└────────────────┬────────────────────────────────────────────────────────┘
                 │
     ┌───────────┼───────────┐
     │           │           │
     ▼           ▼           ▼
┌─────────┐ ┌─────────┐ ┌──────────┐
│PostgreSQL│ │PHPMailer│ │File Store│
│Database  │ │Gmail    │ │ID uploads│
└─────────┘ └─────────┘ └──────────┘
```

---

## Registration Flow (Detailed)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ STAGE 1: USER REGISTRATION                                               │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  1. User opens signup form                                               │
│     ↓                                                                     │
│  2. Fills in details + role (parent/driver)                              │
│     ├─ Email: user@gmail.com                                             │
│     ├─ Password: SecurePass123!                                          │
│     ├─ Name, phone, address                                              │
│     └─ Valid ID file (jpg/png/pdf)                                       │
│     ↓                                                                     │
│  3. Submit → POST /register (multipart/form-data)                        │
│     ↓                                                                     │
│  4. Backend validation:                                                  │
│     ├─ Check email format ✓                                              │
│     ├─ Check password strength ✓                                         │
│     ├─ Check password match ✓                                            │
│     ├─ Check file size < 5MB ✓                                           │
│     ├─ Check file MIME type (image/pdf) ✓                                │
│     └─ Check email not already registered ✓                              │
│     ↓                                                                     │
│  5. Create user in database:                                             │
│     ├─ Hash password with bcrypt                                         │
│     ├─ Save to users table                                               │
│     ├─ is_approved = false                                               │
│     ├─ is_verified = false                                               │
│     ├─ status = 'pending'                                                │
│     ├─ Save ID file to uploads/ids/                                      │
│     └─ Create student/driver record                                      │
│     ↓                                                                     │
│  6. Response 201:                                                        │
│     └─ "Registration submitted. Pending admin approval."                 │
│                                                                            │
│  User Status: ⏳ PENDING (waiting for admin approval)                    │
│  Email: ❌ NOT SENT (waiting for admin decision)                         │
│                                                                            │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Admin Review Process

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ADMIN DASHBOARD                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  Admin views pending applications:                                       │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ Pending Users List:                                                │  │
│  │ • John Doe (parent) - Submitted: May 2, 2026                       │  │
│  │   ├─ Email: john@gmail.com                                         │  │
│  │   ├─ Phone: +1234567890                                            │  │
│  │   ├─ Valid ID: john_id_2026.jpg (500 KB)                           │  │
│  │   └─ [Review] [Approve] [Decline]                                  │  │
│  │                                                                      │  │
│  │ • Jane Smith (driver) - Submitted: May 1, 2026                      │  │
│  │   ├─ Email: jane@gmail.com                                         │  │
│  │   ├─ License: DL123456                                             │  │
│  │   └─ [Review] [Approve] [Decline]                                  │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  Admin clicks "Approve" for John Doe                                      │
│  ↓                                                                        │
│  POST /admin/approve-user                                                │
│  {                                                                        │
│    "user_id": 1,                                                         │
│    "action": "approve"                                                   │
│  }                                                                        │
│  ↓                                                                        │
│  Backend actions:                                                        │
│  1. Generate random 6-digit code: 487392                                 │
│  2. Set expiry: NOW + 15 minutes                                         │
│  3. Update database:                                                     │
│     ├─ is_approved = true                                               │
│     ├─ verification_code = '487392'                                     │
│     ├─ verification_code_expires_at = '2026-05-02T22:45:00'             │
│     ├─ status = 'approved'                                              │
│     └─ approval_date = NOW                                              │
│  4. Send email via SMTP:                                                │
│     ├─ To: john@gmail.com                                               │
│     ├─ Subject: "Your Account Verification Code - H&S App"              │
│     └─ Body: "Your code is: 487392 (expires in 15 minutes)"             │
│  5. Log action:                                                         │
│     ├─ approval_logs table                                              │
│     ├─ user_id: 1                                                       │
│     ├─ action: 'approval'                                               │
│     └─ admin_id: <admin_user_id>                                        │
│  ↓                                                                        │
│  Response 200 OK                                                         │
│                                                                            │
│  User Status: ✅ APPROVED (email sent with code)                        │
│  Next: User must verify email with 6-digit code                          │
│                                                                            │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Email Verification (Stage 3)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ USER RECEIVES EMAIL                                                      │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ EMAIL FROM H&S APP                                                 │  │
│  ├────────────────────────────────────────────────────────────────────┤  │
│  │                                                                      │  │
│  │ Subject: Your Account Verification Code - H&S App                  │  │
│  │                                                                      │  │
│  │ Dear John,                                                         │  │
│  │                                                                      │  │
│  │ Your account has been approved!                                   │  │
│  │                                                                      │  │
│  │ Your verification code is:                                        │  │
│  │ ╔════════════════════════╗                                       │  │
│  │ ║        487392          ║                                       │  │
│  │ ╚════════════════════════╝                                       │  │
│  │                                                                      │  │
│  │ Code expires in 15 minutes.                                       │  │
│  │                                                                      │  │
│  │ Visit: https://hnsapp.com/verify                                  │  │
│  │                                                                      │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  User sees email and clicks link → Opens verification form              │
│  ↓                                                                        │
│  Verification Form (verification_form.html)                              │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                                                                      │  │
│  │  Email Address:    john@gmail.com                                  │  │
│  │  Verification Code: [4][8][7][3][9][2]  ← auto-formatted          │  │
│  │                                                                      │  │
│  │  [Verify Email]  ← Auto-focuses code input                         │  │
│  │                                                                      │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  User enters code and clicks "Verify Email"                              │
│  ↓                                                                        │
│  POST /verify                                                            │
│  {                                                                        │
│    "email": "john@gmail.com",                                            │
│    "verification_code": "487392"                                         │
│  }                                                                        │
│  ↓                                                                        │
│  Backend validation:                                                     │
│  1. Find user by email ✓                                                 │
│  2. Check code format (6 digits) ✓                                       │
│  3. Check code matches database ✓ (487392 == 487392)                     │
│  4. Check code not expired ✓ (expires at 22:45, now 22:30)               │
│  5. Mark verified:                                                       │
│     ├─ is_verified = true                                               │
│     ├─ verification_date = NOW                                          │
│     └─ verification_code = NULL (clear)                                 │
│  6. Log verification in approval_logs                                    │
│  ↓                                                                        │
│  Response 200 OK                                                         │
│  "Account verified successfully! You can now log in."                    │
│  ↓                                                                        │
│  Browser redirects to login page                                         │
│                                                                            │
│  User Status: 🎉 FULLY VERIFIED (can login)                             │
│                                                                            │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema (Visual)

```
┌─────────────────────────────────────────────────────────────────┐
│ USERS TABLE (Main)                                              │
├─────────────────────────────────────────────────────────────────┤
│ id (PK)                                                         │
│ email (UNIQUE)                                                  │
│ password_hash                                                   │
│ full_name                                                       │
│ phone                                                           │
│ home_address                                                    │
│ role (parent/driver)                                            │
│ ├─ is_approved ⭐ (false → true during admin approval)         │
│ ├─ is_verified ⭐ (false → true after email verification)      │
│ ├─ verification_code ⭐ (6-digit, generated by admin)           │
│ ├─ verification_code_expires_at ⭐ (15-min expiry)              │
│ status (pending/approved/declined)                              │
│ valid_id_filename                                               │
│ approval_date                                                   │
│ verification_date                                               │
│ created_at                                                      │
│ updated_at                                                      │
└─────────────────────────────────────────────────────────────────┘
         │                    │                    │
         │                    │                    │
    FK to ▼                FK to ▼            FK to ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ STUDENTS TABLE   │  │ DRIVERS TABLE    │  │APPROVAL_LOGS     │
├──────────────────┤  ├──────────────────┤  ├──────────────────┤
│ id (PK)          │  │ id (PK)          │  │ id (PK)          │
│ user_id (FK)     │  │ user_id (FK)     │  │ user_id (FK)     │
│ full_name        │  │ license_number   │  │ admin_id (FK)    │
│ age              │  │ license_expiry   │  │ action           │
│ grade_level      │  │ vehicle_type     │  │ notes            │
│ student_number   │  │ plate_number     │  │ created_at       │
│ school_name      │  │ years_experience │  │                  │
│ created_at       │  │ created_at       │  │                  │
│ updated_at       │  │ updated_at       │  │                  │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

---

## Data Flow Diagram

```
User Input
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│ Form Submission (HTML/React)                            │
│ - Signup Form (register.php)                            │
│ - Verification Form (verify.php)                        │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
            ┌─────────────────────┐
            │ Validation Layer    │
            │ - Email format      │
            │ - Password strength │
            │ - File validation   │
            │ - Code format       │
            └─────────┬───────────┘
                      │
          ┌───────────┴────────────┐
          │ Success ✓              │ Error ✗
          │                        │
          ▼                        ▼
    ┌──────────────┐       ┌─────────────┐
    │ Processing   │       │ Return Error│
    │ - Hash pass  │       │ - 400 Bad   │
    │ - Gen code   │       │ - 409 Conflict
    │ - Save file  │       │ - 500 Server
    └─────┬────────┘       └─────────────┘
          │
          ▼
    ┌──────────────────────────────┐
    │ Database (PostgreSQL)         │
    │ - INSERT/UPDATE users         │
    │ - INSERT approval_logs        │
    │ - INSERT students/drivers     │
    └─────┬───────────────────────────┘
          │
          ├─→ [Send Email] (if approval)
          │        └─→ PHPMailer
          │             └─→ Gmail SMTP
          │
          └─→ [Return Response]
                 └─→ JSON with status

```

---

## Security Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ PASSWORD SECURITY                                               │
├─────────────────────────────────────────────────────────────────┤
│ User enters: SecurePass123!                                     │
│ ├─ Frontend: Show strength indicator                            │
│ ├─ Validation:                                                  │
│ │  ├─ 8+ characters ✓                                           │
│ │  ├─ 1 uppercase (S) ✓                                         │
│ │  ├─ 1 number (123) ✓                                          │
│ │  └─ 1 special (!) ✓                                           │
│ └─ Backend: Hash with bcrypt (cost=12)                          │
│    └─ Store: $2y$12$abcdefgh... (60 chars)                      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ DATABASE SECURITY (SQL INJECTION PREVENTION)                    │
├─────────────────────────────────────────────────────────────────┤
│ Traditional (Vulnerable):                                       │
│ $sql = "SELECT * FROM users WHERE email = '$email'";           │
│ ✗ Can be exploited: '; DROP TABLE users; --                    │
│                                                                  │
│ Our Approach (Secure):                                          │
│ $stmt = $db->prepare("SELECT * FROM users WHERE email = ?");   │
│ $stmt->execute([$email]);                                       │
│ ✓ Parameter binding prevents injection                          │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ EMAIL SECURITY                                                  │
├─────────────────────────────────────────────────────────────────┤
│ Verification Code: 6-digit (000000-999999)                      │
│ ├─ Generated randomly: mt_rand()                                │
│ ├─ Stored in database: verification_code column                 │
│ ├─ Expires in: 15 minutes                                       │
│ ├─ Sent via: SMTP + STARTTLS (encrypted)                        │
│ └─ Validated: Must match DB + not expired                       │
│                                                                  │
│ Credentials in Environment:                                     │
│ ├─ Not in code ✓                                                │
│ ├─ In .env file ✓                                               │
│ ├─ Use getenv() ✓                                               │
│ └─ Add .env to .gitignore ✓                                     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ FILE UPLOAD SECURITY                                            │
├─────────────────────────────────────────────────────────────────┤
│ Validation:                                                     │
│ ├─ MIME type check (image/*, application/pdf) ✓                 │
│ ├─ File extension check (.jpg, .png, .pdf) ✓                    │
│ ├─ File size check (< 5MB) ✓                                    │
│ ├─ Stored outside web root ✓                                    │
│ └─ Renamed with timestamp + random hash ✓                       │
│    └─ Example: 2026-05-02-5e6f7a8b.jpg                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## State Transitions

```
Registration Status States:
┌──────────┐         ┌──────────┐         ┌──────────┐
│ PENDING  │────────▶│ APPROVED │────────▶│ VERIFIED │
│          │         │          │         │          │
└──────────┘         └──────────┘         └──────────┘
     │                    │                    │
     │                    │                    │
     │                    └─────┬──────────────┘
     │                          │
     │                    Created: User created
     │                    with is_approved=false
     │
     └──────────────────────▶│
                             │ Approved: Admin
                             │ approved account
                             │ + sent email
                             │
                             └──▶ Verified: User
                                 entered correct
                                 6-digit code

Approval Status:
     ┌─────────────────────────┐
     │      PENDING (default)  │
     └────────┬────────────────┘
              │
        ┌─────┴─────┐
        ▼           ▼
    APPROVED    DECLINED
        │           │
        │           │ Final state
        │           │ (cannot undo)
        ▼
    VERIFIED
    (Final state)
```

---

## Timeline Example

```
2026-05-02
-----------

10:00 AM   User fills registration form and clicks Submit
           └─ POST /register
           └─ User created: status=pending, is_approved=false

10:05 AM   Admin views pending applications in dashboard
           └─ Sees John Doe's application

10:07 AM   Admin clicks "Approve" button
           └─ POST /admin/approve-user
           └─ Code generated: 487392
           └─ Expiry set: 10:22 AM (15 mins)
           └─ Email sent to john@gmail.com
           └─ User status: is_approved=true

10:08 AM   John receives email with code 487392
           └─ Opens verification form

10:10 AM   John enters code: 487392
           └─ POST /verify
           └─ Code validated ✓ (match + not expired)
           └─ User status: is_verified=true
           └─ Email sent confirmation

10:10 AM   John redirected to login page
           └─ Can now login with email/password ✓

Legend:
⏳ = Waiting for action
✓ = Complete/verified
✗ = Failed
🎉 = Success
```

---

**These diagrams show the complete system architecture, data flow, and security mechanisms.**
