import { GameNight, MatchHistoryItem, Player, Prediction, Team } from '../types';

export function makePlayer(id: string, name = id): Player {
  return { id, name, created_at: '2026-01-01T00:00:00Z' };
}

export function makeTeam(id: string, overallRating = 80, version = 'FC27'): Team {
  return {
    id,
    name: `Team ${id}`,
    league: 'Test League',
    rating: 4,
    logoUrl: '',
    overallRating,
    attackRating: overallRating,
    midfieldRating: overallRating,
    defendRating: overallRating,
    version,
  };
}

let matchSeq = 0;

/** Scored match; `minute` orders matches (2026-10-24 20:00 + minute). */
export function makeMatch(
  t1: Player[],
  t2: Player[],
  score1: number,
  score2: number,
  overrides: Partial<MatchHistoryItem> & { minute?: number } = {}
): MatchHistoryItem {
  const { minute = matchSeq, ...rest } = overrides;
  matchSeq += 1;
  const at = new Date(Date.UTC(2026, 9, 24, 18, 0) + minute * 60_000).toISOString();
  return {
    id: `m${matchSeq}`,
    team1_id: 't1',
    team2_id: 't2',
    team1_score: score1,
    team2_score: score2,
    penalties_winner: null,
    played_at: at,
    created_at: at,
    created_by: null,
    game_night_id: null,
    team1_name: 'Team t1',
    team1_logoUrl: '',
    team1_version: 'FC27',
    team2_name: 'Team t2',
    team2_logoUrl: '',
    team2_version: 'FC27',
    team1_players: t1,
    team2_players: t2,
    ...rest,
  };
}

export function makeNight(id: string, startedAt = '2026-10-24T18:00:00Z', endedAt: string | null = null): GameNight {
  return {
    id,
    started_at: startedAt,
    ended_at: endedAt,
    started_by: null,
    version: 'FC27',
    jokers_per_player: 1,
    created_at: startedAt,
  };
}

export function makePrediction(overrides: Partial<Prediction> & Pick<Prediction, 'player_id' | 'predicted_winner'>): Prediction {
  return {
    id: `pr-${Math.random().toString(36).slice(2)}`,
    game_night_id: 'n1',
    team1_id: 't1',
    team2_id: 't2',
    predicted_team1_score: null,
    predicted_team2_score: null,
    match_id: null,
    created_by: null,
    created_at: '2026-10-24T18:00:00Z',
    ...overrides,
  };
}
