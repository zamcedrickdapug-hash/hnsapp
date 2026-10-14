# ECONNREFUSED Fix - Code Reference & Examples

## Quick Code Snippets

### 1. Test Backend Connection in Browser Console

```javascript
// Test 1: Health check
fetch('http://localhost:4000/api/health')
  .then(r => r.json())
  .then(data => console.log('✅ Backend OK:', data))
  .catch(err => console.error('❌ Backend error:', err.message))

// Test 2: With timeout
const controller = new AbortController()
const timeoutId = setTimeout(() => controller.abort(), 5000)

fetch('http://localhost:4000/api/health', { signal: controller.signal })
  .then(r => r.json())
  .then(data => {
    clearTimeout(timeoutId)
    console.log('✅ Response:', data)
  })
  .catch(err => console.error('❌ Error:', err.message))

// Test 3: Admin endpoint with token
const token = localStorage.getItem('authToken')
fetch('http://localhost:4000/api/admin/driver-locations', {
  headers: { Authorization: `Bearer ${token}` }
})
  .then(r => r.json())
  .then(data => console.log('✅ Locations:', data.total, 'drivers'))
  .catch(err => console.error('❌ Error:', err.message))
```

---

### 2. Check Backend Status from Terminal

```bash
#!/bin/bash
# health-check.sh

echo "🔍 Checking backend health..."

# Test 1: Port listening
if netstat -ano | grep -q ":4000"; then
  echo "✅ Port 4000 is listening"
else
  echo "❌ Port 4000 is NOT listening"
  exit 1
fi

# Test 2: HTTP health endpoint
RESPONSE=$(curl -s -w "\n%{http_code}" http://localhost:4000/api/health)
STATUS=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$STATUS" = "200" ]; then
  echo "✅ Backend responding: $BODY"
else
  echo "❌ Backend error (HTTP $STATUS): $BODY"
  exit 1
fi

# Test 3: Database connection
if echo "$BODY" | grep -q '"database":"connected"'; then
  echo "✅ MongoDB connected"
else
  echo "⚠️  MongoDB still connecting..."
fi

echo "✅ All checks passed!"
```

---

### 3. Monitor Backend Logs in Real-time

```bash
#!/bin/bash
# watch-backend.sh

cd backend

echo "📊 Monitoring backend logs..."
echo "Press Ctrl+C to stop"
echo ""

npm start 2>&1 | while read line; do
  # Color error lines red
  if [[ $line == *"ERROR"* ]] || [[ $line == *"Error"* ]] || [[ $line == *"error"* ]]; then
    echo -e "\033[31m$line\033[0m"
  # Color API response lines green
  elif [[ $line == *"RESPONSE"* ]]; then
    echo -e "\033[32m$line\033[0m"
  # Color request lines blue
  elif [[ $line == *"REQUEST"* ]]; then
    echo -e "\033[34m$line\033[0m"
  else
    echo "$line"
  fi
done
```

---

### 4. Diagnose Connection Issues

```javascript
// diagnostic.js - Run in backend console

async function diagnoseBackend() {
  const results = {
    timestamp: new Date().toISOString(),
    checks: {}
  }

  // Check 1: Backend listening
  try {
    const response = await fetch('http://localhost:4000/api/health')
    results.checks.backendListening = {
      status: 'OK',
      httpStatus: response.status
    }
  } catch (error) {
    results.checks.backendListening = {
      status: 'FAILED',
      error: error.message
    }
  }

  // Check 2: MongoDB
  try {
    const response = await fetch('http://localhost:4000/api/health')
    const data = await response.json()
    results.checks.mongoDatabase = {
      status: data.database,
      connected: data.database === 'connected'
    }
  } catch (error) {
    results.checks.mongoDatabase = {
      status: 'ERROR',
      error: error.message
    }
  }

  // Check 3: Admin routes
  try {
    const token = localStorage.getItem('authToken')
    if (!token) throw new Error('No auth token found')
    
    const response = await fetch('http://localhost:4000/api/admin/driver-locations', {
      headers: { Authorization: `Bearer ${token}` }
    })
    results.checks.adminRoute = {
      status: 'OK',
      httpStatus: response.status
    }
  } catch (error) {
    results.checks.adminRoute = {
      status: 'ERROR',
      error: error.message
    }
  }

  console.table(results.checks)
  return results
}

// Run diagnostic
diagnoseBackend().then(results => console.log(JSON.stringify(results, null, 2)))
```

---

### 5. Test Retry Logic

```javascript
// test-retry.js

async function testRetryLogic() {
  console.log('🧪 Testing API retry mechanism...')
  
  // Simulate network failures
  let attemptCount = 0
  const maxRetries = 3
  const retryDelay = 1000

  async function fetchWithRetry(url, retries = 0) {
    try {
      attemptCount++
      console.log(`📡 Attempt ${attemptCount}...`)
      
      const response = await fetch(url, { timeout: 5000 })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      
      console.log(`✅ Success on attempt ${attemptCount}`)
      return await response.json()
    } catch (error) {
      if (retries < maxRetries) {
        console.log(`⏳ Retrying in ${retryDelay}ms...`)
        await new Promise(r => setTimeout(r, retryDelay))
        return fetchWithRetry(url, retries + 1)
      }
      console.error(`❌ Failed after ${maxRetries} retries`)
      throw error
    }
  }

  try {
    const data = await fetchWithRetry('http://localhost:4000/api/health')
    console.log('✅ Final result:', data)
  } catch (error) {
    console.error('❌ Failed:', error.message)
  }
}

testRetryLogic()
```

---

### 6. Monitor Proxy Requests

```javascript
// frontend/src/middleware/proxyMonitor.js

export function setupProxyMonitoring() {
  const originalFetch = window.fetch

  window.fetch = function(...args) {
    const [url, options] = args
    const isProxied = url.startsWith('/api')
    
    if (isProxied) {
      const startTime = Date.now()
      const method = options?.method || 'GET'
      
      console.log(`[PROXY MONITOR] → ${method} ${url}`)
      
      return originalFetch.apply(this, args)
        .then(response => {
          const duration = Date.now() - startTime
          console.log(`[PROXY MONITOR] ← ${response.status} ${method} ${url} (${duration}ms)`)
          return response
        })
        .catch(error => {
          const duration = Date.now() - startTime
          console.error(`[PROXY MONITOR] ✗ ${method} ${url} (${duration}ms)`, error.message)
          throw error
        })
    }
    
    return originalFetch.apply(this, args)
  }
}

// Use in main.jsx or App.jsx
setupProxyMonitoring()
```

---

### 7. Environment Setup Script

```bash
#!/bin/bash
# setup-env.sh

echo "🔧 Setting up environment variables..."

# Create backend/.env if not exists
if [ ! -f backend/.env ]; then
  echo "📝 Creating backend/.env..."
  cat > backend/.env << 'EOF'
PORT=4000
NODE_ENV=development
MONGO_URL=YOUR_MONGODB_CONNECTION_STRING
FRONTEND_URL=http://localhost:5173
JWT_SECRET=your-secret-key-here
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
MAIL_FROM_EMAIL=your-email@gmail.com
MAIL_FROM_NAME=HNS App
FIREBASE_ADMIN_SDK_PATH=./serviceAccountKey.json
EOF
  echo "✅ backend/.env created"
else
  echo "✓ backend/.env already exists"
fi

# Create frontend/.env if not exists
if [ ! -f frontend/.env ]; then
  echo "📝 Creating frontend/.env..."
  cat > frontend/.env << 'EOF'
VITE_API_URL=http://localhost:4000/api
VITE_SOCKET_URL=http://localhost:4000
VITE_FIREBASE_API_KEY=AIzaSyDK780OVIE77SPLsg3OA1RKIacaKCGhNXc
VITE_FIREBASE_AUTH_DOMAIN=hnsapp-f9f67.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=hnsapp-f9f67
VITE_FIREBASE_STORAGE_BUCKET=hnsapp-f9f67.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=785102853021
VITE_FIREBASE_APP_ID=1:785102853021:web:4bbd007bf313f756931574
EOF
  echo "✅ frontend/.env created"
else
  echo "✓ frontend/.env already exists"
fi

echo "✅ Environment setup complete!"
echo ""
echo "Next steps:"
echo "1. Backend: npm run dev (or npm start)"
echo "2. Frontend: npm run dev"
echo "3. Open http://localhost:5173"
```

---

### 8. Docker Compose for Local Development

```yaml
# docker-compose.dev.yml

version: '3.8'

services:
  mongodb:
    image: mongo:7.0
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_ROOT_USERNAME: root
      MONGO_INITDB_ROOT_PASSWORD: root
    volumes:
      - mongodb_data:/data/db
    networks:
      - hns-network

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.dev
    ports:
      - "4000:4000"
    environment:
      NODE_ENV: development
      PORT: 4000
      MONGO_URL: YOUR_MONGODB_CONNECTION_STRING
      FRONTEND_URL: http://localhost:5173
    depends_on:
      - mongodb
    volumes:
      - ./backend:/app
      - /app/node_modules
    networks:
      - hns-network

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    ports:
      - "5173:5173"
    environment:
      VITE_API_URL: http://localhost:4000/api
      VITE_SOCKET_URL: http://localhost:4000
    volumes:
      - ./frontend:/app
      - /app/node_modules
    networks:
      - hns-network

volumes:
  mongodb_data:

networks:
  hns-network:
    driver: bridge
```

Usage:
```bash
docker-compose -f docker-compose.dev.yml up
```

---

### 9. Kubernetes Health Probe Configuration

```yaml
# backend-deployment.yaml

apiVersion: apps/v1
kind: Deployment
metadata:
  name: hns-backend
spec:
  replicas: 2
  template:
    spec:
      containers:
      - name: backend
        image: hns-backend:latest
        ports:
        - containerPort: 4000
        
        # Liveness probe - restart if not responding
        livenessProbe:
          httpGet:
            path: /api/health
            port: 4000
          initialDelaySeconds: 10
          periodSeconds: 10
          
        # Readiness probe - only send traffic when ready
        readinessProbe:
          httpGet:
            path: /api/health
            port: 4000
          initialDelaySeconds: 5
          periodSeconds: 5
        
        env:
        - name: PORT
          value: "4000"
        - name: MONGO_URL
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: mongo-url
```

---

### 10. GitHub Actions CI/CD Health Check

```yaml
# .github/workflows/health-check.yml

name: Health Check

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  backend-health:
    runs-on: ubuntu-latest
    
    services:
      mongodb:
        image: mongo:7.0
        options: >-
          --health-cmd mongosh
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 27017:27017
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '20'
    
    - name: Install dependencies
      run: cd backend && npm install
    
    - name: Start backend
      run: cd backend && npm start &
      env:
        MONGO_URL: mongodb://127.0.0.1:27017/hs_app
        PORT: 4000
    
    - name: Wait for backend
      run: sleep 5
    
    - name: Health check
      run: curl -f http://localhost:4000/api/health
    
    - name: Test admin route
      run: |
        TOKEN=$(node -e "console.log(require('jsonwebtoken').sign({role:'admin'}, 'test'))")
        curl -f -H "Authorization: Bearer $TOKEN" http://localhost:4000/api/admin/driver-locations || true
```

---

### 11. Performance Profiling

```javascript
// performance-profile.js

class APIProfiler {
  constructor() {
    this.requests = []
  }

  async profileRequest(path, options = {}) {
    const profile = {
      path,
      startTime: performance.now(),
      method: options.method || 'GET'
    }

    try {
      const response = await fetch(path, options)
      const data = await response.json()
      
      profile.endTime = performance.now()
      profile.duration = profile.endTime - profile.startTime
      profile.status = response.status
      profile.success = true
      
      return { data, profile }
    } catch (error) {
      profile.endTime = performance.now()
      profile.duration = profile.endTime - profile.startTime
      profile.error = error.message
      profile.success = false
      
      throw error
    } finally {
      this.requests.push(profile)
    }
  }

  getStats() {
    const successful = this.requests.filter(r => r.success)
    const failed = this.requests.filter(r => !r.success)
    const durations = successful.map(r => r.duration)

    return {
      total: this.requests.length,
      successful: successful.length,
      failed: failed.length,
      averageDuration: durations.length > 0 
        ? (durations.reduce((a, b) => a + b) / durations.length).toFixed(2)
        : 0,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations)
    }
  }

  printReport() {
    console.table(this.requests)
    console.log('📊 Statistics:', this.getStats())
  }
}

// Usage
const profiler = new APIProfiler()

async function testAPIs() {
  try {
    await profiler.profileRequest('/api/health')
    await profiler.profileRequest('/api/admin/driver-locations', {
      headers: { Authorization: `Bearer ${token}` }
    })
    profiler.printReport()
  } catch (error) {
    console.error('Test failed:', error)
    profiler.printReport()
  }
}

testAPIs()
```

---

## Complete Debugging Flow

```javascript
// Complete debugging flow for ECONNREFUSED

async function debugECONNREFUSED() {
  console.log('🔍 Starting ECONNREFUSED diagnostic...\n')

  // Step 1: Check backend port
  console.log('Step 1️⃣: Checking port 4000...')
  try {
    const response = await fetch('http://localhost:4000/api/health', { timeout: 2000 })
    console.log('✅ Port 4000 is open')
  } catch (error) {
    console.error('❌ Port 4000 not responding:', error.message)
    console.log('💡 Fix: Run "cd backend && npm start"')
    return
  }

  // Step 2: Check MongoDB
  console.log('\nStep 2️⃣: Checking MongoDB...')
  const healthResponse = await fetch('http://localhost:4000/api/health')
  const health = await healthResponse.json()
  if (health.database === 'connected') {
    console.log('✅ MongoDB connected')
  } else {
    console.warn('⚠️  MongoDB state:', health.database)
    console.log('💡 Fix: Check MONGO_URL in backend/.env')
  }

  // Step 3: Check authentication
  console.log('\nStep 3️⃣: Checking authentication...')
  const token = localStorage.getItem('authToken')
  if (!token) {
    console.error('❌ No auth token')
    console.log('💡 Fix: Login first')
    return
  }
  console.log('✅ Auth token found')

  // Step 4: Test admin route
  console.log('\nStep 4️⃣: Testing admin route...')
  try {
    const response = await fetch('/api/admin/driver-locations', {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (response.ok) {
      const data = await response.json()
      console.log('✅ Admin route working, found', data.total, 'drivers')
    } else {
      console.error('❌ Admin route returned:', response.status)
    }
  } catch (error) {
    console.error('❌ Admin route failed:', error.message)
  }

  console.log('\n✅ Diagnostic complete!')
}

// Run it
debugECONNREFUSED()
```

---

## Key Takeaways

1. **ECONNREFUSED** = Backend not running or port not open
2. **503 Service Unavailable** = Backend is unavailable
3. **401 Unauthorized** = Auth token missing/invalid
4. **403 Forbidden** = User doesn't have permission
5. **500 Internal Server Error** = Backend error (check logs)

Always check:
- ✅ Backend is running
- ✅ Port 4000 is listening
- ✅ MongoDB is connected
- ✅ Environment variables are set
- ✅ Auth token is valid
