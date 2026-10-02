import React from 'react';
import { useAuth } from '../contexts/AuthContext';

interface AdminOnlyProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const AdminOnly: React.FC<AdminOnlyProps> = ({ children, fallback = null }) => {
  const { isAdmin } = useAuth();
  return isAdmin ? <>{children}</> : <>{fallback}</>;
};

interface AuthenticatedOnlyProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const AuthenticatedOnly: React.FC<AuthenticatedOnlyProps> = ({ children, fallback = null }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <>{fallback}</>;
};

interface NormalUserOnlyProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const NormalUserOnly: React.FC<NormalUserOnlyProps> = ({ children, fallback = null }) => {
  const { isNormalUser } = useAuth();
  return isNormalUser ? <>{children}</> : <>{fallback}</>;
};

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
  const shouldShow = (!requireAuth || isAuthenticated) && (!requireAdmin || isAdmin);
  if (!shouldShow) return null;
  return <button {...props}>{children}</button>;
};

export const RoleIndicator: React.FC = () => {
  const { userProfile, isAuthenticated } = useAuth();
  if (!isAuthenticated || !userProfile) return null;

  const isAdminRole = userProfile.role === 'admin';

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-bold uppercase tracking-wide border ${
        isAdminRole
          ? 'bg-(--color-ink) text-white border-(--color-ink)'
          : 'bg-(--color-green-bright)/15 text-(--color-green-deep) border-(--color-green-deep)'
      }`}
    >
      {userProfile.role}
    </span>
  );
};

export const UserInfo: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-700">{user?.email}</span>
      <RoleIndicator />
    </div>
  );
};
