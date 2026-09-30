import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function ProtectedRoute({
  children,
  requireSuperAdmin = false,
  allowedRoles,
  requireFirstLogin = false,
  blockFirstLogin = false,
  unauthorizedTo = '/unauthorized',
}) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // If password reset isn't needed anymore, send students to their own dashboard
  if (requireFirstLogin && !user?.firstLogin) {
    const defaultHome = user?.role === 'STUDENT' ? '/student/dashboard' : '/dashboard';
    return <Navigate to={defaultHome} replace />;
  }

  if (blockFirstLogin && user?.firstLogin) {
    return <Navigate to="/reset-password" replace />;
  }

  const permittedRoles = requireSuperAdmin ? ['SUPER_ADMIN'] : allowedRoles;

  if (permittedRoles?.length && !permittedRoles.includes(user?.role)) {
    // Redirect unpermitted students directly to their own dashboard
    const redirectPath = user?.role === 'STUDENT' ? '/student/dashboard' : unauthorizedTo;
    return <Navigate to={redirectPath} replace state={{ from: location }} />;
  }

  return children;
}

export default ProtectedRoute;