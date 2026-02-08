import React from 'react';
import { Dices, PlusSquare, List, Settings, ArrowLeft } from 'lucide-react';

interface BottomNavProps {
  onNewMatchup: () => void;
  onAddMatch: () => void;
  onAllMatches: () => void;
  onSettings: () => void;
  onBackToMain: () => void;
  canGenerateNewMatch: boolean;
  hasMatch: boolean;
  isAdmin: boolean;
  currentPage: 'main' | 'allMatches';
}

const BottomNav: React.FC<BottomNavProps> = ({
  onNewMatchup,
  onAddMatch,
  onAllMatches,
  onSettings,
  onBackToMain,
  canGenerateNewMatch,
  hasMatch,
  isAdmin,
  currentPage,
}) => {
  if (currentPage === 'allMatches') {
    return (
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-brand-dark shadow-[0_-2px_10px_rgba(0,0,0,0.15)] md:hidden bottom-nav">
        <div className="flex justify-center py-2 px-4">
          <button
            onClick={onBackToMain}
            className="flex flex-col items-center justify-center px-6 py-1.5 text-white/90 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
            <span className="text-[10px] mt-0.5 font-medium">Back</span>
          </button>
        </div>
      </nav>
    );
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-brand-dark shadow-[0_-2px_10px_rgba(0,0,0,0.15)] md:hidden bottom-nav">
      <div className="flex justify-around items-end py-1.5 px-2">
        <button
          onClick={onNewMatchup}
          disabled={!canGenerateNewMatch}
          className="flex flex-col items-center justify-center min-w-[60px] py-1 text-white/90 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title="New Matchup"
        >
          <Dices className="w-6 h-6" />
          <span className="text-[10px] mt-0.5 font-medium">New Match</span>
        </button>

        {isAdmin && (
          <button
            onClick={onAddMatch}
            disabled={!hasMatch}
            className="flex flex-col items-center justify-center min-w-[60px] py-1 text-white/90 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Add Match"
          >
            <PlusSquare className="w-6 h-6" />
            <span className="text-[10px] mt-0.5 font-medium">Add Match</span>
          </button>
        )}

        <button
          onClick={onAllMatches}
          className="flex flex-col items-center justify-center min-w-[60px] py-1 text-white/90 hover:text-white transition-colors"
          title="All Matches"
        >
          <List className="w-6 h-6" />
          <span className="text-[10px] mt-0.5 font-medium">All Matches</span>
        </button>

        <button
          onClick={onSettings}
          className="flex flex-col items-center justify-center min-w-[60px] py-1 text-white/90 hover:text-white transition-colors"
          title="Settings"
        >
          <Settings className="w-6 h-6" />
          <span className="text-[10px] mt-0.5 font-medium">Settings</span>
        </button>
      </div>
    </nav>
  );
};

export default BottomNav;
