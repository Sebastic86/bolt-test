import { Team, MatchHistoryItem } from '../types';

// Pure matchup-weighting logic, extracted from the useMatchGenerator hook so
// it can be unit tested without React. The hook wraps these functions in
// state/effects; nothing here touches the DOM, Supabase, or React.

export const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_RECENCY_DAYS = 30;

export type MatchupStats = {
  teamCounts: Map<string, number>;
  lastPlayed: Map<string, number>;
  pairCounts: Map<string, number>;
  pairLastPlayed: Map<string, number>;
  maxTeamCount: number;
};

export const getPairKey = (team1Id: string, team2Id: string): string => {
  return team1Id < team2Id ? `${team1Id}|${team2Id}` : `${team2Id}|${team1Id}`;
};

export const buildMatchupStats = (matches: MatchHistoryItem[]): MatchupStats => {
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

export function getWeightedRandom<T>(items: T[], getWeight: (item: T) => number): T | null {
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

export const getTeamWeight = (teamId: string, stats: MatchupStats, now: number): number => {
  const count = stats.teamCounts.get(teamId) ?? 0;
  const usageWeight = Math.max(1, stats.maxTeamCount - count + 1);
  const lastPlayedTime = stats.lastPlayed.get(teamId);
  const daysSincePlayed = lastPlayedTime !== undefined
    ? Math.floor(Math.max(0, now - lastPlayedTime) / DAY_MS)
    : MAX_RECENCY_DAYS;
  const recencyWeight = Math.min(MAX_RECENCY_DAYS, daysSincePlayed) + 1;

  return usageWeight * recencyWeight;
};

export const getPairWeight = (pairKey: string, stats: MatchupStats, now: number): number => {
  const pairCount = stats.pairCounts.get(pairKey) ?? 0;
  const lastPlayedTime = stats.pairLastPlayed.get(pairKey);
  const daysSincePlayed = lastPlayedTime !== undefined
    ? Math.floor(Math.max(0, now - lastPlayedTime) / DAY_MS)
    : MAX_RECENCY_DAYS;
  const recencyWeight = Math.min(MAX_RECENCY_DAYS, daysSincePlayed) + 1;
  const frequencyWeight = 1 / (1 + pairCount);

  return recencyWeight * frequencyWeight;
};

export const getSmartTeam = (teams: Team[], stats: MatchupStats, now: number): Team | null => {
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

export const getSmartMatch = (
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
