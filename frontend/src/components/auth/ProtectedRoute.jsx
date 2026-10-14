import { useEffect } from 'react';

/**
 * ProtectedRoute Component
 * Enforces role-based access control and redirects unauthorized users
 * @param {object} props
 * @param {React.Component} props.component - Component to render
 * @param {string} props.requiredRole - Required role for access
 * @param {object} props.user - Current user
 * @param {string} props.token - Auth token
 * @param {function} props.onNavigate - Callback to handle navigation
 * @param {boolean} props.isLoading - Loading state
 * @returns {React.ReactElement}
 */
export default function ProtectedRoute({
  component: Component,
  requiredRole,
  user,
  token,
  onNavigate,
  isLoading = false,
}) {
  useEffect(() => {
    // If not loading and no token, redirect to login
    if (!isLoading && !token) {
      onNavigate('login');
      return;
    }

    // If user exists but role doesn't match, redirect appropriately
    if (!isLoading && user && user.role !== requiredRole) {
      console.warn(
        `[SECURITY] Access denied: User with role '${user.role}' attempted to access '${requiredRole}' route`,
        { timestamp: new Date().toISOString() }
      );

      // Redirect to user's correct dashboard
      switch (user.role) {
        case 'admin':
          onNavigate('admin');
          break;
        case 'parent':
          onNavigate('parent');
          break;
        case 'driver':
          onNavigate('driver');
          break;
        default:
          onNavigate('login');
      }
    }
  }, [token, user, requiredRole, isLoading, onNavigate]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="flex flex-col items-center gap-4">
          {/* Loading spinner */}
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 text-sm">Loading application...</p>
        </div>
      </div>
    );
  }

  // User is not authenticated
  if (!token || !user) {
    return null;
  }

  // User role doesn't match
  if (user.role !== requiredRole) {
    return null;
  }

  // User is authorized, render the component
  return <Component />;
}
