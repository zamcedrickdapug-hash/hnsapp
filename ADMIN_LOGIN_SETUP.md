# Admin Login Setup Guide

This guide explains how to set up email + password authentication for admin accounts.

## Overview

The HNS app now supports two authentication methods:

1. **Code-based Login** (for Parents & Drivers)
   - User enters email/phone
   - Receives 6-digit verification code via SMS or email
   - Enters code to verify and login

2. **Email + Password Login** (for Admins)
   - Admin enters email and password
   - Uses bcrypt-hashed passwords for security
   - Separate admin login form

## Step 1: Create Admin User in Database

### Option A: Using Environment Variables (Recommended)

Set the admin account values in a `.env` file in the backend directory. Do not
commit this file:

```bash
ADMIN_EMAIL=
ADMIN_PASSWORD=
ADMIN_NAME=
```

### Option B: Run the Script

After setting a non-empty `ADMIN_PASSWORD` securely in the process environment
or backend `.env`, run the admin creation script:

```bash
cd backend
node scripts/create-admin.js
```

The script has no default password and does not print credentials. The startup
seed also skips new admin creation with a warning when `ADMIN_PASSWORD` is not
configured.

## Step 2: Test Admin Login

1. **On the login page:**
   - Select "Admin" from Account Type dropdown
   - Click "Admin Login" button
   - You'll be redirected to the admin password login form

2. **Enter credentials:**
   - Email: (the email you created the admin account with)
   - Password: (the password you set)

3. **Click "Sign In"**

## Step 3: Update Admin Password

The creation script only creates accounts and will not reset an existing
administrator password. Use the approved operational password-reset procedure.

## Database Schema

The admin user is stored in the `users` collection with:

```javascript
{
  email: "admin@hnsapp.com",
  fullName: "Admin User",
  role: "admin",
  passwordHash: "<bcrypt-hashed-password>",
  status: "approved",
  accountState: "active",
  isVerified: true,
  signupMethod: "password",
  // ... other fields
}
```

## Resetting Admin Password

If you forget the admin password, you can reset it:

```bash
cd backend

# Delete the old admin user
mongo hnsapp
db.users.deleteOne({ email: "admin@hnsapp.com" })
exit

# Create new admin with new password
ADMIN_EMAIL=admin@hnsapp.com node scripts/create-admin.js
```

Set `ADMIN_PASSWORD` securely in the environment before running the command.

Or update directly in MongoDB:

```javascript
// In MongoDB shell
use hnsapp;
db.users.updateOne(
  { email: "admin@hnsapp.com" },
  { $set: { passwordHash: "<new-bcrypt-hash>" } }
);
```

## Troubleshooting

### "Invalid email or password"
- Check that email matches exactly (case-insensitive)
- Verify password is correct
- Ensure admin account exists in database

### Admin account doesn't exist
- Run the create-admin.js script again
- Check MongoDB to confirm user was created:
  ```bash
  mongo hnsapp
  db.users.findOne({ role: "admin" })
  ```

### SMTP errors when sending verification codes
- This only affects parent/driver code-based login
- Admin password login doesn't require email sending
- Check SMTP configuration in `.env`

## Security Notes

✓ **Passwords are hashed** using bcrypt with salt rounds of 12
✓ **Admin role** automatically approved (no waiting period)
✓ **Separate login form** provides better UX for admin users
✓ **JWT tokens** used for session management

⚠️ **To Do:**
- Implement password change/reset functionality
- Add 2FA (two-factor authentication) for admins
- Set admin password expiration policies
- Add admin audit logging

## API Endpoints

### Admin Login
```
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@hnsapp.com",
  "password": "password123",
  "accountType": "admin"
}

Response:
{
  "token": "eyJhbGc...",
  "user": {
    "id": "...",
    "role": "admin",
    "fullName": "Admin User",
    "email": "admin@hnsapp.com",
    ...
  }
}
```

### User/Parent/Driver Login (Code-based)
```
POST /api/auth/send-code
POST /api/auth/verify-code
```

See main authentication docs for details.
