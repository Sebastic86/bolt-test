import { useState, useMemo, useEffect, useCallback } from 'react';
import { Team, Player, MatchHistoryItem } from '../types';

// --- Matchup Weighting Helpers ---
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RECENCY_DAYS = 30;

type MatchupStats = {
  teamCounts: Map<string, number>;
  lastPlayed: Map<string, number>;
  pairCounts: Map<string, number>;
  pairLastPlayed: Map<string, number>;
  maxTeamCount: number;
};

const getPairKey = (team1Id: string, team2Id: string): string => {
  return team1Id < team2Id ? `${team1Id}|${team2Id}` : `${team2Id}|${team1Id}`;
};

const buildMatchupStats = (matches: MatchHistoryItem[]): MatchupStats => {
  const teamCounts = new Map<string, number>();
  const lastPlayed = new Map<string, number>();
  const pairCounts = new Map<string, number>();
  const pairLastPlayed = new Map<string, number>();
  let maxTeamCount = 0;

  matches.forEach(match => {
    const playedAt = Date.parse(match.played_at);
    const teamIds = [match.team1_id, match.team2_id];

    teamIds.forEach(teamId => {
      const nextCount = (teamCounts.get(teamId) ?? 0) + 1;
      teamCounts.set(teamId, nextCount);
      if (nextCount > maxTeamCount) {
        maxTeamCount = nextCount;
      }

      if (!Number.isNaN(playedAt)) {
        const previousPlayed = lastPlayed.get(teamId) ?? 0;
        if (playedAt > previousPlayed) {
          lastPlayed.set(teamId, playedAt);
        }
      }
    });

    const pairKey = getPairKey(match.team1_id, match.team2_id);
    pairCounts.set(pairKey, (pairCounts.get(pairKey) ?? 0) + 1);

    if (!Number.isNaN(playedAt)) {
      const previousPairPlayed = pairLastPlayed.get(pairKey) ?? 0;
      if (playedAt > previousPairPlayed) {
        pairLastPlayed.set(pairKey, playedAt);
      }
    }
  });

  return { teamCounts, lastPlayed, pairCounts, pairLastPlayed, maxTeamCount };
};

function getWeightedRandom<T>(items: T[], getWeight: (item: T) => number): T | null {
  if (items.length === 0) return null;

  const weights = items.map(item => Math.max(0, getWeight(item)));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

  if (totalWeight <= 0) {
    return items[Math.floor(Math.random() * items.length)];
  }

  let threshold = Math.random() * totalWeight;
  for (let i = 0; i < items.length; i++) {
    threshold -= weights[i];
    if (threshold <= 0) {
      return items[i];
    }
  }

  return items[items.length - 1];
}

const getTeamWeight = (teamId: string, stats: MatchupStats, now: number): number => {
  const count = stats.teamCounts.get(teamId) ?? 0;
  const usageWeight = Math.max(1, stats.maxTeamCount - count + 1);
  const lastPlayedTime = stats.lastPlayed.get(teamId);
  const daysSincePlayed = lastPlayedTime !== undefined
    ? Math.floor(Math.max(0, now - lastPlayedTime) / DAY_MS)
    : MAX_RECENCY_DAYS;
  const recencyWeight = Math.min(MAX_RECENCY_DAYS, daysSincePlayed) + 1;

  return usageWeight * recencyWeight;
};

const getPairWeight = (pairKey: string, stats: MatchupStats, now: number): number => {
  const pairCount = stats.pairCounts.get(pairKey) ?? 0;
  const lastPlayedTime = stats.pairLastPlayed.get(pairKey);
  const daysSincePlayed = lastPlayedTime !== undefined
    ? Math.floor(Math.max(0, now - lastPlayedTime) / DAY_MS)
    : MAX_RECENCY_DAYS;
  const recencyWeight = Math.min(MAX_RECENCY_DAYS, daysSincePlayed) + 1;
  const frequencyWeight = 1 / (1 + pairCount);

  return recencyWeight * frequencyWeight;
};

const getSmartTeam = (teams: Team[], stats: MatchupStats, now: number): Team | null => {
  return getWeightedRandom(teams, team => getTeamWeight(team.id, stats, now));
};

export const getSmartOpponent = (
  teams: Team[],
  referenceTeam: Team,
  stats: MatchupStats,
  now: number,
  maxOvrDiff?: number,
  referenceLeague?: string
): Team | null => {
  if (teams.length === 0) return null;

  let availableTeams = teams.filter(team => team.id !== referenceTeam.id);

  if (referenceLeague === 'Nation') {
    availableTeams = availableTeams.filter(team => team.league === 'Nation');
  } else {
    availableTeams = availableTeams.filter(team => team.league !== 'Nation');
  }

  if (maxOvrDiff !== undefined) {
    availableTeams = availableTeams.filter(
      team => Math.abs(team.overallRating - referenceTeam.overallRating) <= maxOvrDiff
    );
  }

  if (availableTeams.length === 0) return null;

  return getWeightedRandom(availableTeams, team => {
    const pairKey = getPairKey(referenceTeam.id, team.id);
    const pairWeight = getPairWeight(pairKey, stats, now);
    const teamWeight = getTeamWeight(team.id, stats, now);
    const diff = Math.abs(team.overallRating - referenceTeam.overallRating);
    const ovrWeight = maxOvrDiff !== undefined ? Math.max(1, maxOvrDiff - diff + 1) : 1;

    return teamWeight * pairWeight * ovrWeight;
  });
};

const getSmartMatch = (
  teams: Team[],
  stats: MatchupStats,
  now: number,
  maxOvrDiff?: number
): [Team, Team] | null => {
  if (teams.length < 2) return null;
  const team1 = getSmartTeam(teams, stats, now);
  if (!team1) return null;
  const team2 = getSmartOpponent(teams, team1, stats, now, maxOvrDiff, team1.league);
  if (!team2) return null;
  return [team1, team2];
};

interface UseMatchGeneratorOptions {
  allTeams: Team[];
  filteredTeams: Team[];
  matchesToday: MatchHistoryItem[];
  allMatches: MatchHistoryItem[];
  maxOvrDiff: number;
  excludeNations: boolean;
  minRating: number;
  maxRating: number;
  loading: boolean;
}

export function useMatchGenerator({
  allTeams,
  filteredTeams,
  matchesToday,
  allMatches,
  maxOvrDiff,
  excludeNations,
  minRating,
  maxRating,
  loading,
}: UseMatchGeneratorOptions) {
  const [match, setMatch] = useState<[Team, Team] | null>(null);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [pendingMatch, setPendingMatch] = useState<[Team, Team] | null>(null);
  const [lastMatchPlayers, setLastMatchPlayers] = useState<{
    team1Id: string;
    team2Id: string;
    team1Players: Player[];
    team2Players: Player[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const matchupStats = useMemo(() => buildMatchupStats(allMatches), [allMatches]);

  // Determine if New Matchup button should be disabled
  const playedTeamIdsToday = useMemo(() => new Set(matchesToday.flatMap(m => [m.team1_id, m.team2_id])), [matchesToday]);
  const availableForNewMatchupCount = useMemo(() => filteredTeams.filter(team => !playedTeamIdsToday.has(team.id)).length, [filteredTeams, playedTeamIdsToday]);
  const canGenerateNewMatch = availableForNewMatchupCount >= 2;

  // Effect to set initial match or update when filters/teams change
  useEffect(() => {
    if (!loading && allTeams.length > 0) {
      const currentMatchIsValid = match &&
        filteredTeams.some(t => t.id === match[0].id) &&
        filteredTeams.some(t => t.id === match[1].id);

      if (!currentMatchIsValid) {
        const playedTeamIds = new Set(matchesToday.flatMap(m => [m.team1_id, m.team2_id]));
        const availableForInitialMatch = filteredTeams.filter(t => !playedTeamIds.has(t.id));
        setMatch(getSmartMatch(availableForInitialMatch, matchupStats, Date.now(), maxOvrDiff));
      } else if (filteredTeams.length < 2) {
        setMatch(null);
      }
    } else if (!loading && allTeams.length === 0) {
      setMatch(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredTeams, loading, allTeams, matchesToday, maxOvrDiff, matchupStats]);

  const handleGenerateNewMatch = useCallback((extraExcludedTeamIds?: Set<string>) => {
    const playedTeamIds = new Set(matchesToday.flatMap(m => [m.team1_id, m.team2_id]));
    if (extraExcludedTeamIds) {
      extraExcludedTeamIds.forEach(teamId => playedTeamIds.add(teamId));
    }
    const availableTeamsForNewMatchup = filteredTeams.filter(team => !playedTeamIds.has(team.id));

    if (availableTeamsForNewMatchup.length >= 2) {
      const newMatch = getSmartMatch(availableTeamsForNewMatchup, matchupStats, Date.now(), maxOvrDiff);
      if (newMatch) {
        setPendingMatch(newMatch);
        setIsAnimating(true);
        setError(null);
      } else {
        setMatch(null);
        const nationFilterText = excludeNations ? " excluding nations" : "";
        setError(`Not enough teams available for a new matchup within the current filter (${minRating.toFixed(1)}-${maxRating.toFixed(1)} stars${nationFilterText}, max OVR diff ${maxOvrDiff}) that haven't played today. Only ${availableTeamsForNewMatchup.length} team(s) remaining.`);
      }
    } else {
      setMatch(null);
      const nationFilterText = excludeNations ? " excluding nations" : "";
      setError(`Not enough teams available for a new matchup within the current filter (${minRating.toFixed(1)}-${maxRating.toFixed(1)} stars${nationFilterText}) that haven't played today. Only ${availableTeamsForNewMatchup.length} team(s) remaining.`);
    }
  }, [matchesToday, filteredTeams, matchupStats, maxOvrDiff, excludeNations, minRating, maxRating]);

  const handleAnimationComplete = useCallback(() => {
    setMatch(pendingMatch);
    setPendingMatch(null);
    setIsAnimating(false);
  }, [pendingMatch]);

  const handleUpdateTeam = useCallback((newTeam: Team, editingTeamIndex: 0 | 1) => {
    if (!match) return;

    const playedTeamIds = new Set(matchesToday.flatMap(m => [m.team1_id, m.team2_id]));
    const potentialOpponentPool = filteredTeams.filter(t => !playedTeamIds.has(t.id) && t.id !== newTeam.id);

    const otherTeamIndex = editingTeamIndex === 0 ? 1 : 0;
    let newOpponent = match[otherTeamIndex];

    const leagueMatch = newTeam.league === 'Nation' ? newOpponent.league === 'Nation' : true;
    const currentOpponentIsValid = filteredTeams.some(t => t.id === newOpponent.id) &&
      !playedTeamIds.has(newOpponent.id) &&
      Math.abs(newOpponent.overallRating - newTeam.overallRating) <= maxOvrDiff &&
      leagueMatch;

    if (newOpponent.id === newTeam.id || !currentOpponentIsValid) {
      const potentialOpponent = getSmartOpponent(
        potentialOpponentPool,
        newTeam,
        matchupStats,
        Date.now(),
        maxOvrDiff,
        newTeam.league
      );
      if (potentialOpponent) {
        newOpponent = potentialOpponent;
      } else {
        console.warn("Could not find a different, unplayed, filter-matching opponent with acceptable OVR difference and league constraint.");
      }
    }

    const updatedMatch: [Team, Team] = [...match];
    updatedMatch[editingTeamIndex] = newTeam;
    updatedMatch[otherTeamIndex] = newOpponent;
    setMatch(updatedMatch);
  }, [match, filteredTeams, matchesToday, maxOvrDiff, matchupStats]);

  const setMatchError = useCallback((err: string | null) => {
    setError(err);
  }, []);

  const initialMatchPlayers = useMemo(() => {
    if (!match || !lastMatchPlayers) return null;
    if (lastMatchPlayers.team1Id !== match[0].id || lastMatchPlayers.team2Id !== match[1].id) return null;
    return {
      team1Players: lastMatchPlayers.team1Players,
      team2Players: lastMatchPlayers.team2Players,
    };
  }, [match, lastMatchPlayers]);

  return {
    match,
    isAnimating,
    pendingMatch,
    error,
    canGenerateNewMatch,
    playedTeamIdsToday,
    matchupStats,
    initialMatchPlayers,
    handleGenerateNewMatch,
    handleAnimationComplete,
    handleUpdateTeam,
    setLastMatchPlayers,
    setMatchError,
  };
}
