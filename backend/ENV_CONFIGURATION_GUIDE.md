# Environment Configuration Guide for Email Verification

## Firebase Configuration Variables

Add these to your `.env` file in the backend directory:

```env
# ============================================
# FIREBASE AUTHENTICATION CONFIGURATION
# ============================================

# Get from Firebase Console > Project Settings > Service Accounts
# (These are for backend Firebase Admin SDK if needed)
FIREBASE_ADMIN_SDK_PATH=./serviceAccountKey.json

# Frontend Firebase Configuration
# Get from Firebase Console > Project Settings > Web App Config
VITE_FIREBASE_API_KEY=YOUR_API_KEY_HERE
VITE_FIREBASE_AUTH_DOMAIN=hnsapp-f9f67.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=hnsapp-f9f67
VITE_FIREBASE_STORAGE_BUCKET=hnsapp-f9f67.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=785102853021
VITE_FIREBASE_APP_APP_ID=1:785102853021:web:YOUR_APP_ID

# ============================================
# EMAIL CONFIGURATION FOR VERIFICATION
# ============================================

# Sender Name - This appears in email "From" field
# IMPORTANT: Set in Firebase Console AND here for consistency
MAIL_FROM_NAME=H&S Booking System

# Sender Email - Use custom domain if available
# Option 1: Custom domain (RECOMMENDED for production)
MAIL_FROM_EMAIL=noreply@hnsapp.com

# Option 2: Gmail address (if custom domain not available)
# MAIL_FROM_EMAIL=noreply@gmail.com

# Option 3: Firebase custom domain (if configured in Firebase Console)
# MAIL_FROM_EMAIL=noreply.hnsapp.firebaseapp.com

# ============================================
# OPTIONAL: SMTP FOR ADDITIONAL EMAILS
# ============================================
# These are NOT used for Firebase verification emails,
# but can be used for other email notifications

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-16-char-app-password

# ============================================
# EMAIL VERIFICATION SETTINGS
# ============================================

# Verification code expiration time (in minutes)
VERIFICATION_CODE_EXPIRY_MINUTES=15

# Maximum verification attempts allowed
MAX_VERIFICATION_ATTEMPTS=3

# ============================================
# FRONTEND CONFIGURATION
# ============================================

VITE_API_URL=http://localhost:4000/api

# Application environment
APP_ENV=development
APP_DEBUG=true
```

## Setting Up Each Variable

### Firebase Configuration

1. **Get API Key and Auth Domain:**
   - Go to https://console.firebase.google.com
   - Select project: hnsapp-f9f67
   - Click ⚙️ Settings (top right)
   - Go to "Project Settings" tab
   - Scroll to "Your apps" section
   - For Web app, copy the configuration object
   - Extract these values:
     - `apiKey` → VITE_FIREBASE_API_KEY
     - `authDomain` → VITE_FIREBASE_AUTH_DOMAIN
     - `projectId` → VITE_FIREBASE_PROJECT_ID
     - `storageBucket` → VITE_FIREBASE_STORAGE_BUCKET
     - `messagingSenderId` → VITE_FIREBASE_MESSAGING_SENDER_ID
     - `appId` → VITE_FIREBASE_APP_ID

### Email Configuration

2. **Sender Name (MAIL_FROM_NAME):**
   - Keep as: `H&S Booking System`
   - Must match Firebase Console email template sender name
   - This is what users see in "From" field

3. **Sender Email (MAIL_FROM_EMAIL):**

   **Option 1: Custom Domain (RECOMMENDED)**
   - Use: `noreply@hnsapp.com`
   - Requires custom domain setup in Firebase Console
   - Provides best deliverability
   - Must configure DNS records (SPF, DKIM, DMARC)

   **Option 2: Firebase Default**
   - Use: `noreply@firebase.com`
   - Works immediately without setup
   - Lower deliverability (more spam folder placement)

   **Option 3: Gmail Address**
   - Use: `noreply@gmail.com`
   - Acceptable for development/testing
   - Moderate deliverability

## Important Notes

### ⚠️ Don't Commit Secrets

Never commit your `.env` file with real secrets to Git:

```bash
# Add to .gitignore if not already there
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
echo ".env.*.local" >> .gitignore
```

### 🔒 Development vs Production

**Development (.env.development):**
```env
MAIL_FROM_NAME=H&S Booking System (Dev)
MAIL_FROM_EMAIL=noreply-dev@hnsapp.com
APP_ENV=development
```

**Production (.env.production):**
```env
MAIL_FROM_NAME=H&S Booking System
MAIL_FROM_EMAIL=noreply@hnsapp.com
APP_ENV=production
```

### ✅ Verification Checklist

- [ ] Firebase API Key added
- [ ] Auth Domain added
- [ ] Project ID added
- [ ] Mail From Name set to: H&S Booking System
- [ ] Mail From Email set (with custom domain)
- [ ] Frontend VITE variables added
- [ ] .env file NOT in Git (in .gitignore)
- [ ] Tested email delivery

## Testing Configuration

After setting up `.env`, test with:

```bash
# Backend
cd backend
npm test

# Frontend
cd frontend
npm run dev
```

Then:
1. Create a test parent account
2. Verify you receive verification email
3. Check email sender name and address
4. Verify email template looks professional
5. Click verification link
6. Confirm account activation

## Troubleshooting

**Email not sent?**
- Check VITE_FIREBASE_API_KEY is correct
- Verify Firebase project ID matches
- Ensure auth domain is correct

**Email in spam folder?**
- Configure custom domain in Firebase Console
- Add SPF/DKIM/DMARC records
- Check sender name in Firebase template

**Environment variables not loading?**
- Restart dev server after .env changes
- Check file is named `.env` (not `.env.example`)
- Ensure no syntax errors in .env

## Next Steps

1. ✅ Set up all environment variables
2. ✅ Configure Firebase email template (see FIREBASE_EMAIL_VERIFICATION_SETUP.md)
3. ✅ Test email delivery
4. ✅ Set up custom domain (optional but recommended)
5. ✅ Monitor delivery metrics
6. ✅ Adjust based on user feedback

## Reference

- Full Setup Guide: `FIREBASE_EMAIL_VERIFICATION_SETUP.md`
- Quick Setup: `FIREBASE_EMAIL_VERIFICATION_QUICK_SETUP.md`
- Email Verification Code: `utils/firebaseEmailVerification.js`
- Frontend Auth Config: `src/lib/firebaseAuthEnhanced.js`
