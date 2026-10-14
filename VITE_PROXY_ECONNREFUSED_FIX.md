# Vite Proxy ECONNREFUSED Fix - Complete Diagnostic & Solution

**Issue:** `[vite] http proxy error: /api/admin/driver-locations` with `ECONNREFUSED` error

---

## Root Causes Analysis

### 1. **Backend Server Not Running**
- Express server (`backend/index.js`) is not started
- Port 4000 is not listening for connections

### 2. **Port Configuration Mismatch**
- Vite config targets `http://localhost:4000`
- Backend `.env` specifies different PORT
- Firewall blocking localhost connections

### 3. **MongoDB Connection Blocking**
- MongoDB connection string invalid/unreachable
- Credentials incorrect
- Database initialization timeout preventing API server startup

### 4. **Express Route Registration Issue**
- Admin routes not properly exported/imported
- Middleware chain broken
- Missing error handling in route handlers

---

## Diagnostic Checklist

### ✓ Step 1: Verify Backend is Running
```bash
# In backend terminal
cd backend
npm start

# Expected output:
# ═══════════════════════════════════════════════════════════
# ✓ Backend server listening on http://localhost:4000
# ✓ Frontend URL configured: (not set - using default)
# ✓ Vite proxy should target: http://localhost:4000
# ═══════════════════════════════════════════════════════════
```

### ✓ Step 2: Test Backend Health
```bash
curl http://localhost:4000/api/health
# Expected: {"message":"Server is running.","database":"connected"}
```

### ✓ Step 3: Verify Port 4000 is Listening
```bash
# On Windows PowerShell:
netstat -ano | findstr :4000

# Should show node.exe or similar listening
```

### ✓ Step 4: Check Environment Variables
```bash
# Backend .env must contain:
PORT=4000
MONGO_URL=<valid-connection-string>

# Frontend .env must contain:
VITE_API_URL=http://localhost:4000/api
VITE_SOCKET_URL=http://localhost:4000
```

### ✓ Step 5: Verify Admin Route Exists
```bash
# Test with authorization header
curl -H "Authorization: Bearer <token>" http://localhost:4000/api/admin/driver-locations
```

---

## Fix Implementation

### PART 1: Enhanced Vite Configuration

**File:** `frontend/vite.config.ts`

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
        timeout: 30000,
        ws: true,
        
        // Enhanced error logging
        onError: (err, req, res) => {
          console.error('[PROXY ERROR]', {
            path: req.url,
            error: err.code,
            message: err.message,
            targetUrl: 'http://localhost:4000' + req.url,
            suggestion: 'Ensure backend is running: npm start in backend directory'
          })
          
          res.writeHead(503, {
            'Content-Type': 'application/json',
          })
          res.end(JSON.stringify({
            message: 'Backend service unavailable',
            code: err.code,
            suggestion: 'Make sure backend server is running on port 4000',
          }))
        },

        // ProxyRes middleware for response handling
        onProxyRes: (proxyRes, req, res) => {
          proxyRes.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
          if (proxyRes.statusCode >= 500) {
            console.warn('[PROXY WARNING]', {
              status: proxyRes.statusCode,
              path: req.url,
              method: req.method,
            })
          }
        },

        // Request logging
        onProxyReq: (proxyReq, req, res) => {
          console.log('[PROXY REQUEST]', req.method, req.url)
        },

        rewrite: (path) => path,
      },
      '/socket.io': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
        ws: true,
        rewriteWsOrigin: true,
        timeout: 30000,
      },
    },
    
    // Additional server config
    middlewareMode: false,
    host: 'localhost',
    port: 5173,
    strictPort: false,
    cors: true,
  },
})
```

---

### PART 2: Frontend Environment Configuration

**File:** `frontend/.env`

```env
# API Configuration - MUST match backend port and host
VITE_API_URL=http://localhost:4000/api
VITE_SOCKET_URL=http://localhost:4000

# Firebase Configuration (existing values)
VITE_FIREBASE_API_KEY=AIzaSyDK780OVIE77SPLsg3OA1RKIacaKCGhNXc
VITE_FIREBASE_AUTH_DOMAIN=hnsapp-f9f67.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=hnsapp-f9f67
VITE_FIREBASE_STORAGE_BUCKET=hnsapp-f9f67.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=785102853021
VITE_FIREBASE_APP_ID=1:785102853021:web:4bbd007bf313f756931574
```

---

### PART 3: Enhanced API Request Handler

**File:** `frontend/src/api.js`

```javascript
export async function apiFetch(path, options = {}) {
  const fullPath = path.startsWith('http') ? path : path
  
  // Add detailed logging for debugging
  const startTime = Date.now()
  console.log('[API Request Start]', {
    method: options.method || 'GET',
    path,
    timestamp: new Date().toISOString(),
  })

  try {
    const response = await fetch(fullPath, {
      ...options,
      headers: {
        ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...(options.headers || {}),
      },
    })

    const duration = Date.now() - startTime
    const contentType = response.headers.get('content-type') || ''
    const isJson = contentType.includes('application/json')
    const payload = isJson ? await response.json() : await response.text()

    // Log response
    console.log('[API Response]', {
      method: options.method || 'GET',
      path,
      status: response.status,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    })

    if (!response.ok) {
      const message = isJson ? payload?.message : 'Request failed.'
      const error = new Error(message || 'Request failed.')
      error.status = response.status
      error.data = payload
      error.duration = duration
      
      console.error('[API Error]', {
        status: response.status,
        message: error.message,
        path,
        duration: `${duration}ms`,
      })
      
      throw error
    }

    return payload
  } catch (error) {
    const duration = Date.now() - startTime
    
    // Distinguish between network and response errors
    if (error instanceof TypeError) {
      console.error('[API Network Error]', {
        path,
        error: error.message,
        duration: `${duration}ms`,
        suggestion: 'Backend server may not be running or is unreachable',
        backendUrl: 'http://localhost:4000',
      })
    } else {
      console.error('[API Error Caught]', {
        path,
        error: error.message,
        status: error.status,
        duration: `${duration}ms`,
      })
    }
    
    throw error
  }
}
```

---

### PART 4: Backend Enhanced Logging & Error Handling

**File:** `backend/index.js` - Add logging middleware

```javascript
// Add this BEFORE route registrations (around line 110)

// Enhanced error handling middleware
app.use((req, res, next) => {
  const start = Date.now()
  
  // Log incoming request with full details
  console.log(`[API] ${req.method} ${req.path}`, {
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    timestamp: new Date().toISOString(),
  })

  // Override res.json to catch all API responses
  const originalJson = res.json.bind(res)
  res.json = function(data) {
    const duration = Date.now() - start
    console.log(`[API] ${req.method} ${req.path} → ${res.statusCode} (${duration}ms)`)
    return originalJson(data)
  }

  next()
})

// Add this error handler at END of middleware (before app.listen)
app.use((error, req, res, next) => {
  const duration = Date.now() - req.start
  console.error('[ERROR]', {
    path: req.path,
    method: req.method,
    message: error.message,
    stack: error.stack?.split('\n').slice(0, 3),
    duration,
  })
  
  res.status(error.status || 500).json({
    message: error.message || 'Unexpected server error.',
    code: error.code,
  })
})
```

---

### PART 5: Backend Environment Configuration

**File:** `backend/.env`

```env
# Server Configuration
PORT=4000
NODE_ENV=development

# MongoDB Configuration (from root .env)
MONGO_URL=YOUR_MONGODB_CONNECTION_STRING

# Frontend URL (for development)
FRONTEND_URL=http://localhost:5173

# Authentication
JWT_SECRET=your-secret-key-here

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USERNAME=zamcedrickdapug@gmail.com
SMTP_PASSWORD=YOUR_SMTP_APP_PASSWORD
MAIL_FROM_EMAIL=zamcedrickdapug@gmail.com
MAIL_FROM_NAME=HNS App

# Firebase
FIREBASE_ADMIN_SDK_PATH=./serviceAccountKey.json
```

---

### PART 6: Frontend Request Wrapper with Retry Logic

**File:** `frontend/src/api.js` - Enhanced version with retry

```javascript
export async function apiFetch(path, options = {}, retryCount = 0) {
  const maxRetries = options.maxRetries ?? 3
  const retryDelay = options.retryDelay ?? 1000
  const fullPath = path.startsWith('http') ? path : path

  const startTime = Date.now()
  console.log('[API] Fetching', { method: options.method || 'GET', path, retryCount })

  try {
    const response = await fetch(fullPath, {
      ...options,
      headers: {
        ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...(options.headers || {}),
      },
    })

    const duration = Date.now() - startTime
    const contentType = response.headers.get('content-type') || ''
    const isJson = contentType.includes('application/json')
    const payload = isJson ? await response.json() : await response.text()

    if (!response.ok) {
      const message = isJson ? payload?.message : 'Request failed.'
      const error = new Error(message || `HTTP ${response.status}`)
      error.status = response.status
      error.data = payload
      throw error
    }

    console.log('[API] Success', { method: options.method || 'GET', path, status: 200, duration: `${duration}ms` })
    return payload
  } catch (error) {
    const duration = Date.now() - startTime

    if (error instanceof TypeError && retryCount < maxRetries) {
      console.warn(`[API] Retry ${retryCount + 1}/${maxRetries} after ${retryDelay}ms for ${path}`)
      await new Promise(r => setTimeout(r, retryDelay))
      return apiFetch(path, { ...options, maxRetries, retryDelay }, retryCount + 1)
    }

    console.error('[API] Error', {
      method: options.method || 'GET',
      path,
      error: error.message,
      status: error.status,
      duration: `${duration}ms`,
    })

    throw error
  }
}
```

---

### PART 7: Admin Route Verification

**File:** `backend/routes/admin.routes.js` - Verify the route

```javascript
// Around line 234, the route MUST exist exactly like this:
router.get('/driver-locations', requireAdmin, async (req, res) => {
  try {
    const drivers = await User.find({ role: 'driver', status: 'approved' })
      .select('fullName email phone status accountState driver.vehicleType driver.plateNumber lastKnownLocation')
      .sort({ fullName: 1 })

    const requestsWithLocation = await VanRequest.find({
      driver: { $ne: null },
      liveLocation: { $ne: null },
      status: { $in: ['accepted', 'arrived', 'picked_up'] },
    })
      .select('driver status liveLocation studentName schoolName updatedAt')
      .sort({ 'liveLocation.updatedAt': -1, updatedAt: -1 })

    const latestRequestByDriverId = new Map()
    for (const item of requestsWithLocation) {
      const driverId = String(item.driver || '')
      if (!driverId || latestRequestByDriverId.has(driverId)) {
        continue
      }
      latestRequestByDriverId.set(driverId, item)
    }

    const locations = drivers.map((driver) => {
      const driverId = String(driver._id)
      const latestTrip = latestRequestByDriverId.get(driverId) || null
      const fallbackLocation = driver.lastKnownLocation

      return {
        id: driverId,
        name: driver.fullName,
        email: driver.email,
        phone: driver.phone,
        status: driver.status,
        accountState: driver.accountState || 'active',
        vehicle: {
          type: driver.driver?.vehicleType || 'Unknown',
          plateNumber: driver.driver?.plateNumber || 'N/A',
        },
        location: latestTrip?.liveLocation || fallbackLocation || null,
        lastTrip: latestTrip ? {
          studentName: latestTrip.studentName,
          schoolName: latestTrip.schoolName,
          status: latestTrip.status,
          updatedAt: latestTrip.updatedAt,
        } : null,
      }
    })

    return res.status(200).json({ locations })
  } catch (error) {
    console.error('[ERROR] /api/admin/driver-locations:', error)
    return res.status(500).json({ message: 'Failed to retrieve driver locations.' })
  }
})

// IMPORTANT: Ensure module is exported
module.exports = router
```

---

### PART 8: Express Server Startup Verification

**File:** `backend/index.js` - Verify route registration section

Routes MUST be registered in this exact order (around line 130-145):

```javascript
app.use('/api/auth', authRoutes)
app.use('/api/parents', parentRoutes)
app.use('/api/admin', adminRoutes)        // ← ADMIN ROUTES MUST BE HERE
app.use('/api/drivers', driverRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/issues', issuesRoutes)
app.use('/api/routing', routingRoutes)
app.use('/api/gps', gpsRoutes)
```

---

## Step-by-Step Fix Procedure

### 1. **Update Frontend Vite Configuration**
- Replace `frontend/vite.config.ts` with enhanced version from PART 1
- Adds proxy error logging and debugging

### 2. **Update Frontend Environment**
- Ensure `frontend/.env` has correct API URL (see PART 2)

### 3. **Update Frontend API Handler**
- Replace `frontend/src/api.js` with enhanced version from PART 4 & 6
- Adds retry logic and detailed logging

### 4. **Update Backend Environment**
- Ensure `backend/.env` has correct PORT and MONGO_URL (see PART 5)

### 5. **Verify Backend Routes**
- Confirm `backend/routes/admin.routes.js` exports router properly
- Verify error handling in `/driver-locations` route

### 6. **Start Backend Server**
```bash
cd backend
npm install
npm start
```

### 7. **Start Frontend Development Server**
```bash
cd frontend
npm install
npm run dev
```

### 8. **Test API Call**
```bash
# In browser console or Postman:
curl -H "Authorization: Bearer <token>" http://localhost:4000/api/admin/driver-locations
```

---

## Troubleshooting Common Issues

### Issue: Port 4000 Already in Use
```bash
# Find process on port 4000
netstat -ano | findstr :4000

# Kill process (replace PID)
taskkill /PID <PID> /F

# Or change PORT in backend/.env
PORT=4001
# Then update vite.config.ts target to http://localhost:4001
```

### Issue: MongoDB Connection Timeout
```bash
# Test MongoDB connectivity
mongosh "<MONGO_URL>"

# Verify connection string has correct:
# - Username
# - Password (URL-encoded)
# - Server addresses
# - Replica set name
# - SSL enabled if required
```

### Issue: CORS Errors
- Ensure `changeOrigin: true` in Vite proxy config
- Verify backend CORS middleware (if any)

### Issue: Authentication Fails on /driver-locations
- Verify JWT token is valid
- Check `requireAdmin` middleware in `backend/middleware/auth.js`
- Confirm user has admin role in database

---

## Verification Checklist

- [ ] Backend running on port 4000
- [ ] `http://localhost:4000/api/health` returns 200 + connected database
- [ ] Frontend running on port 5173
- [ ] Vite proxy logs show requests forwarding to backend
- [ ] `/api/admin/driver-locations` returns 200 with locations array
- [ ] No ECONNREFUSED errors in console
- [ ] MongoDB connection established
- [ ] Admin user authenticated with valid JWT token

---

## Production Deployment Notes

When deploying to production:

1. **Update environment variables**
   ```env
   # Production backend
   FRONTEND_URL=https://yourdomain.com
   MONGO_URL=<production-connection-string>
   
   # Production frontend
   VITE_API_URL=https://yourdomain.com/api
   VITE_SOCKET_URL=https://yourdomain.com
   ```

2. **Disable Vite proxy** (backend serves frontend in prod)
   - Frontend built to `frontend/dist`
   - Backend serves static files from dist

3. **Ensure HTTPS/SSL** for production

4. **Update CORS** if frontend domain differs from backend

---

## Support & Debugging

If issues persist:

1. Check console logs for exact error message
2. Verify all environment variables are set correctly
3. Test backend health: `http://localhost:4000/api/health`
4. Run backend with verbose logging: `DEBUG=* npm start`
5. Check Firebase configuration if auth fails
6. Verify MongoDB credentials and network access
