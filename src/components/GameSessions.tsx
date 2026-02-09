import React, { useState, useMemo } from 'react';
import { Player, MatchHistoryItem } from '../types';
import { Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { TeamLogo } from './TeamLogo';

interface GameSessionsProps {
  allMatches: MatchHistoryItem[];
  allPlayers: Player[];
  loading: boolean;
  error: string | null;
  hideTitle?: boolean;
}

interface GameSession {
  date: string; // Format: YYYY-MM-DD
  displayDate: string; // Format: DD/MM/YYYY
  matches: MatchHistoryItem[];
}


// Helper function to format date to YYYY-MM-DD
const getDateKey = (isoString: string): string => {
  try {
    const date = new Date(isoString);
    return date.toISOString().split('T')[0];
  } catch (e) {
    console.error("Error formatting date key:", e);
    return "Invalid Date";
  }
};

// Helper function to format date for display (DD/MM/YYYY)
const formatDisplayDate = (dateKey: string): string => {
  try {
    const [year, month, day] = dateKey.split('-');
    return `${day}/${month}/${year}`;
  } catch (e) {
    console.error("Error formatting display date:", e);
    return "Invalid Date";
  }
};

// Helper function to format time (HH:mm)
const formatTime = (isoString: string): string => {
  try {
    const date = new Date(isoString);
    const options: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    };
    return date.toLocaleString('en-GB', options);
  } catch (e) {
    console.error("Error formatting time:", e);
    return "Invalid Time";
  }
};

const GameSessions: React.FC<GameSessionsProps> = ({
  allMatches,
  allPlayers,
  loading,
  error,
  hideTitle = false,
}) => {
  const [selectedSessionDate, setSelectedSessionDate] = useState<string | null>(null);
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);

  // Group matches by date and filter sessions with 2+ matches
  const gameSessions = useMemo<GameSession[]>(() => {
    const sessionMap = new Map<string, MatchHistoryItem[]>();

    allMatches.forEach(match => {
      const dateKey = getDateKey(match.played_at);
      if (!sessionMap.has(dateKey)) {
        sessionMap.set(dateKey, []);
      }
      sessionMap.get(dateKey)!.push(match);
    });

    // Filter sessions with 2+ matches and convert to array
    const sessions: GameSession[] = [];
    sessionMap.forEach((matches, dateKey) => {
      if (matches.length >= 2) {
        sessions.push({
          date: dateKey,
          displayDate: formatDisplayDate(dateKey),
          matches: matches.sort((a, b) =>
            new Date(b.played_at).getTime() - new Date(a.played_at).getTime()
          ),
        });
      }
    });

    // Sort sessions by date descending (most recent first)
    return sessions.sort((a, b) => b.date.localeCompare(a.date));
  }, [allMatches]);


  const toggleExpandMatch = (matchId: string) => {
    setExpandedMatchId(prevId => (prevId === matchId ? null : matchId));
  };

  const selectedSession = gameSessions.find(s => s.date === selectedSessionDate);

  return (
    <div className="w-full max-w-4xl">
      {!hideTitle && (
        <h2 className="text-2xl font-semibold text-gray-700 mb-4">Game Sessions</h2>
      )}

      {loading && <p className="text-center text-gray-600">Loading sessions...</p>}
      {error && <p className="text-center text-red-600 bg-red-100 p-3 rounded-sm">{error}</p>}

      {!loading && !error && gameSessions.length === 0 && (
        <p className="text-center text-gray-500">No game sessions found. A session requires 2 or more matches on the same day.</p>
      )}

      {!loading && !error && gameSessions.length > 0 && (
        <>
          {/* Session Dropdown */}
          <div className="mb-6">
            <label htmlFor="session-select" className="block text-sm font-medium text-gray-700 mb-2">
              Select a Game Session:
            </label>
            <select
              id="session-select"
              value={selectedSessionDate || ''}
              onChange={(e) => {
                setSelectedSessionDate(e.target.value || null);
                setExpandedMatchId(null); // Reset expanded match when changing session
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-medium focus:border-transparent"
            >
              <option value="">-- Select a session --</option>
              {gameSessions.map((session) => (
                <option key={session.date} value={session.date}>
                  {session.displayDate} - {session.matches.length} {session.matches.length === 1 ? 'match' : 'matches'}
                </option>
              ))}
            </select>
          </div>

          {/* Display Selected Session Matches */}
          {selectedSession && (
            <div>
              <h3 className="text-xl font-semibold text-gray-700 mb-4">
                Matches from {selectedSession.displayDate}
              </h3>
              <ul className="space-y-4">
                {selectedSession.matches.map((match) => {
                  const isExpanded = expandedMatchId === match.id;

                  return (
                    <li
                      key={match.id}
                      className="rounded-lg shadow-sm p-4 border border-brand-light bg-brand-lighter transition-all duration-200"
                    >
                      <div className="flex flex-col sm:flex-row justify-between items-center mb-2">
                        {/* Teams and Score */}
                        <div className="flex items-center space-x-2 grow mb-2 sm:mb-0 min-w-0">
                          {/* Team 1 Logo */}
                          <div className="shrink-0">
                            <TeamLogo
                              team={{ name: match.team1_name, logoUrl: match.team1_logoUrl, apiTeamId: null, apiTeamName: null }}
                              size="sm"
                            />
                          </div>
                          <span className="font-medium truncate shrink-0 w-24 sm:w-auto text-gray-800">
                            {match.team1_name} ({match.team1_version || 'FC25'})
                          </span>

                          {/* Score Display */}
                          <span className="text-lg font-bold mx-2 shrink-0 text-gray-700">
                            {match.team1_score !== null && match.team2_score !== null ? (
                              <>
                                {`${match.team1_score} - ${match.team2_score}`}
                                {match.team1_score === match.team2_score && match.penalties_winner && (
                                  <span className="ml-1 text-xs text-gray-500">
                                    (Pen: {match.penalties_winner === 1
                                      ? `${match.team1_name} (${match.team1_version || 'FC25'})`
                                      : `${match.team2_name} (${match.team2_version || 'FC25'})`})
                                  </span>
                                )}
                              </>
                            ) : 'vs'}
                          </span>

                          {/* Team 2 Logo/Fallback */}
                          <div className="shrink-0">
                            <TeamLogo
                              team={{ name: match.team2_name, logoUrl: match.team2_logoUrl, apiTeamId: null, apiTeamName: null }}
                              size="sm"
                            />
                          </div>
                          <span className="font-medium truncate shrink-0 w-24 sm:w-auto text-gray-800">
                            {match.team2_name} ({match.team2_version || 'FC25'})
                          </span>
                        </div>

                        {/* Expand/Collapse Button */}
                        <button
                          onClick={() => toggleExpandMatch(match.id)}
                          className="p-1 text-gray-500 hover:text-brand-dark"
                          title={isExpanded ? "Collapse Players" : "Expand Players"}
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>

                      {/* Expanded Player List */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-brand-light text-xs text-gray-600 grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                          <div>
                            <strong className="block mb-1 text-gray-700">
                              {match.team1_name} ({match.team1_version || 'FC25'}) Players:
                            </strong>
                            {match.team1_players.length > 0 ? (
                              <ul className="space-y-1">
                                {match.team1_players.map(p => (
                                  <li key={p.id}>{p.name}</li>
                                ))}
                              </ul>
                            ) : <span className="italic">No players recorded</span>}
                          </div>
                          <div>
                            <strong className="block mb-1 text-gray-700">
                              {match.team2_name} ({match.team2_version || 'FC25'}) Players:
                            </strong>
                            {match.team2_players.length > 0 ? (
                              <ul className="space-y-1">
                                {match.team2_players.map(p => (
                                  <li key={p.id}>{p.name}</li>
                                ))}
                              </ul>
                            ) : <span className="italic">No players recorded</span>}
                          </div>
                        </div>
                      )}

                      {/* Match Time */}
                      <div className="text-right text-xs text-gray-400 mt-1">
                        Time: {formatTime(match.played_at)}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default GameSessions;
