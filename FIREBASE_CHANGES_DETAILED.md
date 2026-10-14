# Firebase Migration - Detailed File Changes

## 📂 CREATED FILES

### 1. `frontend/src/config/firebase.js`
**Purpose**: Firebase application initialization
**Key Features**:
- Initializes Firebase app with environment variables
- Exports `auth` object for use in components
- Exports `db` and `app` for future use
- Handles environment variable imports

**Usage**:
```javascript
import { auth } from '../../config/firebase';
```

---

### 2. `frontend/src/context/AuthContext.jsx`
**Purpose**: Global authentication state management
**Key Exports**:
- `AuthProvider` - Wrapper component
- `useAuth()` - Hook to access auth state

**Provides**:
```javascript
{
  currentUser,        // Firebase user object or null
  loading,           // Boolean - true while checking auth
  error,             // Error message or null
  logout(),          // Async function to sign out
  isAuthenticated,   // Boolean - true if user logged in
  isEmailVerified    // Boolean - true if email verified
}
```

**Usage**:
```javascript
const { currentUser, loading, logout } = useAuth();
```

---

### 3. `frontend/.env`
**Purpose**: Frontend environment variables
**Contains**:
- Firebase configuration values (from Firebase Console)
- API base URL for backend requests

**MUST BE FILLED IN**:
- All `VITE_FIREBASE_*` values from Firebase project
- `VITE_API_URL` should point to backend

---

### 4. `FIREBASE_MIGRATION_SUMMARY.md`
**Purpose**: Comprehensive documentation of all changes
**Includes**:
- Completed tasks
- Pending tasks with priority
- User flow diagrams
- Testing checklist
- Troubleshooting guide

---

### 5. `FIREBASE_SETUP_GUIDE.md`
**Purpose**: Step-by-step setup instructions
**Contains**:
- 12-step setup process
- Firebase project creation
- Configuration instructions
- Testing procedures
- Troubleshooting tips

---

## 📝 MODIFIED FILES

### 1. `frontend/src/page/signup/signup.jsx`
**Changes**:
| Change | Before | After |
|--------|--------|-------|
| Import | `import { apiFetch }` | `import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth'` |
| Import | None | `import { auth } from '../../config/firebase'` |
| SIGNUP_STEPS | `VERIFY: 'verify'` | `VERIFICATION_SENT: 'verification-sent'` |
| Parent Step | 2 steps (send code, verify) | 2 steps (credentials, verification sent message) |
| Signup Handler | `handleParentSendCode()` | `handleParentSignup()` |
| Code Verification | `handleParentVerifyCode()` | Removed |
| Backend Call | `POST /api/auth/send-code` | `POST /api/parents/create-profile` |
| Email Verification | Custom 6-digit code | Firebase automatic email |
| Back Button | `handleParentBackToCredentials` | `handleParentBackToSignup` |

**Key Function Changes**:
```javascript
// OLD (Verification Code Flow)
const handleParentSendCode = async (e) => {
  await apiFetch('/api/auth/send-code', { ... });
  setParentStep(SIGNUP_STEPS.VERIFY);
}

const handleParentVerifyCode = async (e) => {
  await apiFetch('/api/auth/verify-code', { ... });
  // Auto login
}

// NEW (Firebase Flow)
const handleParentSignup = async (e) => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  await sendEmailVerification(userCredential.user);
  await apiFetch('/api/parents/create-profile', { ... });
  setParentStep(SIGNUP_STEPS.VERIFICATION_SENT);
}
```

**State Changes**:
- ❌ Removed: `const [parentCode, setParentCode] = useState('')`
- ➕ No new state (Firebase handles everything)

---

### 2. `frontend/src/page/login/login.jsx`
**Changes**:
| Change | Before | After |
|--------|--------|-------|
| Import | `import { apiFetch }` | `import { signInWithEmailAndPassword } from 'firebase/auth'` |
| Import | None | `import { auth } from '../../config/firebase'` |
| Login Handler | Backend API call | Firebase Auth |
| Password Check | bcrypt on backend | Firebase Auth |
| Email Check | Format only | Format + Firebase `emailVerified` |
| Token Exchange | None | Firebase ID token → Backend JWT |
| Error Handling | Backend errors | Firebase + Backend errors |

**Key Function Changes**:
```javascript
// OLD (Backend Password Auth)
const handleLogin = async (event) => {
  const response = await apiFetch('/api/auth/login', {
    email, password, accountType
  });
  onLoggedIn(response);
}

// NEW (Firebase Auth)
const handleLogin = async (event) => {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  if (!userCredential.user.emailVerified) {
    setError('Please verify your email');
    return;
  }
  const idToken = await userCredential.user.getIdToken();
  const response = await apiFetch('/api/auth/verify-firebase-token', {
    idToken, accountType
  });
  onLoggedIn(response);
}
```

**Error Handling**:
- ➕ Added: Check for Firebase `auth/user-not-found`
- ➕ Added: Check for Firebase `auth/wrong-password`
- ➕ Added: Email verification check
- ✏️ Modified: All error messages to be user-friendly

---

### 3. `backend/routes/auth.routes.js`
**Removed Endpoints**:
```
POST /auth/send-code      ❌ REMOVED
POST /auth/verify-code    ❌ REMOVED
```

**Added Endpoints**:
```
POST /auth/verify-firebase-token        ✅ NEW
POST /auth/create-parent-profile        ❌ RETIRED (use /parents/create-profile)
```

**Kept Endpoints**:
```
POST /auth/register              (but no longer used by parents)
POST /auth/login                 (becomes optional/deprecated)
GET  /auth/me                    ✅ KEPT
GET  /auth/push/vapid-public-key ✅ KEPT
POST /auth/push/subscribe        ✅ KEPT
POST /auth/push/unsubscribe      ✅ KEPT
```

**Added Code**:
```javascript
// Firebase Admin SDK initialization
let admin = null;
try {
  admin = require('firebase-admin');
  if (!admin.apps.length) {
    const serviceAccount = require(process.env.FIREBASE_ADMIN_SDK_PATH || '../serviceAccountKey.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
} catch (error) {
  console.warn('Firebase Admin SDK not initialized:', error.message);
}

// POST /auth/verify-firebase-token
// - Verifies Firebase ID token
// - Creates/updates user in MongoDB
// - Returns JWT for API usage
// - Checks driver approval status
// - Validates account state (banned/suspended)

// POST /auth/create-parent-profile (retired)
// - Legacy duplicate profile-creation route; use /parents/create-profile
```

**Removed Code**:
```javascript
// ❌ REMOVED: In-memory verification code storage
const verificationCodes = new Map();

// ❌ REMOVED: Verification code logic (10 minutes expiry, 5 attempts, etc.)

// ❌ REMOVED: Email sending code (was logging to console)

// ❌ REMOVED: Bcrypt password hashing for parents
// (Firebase handles this on their servers)
```

**Import Changes**:
```javascript
// ➖ Removed
const bcrypt = require('bcryptjs');
const { sendEmailCode } = require('../utils/verification');

// ➕ Added
const admin = require('firebase-admin');
```

---

### 4. `backend/routes/parent.routes.js`
**Added**:
```javascript
// Gmail validation utility
const isValidGmail = (email) => {
  const trimmed = (email || '').trim().toLowerCase();
  return /^[a-z0-9._%+\-]+@gmail\.com$/.test(trimmed);
};

// POST /parents/create-profile
// - Creates parent profile after Firebase signup
// - Takes: fullName, email, firebaseUid, status
// - Returns: User object with MongoDB ID
// - Idempotent: Updates Firebase UID if user exists
// - Sets role: 'parent', isVerified: false, status: 'pending-verification'
```

**Kept**:
```
POST /parents/register          ❌ RETIRED (use the Firebase-backed profile flow)
All other parent endpoints      ✅ UNCHANGED
```

---

## 🗑️ FILES TO BE REMOVED (After Testing)

These files are no longer needed once Firebase is working:

```
❌ backend/utils/verification.js      (Email/SMS sending)
❌ backend/MailerConfig.php           (PHP mailer config)
❌ backend/send_verification.php      (PHP email script)
❌ backend/PHPMailer/*                (PHP library)
❌ backend/SMTP.php                   (SMTP configuration)
```

**When to Remove**: After successfully testing parent signup with Firebase email

---

## 🔄 WORKFLOW CHANGES

### Parent Sign-Up Workflow

**BEFORE (Verification Code)**:
```
1. User fills credentials
2. Frontend: POST /api/auth/send-code
3. Backend: Generate code, store in memory
4. Frontend: Show "Enter code" form
5. User enters code
6. Frontend: POST /api/auth/verify-code
7. Backend: Validate code, hash password, create user
8. Return JWT → Auto login
```

**AFTER (Firebase)**:
```
1. User fills credentials
2. Frontend: createUserWithEmailAndPassword()
3. Firebase: Creates account, sends email
4. Frontend: sendEmailVerification()
5. Frontend: POST /api/parents/create-profile
6. Backend: Create MongoDB profile
7. Show "Check your email" message
8. User clicks email link (Firebase handles)
9. User logs in
10. Frontend: signInWithEmailAndPassword()
11. Frontend: Check emailVerified
12. Frontend: POST /api/auth/verify-firebase-token
13. Backend: Verify Firebase token, return JWT
```

### Parent Login Workflow

**BEFORE**:
```
1. User enters email + password
2. Frontend: POST /api/auth/login
3. Backend: Find user, verify bcrypt password
4. Return JWT → Login success
```

**AFTER**:
```
1. User enters email + password
2. Frontend: signInWithEmailAndPassword()
3. Firebase: Authenticates user
4. Frontend: Check if emailVerified
5. Frontend: Get Firebase ID token
6. Frontend: POST /api/auth/verify-firebase-token with token
7. Backend: Verify token with Firebase Admin SDK
8. Backend: Find/create MongoDB user
9. Backend: Return JWT → Login success
```

---

## 📊 DEPENDENCIES CHANGES

### Dependencies to ADD
**Frontend**:
```json
{
  "firebase": "^10.8.0"
}
```

**Backend**:
```json
{
  "firebase-admin": "^11.11.0"
}
```

### Dependencies to REMOVE (Later)
**Backend**:
```json
{
  "nodemailer": "❌ Not needed anymore"
}
```

---

## 🔐 Security Implications

### BEFORE (Custom Verification)
- ⚠️ Passwords stored in MongoDB with bcrypt
- ⚠️ Custom verification code system
- ⚠️ Email sent via Nodemailer (must configure SMTP)
- ⚠️ Requires managing secrets: SMTP credentials
- ⚠️ Developers handle email templates

### AFTER (Firebase)
- ✅ Passwords managed by Firebase (Google-backed security)
- ✅ Email verification managed by Firebase
- ✅ Email sent by Firebase (built-in service)
- ✅ Single secret: Firebase service account JSON
- ✅ No email template management needed
- ✅ Built-in rate limiting and abuse protection

---

## 📈 Database Changes

### User Model Field Usage

**Kept**:
- `email` - Still used as identifier
- `fullName` - User display name
- `role` - Parent/Driver/Admin
- `status` - Approval status
- `accountState` - Active/Suspended/Banned
- `phone` - Driver requirement
- `homeAddress` - Driver requirement

**New**:
- `firebaseUid` - Links MongoDB to Firebase user

**No Longer Needed** (Can be kept or removed):
- `passwordHash` - Firebase stores passwords
- `verificationCode` - Firebase handles verification
- `verificationCodeExpires` - Firebase handles timing

**Drivers Still Use**:
- `passwordHash` (if continuing to use MongoDB auth)

---

## ✅ TESTING IMPACT

### Tests That Now Pass Differently
- Parent signup: Uses Firebase instead of custom codes
- Parent login: Uses Firebase instead of password hash
- Email verification: Firebase automatic instead of 6-digit code

### Tests That Are Unchanged
- Driver registration
- Driver login (if using MongoDB)
- Admin login
- Parent van requests
- Driver trip management

### New Tests Needed
- Firebase signup flow
- Email verification link
- Login with unverified email (should fail)
- Login with verified email (should work)
- Firebase token validation on backend

---

## 🚀 Deployment Considerations

### Environment Variables Needed
**Production Frontend**:
```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_API_URL (production backend URL)
```

**Production Backend**:
```
FIREBASE_ADMIN_SDK_PATH (path to service account JSON)
JWT_SECRET (for generating API tokens)
MONGODB_URI (database connection)
```

### Files to NOT Commit to Git
```
❌ backend/serviceAccountKey.json (Firebase secret keys)
❌ frontend/.env (Contains API keys)
```

### Production Checklist
- [ ] Firebase service account key backed up securely
- [ ] Environment variables set in production
- [ ] Firebase email verification is working
- [ ] HTTPS enabled (required by Firebase Auth)
- [ ] Backend can reach Firebase Admin APIs
- [ ] Email notifications tested in production
- [ ] Error logging monitored

---

## 🔗 Related Configuration Files

### Firebase Configuration
- **Firebase Console**: https://console.firebase.google.com
- **Service Account Download**: Project Settings > Service Accounts
- **Web App Credentials**: Project Settings > Your Apps

### Environment Configuration
- **Frontend**: `frontend/.env` (Vite loads VITE_* prefixed vars)
- **Backend**: `backend/.env` (dotenv loads all vars)

### Build Configuration
- **Frontend**: `frontend/vite.config.ts`
- **Backend**: `backend/package.json` (entry: index.js)

---

**Summary**: Firebase migration replaces custom email verification with managed authentication service, improving security and reducing maintenance overhead.
