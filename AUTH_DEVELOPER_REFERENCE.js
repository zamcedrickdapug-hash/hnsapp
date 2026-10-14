/**
 * HNSAPP ENTERPRISE AUTH SYSTEM - DEVELOPER REFERENCE
 * 
 * Quick guide for using the new modern authentication system
 */

// ============================================
// USING NEW AUTHENTICATION COMPONENTS
// ============================================

/**
 * LOGIN PAGE USAGE
 * 
 * Component: LoginPageEnterprise
 * Location: src/page/login/LoginPageEnterprise.jsx
 * 
 * Props:
 * - onLoggedIn: (response) => void // Called when login successful
 * - onSignUpClick: () => void      // Called when signup button clicked
 */

import LoginPageEnterprise from './page/login/LoginPageEnterprise';

// In your app:
<LoginPageEnterprise 
  onLoggedIn={(response) => {
    // response contains { token, user }
    // Handle navigation to dashboard
  }}
  onSignUpClick={() => {
    // Navigate to signup page
  }}
/>

// ============================================

/**
 * SIGNUP PAGE USAGE
 * 
 * Component: SignupPageEnterprise
 * Location: src/page/signup/SignupPageEnterprise.jsx
 * 
 * Props:
 * - onLoggedIn: (response) => void  // Called when signup successful
 * - onBackToLogin: () => void       // Called to go back to login
 */

import SignupPageEnterprise from './page/signup/SignupPageEnterprise';

// In your app:
<SignupPageEnterprise 
  onLoggedIn={(response) => {
    // Handle successful signup (rare, email verification required first)
  }}
  onBackToLogin={() => {
    // Navigate back to login
  }}
/>

// ============================================

/**
 * PROTECTED ROUTE USAGE
 * 
 * Component: ProtectedRoute
 * Location: src/components/auth/ProtectedRoute.jsx
 * 
 * Props:
 * - component: React.Component     // Component to render
 * - requiredRole: 'admin' | 'parent' | 'driver'
 * - user: AuthUser | null
 * - token: string | null
 * - onNavigate: (route) => void
 * - isLoading: boolean
 */

import ProtectedRoute from './components/auth/ProtectedRoute';

// In your app:
<ProtectedRoute
  component={AdminPanel}
  requiredRole="admin"
  user={user}
  token={token}
  onNavigate={(route) => setRoute(route)}
  isLoading={isLoading}
/>

// ============================================
// USING AUTH HOOKS
// ============================================

/**
 * USE AUTH GUARD
 * 
 * Location: src/hooks/useAuthGuard.js
 * 
 * Enforces a specific role and redirects on mismatch
 */

import { useAuthGuard } from './hooks/useAuthGuard';

function MyComponent({ user, onNavigate }) {
  useAuthGuard('admin', user, (reason) => {
    if (reason === 'no-user') {
      onNavigate('login');
    } else if (reason === 'invalid-role') {
      onNavigate('parent'); // Or correct dashboard
    }
  });
  
  // Component rendered only if user.role === 'admin'
  return <div>Admin content</div>;
}

// ============================================

/**
 * USE ROLE CHECK
 * 
 * Location: src/hooks/useAuthGuard.js
 * 
 * Returns boolean if user has specific role
 */

import { useRoleCheck, useIsAdmin, useIsDriver, useIsParent } from './hooks/useAuthGuard';

function MyComponent({ user }) {
  const isAdmin = useRoleCheck('admin', user);
  const admin = useIsAdmin(user);
  const driver = useIsDriver(user);
  const parent = useIsParent(user);
  
  if (!isAdmin) return null;
  return <div>Admin content</div>;
}

// ============================================

/**
 * USE HAS ROLE
 * 
 * Location: src/hooks/useAuthGuard.js
 * 
 * Check if user has ANY of multiple roles
 */

import { useHasRole } from './hooks/useAuthGuard';

function MyComponent({ user }) {
  const canAccess = useHasRole(['admin', 'parent'], user);
  
  if (!canAccess) return null;
  return <div>Admin or Parent content</div>;
}

// ============================================
// USING AUTH CONSTANTS
// ============================================

/**
 * AUTH CONSTANTS
 * 
 * Location: src/constants/authConstants.js
 * 
 * Centralized authentication configuration
 */

import {
  ROLES,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  AUTH_ROUTES,
  PROTECTED_ROUTES,
  SESSION_CONFIG,
  VALIDATION,
  getDefaultRouteForRole,
  canAccessRoute,
} from './constants/authConstants';

// Get route for a role
const route = getDefaultRouteForRole('parent'); // '/dashboard/parent'

// Check if user can access route
const canAccess = canAccessRoute('parent', '/dashboard/parent'); // true

// Validate email
const isValidEmail = VALIDATION.GMAIL_REGEX.test(email);

// Get role label
const label = ROLE_LABELS.admin; // 'Admin'

// Get role description
const desc = ROLE_DESCRIPTIONS.driver.title; // 'Driver Account'

// Session config
const token = localStorage.getItem(SESSION_CONFIG.TOKEN_KEY);

// ============================================
// ROLE-BASED ACCESS CONTROL EXAMPLES
// ============================================

/**
 * EXAMPLE 1: Redirect unauthorized access
 */

function App() {
  const [route, setRoute] = useState('login');
  const [user, setUser] = useState(null);

  // If parent tries to access admin route
  if (user && user.role === 'parent' && route === 'admin') {
    console.warn('[SECURITY] Parent attempted unauthorized access to admin');
    setRoute(getDefaultRouteForRole(user.role)); // Redirect to parent dashboard
  }

  return null;
}

// ============================================

/**
 * EXAMPLE 2: Conditional component rendering
 */

function Dashboard({ user, token }) {
  if (!token || !user) return <LoginPageEnterprise />;

  // Show role-specific content
  switch (user.role) {
    case 'admin':
      return <AdminPanel />;
    case 'parent':
      return <ParentDashboard />;
    case 'driver':
      return <DriverDashboard />;
    default:
      return <div>Invalid role</div>;
  }
}

// ============================================

/**
 * EXAMPLE 3: API calls with role validation
 */

async function getAdminData(token, user) {
  // Frontend role check
  if (user.role !== 'admin') {
    console.error('User is not admin');
    return null;
  }

  try {
    const response = await fetch('/api/admin/dashboard', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    // 403 if user role changed, or token tampered with
    if (response.status === 403) {
      console.error('Access denied by backend');
      return null;
    }

    return response.json();
  } catch (error) {
    console.error('API call failed:', error);
  }
}

// ============================================
// BACKEND MIDDLEWARE USAGE
// ============================================

/**
 * PROTECTING ROUTES WITH MIDDLEWARE
 * 
 * Location: backend/middleware/auth.js
 * 
 * Available middleware:
 * - requireAuth      // Any authenticated user
 * - requireAdmin     // Admin only
 * - requireParent    // Parent only
 * - requireDriver    // Driver only (NEW)
 * - requireApplicant // Parent or Driver
 */

// backend/routes/example.js

const { requireAdmin, requireDriver, requireParent } = require('../middleware/auth');
const router = require('express').Router();

// Admin only endpoints
router.get('/api/admin/dashboard', requireAdmin, (req, res) => {
  // Only admins can access
  res.json({ data: 'admin only' });
});

// Driver only endpoints (NEW)
router.post('/api/drivers/location', requireDriver, (req, res) => {
  // Only drivers can access
  res.json({ status: 'location updated' });
});

// Parent only endpoints
router.get('/api/parents/children', requireParent, (req, res) => {
  // Only parents can access
  res.json({ children: [] });
});

// Anyone authenticated
router.post('/api/trips', requireAuth, (req, res) => {
  // Any authenticated user
});

// ============================================
// SECURITY BEST PRACTICES
// ============================================

/**
 * DO's ✅
 */

// ✅ Always validate role before rendering components
if (user?.role === 'admin') {
  return <AdminPanel />;
}

// ✅ Use ProtectedRoute for dashboard components
<ProtectedRoute component={AdminPanel} requiredRole="admin" ... />

// ✅ Check role on backend for API calls
router.get('/api/admin/...', requireAdmin, handler);

// ✅ Redirect unauthorized users to their dashboard
if (user.role === 'parent' && route === 'admin') {
  setRoute('parent');
}

// ✅ Log security violations
console.warn('[SECURITY] Parent attempted unauthorized access to admin');

// ✅ Validate role format ['admin', 'parent', 'driver']
const validRoles = ['admin', 'parent', 'driver'];
if (!validRoles.includes(user.role)) {
  throw new Error('Invalid role');
}

// ============================================

/**
 * DON'Ts ❌
 */

// ❌ Don't trust role from localStorage alone
// const role = localStorage.getItem('user_role'); // Not safe

// ❌ Don't skip backend role validation
// router.get('/api/admin/...', requireAuth, handler); // Missing requireAdmin!

// ❌ Don't render components without role check
// return <AdminPanel />; // What if user.role is 'parent'?

// ❌ Don't trust frontend role validation alone
// if (user.role === 'admin') makeAdminAPICall(); // Need backend check too

// ❌ Don't allow role modification by users
// user.role = 'admin'; // NEVER do this

// ❌ Don't store sensitive data in localStorage
// localStorage.setItem('isAdmin', true); // Unsafe

// ============================================
// TROUBLESHOOTING
// ============================================

/**
 * Problem: User logged in but cannot access dashboard
 * 
 * Check:
 * 1. Role is valid: ['admin', 'parent', 'driver']
 * 2. Token is in localStorage
 * 3. Token is valid (not expired, not tampered)
 * 4. Backend session restore validates role
 * 5. ProtectedRoute has correct requiredRole prop
 * 
 * Solution:
 * - Clear localStorage and re-login
 * - Check browser console for logs
 * - Check network tab for 401/403 responses
 */

/**
 * Problem: Parent can access admin routes
 * 
 * This should NOT happen because:
 * 1. Frontend route protection prevents navigation
 * 2. ProtectedRoute prevents component rendering
 * 3. Backend requireAdmin prevents API access
 * 
 * If happening:
 * - Check ProtectedRoute is being used
 * - Check route protection is in place
 * - Check backend middleware is applied
 * - Check user.role is actually 'parent'
 */

/**
 * Problem: Role-based data not showing correctly
 * 
 * Check:
 * 1. API response includes user role
 * 2. Role stored correctly in state
 * 3. Components check role before rendering
 * 4. API calls sent with correct authorization header
 * 
 * Debug:
 * - console.log(user.role) at start of component
 * - Check Network tab API response for role
 * - Verify backend middleware is working
 */

// ============================================
// QUICK START CHECKLIST
// ============================================

/**
 * ✅ Implementation Checklist
 * 
 * [ ] Update App.tsx imports
 * [ ] Replace LoginPage with LoginPageEnterprise
 * [ ] Replace SignupPage with SignupPageEnterprise
 * [ ] Use ProtectedRoute for dashboards
 * [ ] Update role checking logic
 * [ ] Verify requireDriver middleware added
 * [ ] Test parent cannot access admin
 * [ ] Test driver cannot access parent
 * [ ] Test admin can access admin panel
 * [ ] Test session restoration works
 * [ ] Verify error messages display correctly
 * [ ] Check security logs in console
 * [ ] Test mobile responsiveness
 * [ ] Deploy to staging
 * [ ] Run UAT
 * [ ] Deploy to production
 */

// ============================================

export default {
  title: 'HNSAPP Enterprise Auth - Developer Reference',
  version: '1.0.0',
  lastUpdated: 'May 16, 2026',
};
