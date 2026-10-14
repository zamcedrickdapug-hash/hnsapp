# ECONNREFUSED Fix - Verification & Testing Guide

## Summary of Changes Made

### 1. ✅ Vite Configuration Enhanced
**File:** `frontend/vite.config.ts`
- Added detailed proxy error logging
- Enhanced error response handling
- Added request/response middleware logging
- Improved timeouts and WebSocket support

### 2. ✅ Frontend API Handler Improved
**File:** `frontend/src/api.js`
- Added retry logic (3 attempts by default)
- Added detailed logging for debugging
- Distinguishes between network errors and HTTP errors
- Network errors trigger automatic retry

### 3. ✅ Backend Error Handling Enhanced
**File:** `backend/index.js`
- Improved error logging with context
- Better status code and error message handling
- Includes stack trace in error logs

### 4. ✅ Admin Route Error Handling
**File:** `backend/routes/admin.routes.js`
- Added try-catch wrapper to `/driver-locations` route
- Added detailed logging for route execution
- Proper error propagation to global error handler

### 5. ✅ Backend Environment Updated
**File:** `backend/.env`
- Added `PORT=4000` configuration
- Added `MONGO_URL` (copied from root .env)
- Added `FRONTEND_URL=http://localhost:5173`
- Added `NODE_ENV=development`

### 6. ✅ Frontend Environment Verified
**File:** `frontend/.env`
- Confirmed `VITE_API_URL=http://localhost:4000/api`
- Confirmed `VITE_SOCKET_URL=http://localhost:4000`
- All Firebase configuration present

---

## Pre-Launch Checklist

### Environment Variables
- [ ] `backend/.env` has `PORT=4000`
- [ ] `backend/.env` has valid `MONGO_URL`
- [ ] `backend/.env` has `JWT_SECRET`
- [ ] `frontend/.env` has `VITE_API_URL=http://localhost:4000/api`
- [ ] No placeholder values like `<password>` in URLs

### System Requirements
- [ ] Node.js >= 20.0.0 (check: `node --version`)
- [ ] npm >= 9.0.0 (check: `npm --version`)
- [ ] Port 4000 available (check: `netstat -ano | findstr :4000`)
- [ ] Port 5173 available (check: `netstat -ano | findstr :5173`)

### MongoDB
- [ ] Connection string is complete (with password)
- [ ] IP address whitelisted in MongoDB Atlas
- [ ] Cluster is active and accessible

---

## Step-by-Step Launch

### Terminal 1: Start Backend

```bash
cd backend
npm install
npm start
```

**Wait for this output:**
```
═══════════════════════════════════════════════════════════
✓ Backend server listening on http://localhost:4000
✓ Frontend URL configured: http://localhost:5173
✓ Vite proxy should target: http://localhost:4000
═══════════════════════════════════════════════════════════
Connected to MongoDB.
[Startup] Routes registered:
  - /api/auth
  - /api/parents
  - /api/admin
  - /api/drivers
  - /api/gps
  - /api/notifications
  - /api/issues
  - /api/routing
  - /health and /api/health (status check)
```

### Terminal 2: Verify Backend Health

```bash
# Wait 5 seconds for MongoDB to connect, then:
curl http://localhost:4000/api/health

# Expected response:
# {"message":"Server is running.","database":"connected"}
```

### Terminal 3: Start Frontend

```bash
cd frontend
npm install
npm run dev
```

**Wait for this output:**
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
➜  press h + enter to show help
```

### Terminal 2: Monitor Frontend Requests

Keep watching backend console for proxy logs:
```
[REQUEST] Incoming: GET /api/health
[RESPONSE] GET /api/health 200 (45ms)
[REQUEST] Incoming: GET /api/admin/driver-locations
[RESPONSE] GET /api/admin/driver-locations 200 (123ms)
```

---

## Testing the Fix

### Test 1: Health Check
```bash
curl http://localhost:4000/api/health
```
✅ Should return: `{"message":"Server is running.","database":"connected"}`

### Test 2: Check Network Connectivity
Open browser DevTools (F12):
```javascript
// In Console:
await fetch('http://localhost:4000/api/health').then(r => r.json())
```
✅ Should return: `{message: "Server is running.", database: "connected"}`

### Test 3: Test Admin Route (with Authentication)
```bash
# Get token from login or localStorage
TOKEN="your-auth-token-here"

curl -H "Authorization: Bearer $TOKEN" http://localhost:4000/api/admin/driver-locations
```
✅ Should return: `{"locations":[...],"total":N}`

### Test 4: Check Frontend Console Logs
In browser DevTools Console, look for:
```
[API] Fetching {method: "GET", path: "/api/admin/driver-locations", ...}
[PROXY REQUEST] GET /api/admin/driver-locations
[API] Response {method: "GET", path: "/api/admin/driver-locations", status: 200, ...}
```

---

## Common Issues & Quick Fixes

### Issue: Backend fails to start
```
Error: connect ECONNREFUSED
```
**Diagnosis:**
- MongoDB connection string invalid
- MongoDB server not reachable
- Network firewall blocking connection

**Fix:**
```bash
# Check MongoDB URL format
grep MONGO_URL backend/.env

# Should look like:
# MONGO_URL=mongodb://<username>:<password>@<example-host>:27017/<database>

# Test with mongosh
mongosh "mongodb://<username>:<password>@<example-host>:27017/<database>"
```

### Issue: Port 4000 Already in Use
```
Error: listen EADDRINUSE: address already in use :::4000
```
**Fix:**
```bash
# Find process
netstat -ano | findstr :4000

# Kill it (replace <PID>)
taskkill /PID <PID> /F

# Or change port in backend/.env
PORT=5000

# Then update frontend/vite.config.ts:
# target: 'http://localhost:5000'
```

### Issue: Frontend sees ECONNREFUSED in Console
```
[vite] http proxy error: /api/admin/driver-locations
AggregateError [ECONNREFUSED]
```
**Diagnosis:**
- Backend not running
- Backend crashed
- Port mismatch

**Fix:**
```bash
# Terminal 1: Check backend
ps aux | grep node  # Find if running
curl http://localhost:4000/api/health  # Test connectivity

# If not running:
cd backend && npm start

# If running but failing:
# Check backend console logs for errors
# Check MongoDB connection with:
mongosh "your-connection-string"
```

### Issue: 403 Forbidden on Admin Routes
```
{"message":"Unauthorized - Admin access required"}
```
**Diagnosis:**
- JWT token missing or invalid
- User doesn't have admin role
- Token expired

**Fix:**
```bash
# Verify admin user exists in database
mongosh "your-connection-string"
> use hs_app
> db.users.findOne({role: "admin"})

# Should return admin user document
# If not, create test admin in backend:
cd backend
node scripts/create-admin.js
```

### Issue: Vite Proxy Timeout
```
Error: socket hang up
```
**Fix:**
```typescript
// In frontend/vite.config.ts, increase timeout:
'/api': {
  target: 'http://localhost:4000',
  timeout: 60000,  // Increased from 30000
}
```

---

## Monitoring & Debugging

### Enable Verbose Logging
```bash
# Backend verbose mode
DEBUG=* npm start

# Frontend Vite verbose
npm run dev -- --loglevel=debug
```

### Check Routes Registration
Backend console should show:
```
[Startup] Routes registered:
  - /api/auth
  - /api/parents
  - /api/admin          ← MUST BE HERE
  - /api/drivers
  - /api/gps
  - /api/notifications
  - /api/issues
  - /api/routing
```

### Monitor Network Requests
**Browser DevTools → Network tab:**
- Filter by `/api` to see API requests
- Check Status codes (should be 2xx or 4xx, not 5xx)
- Check Response headers (should have proper content-type)
- Check payload in Response tab

### Monitor Backend Logs
**Terminal 1 (Backend console):**
```
[REQUEST] Incoming: GET /api/admin/driver-locations
[RESPONSE] GET /api/admin/driver-locations 200 (95ms)
```

### Test WebSocket Connection
```javascript
// In browser console:
const socket = io('http://localhost:4000')
socket.on('connect', () => console.log('Socket connected'))
socket.on('disconnect', () => console.log('Socket disconnected'))
```

---

## Performance Verification

### API Response Times
✅ Acceptable: < 500ms
⚠️ Warning: 500-2000ms
❌ Error: > 2000ms

### Proxy Performance
```javascript
// Test in browser console:
console.time('api-call')
const res = await fetch('/api/admin/driver-locations', {
  headers: { Authorization: `Bearer ${token}` }
})
console.timeEnd('api-call')
const data = await res.json()
console.log('Locations:', data.total)
```

### Database Query Performance
MongoDB should return queries < 100ms for small datasets.

---

## Deployment Readiness

When ready for production:

### 1. Update Environment
```env
# production backend/.env
PORT=4000  # Or whatever production port
NODE_ENV=production
MONGO_URL=<production-mongodb-url>
FRONTEND_URL=https://yourdomain.com
JWT_SECRET=<strong-random-secret>
```

### 2. Update Frontend Config
```env
# production frontend/.env
VITE_API_URL=https://yourdomain.com/api
VITE_SOCKET_URL=https://yourdomain.com
```

### 3. Build Frontend
```bash
cd frontend
npm run build
# Creates frontend/dist/ folder

# Backend will serve this automatically
```

### 4. Test Production Build
```bash
cd backend
npm run build  # If needed
npm start      # Uses built frontend from dist/
```

---

## Success Criteria

All of these should be true:

- [ ] Backend starts without errors
- [ ] `curl http://localhost:4000/api/health` returns 200
- [ ] MongoDB shows "Connected" in backend logs
- [ ] Frontend loads without errors
- [ ] Browser console shows `[API]` logs without `ECONNREFUSED`
- [ ] Admin page can load driver locations
- [ ] `/api/admin/driver-locations` returns data
- [ ] No proxy errors in Vite console
- [ ] Real-time updates work (if WebSocket involved)
- [ ] Can login and authenticate successfully

---

## Support Resources

📄 **Comprehensive Guide:** `VITE_PROXY_ECONNREFUSED_FIX.md`
📄 **Quick Start:** `QUICK_START_FIX.md`
📄 **This Guide:** `ECONNREFUSED_VERIFICATION.md`

---

## Next Steps

1. ✅ Verify all checklist items above
2. ✅ Test basic API connectivity
3. ✅ Test admin functionality
4. ✅ Test real-time features (GPS, notifications)
5. ✅ Test with different user roles (parent, driver, admin)
6. ✅ Load testing if needed
7. ✅ Deploy to production

---

**If issues persist:**
1. Check all console logs (backend + frontend)
2. Verify environment variables are set correctly
3. Test MongoDB connectivity directly
4. Check network connectivity to backend
5. Review error codes and stack traces
6. Check firewall/antivirus not blocking ports
