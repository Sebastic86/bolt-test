import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Dices, PlusSquare, Settings, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface BottomNavProps {
  onNewMatchup: () => void;
  onAddMatch: () => void;
  onSettings: () => void;
  canGenerateNewMatch: boolean;
  hasMatch: boolean;
  canAddMatch: boolean;
}

const BottomNav: React.FC<BottomNavProps> = ({
  onNewMatchup,
  onAddMatch,
  onSettings,
  canGenerateNewMatch,
  hasMatch,
  canAddMatch,
}) => {
  const { pathname } = useLocation();
  const { isAdmin } = useAuth();
  const isOnSubPage = pathname === '/matches' || pathname === '/admin';

  if (isOnSubPage) {
    return (
      <nav className="bottom-nav flex-none border-t-[3px] border-(--color-green-bright) bg-(--color-ink)">
        <div className="flex justify-center px-4 py-2">
          <Link
            to="/"
            className="flex flex-col items-center justify-center px-6 py-1.5 text-white/90 hover:text-white"
          >
            <ArrowLeft className="h-6 w-6" />
            <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wide">Back</span>
          </Link>
        </div>
      </nav>
    );
  }

  return (
    <nav className="bottom-nav flex-none border-t-[3px] border-(--color-green-bright) bg-(--color-ink)">
      <div className="flex items-stretch justify-around px-2 py-1.5">
        <button
          onClick={onNewMatchup}
          disabled={!canGenerateNewMatch}
          className="flex min-w-[64px] flex-col items-center justify-center py-1 text-white/90 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Dices className="h-6 w-6" />
          <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wide">New Match</span>
        </button>

        {canAddMatch && (
          <button
            onClick={onAddMatch}
            disabled={!hasMatch}
            className="flex min-w-[64px] flex-col items-center justify-center py-1 text-white/90 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <PlusSquare className="h-6 w-6" />
            <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wide">Add Match</span>
          </button>
        )}

        {isAdmin && (
          <Link
            to="/admin"
            className="flex min-w-[64px] flex-col items-center justify-center py-1 text-white/90 hover:text-white"
          >
            <Shield className="h-6 w-6" />
            <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wide">Admin</span>
          </Link>
        )}

        <button
          onClick={onSettings}
          className="flex min-w-[64px] flex-col items-center justify-center py-1 text-white/90 hover:text-white"
        >
          <Settings className="h-6 w-6" />
          <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wide">Settings</span>
        </button>
      </div>
    </nav>
  );
};

export default BottomNav;
