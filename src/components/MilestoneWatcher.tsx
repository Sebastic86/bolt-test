import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useMilestoneWatcher } from '../hooks/useMilestoneWatcher';

const ActiveWatcher: React.FC = () => {
  useMilestoneWatcher();
  return null;
};

/** Renders nothing; watches for new scores and toasts milestones. Only runs when signed in. */
export const MilestoneWatcher: React.FC = () => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <ActiveWatcher /> : null;
};
