import React, { useMemo } from 'react';
import { MatchHistoryItem, Player } from '../types';
import MatchList from './MatchList';
import { BottomSheet } from './ui';
import { getMatchResult, inferPerspective, MatchPerspective } from '../utils/matchDisplay';

interface MatchDetailsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  matches: MatchHistoryItem[];
  players: Player[];
  currentUserId?: string;
  /**
   * Whose point of view to show results from (Win / Loss / Win (P) /
   * Loss (P) badge per match, selected team row marked / selected player
   * highlighted). Optional: when omitted it's inferred — the single team or
   * player present in every match whose name is in `title`.
   */
  perspective?: MatchPerspective | null;
}

/**
 * "All matches involving this player/team" — one sheet replacing the old
 * app's PlayerMatchDetails.tsx and TeamMatchDetails.tsx, which each
 * hand-rolled their own fixed-overlay match-card renderer. This one just
 * filters matches and hands them to the same MatchList every other match
 * view already uses, so score-edit/delete/move-players come for free.
 */
const MatchDetailsSheet: React.FC<MatchDetailsSheetProps> = ({
  isOpen, onClose, title, matches, players, currentUserId, perspective,
}) => {
  const effectivePerspective = useMemo(
    () => (perspective !== undefined ? perspective : inferPerspective(matches, title)),
    [perspective, matches, title]
  );

  const record = useMemo(() => {
    if (!effectivePerspective) return null;
    let wins = 0;
    let losses = 0;
    matches.forEach(m => {
      const result = getMatchResult(m, effectivePerspective);
      if (result === 'Win' || result === 'Win (P)') wins++;
      else if (result === 'Loss' || result === 'Loss (P)') losses++;
    });
    return { wins, losses };
  }, [matches, effectivePerspective]);

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={title}>
      <p className="mb-2.5 text-xs font-bold uppercase tracking-wide text-gray-500">
        {matches.length} {matches.length === 1 ? 'match' : 'matches'}
        {record && (
          <>
            {' · '}
            <span className="tabular-nums text-(--color-green-mid)">{record.wins}W</span>
            {' – '}
            <span className="tabular-nums text-red-600">{record.losses}L</span>
          </>
        )}
      </p>
      <MatchList
        matches={matches}
        loading={false}
        error={null}
        currentUserId={currentUserId}
        players={players}
        showTeamVersion
        perspective={effectivePerspective}
        highlightBiggestWin={false}
        emptyMessage="No matches found."
      />
    </BottomSheet>
  );
};

export default MatchDetailsSheet;
