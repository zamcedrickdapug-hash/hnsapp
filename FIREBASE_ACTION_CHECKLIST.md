# Firebase Migration - Action Checklist

## 🎯 Quick Navigation
- **Setup Instructions**: `FIREBASE_SETUP_GUIDE.md`
- **Implementation Details**: `FIREBASE_MIGRATION_SUMMARY.md`
- **File Changes**: `FIREBASE_CHANGES_DETAILED.md`

---

## 📋 PHASE 1: PREPARATION (Est. 20 minutes)

### Frontend Dependencies
- [ ] Navigate to `frontend/` directory
- [ ] Run: `npm install firebase`
- [ ] Verify: Check `node_modules/firebase` exists
- [ ] Verify: `package.json` shows `"firebase": "^10.x.x"`

### Backend Dependencies
- [ ] Navigate to `backend/` directory
- [ ] Run: `npm install firebase-admin`
- [ ] Verify: Check `node_modules/firebase-admin` exists
- [ ] Verify: `package.json` shows `"firebase-admin": "^11.x.x"`

### Verification
- [ ] Both npm installs completed without errors
- [ ] No peer dependency warnings (if present, can be ignored)

---

## 🔐 PHASE 2: FIREBASE PROJECT SETUP (Est. 15 minutes)

### Create Firebase Project
- [ ] Go to https://console.firebase.google.com
- [ ] Click "Create a new project"
- [ ] Enter project name (e.g., "hnsapp-booking-system")
- [ ] Accept terms and click "Create project"
- [ ] Wait for project to initialize (30-60 seconds)

### Enable Email/Password Authentication
- [ ] In Firebase Console, click "Authentication" (left sidebar)
- [ ] Click "Sign-in method" tab
- [ ] Find "Email/Password" in the list
- [ ] Click on it (card expands)
- [ ] Toggle "Enabled" switch
- [ ] Click "Save"
- [ ] Verify: Status shows "Email/Password: Enabled"

### Download Service Account Key
- [ ] Click ⚙️ icon (Project Settings, top right)
- [ ] Click "Project Settings"
- [ ] Go to "Service Accounts" tab
- [ ] Find "Generate New Private Key" button
- [ ] Click it → JSON file downloads
- [ ] Move file to: `backend/serviceAccountKey.json`
- [ ] Open file to verify it contains: `"type": "service_account"`

### Get Firebase Web Config
- [ ] Go to Firebase Console home
- [ ] Look for "Your apps" section (scroll down)
- [ ] If no web app, click Web icon (</>) and add app
- [ ] Copy the config object values:
  ```
  apiKey
  authDomain
  projectId
  storageBucket
  messagingSenderId
  appId
  ```

### Verification
- [ ] serviceAccountKey.json exists in backend directory
- [ ] Firebase web config values ready (written down or in clipboard)

---

## ⚙️ PHASE 3: ENVIRONMENT CONFIGURATION (Est. 10 minutes)

### Frontend .env Configuration
- [ ] Open `frontend/.env`
- [ ] Fill in all values:
  ```env
  VITE_FIREBASE_API_KEY=<paste value>
  VITE_FIREBASE_AUTH_DOMAIN=<paste value>
  VITE_FIREBASE_PROJECT_ID=<paste value>
  VITE_FIREBASE_STORAGE_BUCKET=<paste value>
  VITE_FIREBASE_MESSAGING_SENDER_ID=<paste value>
  VITE_FIREBASE_APP_ID=<paste value>
  VITE_API_URL=http://localhost:4000/api
  ```
- [ ] Verify: All values are non-empty
- [ ] Save file

### Backend .env Configuration
- [ ] Open `backend/.env`
- [ ] Add line (if not present):
  ```
  FIREBASE_ADMIN_SDK_PATH=./serviceAccountKey.json
  ```
- [ ] Verify: JWT_SECRET is set (for token signing)
- [ ] Verify: MONGODB_URI is set (database connection)
- [ ] Optional: Remove SMTP_* variables (no longer needed)
  ```
  SMTP_HOST
  SMTP_PORT
  SMTP_USERNAME
  SMTP_PASSWORD
  MAIL_FROM_NAME
  MAIL_FROM_EMAIL
  ```
- [ ] Save file

### Verification
- [ ] `frontend/.env` has all Firebase values filled in
- [ ] `backend/.env` has FIREBASE_ADMIN_SDK_PATH set
- [ ] No errors when you reload files

---

## 🎨 PHASE 4: CODE INTEGRATION (Est. 20 minutes)

### Update Main App Entry Point
- [ ] Open `frontend/src/main.tsx`
- [ ] Find the root render code
- [ ] Add import:
  ```tsx
  import { AuthProvider } from './context/AuthContext';
  ```
- [ ] Wrap App component with AuthProvider:
  ```tsx
  <AuthProvider>
    <App />
  </AuthProvider>
  ```
- [ ] Save file

### Optional: Update Route Protection
- [ ] Open your main `App.tsx` or routing component
- [ ] Consider adding protection using `useAuth()` hook
- [ ] Example:
  ```tsx
  import { useAuth } from './context/AuthContext';

  function ProtectedRoute() {
    const { currentUser, loading } = useAuth();
    if (loading) return <Spinner />;
    if (!currentUser) return <Navigate to="/login" />;
    return <Dashboard />;
  }
  ```
- [ ] **Note**: This is optional - the migration works without it

### Verification
- [ ] `main.tsx` imports AuthProvider
- [ ] App is wrapped with `<AuthProvider>`
- [ ] No syntax errors in imports

---

## ✅ PHASE 5: TESTING (Est. 45 minutes)

### Start Servers
- [ ] Terminal 1: `cd backend && npm start`
  - Verify: "Server is running on port 4000"
  - Verify: "MongoDB connected" or similar
  - Check: No Firebase initialization errors
  
- [ ] Terminal 2: `cd frontend && npm run dev`
  - Verify: "Local: http://localhost:5173"
  - Check: No errors in console

### Test Parent Signup
- [ ] Open browser: `http://localhost:5173`
- [ ] Navigate to Signup page
- [ ] Select: **Parent** account type
- [ ] Fill form:
  - Full Name: `Test User`
  - Gmail: `your-real-gmail@gmail.com` (must be real email you control)
  - Password: `TestPassword123`
  - Confirm: `TestPassword123`
- [ ] Click: **Sign Up**

**Expected Results**:
- [ ] No error messages
- [ ] Form submits without delay
- [ ] Page shows: "✉️ Verification email sent to your-real-gmail@gmail.com"
- [ ] Page shows: "Please check your inbox and verify your email"

**Verification**:
- [ ] Check your Gmail inbox
- [ ] Look for email from: "Firebase <noreply@firebase.com>"
- [ ] Subject contains: "Verify your email" or similar
- [ ] Email contains a blue "Verify email address" button or link

### Verify Email Address
- [ ] Open the verification email
- [ ] Click the **"Verify email address"** button (or link)
- [ ] New tab opens → Shows "Your email has been verified"
- [ ] Browser shows Firebase's verification success page

### Test Parent Login (Before Email Verified)
*Skip if you already verified. Do this for 2nd test account.*

- [ ] Open: `http://localhost:5173`
- [ ] Go to: **Login** page
- [ ] Select: **Parent** account type
- [ ] Enter: Email and password for unverified account
- [ ] Click: **Sign In**

**Expected Result**:
- [ ] Error message: "Please verify your Gmail address before logging in"
- [ ] Login form remains visible
- [ ] Can edit email/password and retry

### Test Parent Login (After Email Verified)
- [ ] Go to: **Login** page
- [ ] Select: **Parent** account type
- [ ] Enter: `your-real-gmail@gmail.com`
- [ ] Enter: `TestPassword123`
- [ ] Click: **Sign In**

**Expected Result**:
- [ ] Login successful
- [ ] Redirects to Parent Dashboard
- [ ] Shows: Your profile information
- [ ] No error messages

### Test Driver Registration (Unchanged)
- [ ] Go to: **Signup** page
- [ ] Select: **Driver** account type
- [ ] Fill in all driver fields
- [ ] Upload: Valid ID file
- [ ] Click: **Submit Registration**

**Expected Result**:
- [ ] Success message
- [ ] Shows: "Your application is pending verification"
- [ ] Driver account created in MongoDB
- [ ] Status: "pending" (waiting for admin approval)

---

## 📊 VERIFICATION CHECKLIST

### Code Changes Verified
- [ ] `frontend/src/config/firebase.js` exists
- [ ] `frontend/src/context/AuthContext.jsx` exists
- [ ] `frontend/src/page/signup/signup.jsx` uses Firebase
- [ ] `frontend/src/page/login/login.jsx` uses Firebase
- [ ] `backend/routes/auth.routes.js` has verify-firebase-token endpoint
- [ ] `backend/routes/parent.routes.js` has create-profile endpoint

### Environment Variables Verified
- [ ] `frontend/.env` has all Firebase credentials
- [ ] `backend/.env` has FIREBASE_ADMIN_SDK_PATH
- [ ] `backend/serviceAccountKey.json` exists and contains credentials

### Servers Running
- [ ] Backend server starts without errors
- [ ] Frontend server starts without errors
- [ ] Backend can reach MongoDB
- [ ] Frontend can reach backend API

### Parent Signup Works
- [ ] Can fill signup form
- [ ] Form submits to Firebase
- [ ] Verification email received from Firebase
- [ ] Email contains verification link

### Parent Login Works
- [ ] Cannot login until email verified
- [ ] Can login after email verified
- [ ] Dashboard loads after login
- [ ] User profile displays correctly

### Driver Registration Works
- [ ] Driver signup form works
- [ ] Can upload valid ID
- [ ] Account created in MongoDB
- [ ] Status is "pending"

---

## 🎉 PHASE 6: CLEANUP (Est. 5 minutes)

### Remove Old Code (Optional)
- [ ] Decide if you want to keep old verification code system
- [ ] **Recommendation**: Keep it for now, remove after testing

### Document Current State
- [ ] Note which endpoints are deprecated:
  - `POST /auth/send-code` - DEPRECATED
  - `POST /auth/verify-code` - DEPRECATED
- [ ] Note which endpoints are new:
  - `POST /auth/verify-firebase-token` - NEW
  - `POST /parents/create-profile` - NEW

### Create Production Checklist
- [ ] [ ] Firebase project created in production environment
- [ ] [ ] Environment variables configured in production
- [ ] [ ] Service account key securely stored (not in git)
- [ ] [ ] HTTPS enabled (required for Firebase)
- [ ] [ ] Email verified in production environment

---

## 🐛 TROUBLESHOOTING

### If Firebase Setup Fails

**Issue**: "Cannot find module 'firebase'"
```bash
# Solution:
cd frontend
npm install firebase
```

**Issue**: "Firebase Admin SDK not initialized"
- Check: `serviceAccountKey.json` exists in `backend/`
- Check: `FIREBASE_ADMIN_SDK_PATH` in `backend/.env`
- Check: Path is correct relative to where server runs

**Issue**: "Invalid Firebase config"
- Check: All values in `frontend/.env` are correct
- Check: No typos in key names
- Check: Values are surrounded by quotes if needed

### If Email Doesn't Arrive

**Solution steps**:
1. [ ] Wait 5-10 minutes (sometimes delayed)
2. [ ] Check Gmail spam/promotions folder
3. [ ] Try signup again with different email
4. [ ] Check Firebase Console > Authentication > Users
5. [ ] Verify user was created in Firebase

### If Login Fails

**Issue**: "Email verification status not updating"
- Solution: Refresh the page after verifying email
- Solution: Clear browser cache
- Solution: Try in different browser

**Issue**: "Invalid Firebase token"
- Solution: Restart backend server
- Solution: Check backend logs for errors
- Solution: Verify service account key is valid

### If Tests Fail

**General steps**:
1. [ ] Check browser console for errors (F12)
2. [ ] Check backend terminal for error messages
3. [ ] Check Firebase Console for user creation
4. [ ] Verify all environment variables are set
5. [ ] Restart both servers

---

## 📋 COMPLETION CHECKLIST

### Phase 1 ✅
- [ ] Firebase SDK installed (frontend & backend)

### Phase 2 ✅
- [ ] Firebase project created
- [ ] Email/Password enabled
- [ ] Service account key downloaded
- [ ] Web config values obtained

### Phase 3 ✅
- [ ] `frontend/.env` configured
- [ ] `backend/.env` configured

### Phase 4 ✅
- [ ] AuthProvider integrated in main app
- [ ] Code changes complete

### Phase 5 ✅
- [ ] Parent signup works
- [ ] Email verification works
- [ ] Parent login works
- [ ] Driver registration works

### Phase 6 ✅
- [ ] Cleanup completed
- [ ] Production checklist created

---

## 🚀 YOU ARE DONE!

Once all checkboxes above are checked, Firebase authentication is **fully implemented and tested**.

### Next Optional Steps
1. Remove Nodemailer dependency: `npm uninstall nodemailer`
2. Delete unused files (verification.js, etc.)
3. Update documentation
4. Deploy to production
5. Monitor for any issues

---

## 📞 NEED HELP?

### Check These First
1. `FIREBASE_SETUP_GUIDE.md` - Step-by-step instructions
2. `FIREBASE_MIGRATION_SUMMARY.md` - Comprehensive overview
3. `FIREBASE_CHANGES_DETAILED.md` - Code-level changes

### Common Issues
- Firebase SDK not found → Run `npm install firebase`
- Email not sent → Check Firebase Console > Auth Settings
- Login fails → Check email is verified in Firebase
- Backend can't reach Firebase → Check service account key path

### Support Resources
- Firebase Docs: https://firebase.google.com/docs
- Firebase Auth: https://firebase.google.com/docs/auth
- Firebase Admin: https://firebase.google.com/docs/admin/setup

---

**Firebase Migration Checklist**
**Status**: Ready for user to begin Phase 1
**Last Updated**: 2024-01-[Current Date]
**Estimated Time**: 2-3 hours for complete setup
