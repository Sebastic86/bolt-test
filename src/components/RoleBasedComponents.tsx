import React from 'react';
import { useAuth } from '../contexts/AuthContext';

// Component that only renders for admin users
interface AdminOnlyProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const AdminOnly: React.FC<AdminOnlyProps> = ({ children, fallback = null }) => {
  const { isAdmin } = useAuth();
  return isAdmin ? <>{children}</> : <>{fallback}</>;
};

// Component that only renders for authenticated users
interface AuthenticatedOnlyProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const AuthenticatedOnly: React.FC<AuthenticatedOnlyProps> = ({ children, fallback = null }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <>{fallback}</>;
};

// Component that only renders for normal users (not admins)
interface NormalUserOnlyProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const NormalUserOnly: React.FC<NormalUserOnlyProps> = ({ children, fallback = null }) => {
  const { isNormalUser } = useAuth();
  return isNormalUser ? <>{children}</> : <>{fallback}</>;
};

// Conditional button that shows/hides based on permissions
interface ConditionalButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  requireAuth?: boolean;
  requireAdmin?: boolean;
  children: React.ReactNode;
}

export const ConditionalButton: React.FC<ConditionalButtonProps> = ({ 
  requireAuth = false, 
  requireAdmin = false, 
  children, 
  ...props 
}) => {
  const { isAuthenticated, isAdmin } = useAuth();

  // Check if button should be shown
  const shouldShow = (!requireAuth || isAuthenticated) && (!requireAdmin || isAdmin);

  if (!shouldShow) {
    return null;
  }

  return <button {...props}>{children}</button>;
};

// Role indicator component
export const RoleIndicator: React.FC = () => {
  const { user, userProfile, isAuthenticated } = useAuth();

  if (!isAuthenticated || !userProfile) {
    return null;
  }

  const roleColor = userProfile.role === 'admin' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800';

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${roleColor}`}>
      {userProfile.role}
    </span>
  );
};

// User info component
export const UserInfo: React.FC = () => {
  const { user, userProfile, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm text-gray-700">{user?.email}</span>
      <RoleIndicator />
    </div>
  );
};