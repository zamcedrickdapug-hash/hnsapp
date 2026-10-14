/**
 * HNSAPP Authentication Constants
 * Centralized configuration for auth system
 */

// ============================================
// ROLES
// ============================================

export const ROLES = {
  ADMIN: 'admin',
  DRIVER: 'driver',
  PARENT: 'parent',
};

export const ROLE_LABELS = {
  admin: 'Admin',
  driver: 'Driver',
  parent: 'Parent',
};

// ============================================
// ROLE DESCRIPTIONS
// ============================================

export const ROLE_DESCRIPTIONS = {
  parent: {
    title: 'Parent Account',
    subtitle: 'Book transportation for your children',
    description: 'Monitor your child in real-time, track routes, communicate with drivers, and ensure safety.',
    icon: '👨‍👩‍👧',
    features: [
      'Book transportation for multiple children',
      'Real-time GPS tracking',
      'Driver safety verification',
      'Emergency notifications',
      'Trip history and ratings',
    ],
    permissions: 'Access parent dashboard only',
    verification: 'Email verification required',
  },
  driver: {
    title: 'Driver Account',
    subtitle: 'Manage your professional deliveries',
    description: 'Accept trips, manage routes, communicate with parents, and maintain safety compliance.',
    icon: '🚗',
    features: [
      'Accept and manage trip assignments',
      'Route optimization',
      'Real-time communication',
      'Safety scoring system',
      'Earnings tracking',
    ],
    permissions: 'Access driver dashboard only',
    verification: 'License and background checks required',
  },
  admin: {
    title: 'Admin Account',
    subtitle: 'Oversee operational system',
    description: 'Monitor fleet, manage drivers, investigate incidents, and maintain system compliance.',
    icon: '⚙️',
    features: [
      'Fleet management',
      'Driver verification',
      'Incident investigation',
      'Safety analytics',
      'System compliance reports',
    ],
    permissions: 'Access admin panel only',
    verification: 'Admin credentials required',
  },
};

// ============================================
// ROUTES
// ============================================

export const AUTH_ROUTES = {
  LOGIN: '/login',
  SIGNUP: '/signup',
  DRIVER_APPLY: '/driver/apply',
  FORGOT_PASSWORD: '/auth/forgot-password',
  VERIFY_EMAIL: '/auth/verify-email',
};

export const PROTECTED_ROUTES = {
  ADMIN: '/admin',
  PARENT: '/dashboard/parent',
  DRIVER: '/dashboard/driver',
};

// ============================================
// API ENDPOINTS
// ============================================

export const AUTH_API = {
  VERIFY_TOKEN: '/api/auth/verify-firebase-token',
  GET_CURRENT_USER: '/api/auth/me',
  LOGOUT: '/api/auth/logout',
  SIGNUP: '/api/auth/signup',
  LOGIN: '/api/auth/login',
};

// ============================================
// SESSION
// ============================================

export const SESSION_CONFIG = {
  TOKEN_KEY: 'hns_token',
  USER_KEY: 'hns_user',
  REMEMBER_ME_KEY: 'hns_remember_me',
  SESSION_TIMEOUT_MS: 24 * 60 * 60 * 1000, // 24 hours
};

// ============================================
// VALIDATION
// ============================================

export const VALIDATION = {
  MIN_PASSWORD_LENGTH: 8,
  MAX_PASSWORD_LENGTH: 128,
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE_REGEX: /^(09|\+639|639)\d{9}$/,
  LICENSE_NUMBER_REGEX: /^[A-Z0-9\-]{5,20}$/,
  PLATE_NUMBER_REGEX: /^[A-Z0-9\-]{4,8}$/,
};

export const normalizePhoneNumber = (value) => {
  if (typeof value !== 'string') return '';
  const compact = value.replace(/[\s-]/g, '');
  if (!VALIDATION.PHONE_REGEX.test(compact)) return '';
  if (compact.startsWith('09')) return `+63${compact.slice(1)}`;
  return compact.startsWith('+') ? compact : `+${compact}`;
};

export const isValidPhoneNumber = (value) => (
  typeof value === 'string' && VALIDATION.PHONE_REGEX.test(value.replace(/[\s-]/g, ''))
);

// ============================================
// BUSINESS RULES
// ============================================

export const ACCOUNT_STATUS = {
  PENDING: 'pending',
  REVIEWING: 'reviewing',
  APPROVED: 'approved',
  DECLINED: 'declined',
  SUSPENDED: 'suspended',
  BANNED: 'banned',
};

export const ACCOUNT_STATE = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  BANNED: 'banned',
};

// ============================================
// ROLE ROUTING
// ============================================

/**
 * Gets the default route for a role after login
 * @param {string} role - User role
 * @returns {string} - Route path
 */
export function getDefaultRouteForRole(role) {
  switch (role) {
    case ROLES.ADMIN:
      return PROTECTED_ROUTES.ADMIN;
    case ROLES.PARENT:
      return PROTECTED_ROUTES.PARENT;
    case ROLES.DRIVER:
      return PROTECTED_ROUTES.DRIVER;
    default:
      return '/';
  }
}

/**
 * Checks if a user has access to a route
 * @param {string} userRole - User's role
 * @param {string} route - Route path
 * @returns {boolean}
 */
export function canAccessRoute(userRole, route) {
  if (route.includes('admin')) return userRole === ROLES.ADMIN;
  if (route.includes('parent')) return userRole === ROLES.PARENT;
  if (route.includes('driver')) return userRole === ROLES.DRIVER;
  return false;
}

// ============================================
// ERROR MESSAGES
// ============================================

export const AUTH_ERRORS = {
  NO_TOKEN: 'Authentication token is required.',
  INVALID_TOKEN: 'Invalid or expired authentication token.',
  UNAUTHORIZED: 'You are not authorized to access this resource.',
  FORBIDDEN: 'Access forbidden for your account type.',
  USER_NOT_FOUND: 'User not found.',
  INVALID_CREDENTIALS: 'Invalid email address or password.',
  EMAIL_NOT_VERIFIED: 'Please verify your email address before logging in.',
  ACCOUNT_SUSPENDED: 'Your account has been suspended. Please contact support.',
  ACCOUNT_BANNED: 'Your account has been banned. Please contact support.',
  INVALID_ROLE: 'Invalid user role.',
};

// ============================================
// SUCCESS MESSAGES
// ============================================

export const AUTH_SUCCESS = {
  LOGIN: 'Login successful. Redirecting...',
  SIGNUP: 'Account created successfully. Please check your email for verification.',
  LOGOUT: 'Logged out successfully.',
  PASSWORD_RESET: 'Password reset email sent. Check your inbox.',
};
