# Authentication System Debugging Guide

## Issues Fixed

### 1. ✅ API URL Construction (Frontend)
**Problem**: `api.js` was not constructing the full URL to the backend
```javascript
// BEFORE (WRONG)
const fullPath = path.startsWith('http') ? path : path

// AFTER (CORRECT)
const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'
const fullPath = path.startsWith('http') ? path : `${BACKEND_URL}${path}`
```

### 2. ✅ Import Order (Backend)
**Problem**: Password reset imports were in the middle of the file after other code
```javascript
// BEFORE (WRONG)
// Only had: express, jwt, User, auth middleware

// AFTER (CORRECT)
// Added to top: crypto, generateResetToken, sendPasswordResetEmail
const crypto = require('crypto');
const { generateResetToken, sendPasswordResetEmail } = require('../utils/passwordReset');
```

### 3. ✅ /api/auth/me Error Handling
**Problem**: No try-catch, no validation of `req.user`
```javascript
// BEFORE (RISKY)
router.get('/me', requireAuth, async (req, res) => {
  const user = req.user;
  return res.status(200).json({ user: buildAuthPayload(user) });
});

// AFTER (SAFE)
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: 'User not found. Please log in again.' });
    }
    return res.status(200).json({ user: buildAuthPayload(user) });
  } catch (error) {
    console.error('[Get Me] Error:', error.message);
    return res.status(500).json({ message: 'Failed to retrieve user information.' });
  }
});
```

### 4. ✅ Password Reset Endpoints Enhanced with Logging
**Problem**: Errors were silently failing without debugging info
**Solution**: Added detailed console.log statements throughout the process
- Log incoming request parameters
- Log database searches
- Log token generation
- Log email sending attempts
- Log all errors with full stack trace

### 5. ✅ Better Error Messages
**Problem**: Generic "Unable to process request" errors
**Solution**: Specific error messages that help users and developers
- "Email address is required" (validation)
- "If an account exists with this email, a password reset link has been sent" (security)
- "Password reset link is invalid or has expired" (specific failures)
- Development mode shows actual error messages with `debug` field

---

## How to Debug the 500 Errors

### Step 1: Check Backend Console Logs

When you see a 500 error, look at the backend terminal:

```
[REQUEST] Incoming: POST /api/auth/forgot-password
[Forgot Password] Received request for email: test@example.com
[Forgot Password] Searching for user: test@example.com
[Forgot Password] User not found: test@example.com
[RESPONSE] POST /api/auth/forgot-password 200 (45ms)
```

**Logs to look for**:
- `[REQUEST]` - Confirms request reached backend
- `[Forgot Password] Received request` - Shows what email was sent
- `[Forgot Password] Searching for user` - Shows database query started
- `[Forgot Password] Found user` or `User not found` - Shows query result
- `[Forgot Password] Token saved` - Token generation/storage successful
- `[Forgot Password] Email sent successfully` - Email actually sent
- `[Forgot Password] Critical error` - Shows what went wrong

### Step 2: Check Frontend Console Logs

Open browser console (F12) and look for API logs:

```javascript
[API] Fetching {
  method: "POST",
  path: "/api/auth/forgot-password",
  timestamp: "2024-05-13T10:30:45.000Z"
}

[API] Response {
  method: "POST",
  path: "/api/auth/forgot-password",
  status: 200,
  duration: "45ms"
}
```

**Logs to look for**:
- `[API] Fetching` - Request is being made
- `[API] Response` with `status: 500` - Server returned error
- `[API] Error` with error message - Shows what went wrong

### Step 3: Check Network Tab

In browser DevTools:
1. Press F12 → Network tab
2. Try forgot password
3. Look for POST request to `/api/auth/forgot-password`
4. Click on the request
5. Look at the Response tab for error message

**Expected 200 response**:
```json
{
  "message": "Password reset email has been sent. Please check your inbox."
}
```

**Error 500 response**:
```json
{
  "message": "Unable to process forgot password request.",
  "debug": "User.findOne is not a function"  // Only in development
}
```

---

## Common Issues and Solutions

### Issue: "MongooseError: User.findOne is not a function"
**Cause**: User model not properly imported
**Check**: `const User = require('../models/User');` at top of auth.routes.js
**Fix**: Make sure User is correctly required

### Issue: "500 Internal Server Error" with no logs
**Cause**: Backend not running or not connected
**Check**: Does terminal show "[Startup] Server listening on port 4000"?
**Fix**: Run `npm start` in backend directory

### Issue: "ECONNREFUSED" error from frontend
**Cause**: Frontend trying to reach backend on wrong URL
**Check**: In `frontend/src/api.js`, BACKEND_URL should be `http://localhost:4000`
**Fix**: Update `const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'`

### Issue: "Email sending failed"
**Cause**: Gmail SMTP credentials invalid
**Check**: In backend/.env, verify:
- `SMTP_USERNAME=zamcedrickdapug@gmail.com`
- `SMTP_PASSWORD=YOUR_SMTP_APP_PASSWORD`
**Fix**: 
1. Go to https://myaccount.google.com/security
2. Enable 2-Step Verification
3. Generate App Password for "Mail"
4. Update SMTP_PASSWORD with the generated password

### Issue: "MongoDB connection failed"
**Cause**: MONGO_URL invalid or network issue
**Check**: Does terminal show "Database initialization started"?
**Fix**: 
```bash
# Check MongoDB URL in .env
type backend\.env | findstr MONGO_URL

# Test connection with MongoDB compass or CLI
# Make sure credentials are URL-encoded if they contain special characters
```

### Issue: "JWT signature invalid"
**Cause**: JWT_SECRET not set or mismatch between requests
**Check**: In backend/.env, JWT_SECRET should be set
**Fix**: 
```bash
# If empty, set it
echo 'JWT_SECRET=your-32-character-random-secret-key' >> backend\.env

# Then restart backend
npm start
```

---

## Testing Endpoints Locally

### Test 1: Check Server Health
```bash
curl http://localhost:4000/api/health

# Expected response:
# {"message":"Server is running.","database":"connected"}
```

### Test 2: Test Forgot Password Flow

**Step 1: Request password reset**
```bash
curl -X POST http://localhost:4000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"test@gmail.com\"}"

# Expected response (even if user doesn't exist):
# {"message":"If an account exists with this email, a password reset link has been sent."}
```

**Step 2: Check backend logs for email sending**
```
[Forgot Password] Found user: 507f1f77bcf86cd799439011
[Forgot Password] Token saved, sending email to: test@gmail.com
[Forgot Password] Email sent successfully to: test@gmail.com
```

**Step 3: Check email inbox**
- Look for email from "HNS App" (MAIL_FROM_NAME)
- Should contain password reset link with format: `http://localhost:5173/reset-password/{token}`

### Test 3: Validate Reset Token
```bash
# Use the token from the email
TOKEN="your-token-here"

curl http://localhost:4000/api/auth/validate-reset-token/$TOKEN

# Expected 200 response:
# {"valid":true,"email":"test@gmail.com","message":"Reset token is valid."}

# Expected 400 if expired:
# {"valid":false,"message":"Password reset link is invalid or has expired."}
```

### Test 4: Reset Password
```bash
TOKEN="your-token-here"

curl -X POST http://localhost:4000/api/auth/reset-password/$TOKEN \
  -H "Content-Type: application/json" \
  -d "{\"password\":\"NewPassword123\",\"confirmPassword\":\"NewPassword123\"}"

# Expected 200 response:
# {"message":"Password has been reset successfully. You can now log in with your new password."}
```

---

## Development Environment Checklist

- [ ] Backend running: `npm start` in backend directory (exit code 0)
- [ ] Frontend running: `npm run dev` in frontend directory (exit code 0)
- [ ] MongoDB connected: Backend logs show "database initialization started" ✓
- [ ] Admin account created: Backend logs show "Default admin account" or "already exists"
- [ ] .env file exists: `backend/.env` contains all required variables
- [ ] Email configured: SMTP_USERNAME and SMTP_PASSWORD are set
- [ ] JWT_SECRET: Set to a non-empty value
- [ ] FRONTEND_URL: Set to `http://localhost:5173`
- [ ] MONGO_URL: Valid MongoDB connection string

---

## Quick Fix Checklist

If you're seeing 500 errors:

**1. Restart Backend**
```bash
cd backend
npm start
```

**2. Check Terminal Logs**
- Look for `[REQUEST]`, `[RESPONSE]`, and error messages
- Copy any error messages for debugging

**3. Check Frontend Logs**
- Press F12 in browser
- Look at Console tab
- Look for `[API]` messages

**4. Verify .env**
```bash
type backend\.env | findstr "MONGO_URL JWT_SECRET SMTP_"
# Should show 3 lines with non-empty values
```

**5. Test API with curl**
```bash
curl http://localhost:4000/api/health
# Should respond with JSON
```

**6. Check Network in Browser**
- F12 → Network tab
- Perform the action that's failing
- Click on the failed request
- Check Response tab for error details

---

## Production Debugging

For production, sensitive information should not be logged. Remove or limit:
```javascript
// For production, use:
if (process.env.NODE_ENV === 'development') {
  console.log('[Forgot Password] Received request for email:', email);
}

// And return minimal errors:
return res.status(500).json({ 
  message: 'Unable to process request. Please try again later.' 
  // No 'debug' field in production
});
```

---

## Email Debugging

If emails aren't being sent:

**1. Verify Gmail Credentials**
```bash
# Check if SMTP credentials are set
type backend\.env | findstr SMTP

# Should show:
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USERNAME=your-email@gmail.com
# SMTP_PASSWORD=YOUR_SMTP_APP_PASSWORD
```

**2. Test Email Configuration**
Create `backend/test-email.js`:
```javascript
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USERNAME,
    pass: process.env.SMTP_PASSWORD,
  },
});

transporter.verify((error, success) => {
  if (error) {
    console.log('Email config error:', error);
  } else {
    console.log('Email config valid! Ready to send:', success);
  }
});
```

Run it:
```bash
cd backend
node test-email.js
# Should show: "Email config valid! Ready to send: true"
```

**3. Check Gmail Settings**
1. Go to https://myaccount.google.com/security
2. Enable 2-Step Verification
3. Generate App Password (select "Mail" and "Windows Computer")
4. Update `SMTP_PASSWORD` in .env with the generated 16-character password
5. Restart backend

---

**Last Updated**: May 13, 2026  
**Status**: Ready for Testing
