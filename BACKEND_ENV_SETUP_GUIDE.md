# Backend Environment Configuration - COMPLETE SETUP GUIDE

## Required Environment Variables

### Server Configuration
```
PORT=4000
NODE_ENV=development
```

### MongoDB Configuration
```
MONGO_URL=YOUR_MONGODB_CONNECTION_STRING
```

### Frontend Configuration
```
FRONTEND_URL=http://localhost:5173
```

### Authentication (JWT)
```
JWT_SECRET=your-secret-key-here
```

### Email Configuration (Gmail SMTP)
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USERNAME=zamcedrickdapug@gmail.com
SMTP_PASSWORD=YOUR_SMTP_APP_PASSWORD
MAIL_FROM_EMAIL=zamcedrickdapug@gmail.com
MAIL_FROM_NAME=HNS App
```

### Firebase Configuration
```
FIREBASE_ADMIN_SDK_PATH=./serviceAccountKey.json
```

### Admin Setup (Optional)
```
ADMIN_EMAIL=
ADMIN_PASSWORD=
```

Automatic startup provisioning creates no new admin unless `ADMIN_PASSWORD` is
explicitly set. If it is missing, startup seeding is skipped with a warning.
The `.local` fallback email is only an identifier; it is not accompanied by a
default password.

---

## Verification Checklist

### 1. Check MongoDB Connection
```bash
# Windows PowerShell
$env:MONGO_URL
# Should output your MongoDB connection string

# Or check in .env file directly
type backend\.env | findstr MONGO_URL
```

### 2. Check JWT Secret
```bash
echo $env:JWT_SECRET
# Should output your secret key
```

### 3. Check Email Configuration
```bash
echo $env:SMTP_USERNAME
echo $env:SMTP_PASSWORD
# Should show your Gmail credentials
```

### 4. Test Backend Connection
```bash
# In backend directory
npm start

# When ADMIN_PASSWORD is configured and no matching admin exists:
# [Startup] Server listening on port 4000
# Database initialization started...
# Default admin account created
```

### 5. Test Frontend Connection
```bash
# In frontend directory
npm run dev

# Should show:
# VITE v5.0.0 ready in XXX ms
# ➜  Local:   http://localhost:5173/
```

### 6. Test API Endpoint
```bash
# Test /api/health endpoint
curl http://localhost:4000/api/health

# Should respond with:
# {
#   "message": "Server is running.",
#   "database": "connected"
# }
```

---

## .env File Location

The backend looks for `.env` file in these locations (in order):
1. `backend/.env` (recommended)
2. `.env` (root directory)
3. `backend/` with legacy `MongoUrl` variable

**Best Practice**: Place `.env` in the backend directory:
```
hnsapp/
├── backend/
│   ├── .env  ← Put it here
│   ├── index.js
│   └── ...
├── frontend/
├── .env      ← Or put it here (will be read)
└── ...
```

---

## Troubleshooting Environment Variables

### Issue: "Missing MongoDB connection string"
**Cause**: MONGO_URL not set in .env
**Fix**:
```bash
# Check if .env exists
ls backend\.env

# Check MONGO_URL is there
type backend\.env | findstr MONGO_URL

# Add it if missing
echo 'MONGO_URL=YOUR_MONGODB_CONNECTION_STRING' >> backend\.env
```

### Issue: "JWT signature invalid"
**Cause**: JWT_SECRET not set or different on frontend
**Fix**:
```bash
# Set JWT_SECRET
echo 'JWT_SECRET=your-secret-key-here' >> backend\.env

# Verify it's set
type backend\.env | findstr JWT_SECRET
```

### Issue: "Email sending failed"
**Cause**: SMTP credentials incorrect or missing
**Fix**:
```bash
# Verify Gmail credentials
type backend\.env | findstr SMTP_

# For Gmail, you need an App Password (not your regular password):
# 1. Go to myaccount.google.com
# 2. Select "Security" in the left menu
# 3. Enable 2-Step Verification
# 4. Go to App passwords
# 5. Select "Mail" and "Windows Computer"
# 6. Copy the generated password
# 7. Use it as SMTP_PASSWORD
```

### Issue: "Frontend can't reach backend"
**Cause**: FRONTEND_URL or API URL incorrect
**Fix**:
```bash
# Check FRONTEND_URL in backend .env
type backend\.env | findstr FRONTEND_URL

# In frontend, update api.js:
# Look for BACKEND_URL = 'http://localhost:4000'
# Make sure backend is running on port 4000
```

---

## Environment Variable Reference Table

| Variable | Value | Purpose | Example |
|----------|-------|---------|---------|
| `PORT` | Number | Backend port | `4000` |
| `NODE_ENV` | String | Environment mode | `development` or `production` |
| `MONGO_URL` | String | MongoDB connection | `mongodb+srv://...` |
| `FRONTEND_URL` | String | Frontend base URL | `http://localhost:5173` |
| `JWT_SECRET` | String | JWT signing key | `your-random-secret` |
| `SMTP_HOST` | String | Email server | `smtp.gmail.com` |
| `SMTP_PORT` | Number | Email port | `587` |
| `SMTP_USERNAME` | String | Email account | `your-email@gmail.com` |
| `SMTP_PASSWORD` | String | Email password | `your-app-password` |
| `MAIL_FROM_EMAIL` | String | Sender email | `your-email@gmail.com` |
| `MAIL_FROM_NAME` | String | Sender name | `HNS App` |
| `FIREBASE_ADMIN_SDK_PATH` | String | Firebase config path | `./serviceAccountKey.json` |

---

## Production Deployment Notes

### Recommended .env for Production:

```bash
# Production Settings
PORT=4000
NODE_ENV=production

# MongoDB (use production instance)
MONGO_URL=YOUR_MONGODB_CONNECTION_STRING

# Production Frontend
FRONTEND_URL=https://yourdomain.com

# Strong JWT Secret (use 32+ random characters)
JWT_SECRET=$(openssl rand -base64 32)

# Production Email (use SendGrid, AWS SES, or similar)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USERNAME=apikey
SMTP_PASSWORD=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Company Email
MAIL_FROM_EMAIL=noreply@yourdomain.com
MAIL_FROM_NAME=Your Company Name
```

---

## Verification Script

Create `backend/verify-env.js`:
```javascript
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const requiredVars = [
  'MONGO_URL',
  'JWT_SECRET',
  'SMTP_USERNAME',
  'SMTP_PASSWORD',
  'MAIL_FROM_EMAIL',
  'FRONTEND_URL',
];

console.log('Environment Variables Verification:\n');

let allValid = true;

for (const varName of requiredVars) {
  const value = process.env[varName];
  const status = value ? '✓' : '✗';
  const maskedValue = value 
    ? (value.length > 30 ? value.substring(0, 30) + '...' : value)
    : 'MISSING';
  
  console.log(`${status} ${varName}: ${maskedValue}`);
  
  if (!value) allValid = false;
}

console.log(`\n${allValid ? '✓ All variables configured!' : '✗ Some variables are missing. See above.'}`);

process.exit(allValid ? 0 : 1);
```

Run it:
```bash
cd backend
node verify-env.js
```

---

## Quick Setup Command

```bash
# Windows PowerShell
$vars = @{
    'PORT' = '4000'
    'NODE_ENV' = 'development'
    'MONGO_URL' = 'YOUR_MONGODB_CONNECTION_STRING'
    'FRONTEND_URL' = 'http://localhost:5173'
    'JWT_SECRET' = 'your-secret-key'
    'SMTP_HOST' = 'smtp.gmail.com'
    'SMTP_PORT' = '587'
    'SMTP_SECURE' = 'false'
    'SMTP_USERNAME' = 'your-email@gmail.com'
    'SMTP_PASSWORD' = 'your-app-password'
    'MAIL_FROM_EMAIL' = 'your-email@gmail.com'
    'MAIL_FROM_NAME' = 'HNS App'
}

$content = $vars.GetEnumerator() | ForEach-Object { "$($_.Name)=$($_.Value)" } | Join-String -Separator "`n"
Set-Content -Path backend\.env -Value $content
```

---

**Last Updated**: May 13, 2026  
**Status**: Ready for Setup
