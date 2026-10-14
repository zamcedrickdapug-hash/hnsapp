# Admin Email + Password Login - Quick Setup

## In 3 Steps:

### 1️⃣ Create Admin Account
```bash
cd backend
# Set ADMIN_PASSWORD in backend/.env or the process environment first.
node scripts/create-admin.js
```

The script requires an explicitly configured `ADMIN_PASSWORD`; it does not create
an account with a default password or print account credentials.

### 2️⃣ On Frontend
- Select "Admin" in Account Type
- Click "Admin Login"
- Enter email and password

---

## Configure Credentials

Set `ADMIN_PASSWORD` securely in the backend environment before running the
script. Set `ADMIN_EMAIL` and `ADMIN_NAME` there as needed.

---

## What Changed

✅ **Created admin password login page** - separate from code-based login  
✅ **Added admin creation script** - automatic password hashing with bcrypt  
✅ **Updated main login** - detects admin and routes to password form  
✅ **Security** - passwords are bcrypt-hashed and never printed by the script

---

## Files Added/Modified

**New Files:**
- `backend/scripts/create-admin.js` - Script to create admin user
- `frontend/src/page/login/AdminLoginPage.jsx` - Admin login form
- `frontend/src/page/login/admin-login.scss` - Admin login styling

**Modified Files:**
- `frontend/src/page/login/login.jsx` - Routes admin to password login

---

## ⚠️ Important

No default administrator password is provided. Configure a strong password
before creating an account.
