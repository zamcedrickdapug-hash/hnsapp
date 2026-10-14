# Quick Start - Fix ECONNREFUSED Error

## Prerequisites Check

```bash
# Verify Node.js version (need >=20.0.0)
node --version

# Verify npm version (need >=9.0.0)
npm --version
```

---

## Step 1: Start Backend Server

**Terminal 1 - Backend:**
```bash
cd backend
npm install
npm start
```

**Expected output:**
```
✓ Backend server listening on http://localhost:4000
✓ Frontend URL configured: (not set - using default)
✓ Vite proxy should target: http://localhost:4000
Connected to MongoDB.
[Startup] Routes registered:
  - /api/auth
  - /api/admin        ← ADMIN ROUTES HERE
  - /api/drivers
  - /api/gps
  - /api/notifications
  - /api/issues
  - /api/routing
  - /health and /api/health (status check)
```

### Verify Backend is Running

Open a new terminal (Terminal 2) and test:

```bash
# Test health endpoint
curl http://localhost:4000/api/health

# Expected response:
# {"message":"Server is running.","database":"connected"}
```

---

## Step 2: Verify Port 4000 is Listening

**Terminal 2:**
```bash
# On Windows PowerShell
netstat -ano | findstr :4000

# Should show:
# TCP    127.0.0.1:4000     0.0.0.0:0     LISTENING    <PID>
```

---

## Step 3: Start Frontend Dev Server

**Terminal 3 - Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**Expected output:**
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
➜  press h + enter to show help

[PROXY REQUEST] GET /api/admin/driver-locations
[PROXY REQUEST] GET /api/health
```

---

## Step 4: Test in Browser

1. Open browser to `http://localhost:5173`
2. Open browser DevTools (F12 → Console tab)
3. Look for API logs:
   ```
   [API] Fetching {method: "GET", path: "/api/admin/driver-locations", ...}
   [API] Response {method: "GET", path: "/api/admin/driver-locations", status: 200, ...}
   ```

---

## Troubleshooting

### Error: Port 4000 Already in Use

```bash
# Find process on port 4000
netstat -ano | findstr :4000

# Kill the process (replace <PID>)
taskkill /PID <PID> /F

# Or use different port in backend/.env
PORT=4001
```

Then update `frontend/vite.config.ts`:
```typescript
target: 'http://localhost:4001',  // Changed from 4000
```

### Error: MongoDB Connection Failed

**Check backend/.env:**
```env
MONGO_URL=YOUR_MONGODB_CONNECTION_STRING
```

**Test MongoDB connection:**
```bash
# Verify connection string is complete with password
# Check MongoDB Atlas Network Access - ensure IP is whitelisted
```

### Error: CORS or Authorization Issues

Check browser DevTools Network tab:
- Status: 403? → JWT token invalid or missing
- Status: 401? → Authentication failed
- Headers: Check `Authorization: Bearer <token>`

### Error: Vite Proxy Still Showing ECONNREFUSED

**Backend stopped?**
```bash
# Terminal 1: Check if backend is still running
# Look for: ✓ Backend server listening on http://localhost:4000

# If not, restart:
npm start
```

**Vite cache issue?**
```bash
# Clear Vite cache
rm -r frontend/node_modules/.vite

# Restart dev server
npm run dev
```

---

## Verification Checklist

- [ ] Backend running on `http://localhost:4000`
- [ ] `curl http://localhost:4000/api/health` returns 200
- [ ] Frontend running on `http://localhost:5173`
- [ ] Browser console shows `[API] Fetching` logs
- [ ] No ECONNREFUSED errors in console or terminal
- [ ] MongoDB connection established (backend shows "Connected to MongoDB")
- [ ] Admin user can fetch `/api/admin/driver-locations` (200 status)

---

## Files Modified

✅ `frontend/vite.config.ts` - Enhanced proxy configuration with error logging  
✅ `frontend/src/api.js` - Added retry logic and detailed logging  
✅ `backend/index.js` - Enhanced error handling middleware  
✅ `backend/routes/admin.routes.js` - Added error handling to `/driver-locations` route  

---

## Environment Variables

### Backend `.env` (required)
```env
PORT=4000
MONGO_URL=<your-mongodb-connection-string>
JWT_SECRET=your-secret-key-here
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

### Frontend `.env` (required)
```env
VITE_API_URL=http://localhost:4000/api
VITE_SOCKET_URL=http://localhost:4000
VITE_FIREBASE_API_KEY=AIzaSyDK780OVIE77SPLsg3OA1RKIacaKCGhNXc
VITE_FIREBASE_AUTH_DOMAIN=hnsapp-f9f67.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=hnsapp-f9f67
VITE_FIREBASE_STORAGE_BUCKET=hnsapp-f9f67.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=785102853021
VITE_FIREBASE_APP_ID=1:785102853021:web:4bbd007bf313f756931574
```

---

## API Endpoint Details

**Endpoint:** `/api/admin/driver-locations`  
**Method:** GET  
**Authentication:** Required (Bearer token)  
**Required Role:** Admin  

**Response (200 OK):**
```json
{
  "locations": [
    {
      "driverId": "user_id",
      "driverName": "Driver Name",
      "driverEmail": "email@example.com",
      "phone": "+1234567890",
      "status": "approved",
      "accountState": "active",
      "vehicleType": "Van",
      "plateNumber": "ABC123",
      "location": {
        "latitude": 10.123456,
        "longitude": 15.654321,
        "updatedAt": "2026-05-13T12:00:00Z"
      }
    }
  ],
  "total": 1
}
```

---

## Next Steps After Fix

1. Test all admin features that use `/api/admin/*` endpoints
2. Verify GPS tracking works correctly
3. Test real-time notifications
4. Check driver location updates
5. Verify Socket.IO real-time connections working

---

## Need More Help?

Refer to: `VITE_PROXY_ECONNREFUSED_FIX.md` for comprehensive troubleshooting guide.
