# Forgot Password Feature - API Reference

## Overview

Complete API reference for the Forgot Password feature endpoints. All endpoints return JSON responses.

---

## POST /api/auth/forgot-password

### Purpose
Initiates the password reset process by sending a reset email to the user.

### Request

**Method**: `POST`  
**URL**: `http://localhost:4000/api/auth/forgot-password`  
**Content-Type**: `application/json`

**Request Body**:
```json
{
  "email": "user@gmail.com"
}
```

**Fields**:
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| email | string | Yes | Valid email address |

### Response

**Status Code**: `200 OK`

```json
{
  "message": "If an account exists with this email, a password reset link has been sent."
}
```

### Examples

#### cURL
```bash
curl -X POST http://localhost:4000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"user@gmail.com"}'
```

#### JavaScript/Fetch
```javascript
const response = await fetch('http://localhost:4000/api/auth/forgot-password', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'user@gmail.com' })
})
const data = await response.json()
console.log(data.message)
```

#### Python/Requests
```python
import requests

response = requests.post(
    'http://localhost:4000/api/auth/forgot-password',
    json={'email': 'user@gmail.com'}
)
print(response.json())
```

### Error Handling

**If email is missing or invalid**:
```json
{
  "message": "Email address is required."
}
```

**If server error occurs**:
```json
{
  "message": "Unable to process forgot password request."
}
```

### Security Notes
- Returns same message whether email exists or not (security best practice)
- Token generated with 32 bytes (256-bit) cryptographic randomness
- Token expires after 30 minutes
- Email sent via SMTP configured in `.env`

### Rate Limiting
- No rate limiting on this endpoint (users can request multiple times)
- Rate limiting applies to failed password reset attempts

### Email Contents
Users will receive an email with:
- Professional HTML template
- Reset link in format: `http://localhost:5173/reset-password/{token}`
- 30-minute expiration notice
- Company branding and support info

---

## POST /api/auth/reset-password/:token

### Purpose
Completes the password reset process by updating user's password.

### Request

**Method**: `POST`  
**URL**: `http://localhost:4000/api/auth/reset-password/{token}`  
**Content-Type**: `application/json`

**URL Parameters**:
| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| token | string | Yes | Reset token from email |

**Request Body**:
```json
{
  "password": "NewPassword123!",
  "confirmPassword": "NewPassword123!"
}
```

**Fields**:
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| password | string | Yes | New password (min 6 chars) |
| confirmPassword | string | Yes | Must match password |

### Response

**Status Code**: `200 OK`

```json
{
  "message": "Password has been reset successfully. You can now log in with your new password."
}
```

### Examples

#### cURL
```bash
curl -X POST http://localhost:4000/api/auth/reset-password/abc123def456 \
  -H "Content-Type: application/json" \
  -d '{
    "password":"NewPassword123!",
    "confirmPassword":"NewPassword123!"
  }'
```

#### JavaScript/Fetch
```javascript
const token = 'abc123def456'
const response = await fetch(
  `http://localhost:4000/api/auth/reset-password/${token}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      password: 'NewPassword123!',
      confirmPassword: 'NewPassword123!'
    })
  }
)
const data = await response.json()
console.log(data.message)
```

#### Python/Requests
```python
import requests

token = 'abc123def456'
response = requests.post(
    f'http://localhost:4000/api/auth/reset-password/{token}',
    json={
        'password': 'NewPassword123!',
        'confirmPassword': 'NewPassword123!'
    }
)
print(response.json())
```

### Error Handling

**Invalid or missing token**:
```json
{
  "message": "Invalid or missing reset token."
}
```
Status: `400 Bad Request`

**Token expired**:
```json
{
  "message": "Password reset link is invalid or has expired. Please request a new one."
}
```
Status: `400 Bad Request`

**Password too short**:
```json
{
  "message": "Password must be at least 6 characters long."
}
```
Status: `400 Bad Request`

**Passwords don't match**:
```json
{
  "message": "Passwords do not match."
}
```
Status: `400 Bad Request`

**Too many failed attempts (rate limited)**:
```json
{
  "message": "Too many failed attempts. Please try again in 15 minutes."
}
```
Status: `429 Too Many Requests`

**Server error**:
```json
{
  "message": "Unable to reset password. Please try again."
}
```
Status: `500 Internal Server Error`

### Validation Rules

**Token**:
- Must be valid and not yet used
- Must not be expired (< 30 minutes old)
- Is hashed before storage comparison

**Password**:
- Minimum 6 characters required
- No maximum length restriction
- Case-sensitive
- Special characters allowed
- Password will be hashed with bcrypt before storage

**Confirm Password**:
- Must exactly match password field
- Case-sensitive
- Used only for validation (not stored)

### Security Features
- Token is single-use (cleared after reset)
- Failed attempts tracked per user
- Rate limiting: 3 attempts, 15-minute lockout
- Password hashed with bcrypt (10 salt rounds)
- Old password not required
- Session not created automatically

---

## GET /api/auth/validate-reset-token/:token

### Purpose
Validates if a reset token is still valid without performing the reset.

### Request

**Method**: `GET`  
**URL**: `http://localhost:4000/api/auth/validate-reset-token/{token}`  
**Content-Type**: Not required

**URL Parameters**:
| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| token | string | Yes | Reset token to validate |

### Response (Valid Token)

**Status Code**: `200 OK`

```json
{
  "valid": true,
  "email": "user@gmail.com",
  "message": "Reset token is valid."
}
```

### Response (Invalid Token)

**Status Code**: `400 Bad Request`

```json
{
  "valid": false,
  "message": "Password reset link is invalid or has expired."
}
```

### Examples

#### cURL
```bash
curl http://localhost:4000/api/auth/validate-reset-token/abc123def456
```

#### JavaScript/Fetch
```javascript
const token = 'abc123def456'
const response = await fetch(
  `http://localhost:4000/api/auth/validate-reset-token/${token}`
)
const data = await response.json()

if (data.valid) {
  console.log(`Valid for: ${data.email}`)
} else {
  console.log('Token expired or invalid')
}
```

#### Python/Requests
```python
import requests

token = 'abc123def456'
response = requests.get(
    f'http://localhost:4000/api/auth/validate-reset-token/{token}'
)
data = response.json()

if data['valid']:
    print(f"Valid for: {data['email']}")
else:
    print("Token expired or invalid")
```

### Error Handling

**Missing token**:
```json
{
  "valid": false,
  "message": "Invalid or missing reset token."
}
```
Status: `400 Bad Request`

**Server error**:
```json
{
  "valid": false,
  "message": "Unable to validate reset token."
}
```
Status: `500 Internal Server Error`

### Use Cases
- Pre-validate token before showing reset form
- Check token expiration without resetting password
- Provide better UX by checking token early
- Display user email for confirmation

### Note
This endpoint is optional - you can go directly to POST reset-password if desired.

---

## Common Workflows

### Complete Password Reset Flow

```
1. User forgets password
   POST /api/auth/forgot-password
   Body: { email: "user@gmail.com" }
   Response: 200 OK

2. User receives email with token: abc123

3. (Optional) Validate token before showing form
   GET /api/auth/validate-reset-token/abc123
   Response: { valid: true, email: "user@gmail.com" }

4. User enters new password
   POST /api/auth/reset-password/abc123
   Body: { password: "NewPass123", confirmPassword: "NewPass123" }
   Response: 200 OK

5. User logs in with new password
   POST /api/auth/login
   Body: { email: "user@gmail.com", password: "NewPass123" }
   Response: { token: "jwt...", user: {...} }
```

### Error Recovery Flow

```
1. User enters wrong email
   POST /api/auth/forgot-password
   Body: { email: "wrong@gmail.com" }
   Response: 200 OK (still same for security)
   → User doesn't receive email

2. User re-attempts with correct email
   POST /api/auth/forgot-password
   Body: { email: "correct@gmail.com" }
   Response: 200 OK
   → New token generated
   → Old token still valid for 30 minutes

3. User clicks latest email link
   POST /api/auth/reset-password/new-token
   Response: 200 OK ✓
```

### Token Expiration Flow

```
1. User receives token
   Email sent with token: abc123
   Expiration: 30 minutes

2. User waits 31 minutes and tries to reset
   POST /api/auth/reset-password/abc123
   Response: 400 Bad Request
   Message: "Password reset link is invalid or has expired"

3. User requests new link
   POST /api/auth/forgot-password
   Body: { email: "user@gmail.com" }
   Response: 200 OK
   → New token sent
   → New 30-minute window starts
```

---

## Status Codes Reference

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request successful |
| 400 | Bad Request | Invalid input or expired token |
| 429 | Too Many Requests | Rate limited (too many attempts) |
| 500 | Server Error | Internal server error |
| 503 | Service Unavailable | Email service not configured |

---

## Headers

### Request Headers
```
Content-Type: application/json
```

### Response Headers
```
Content-Type: application/json
X-Response-Time: <milliseconds>
```

---

## Rate Limiting

### Forgot Password Endpoint
- No rate limiting on request
- Users can request multiple reset emails
- Each request generates new token

### Reset Password Endpoint
- Tracks failed attempts per user
- 3 failed attempts → 15-minute lockout
- Lockout resets on successful password change

### Example Rate Limit Response
```json
{
  "message": "Too many failed attempts. Please try again in 15 minutes."
}
```
Status: `429 Too Many Requests`

---

## Environment Variables

Required for password reset functionality:

```bash
# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
MAIL_FROM_EMAIL=your-email@gmail.com
MAIL_FROM_NAME=HNS App

# Frontend URL (for reset link)
FRONTEND_URL=http://localhost:5173

# JWT Secret (for authentication)
JWT_SECRET=your-secret-key-here
```

---

## Security Best Practices

1. **Always use HTTPS** in production
2. **Never log passwords** in console or logs
3. **Validate on both frontend and backend**
4. **Hash all passwords** with bcrypt
5. **Use secure tokens** (32+ bytes)
6. **Set expiration times** (30 minutes)
7. **Implement rate limiting** (3 attempts)
8. **Don't reveal email existence** for security
9. **Use environment variables** for secrets
10. **Monitor reset attempts** for suspicious activity

---

## Testing Checklist

- [ ] Test forgot password with valid email
- [ ] Test with non-existent email (should appear same)
- [ ] Receive email with reset link
- [ ] Validate token before showing form
- [ ] Reset password successfully
- [ ] Password hashed in database
- [ ] Login with new password works
- [ ] Old token no longer works
- [ ] Expired token shows error
- [ ] Rate limiting works (3 attempts)
- [ ] Email template renders correctly
- [ ] Mobile form works properly

---

## Performance Considerations

- **Token Generation**: ~1-2ms (crypto)
- **Token Hashing**: ~100-200ms (sha256)
- **Email Sending**: 1-5 seconds (network)
- **Password Hashing**: 500-1000ms (bcrypt)
- **Database Query**: 5-50ms (MongoDB)

**Estimated total time**: 600-1250ms for forgot-password endpoint

---

## Debugging Tips

### Check Token Validity
```javascript
// In browser console, after reset
const token = window.location.pathname.split('/')[2]
fetch(`/api/auth/validate-reset-token/${token}`)
  .then(r => r.json())
  .then(console.log)
```

### Test Email Configuration
```bash
node -e "
const nodemailer = require('nodemailer');
const t = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: { user: process.env.SMTP_USERNAME, pass: process.env.SMTP_PASSWORD }
});
t.verify((e, ok) => console.log(e || 'OK'))
"
```

### Check Database Fields
```javascript
// MongoDB query to verify token stored
db.users.findOne(
  { email: 'user@gmail.com' },
  { passwordResetToken: 1, passwordResetTokenExpires: 1 }
)
```

---

## Support

For issues with API endpoints:
1. Check backend logs: `npm run dev`
2. Verify `.env` configuration
3. Test with cURL first
4. Check MongoDB connection
5. Verify email credentials

---

**Last Updated**: May 13, 2026  
**Version**: 1.0.0  
**Status**: Production Ready
