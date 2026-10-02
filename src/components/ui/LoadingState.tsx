import React from 'react';

interface LoadingStateProps {
  label?: string;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ label = 'Loading...', className = '' }) => (
  <div className={`flex items-center justify-center gap-2 py-6 text-sm text-gray-500 ${className}`}>
    <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-(--color-ink)" />
    {label}
  </div>
);
