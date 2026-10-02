import { useCallback, useEffect, useMemo, useState } from 'react';
import { Team, MatchHistoryItem } from '../types';
import { buildMatchupStats, getSmartMatch, getSmartOpponent } from '../utils/matchupAlgorithm';

export interface UpdateTeamOptions {
  /** Keep the other side as-is instead of re-validating it against the filters. */
  keepOpponent?: boolean;
}

interface UseMatchGeneratorOptions {
  /** Teams passing the current rating/version/nation filters. */
  filteredTeams: Team[];
  matchesToday: MatchHistoryItem[];
  allMatches: MatchHistoryItem[];
  maxOvrDiff: number;
  excludeNations: boolean;
  minRating: number;
  maxRating: number;
  /** True once teams/matches queries have actually loaded — avoids generating against an empty list. */
  ready: boolean;
}

/**
 * Stateful wrapper around the pure matchup-weighting algorithm
 * (src/utils/matchupAlgorithm.ts). An explicit "New Matchup" click stages
 * the result as `pendingMatch` + `isAnimating` for MatchRevealAnimation to
 * play out, then `handleAnimationComplete` commits it to `match`. The
 * *initial* matchup (on load, or when filters change) is set directly —
 * no reveal animation on page load, matching the old app's behavior.
 */
export function useMatchGenerator({
  filteredTeams,
  matchesToday,
  allMatches,
  maxOvrDiff,
  excludeNations,
  minRating,
  maxRating,
  ready,
}: UseMatchGeneratorOptions) {
  const [match, setMatch] = useState<[Team, Team] | null>(null);
  const [pendingMatch, setPendingMatch] = useState<[Team, Team] | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matchupStats = useMemo(() => buildMatchupStats(allMatches), [allMatches]);

  const playedTeamIdsToday = useMemo(
    () => new Set(matchesToday.flatMap(m => [m.team1_id, m.team2_id])),
    [matchesToday]
  );

  const availableForNewMatchupCount = useMemo(
    () => filteredTeams.filter(team => !playedTeamIdsToday.has(team.id)).length,
    [filteredTeams, playedTeamIdsToday]
  );
  const canGenerateNewMatch = availableForNewMatchupCount >= 2;

  // Set an initial match once data is ready, or clear/regenerate if the
  // current match falls outside the (possibly just-changed) filters.
  useEffect(() => {
    if (!ready) return;

    const currentMatchIsValid = match
      && filteredTeams.some(t => t.id === match[0].id)
      && filteredTeams.some(t => t.id === match[1].id);

    if (!currentMatchIsValid) {
      const available = filteredTeams.filter(t => !playedTeamIdsToday.has(t.id));
      setMatch(getSmartMatch(available, matchupStats, Date.now(), maxOvrDiff));
    } else if (filteredTeams.length < 2) {
      setMatch(null);
    }
    // Only re-run when the inputs that should force a new/cleared matchup change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, filteredTeams, playedTeamIdsToday, maxOvrDiff, matchupStats]);

  /**
   * `excludeTeamIds` covers teams that have just been played but aren't in
   * `matchesToday` yet (e.g. "Save & Next" fires before the query refetches).
   */
  const handleGenerateNewMatch = useCallback((excludeTeamIds: string[] = []) => {
    const available = filteredTeams.filter(
      team => !playedTeamIdsToday.has(team.id) && !excludeTeamIds.includes(team.id)
    );

    if (available.length >= 2) {
      const newMatch = getSmartMatch(available, matchupStats, Date.now(), maxOvrDiff);
      if (newMatch) {
        setPendingMatch(newMatch);
        setIsAnimating(true);
        setError(null);
        return;
      }
    }

    setMatch(null);
    const nationText = excludeNations ? ' excluding nations' : '';
    setError(
      `Not enough teams available for a new matchup within the current filter (${minRating.toFixed(1)}-${maxRating.toFixed(1)} stars${nationText}, max OVR diff ${maxOvrDiff}) that haven't played today. Only ${available.length} team(s) remaining.`
    );
  }, [filteredTeams, playedTeamIdsToday, matchupStats, maxOvrDiff, excludeNations, minRating, maxRating]);

  /** Called by MatchRevealAnimation once the reveal has finished playing. */
  const handleAnimationComplete = useCallback(() => {
    setMatch(pendingMatch);
    setPendingMatch(null);
    setIsAnimating(false);
  }, [pendingMatch]);

  /**
   * Swap one side of the current matchup (used by the "edit team" and joker
   * flows). `keepOpponent` skips re-validating the other side — the joker
   * already drew a team that fits it, and after a rematch save the opponent
   * counts as "played today" and would otherwise be replaced too.
   */
  const handleUpdateTeam = useCallback((newTeam: Team, slot: 0 | 1, options: UpdateTeamOptions = {}) => {
    if (!match) return;

    const otherSlot = slot === 0 ? 1 : 0;
    let newOpponent = match[otherSlot];

    if (options.keepOpponent && newOpponent.id !== newTeam.id) {
      const updated: [Team, Team] = [...match];
      updated[slot] = newTeam;
      setMatch(updated);
      return;
    }

    const leagueOk = newTeam.league === 'Nation'
      ? newOpponent.league === 'Nation'
      : newOpponent.league !== 'Nation';
    const opponentStillValid = filteredTeams.some(t => t.id === newOpponent.id)
      && !playedTeamIdsToday.has(newOpponent.id)
      && Math.abs(newOpponent.overallRating - newTeam.overallRating) <= maxOvrDiff
      && leagueOk;

    if (newOpponent.id === newTeam.id || !opponentStillValid) {
      const pool = filteredTeams.filter(t => !playedTeamIdsToday.has(t.id) && t.id !== newTeam.id);
      const candidate = getSmartOpponent(pool, newTeam, matchupStats, Date.now(), maxOvrDiff, newTeam.league);
      if (candidate) newOpponent = candidate;
    }

    const updated: [Team, Team] = [...match];
    updated[slot] = newTeam;
    updated[otherSlot] = newOpponent;
    setMatch(updated);
  }, [match, filteredTeams, playedTeamIdsToday, maxOvrDiff, matchupStats]);

  return {
    match,
    pendingMatch,
    isAnimating,
    error,
    canGenerateNewMatch,
    playedTeamIdsToday,
    handleGenerateNewMatch,
    handleAnimationComplete,
    handleUpdateTeam,
  };
}
