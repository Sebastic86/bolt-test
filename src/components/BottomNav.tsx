import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Dices, Moon, PlusSquare, Settings, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useActiveNightQuery } from '../queries/nights';

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
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  // A failing query (e.g. migration not applied yet) just means no dot.
  const { data: activeNight } = useActiveNightQuery();
  // /night is deliberately NOT a sub-page: New Match / Add Match stay reachable during a night.
  const isOnSubPage = pathname === '/matches' || pathname === '/admin';
  const isOnNight = pathname === '/night';

  // The matchup (and its reveal animation) only renders on the dashboard.
  const handleNewMatchup = () => {
    if (pathname !== '/') navigate('/');
    onNewMatchup();
  };

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
          onClick={handleNewMatchup}
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

        <Link
          to="/night"
          aria-current={isOnNight ? 'page' : undefined}
          aria-label={activeNight ? 'Game night (live)' : 'Game night'}
          className={`flex min-w-[64px] flex-col items-center justify-center py-1 ${
            isOnNight ? 'text-(--color-green-bright)' : 'text-white/90 hover:text-white'
          }`}
        >
          <span className="relative">
            <Moon className="h-6 w-6" />
            {activeNight && (
              <span
                className="absolute -right-1 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-(--color-ink) bg-(--color-green-bright)"
                aria-hidden
              />
            )}
          </span>
          <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wide">Night</span>
        </Link>

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
