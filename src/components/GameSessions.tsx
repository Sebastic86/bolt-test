import React, { useMemo, useState } from 'react';
import { MatchHistoryItem, Player } from '../types';
import { groupMatchesIntoSessions } from '../utils/gameSessionUtils';
import MatchList from './MatchList';
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
 */
const GameSessions: React.FC<GameSessionsProps> = ({ allMatches, players, loading, error, currentUserId }) => {
  const sessions = useMemo(() => groupMatchesIntoSessions(allMatches), [allMatches]);
  const [selectedDate, setSelectedDate] = useState<string>('');

  const selectedSession = sessions.find(s => s.date === selectedDate);

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
            <MatchList
              matches={selectedSession.matches}
              loading={false}
              error={null}
              currentUserId={currentUserId}
              players={players}
              showTeamVersion
              emptyMessage="No matches in this session."
            />
          )}
        </>
      )}
    </div>
  );
};

export default GameSessions;
