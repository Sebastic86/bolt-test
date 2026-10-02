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
  fallback,
}) => {
  const { user, userProfile, isLoading, isAuthenticated, isAdmin } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-0 flex-1 items-center-safe justify-center overflow-y-auto bg-[#fafafa]">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-gray-200 border-t-(--color-ink)" />
          <p className="mt-4 text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (requireAuth && !isAuthenticated) {
    return <LoginForm />;
  }

  if (isAuthenticated && !userProfile) {
    return (
      <div className="flex min-h-0 flex-1 items-center-safe justify-center overflow-y-auto bg-[#fafafa] p-4">
        <div className="w-full max-w-md border-2 border-(--color-ink) bg-white p-6 text-center">
          <h2 className="text-lg font-black uppercase tracking-wide text-(--color-ink)">
            Account Setup Required
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Your account exists but hasn't been assigned a role yet. Please contact your administrator to complete your account setup.
          </p>
          <p className="mt-4 text-xs text-gray-400">User ID: {user?.id}</p>
        </div>
      </div>
    );
  }

  if (requireAdmin && !isAdmin) {
    if (fallback) return <>{fallback}</>;

    return (
      <div className="flex min-h-0 flex-1 items-center-safe justify-center overflow-y-auto bg-[#fafafa] p-4">
        <div className="w-full max-w-md border-2 border-(--color-ink) bg-white p-6 text-center">
          <h2 className="text-lg font-black uppercase tracking-wide text-red-700">
            Access Denied
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            You don't have permission to access this feature. Administrator access is required.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default AuthWrapper;
