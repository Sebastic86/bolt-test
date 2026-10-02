import React from 'react';

interface ErrorStateProps {
  message: string;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ message, className = '' }) => (
  <div className={`border border-red-300 bg-red-50 p-3 text-center text-sm text-red-700 ${className}`}>
    {message}
  </div>
);
