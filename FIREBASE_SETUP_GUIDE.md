# Firebase Authentication Setup - Quick Start Guide

## 📋 Pre-Implementation Checklist

Everything up to **Step 4** must be completed before starting the app servers.

---

## Step 1: Install Firebase SDK (5 minutes)

### Frontend
```bash
cd frontend
npm install firebase
```

### Backend
```bash
cd backend
npm install firebase-admin
```

**Verify**: Both commands complete without errors.

---

## Step 2: Create Firebase Project (10 minutes)

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click **"Create a new project"**
3. Enter project name (e.g., "hnsapp-booking")
4. Accept default settings, click **Create Project**
5. Wait for project creation to complete

---

## Step 3: Enable Email Authentication

1. In Firebase Console, go to **Authentication**
2. Click on **Sign-in method** tab
3. Find **Email/Password** in the list
4. Click on it and toggle **Enabled**
5. Click **Save**

You should see: "Email/Password: Enabled"

---

## Step 4: Download Service Account Key

1. In Firebase Console, click the **⚙️ Settings** icon (top right)
2. Select **Project Settings**
3. Go to the **Service Accounts** tab
4. Click **Generate New Private Key**
5. A JSON file downloads to your computer
6. **Copy this file** to: `backend/serviceAccountKey.json`

**Important**: Don't commit this file to git! It contains secret keys.

---

## Step 5: Get Firebase Web Config

1. In Firebase Console, go back to **Project Settings**
2. Look for **Your apps** section at the bottom
3. Click the **Web** icon (</> symbol)
4. If no web app exists, click **Add app** and fill in name
5. You'll see a config object with these values:
   ```javascript
   apiKey
   authDomain
   projectId
   storageBucket
   messagingSenderId
   appId
   ```

6. Copy these values (you'll need them next)

---

## Step 6: Configure Frontend Environment

1. Open `frontend/.env` file
2. Fill in the values from Step 5:

```env
VITE_FIREBASE_API_KEY=<paste apiKey from Step 5>
VITE_FIREBASE_AUTH_DOMAIN=<paste authDomain from Step 5>
VITE_FIREBASE_PROJECT_ID=<paste projectId from Step 5>
VITE_FIREBASE_STORAGE_BUCKET=<paste storageBucket from Step 5>
VITE_FIREBASE_MESSAGING_SENDER_ID=<paste messagingSenderId from Step 5>
VITE_FIREBASE_APP_ID=<paste appId from Step 5>

VITE_API_URL=http://localhost:4000/api
```

**Verify**: All values are filled in (non-empty).

---

## Step 7: Configure Backend Environment

1. Open `backend/.env` file
2. Add this line:

```env
FIREBASE_ADMIN_SDK_PATH=./serviceAccountKey.json
```

3. (Optional) Remove these lines if they exist:
   ```
   SMTP_HOST=...
   SMTP_PORT=...
   SMTP_USERNAME=...
   SMTP_PASSWORD=...
   MAIL_FROM_NAME=...
   MAIL_FROM_EMAIL=...
   ```

---

## Step 8: Wrap App with AuthProvider

1. Open `frontend/src/main.tsx`
2. Add import:
   ```tsx
   import { AuthProvider } from './context/AuthContext';
   ```

3. Update your root render to wrap with `AuthProvider`:
   ```tsx
   // Before:
   ReactDOM.createRoot(document.getElementById('root')!).render(
     <React.StrictMode>
       <App />
     </React.StrictMode>
   )

   // After:
   ReactDOM.createRoot(document.getElementById('root')!).render(
     <React.StrictMode>
       <AuthProvider>
         <App />
       </AuthProvider>
     </React.StrictMode>
   )
   ```

---

## Step 9: Start the Servers

### Start Backend
```bash
cd backend
npm start
# Should see: "Server is running on port 4000"
```

### Start Frontend (in new terminal)
```bash
cd frontend
npm run dev
# Should see: "Local: http://localhost:5173"
```

**Verify**: Both servers start without errors and can access the app.

---

## Step 10: Test Parent Signup

1. Open browser to `http://localhost:5173`
2. Navigate to **Signup**
3. Select **Parent** account type
4. Fill in:
   - Full Name: Test User
   - Gmail: your-test@gmail.com (use a real Gmail you control)
   - Password: TestPassword123
   - Confirm Password: TestPassword123
5. Click **Sign Up**

**Expected**:
- Form submits without error
- Shows: "✉️ Verification email sent to your-test@gmail.com"
- Page changes to show success message

**Check**:
- You should receive an email in your Gmail inbox
- Email subject: "Verify your email for [Project Name]"
- Email contains a verification link

---

## Step 11: Verify Email

1. Open the verification email
2. Click the **Verify email address** link (or button)
3. You'll be taken to Firebase verification page
4. Page shows: "Your email has been verified"

---

## Step 12: Test Parent Login

1. Go back to app
2. Navigate to **Login**
3. Select **Parent** account type
4. Enter:
   - Gmail: your-test@gmail.com
   - Password: TestPassword123
5. Click **Sign In**

**Expected - Before Email Verified** (if you didn't verify):
- Error message: "Please verify your Gmail address before logging in"

**Expected - After Email Verified**:
- Successfully logs in
- Redirects to parent dashboard
- Shows your user profile

---

## ✅ Verification Checklist

- [ ] Firebase SDK installed (frontend)
- [ ] Firebase Admin SDK installed (backend)
- [ ] Firebase project created
- [ ] Email/Password authentication enabled
- [ ] Service account key downloaded to `backend/serviceAccountKey.json`
- [ ] Firebase config values added to `frontend/.env`
- [ ] `FIREBASE_ADMIN_SDK_PATH` added to `backend/.env`
- [ ] AuthProvider wraps App component
- [ ] Backend server starts without errors
- [ ] Frontend server starts without errors
- [ ] Parent signup works
- [ ] Verification email received
- [ ] Email verification works
- [ ] Parent login works after verification

---

## 🐛 Troubleshooting

### "Cannot find module 'firebase'"
**Solution**: Run `npm install firebase` in `frontend` directory

### "Firebase Admin SDK not initialized"
**Solution**: Check `serviceAccountKey.json` exists in `backend/` directory and `FIREBASE_ADMIN_SDK_PATH` is set in `.env`

### "Email/Password sign-in not enabled"
**Solution**: Go to Firebase Console > Authentication > Sign-in method, enable Email/Password

### "Email not received"
**Solution**: Check Gmail spam folder, wait a few minutes, or try resending from a different browser session

### "Login fails with 'token' error"
**Solution**: Restart both frontend and backend servers

### "Invalid FIREBASE_ADMIN_SDK_PATH"
**Solution**: Use absolute path or ensure relative path is correct from backend working directory

### "CORS error during signup"
**Solution**: Backend server might not be running. Check port 4000 is accessible.

---

## 🎉 Success!

Once all steps complete and testing passes, Firebase authentication is ready!

**Next steps**:
1. Remove old verification code system (if desired)
2. Uninstall Nodemailer: `npm uninstall nodemailer`
3. Test driver registration still works
4. Test admin login still works
5. Deploy to production

---

## 📞 Support

If you encounter issues:
1. Check the error message in browser console (F12)
2. Check terminal output for backend errors
3. Verify all environment variables are correct
4. Ensure Firebase project has Email/Password enabled
5. Check Firebase service account is valid

**Common Error Logs**:
- "auth/invalid-api-key" → Wrong Firebase API key in `.env`
- "auth/email-already-in-use" → User already signed up with this Gmail
- "auth/weak-password" → Password less than 6 characters
- "auth/user-not-found" → No user with this Gmail in Firebase
- "auth/wrong-password" → Incorrect password (shouldn't happen with Firebase client SDK)

