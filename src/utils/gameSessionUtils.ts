import { MatchHistoryItem } from '../types';

export interface GameSession {
  /** YYYY-MM-DD */
  date: string;
  /** DD/MM/YYYY */
  displayDate: string;
  matches: MatchHistoryItem[];
}

const getDateKey = (isoString: string): string => new Date(isoString).toISOString().split('T')[0];

const formatDisplayDate = (dateKey: string): string => {
  const [year, month, day] = dateKey.split('-');
  return `${day}/${month}/${year}`;
};

/**
 * Groups matches by calendar day, keeping only days with 2+ matches (a
 * single stray match isn't a "session"). Sorted most-recent-first; each
 * session's matches sorted most-recent-first too.
 */
export function groupMatchesIntoSessions(matches: MatchHistoryItem[]): GameSession[] {
  const sessionMap = new Map<string, MatchHistoryItem[]>();

  matches.forEach(match => {
    const dateKey = getDateKey(match.played_at);
    if (!sessionMap.has(dateKey)) sessionMap.set(dateKey, []);
    sessionMap.get(dateKey)!.push(match);
  });

  const sessions: GameSession[] = [];
  sessionMap.forEach((sessionMatches, dateKey) => {
    if (sessionMatches.length >= 2) {
      sessions.push({
        date: dateKey,
        displayDate: formatDisplayDate(dateKey),
        matches: [...sessionMatches].sort((a, b) => new Date(b.played_at).getTime() - new Date(a.played_at).getTime()),
      });
    }
  });

  return sessions.sort((a, b) => b.date.localeCompare(a.date));
}
