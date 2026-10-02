import React, { useCallback, useMemo, useState } from 'react';
import { Share2 } from 'lucide-react';
import { MatchHistoryItem, Player } from '../types';
import { groupMatchesIntoLocalSessions } from '../utils/matchDisplay';
import { buildRecapData, formatSessionSubtitle } from '../utils/recapData';
import { useTeamsQuery } from '../queries/teams';
import MatchList from './MatchList';
import NightRecapSheet from './night/NightRecapSheet';
import { LoadingState, ErrorState, Select } from './ui';

interface GameSessionsProps {
  allMatches: MatchHistoryItem[];
  players: Player[];
  loading: boolean;
  error: string | null;
  currentUserId?: string;
}

/**
 * Days with 2+ matches, picked from a dropdown. Renders the picked day's
 * matches through the same MatchList used everywhere else (score edit,
 * delete, move/add players all come for free) rather than reimplementing
 * a third match-card renderer, as the old app's GameSessions did.
 *
 * Grouped by the device's LOCAL calendar day (not the UTC day), so a late
 * session doesn't get split at midnight UTC.
 */
const GameSessions: React.FC<GameSessionsProps> = ({ allMatches, players, loading, error, currentUserId }) => {
  const sessions = useMemo(() => groupMatchesIntoLocalSessions(allMatches), [allMatches]);
  const [selectedDate, setSelectedDate] = useState<string>('');

  const [recapOpen, setRecapOpen] = useState(false);
  const closeRecap = useCallback(() => setRecapOpen(false), []);
  // Cached query (AppLayout loads teams too) — only used for the standings' OVR totals.
  const { data: teams } = useTeamsQuery();

  const selectedSession = sessions.find(s => s.date === selectedDate);

  // Recap for any day, so sessions from before game nights existed can be shared too.
  const recapData = useMemo(
    () => (recapOpen && selectedSession
      ? buildRecapData({
          title: `Game night · ${selectedSession.displayDate}`,
          subtitle: formatSessionSubtitle(selectedSession.matches),
          matches: selectedSession.matches,
          players,
          teams: teams ?? [],
        })
      : null),
    [recapOpen, selectedSession, players, teams]
  );

  return (
    <div>
      {loading && sessions.length === 0 && <LoadingState label="Loading sessions..." />}
      {error && <ErrorState message={error} />}
      {!loading && !error && sessions.length === 0 && (
        <p className="py-4 text-center text-sm text-gray-500">
          No game sessions yet. A session is 2+ matches played on the same day.
        </p>
      )}

      {sessions.length > 0 && (
        <>
          <Select value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="mb-2.5" aria-label="Select a game session">
            <option value="">Select a session…</option>
            {sessions.map(session => (
              <option key={session.date} value={session.date}>
                {session.displayDate} — {session.matches.length} matches
              </option>
            ))}
          </Select>

          {selectedSession && (
            <>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="min-w-0 truncate text-xs font-black uppercase tracking-wide text-(--color-ink)">
                  Matches from {selectedSession.displayDate}
                </h3>
                <button
                  type="button"
                  onClick={() => setRecapOpen(true)}
                  className="flex h-10 flex-none items-center gap-1.5 border-2 border-(--color-ink) bg-white px-3 text-xs font-bold uppercase tracking-wide text-(--color-ink)"
                >
                  <Share2 className="h-4 w-4" />
                  Share recap
                </button>
              </div>
              <MatchList
                key={selectedSession.date}
                matches={selectedSession.matches}
                loading={false}
                error={null}
                currentUserId={currentUserId}
                players={players}
                showTeamVersion
                timeOnly
                emptyMessage="No matches in this session."
              />
            </>
          )}
        </>
      )}

      <NightRecapSheet isOpen={recapOpen && recapData !== null} onClose={closeRecap} data={recapData} />
    </div>
  );
};

export default GameSessions;
