import { useEffect } from 'react';

/**
 * useAuthGuard - Enforces role-based access control
 * Redirects unauthorized users based on their role
 * @param {string} requiredRole - Required role (e.g., 'admin', 'parent', 'driver')
 * @param {object} user - Current user object
 * @param {function} onUnauthorized - Callback when user is unauthorized
 */
export function useAuthGuard(requiredRole, user, onUnauthorized) {
  useEffect(() => {
    if (!user) {
      onUnauthorized('no-user');
      return;
    }

    if (user.role !== requiredRole) {
      onUnauthorized('invalid-role');
      return;
    }
  }, [user, requiredRole, onUnauthorized]);
}

/**
 * useRoleCheck - Checks if user has a specific role
 * @param {string} role - Role to check
 * @param {object} user - Current user
 * @returns {boolean}
 */
export function useRoleCheck(role, user) {
  return user?.role === role;
}

/**
 * useHasRole - Checks if user has one of multiple roles
 * @param {array} roles - Roles to check
 * @param {object} user - Current user
 * @returns {boolean}
 */
export function useHasRole(roles, user) {
  return user && roles.includes(user.role);
}

/**
 * useIsAdmin - Checks if user is admin
 * @param {object} user - Current user
 * @returns {boolean}
 */
export function useIsAdmin(user) {
  return user?.role === 'admin';
}

/**
 * useIsDriver - Checks if user is driver
 * @param {object} user - Current user
 * @returns {boolean}
 */
export function useIsDriver(user) {
  return user?.role === 'driver';
}

/**
 * useIsParent - Checks if user is parent
 * @param {object} user - Current user
 * @returns {boolean}
 */
export function useIsParent(user) {
  return user?.role === 'parent';
}
