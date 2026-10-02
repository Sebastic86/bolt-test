import React from 'react';
import { MatchHistoryItem, Player } from '../types';
import MatchList from './MatchList';
import { BottomSheet } from './ui';

interface MatchDetailsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  matches: MatchHistoryItem[];
  players: Player[];
  currentUserId?: string;
}

/**
 * "All matches involving this player/team" — one sheet replacing the old
 * app's PlayerMatchDetails.tsx and TeamMatchDetails.tsx, which each
 * hand-rolled their own fixed-overlay match-card renderer. This one just
 * filters matches and hands them to the same MatchList every other match
 * view already uses, so score-edit/delete/move-players come for free.
 */
const MatchDetailsSheet: React.FC<MatchDetailsSheetProps> = ({ isOpen, onClose, title, matches, players, currentUserId }) => (
  <BottomSheet isOpen={isOpen} onClose={onClose} title={title}>
    <MatchList
      matches={matches}
      loading={false}
      error={null}
      currentUserId={currentUserId}
      players={players}
      showTeamVersion
      emptyMessage="No matches found."
    />
  </BottomSheet>
);

export default MatchDetailsSheet;
