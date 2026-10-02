import { describe, expect, it } from 'vitest';
import { calculatePlayerAchievements } from './achievementUtils';
import { MatchHistoryItem, Player, Team } from '../types';

const PLAYER: Player = { id: 'p1', name: 'Seb', created_at: '2026-01-01T00:00:00Z' };

function team(id: string, overallRating: number): Team {
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
    version: 'FC26',
  };
}

// Shared team fixtures used across the scenarios below.
const TEAM_MID = team('mid', 75); // generic opponent, ovr doesn't matter
const TEAM_WEAK = team('weak', 70); // player's team for Giant Killer (opponent must be 5+ higher)
const TEAM_STRONG = team('strong', 76); // opponent for Giant Killer (diff = 6)
const TEAM_STRONG_JUST_UNDER = team('strong-under', 74); // diff = 4, should NOT trigger Giant Killer
const TEAM_DIAMOND = team('diamond', 92); // >= 90 for Diamond League
const TEAM_UNDERDOG = team('underdog', 65); // < 70 for Underdog Hero
const TEAMS_VERSATILE = ['v1', 'v2', 'v3', 'v4', 'v5'].map(id => team(id, 75));
const TEAM_CONSISTENT = team('consistent', 75);

const ALL_TEAMS: Team[] = [
  TEAM_MID, TEAM_WEAK, TEAM_STRONG, TEAM_STRONG_JUST_UNDER, TEAM_DIAMOND,
  TEAM_UNDERDOG, ...TEAMS_VERSATILE, TEAM_CONSISTENT,
];

let matchCounter = 0;

/** Builds a match where PLAYER is always on team1, playing team2. */
function match(opts: {
  playerTeamId: string;
  opponentTeamId?: string;
  playerScore: number;
  opponentScore: number;
  playedAt: string;
  penaltiesWinner?: 1 | 2 | null;
}): MatchHistoryItem {
  matchCounter += 1;
  return {
    id: `m${matchCounter}`,
    team1_id: opts.playerTeamId,
    team2_id: opts.opponentTeamId ?? TEAM_MID.id,
    team1_score: opts.playerScore,
    team2_score: opts.opponentScore,
    penalties_winner: opts.penaltiesWinner ?? null,
    played_at: opts.playedAt,
    created_at: opts.playedAt,
    created_by: null,
    team1_name: 'Player Team',
    team1_logoUrl: '',
    team1_version: 'FC26',
    team2_name: 'Opponent',
    team2_logoUrl: '',
    team2_version: 'FC26',
    team1_players: [PLAYER],
    team2_players: [],
  };
}

function achievementIds(matches: MatchHistoryItem[]): string[] {
  const [data] = calculatePlayerAchievements(matches, [PLAYER], ALL_TEAMS);
  return data.achievements.map(a => a.id);
}

describe('calculatePlayerAchievements', () => {
  it('returns no entry at all for a player with zero completed matches', () => {
    const result = calculatePlayerAchievements([], [PLAYER], ALL_TEAMS);
    expect(result).toHaveLength(0);
  });

  it('Giant Killer: wins with a team rated 5+ lower than the opponent', () => {
    const m = match({
      playerTeamId: TEAM_WEAK.id, opponentTeamId: TEAM_STRONG.id, // 76 - 70 = 6
      playerScore: 1, opponentScore: 0, playedAt: '2026-01-01T00:00:00Z',
    });
    expect(achievementIds([m])).toContain('giant-killer');
  });

  it('Giant Killer: does NOT trigger when the rating gap is under 5', () => {
    const m = match({
      playerTeamId: TEAM_WEAK.id, opponentTeamId: TEAM_STRONG_JUST_UNDER.id, // 74 - 70 = 4
      playerScore: 1, opponentScore: 0, playedAt: '2026-01-01T00:00:00Z',
    });
    expect(achievementIds([m])).not.toContain('giant-killer');
  });

  it('Clean Sheet King: wins without conceding', () => {
    const m = match({ playerTeamId: TEAM_MID.id, playerScore: 3, opponentScore: 0, playedAt: '2026-01-01T00:00:00Z' });
    expect(achievementIds([m])).toContain('clean-sheet');
  });

  it('Clean Sheet King: does NOT trigger when a goal is conceded', () => {
    const m = match({ playerTeamId: TEAM_MID.id, playerScore: 3, opponentScore: 1, playedAt: '2026-01-01T00:00:00Z' });
    expect(achievementIds([m])).not.toContain('clean-sheet');
  });

  it('Demolition: wins by a 4+ goal margin', () => {
    const m = match({ playerTeamId: TEAM_MID.id, playerScore: 5, opponentScore: 1, playedAt: '2026-01-01T00:00:00Z' }); // diff 4
    expect(achievementIds([m])).toContain('demolition');
  });

  it('Demolition: does NOT trigger on a 3-goal margin', () => {
    const m = match({ playerTeamId: TEAM_MID.id, playerScore: 4, opponentScore: 1, playedAt: '2026-01-01T00:00:00Z' }); // diff 3
    expect(achievementIds([m])).not.toContain('demolition');
  });

  it('Lightning Strike: scores 6+ goals in a win', () => {
    const m = match({ playerTeamId: TEAM_MID.id, playerScore: 6, opponentScore: 2, playedAt: '2026-01-01T00:00:00Z' });
    expect(achievementIds([m])).toContain('lightning-strike');
  });

  it('Lightning Strike: does NOT trigger on 5 goals', () => {
    const m = match({ playerTeamId: TEAM_MID.id, playerScore: 5, opponentScore: 2, playedAt: '2026-01-01T00:00:00Z' });
    expect(achievementIds([m])).not.toContain('lightning-strike');
  });

  it('Penalty Specialist: wins a draw on penalties', () => {
    const m = match({
      playerTeamId: TEAM_MID.id, playerScore: 2, opponentScore: 2,
      penaltiesWinner: 1, playedAt: '2026-01-01T00:00:00Z',
    });
    expect(achievementIds([m])).toContain('penalty-specialist');
  });

  it('Penalty Specialist: does NOT trigger when the opponent wins the penalties', () => {
    const m = match({
      playerTeamId: TEAM_MID.id, playerScore: 2, opponentScore: 2,
      penaltiesWinner: 2, playedAt: '2026-01-01T00:00:00Z',
    });
    expect(achievementIds([m])).not.toContain('penalty-specialist');
  });

  it('Hot Streak: 3 consecutive wins', () => {
    const matches = [
      match({ playerTeamId: TEAM_MID.id, playerScore: 1, opponentScore: 0, playedAt: '2026-01-01T00:00:00Z' }),
      match({ playerTeamId: TEAM_MID.id, playerScore: 1, opponentScore: 0, playedAt: '2026-01-02T00:00:00Z' }),
      match({ playerTeamId: TEAM_MID.id, playerScore: 1, opponentScore: 0, playedAt: '2026-01-03T00:00:00Z' }),
    ];
    expect(achievementIds(matches)).toContain('hot-streak');
  });

  it('Hot Streak: does NOT trigger on only 2 consecutive wins', () => {
    const matches = [
      match({ playerTeamId: TEAM_MID.id, playerScore: 1, opponentScore: 0, playedAt: '2026-01-01T00:00:00Z' }),
      match({ playerTeamId: TEAM_MID.id, playerScore: 1, opponentScore: 0, playedAt: '2026-01-02T00:00:00Z' }),
    ];
    expect(achievementIds(matches)).not.toContain('hot-streak');
  });

  it('Unbeatable: 5 consecutive wins', () => {
    const matches = Array.from({ length: 5 }, (_, i) =>
      match({ playerTeamId: TEAM_MID.id, playerScore: 1, opponentScore: 0, playedAt: `2026-01-0${i + 1}T00:00:00Z` })
    );
    const ids = achievementIds(matches);
    expect(ids).toContain('unbeatable');
    expect(ids).toContain('hot-streak'); // 5-streak also satisfies the 3+ hot-streak condition
  });

  it('Consistency King: 3+ wins with the same team', () => {
    const matches = [
      match({ playerTeamId: TEAM_CONSISTENT.id, playerScore: 1, opponentScore: 0, playedAt: '2026-01-01T00:00:00Z' }),
      match({ playerTeamId: TEAM_CONSISTENT.id, playerScore: 1, opponentScore: 0, playedAt: '2026-01-02T00:00:00Z' }),
      match({ playerTeamId: TEAM_CONSISTENT.id, playerScore: 1, opponentScore: 0, playedAt: '2026-01-03T00:00:00Z' }),
    ];
    expect(achievementIds(matches)).toContain('consistency-king');
  });

  it('Versatile: wins with 5+ different teams', () => {
    const matches = TEAMS_VERSATILE.map((t, i) =>
      match({ playerTeamId: t.id, playerScore: 1, opponentScore: 0, playedAt: `2026-01-0${i + 1}T00:00:00Z` })
    );
    expect(achievementIds(matches)).toContain('versatile');
  });

  it('Diamond League: wins with a 90+ OVR team', () => {
    const m = match({ playerTeamId: TEAM_DIAMOND.id, playerScore: 1, opponentScore: 0, playedAt: '2026-01-01T00:00:00Z' });
    expect(achievementIds([m])).toContain('diamond-league');
  });

  it('Underdog Hero: wins with a sub-70 OVR team', () => {
    const m = match({ playerTeamId: TEAM_UNDERDOG.id, playerScore: 1, opponentScore: 0, playedAt: '2026-01-01T00:00:00Z' });
    expect(achievementIds([m])).toContain('underdog-hero');
  });

  it('Comeback Kid: wins right after a 3+ loss streak', () => {
    const matches = [
      match({ playerTeamId: TEAM_MID.id, playerScore: 0, opponentScore: 1, playedAt: '2026-01-01T00:00:00Z' }),
      match({ playerTeamId: TEAM_MID.id, playerScore: 0, opponentScore: 1, playedAt: '2026-01-02T00:00:00Z' }),
      match({ playerTeamId: TEAM_MID.id, playerScore: 0, opponentScore: 1, playedAt: '2026-01-03T00:00:00Z' }),
      match({ playerTeamId: TEAM_MID.id, playerScore: 1, opponentScore: 0, playedAt: '2026-01-04T00:00:00Z' }),
    ];
    expect(achievementIds(matches)).toContain('comeback-kid');
  });

  it('Comeback Kid: does NOT trigger after only 2 losses', () => {
    const matches = [
      match({ playerTeamId: TEAM_MID.id, playerScore: 0, opponentScore: 1, playedAt: '2026-01-01T00:00:00Z' }),
      match({ playerTeamId: TEAM_MID.id, playerScore: 0, opponentScore: 1, playedAt: '2026-01-02T00:00:00Z' }),
      match({ playerTeamId: TEAM_MID.id, playerScore: 1, opponentScore: 0, playedAt: '2026-01-03T00:00:00Z' }),
    ];
    expect(achievementIds(matches)).not.toContain('comeback-kid');
  });

  it('Perfectionist: 75%+ win rate over 10+ matches', () => {
    // 8 wins, 2 losses over 10 matches = 80% win rate
    const matches = Array.from({ length: 10 }, (_, i) =>
      match({
        playerTeamId: TEAM_MID.id,
        playerScore: i < 8 ? 1 : 0,
        opponentScore: i < 8 ? 0 : 1,
        playedAt: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
      })
    );
    expect(achievementIds(matches)).toContain('perfectionist');
  });

  it('Perfectionist: does NOT trigger with a 100% win rate under 10 matches', () => {
    const matches = Array.from({ length: 9 }, (_, i) =>
      match({ playerTeamId: TEAM_MID.id, playerScore: 1, opponentScore: 0, playedAt: `2026-01-0${i + 1}T00:00:00Z` })
    );
    expect(achievementIds(matches)).not.toContain('perfectionist');
  });

  it('ignores matches where the player did not participate on either side', () => {
    const other: Player = { id: 'other', name: 'Milo', created_at: '2026-01-01T00:00:00Z' };
    const m: MatchHistoryItem = {
      ...match({ playerTeamId: TEAM_MID.id, playerScore: 1, opponentScore: 0, playedAt: '2026-01-01T00:00:00Z' }),
      team1_players: [other],
    };
    const result = calculatePlayerAchievements([m], [PLAYER], ALL_TEAMS);
    expect(result).toHaveLength(0);
  });

  it('ignores matches with a null score (unplayed)', () => {
    const m: MatchHistoryItem = {
      ...match({ playerTeamId: TEAM_MID.id, playerScore: 1, opponentScore: 0, playedAt: '2026-01-01T00:00:00Z' }),
      team1_score: null,
      team2_score: null,
    };
    const result = calculatePlayerAchievements([m], [PLAYER], ALL_TEAMS);
    expect(result).toHaveLength(0);
  });
});
