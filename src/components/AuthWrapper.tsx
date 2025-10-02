import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import LoginForm from './LoginForm';

interface AuthWrapperProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  requireAdmin?: boolean;
  fallback?: React.ReactNode;
}

const AuthWrapper: React.FC<AuthWrapperProps> = ({ 
  children, 
  requireAuth = true,
  requireAdmin = false,
  fallback 
}) => {
  const { user, userProfile, isLoading, isAuthenticated, isAdmin } = useAuth();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-lighter via-brand-light to-brand-medium">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-dark mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If authentication is required but user is not authenticated, show login
  if (requireAuth && !isAuthenticated) {
    return <LoginForm />;
  }

  // If user is authenticated but has no profile, show error
  if (isAuthenticated && !userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-lighter via-brand-light to-brand-medium p-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-6">
            <h2 className="text-lg font-semibold text-yellow-800 mb-2">
              Account Setup Required
            </h2>
            <p className="text-sm text-yellow-700 mb-4">
              Your account exists but hasn't been assigned a role yet. Please contact your administrator to complete your account setup.
            </p>
            <p className="text-xs text-yellow-600">
              User ID: {user?.id}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // If admin access is required but user is not admin, show unauthorized
  if (requireAdmin && !isAdmin) {
    if (fallback) {
      return <>{fallback}</>;
    }
    
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-lighter via-brand-light to-brand-medium p-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-red-50 border border-red-200 rounded-md p-6">
            <h2 className="text-lg font-semibold text-red-800 mb-2">
              Access Denied
            </h2>
            <p className="text-sm text-red-700">
              You don't have permission to access this feature. Administrator access is required.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // All checks passed, render children
  return <>{children}</>;
};

export default AuthWrapper;