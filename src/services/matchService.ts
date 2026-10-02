import { supabase } from '../lib/supabaseClient';
import { Match, MatchPlayer } from '../types';

/**
 * Match Service — `matches` + `match_players` table access, consolidating
 * what used to be near-identical inline Supabase calls duplicated across
 * useMatchData, MatchHistory.tsx, AllMatches.tsx and AddMatchModal.tsx.
 *
 * Returns raw rows (Match[] / MatchPlayer[]) rather than joined
 * MatchHistoryItem[] — joining with teams/players is a pure transform
 * (see src/utils/matchTransforms.ts) applied by the query layer, which is
 * what actually has team/player data cached.
 */

export interface RawMatchesResult {
  matches: Match[];
  matchPlayers: MatchPlayer[];
}

async function fetchMatchPlayersForMatches(matchIds: string[]): Promise<MatchPlayer[]> {
  if (matchIds.length === 0) return [];

  const { data, error } = await supabase
    .from('match_players')
    .select('*')
    .in('match_id', matchIds);

  if (error) {
    console.error('[matchService] Error fetching match players:', error);
    throw new Error(error.message);
  }

  return data || [];
}

export async function fetchMatchesToday(): Promise<RawMatchesResult> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayStart.getDate() + 1);

  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .gte('played_at', todayStart.toISOString())
    .lt('played_at', todayEnd.toISOString())
    .order('played_at', { ascending: false });

  if (error) {
    console.error("[matchService] Error fetching today's matches:", error);
    throw new Error(error.message);
  }

  const matches = data || [];
  const matchPlayers = await fetchMatchPlayersForMatches(matches.map(m => m.id));
  return { matches, matchPlayers };
}

export async function fetchAllMatches(): Promise<RawMatchesResult> {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .order('played_at', { ascending: false });

  if (error) {
    console.error('[matchService] Error fetching all matches:', error);
    throw new Error(error.message);
  }

  const matches = data || [];
  const matchPlayers = await fetchMatchPlayersForMatches(matches.map(m => m.id));
  return { matches, matchPlayers };
}

export interface CreateMatchInput {
  team1Id: string;
  team2Id: string;
  createdBy: string | null;
  team1PlayerIds: string[];
  team2PlayerIds: string[];
}

/**
 * Inserts a match, then its match_players rows. If the second insert
 * fails, rolls back the match insert so we never leave an orphaned match
 * with no players recorded — same guard AddMatchModal.tsx used to do
 * inline, now centralized here.
 */
export async function createMatch(input: CreateMatchInput): Promise<string> {
  const { data: matchData, error: matchError } = await supabase
    .from('matches')
    .insert({
      team1_id: input.team1Id,
      team2_id: input.team2Id,
      team1_score: null,
      team2_score: null,
      penalties_winner: null,
      created_by: input.createdBy,
    })
    .select('id')
    .single();

  if (matchError || !matchData) {
    console.error('[matchService] Error creating match:', matchError);
    throw new Error('Failed to save match details.');
  }

  const newMatchId = matchData.id;

  const playersToInsert = [
    ...input.team1PlayerIds.map(playerId => ({ match_id: newMatchId, player_id: playerId, team_number: 1 as const })),
    ...input.team2PlayerIds.map(playerId => ({ match_id: newMatchId, player_id: playerId, team_number: 2 as const })),
  ];

  if (playersToInsert.length > 0) {
    const { error: playersError } = await supabase.from('match_players').insert(playersToInsert);
    if (playersError) {
      await supabase.from('matches').delete().eq('id', newMatchId);
      console.error('[matchService] Error saving match players, rolled back match:', playersError);
      throw new Error('Failed to save player assignments for the match.');
    }
  }

  return newMatchId;
}

/** Just the team ids of every match — enough to count how often each team is played. */
export async function fetchMatchTeamIds(): Promise<Pick<Match, 'team1_id' | 'team2_id'>[]> {
  const { data, error } = await supabase.from('matches').select('team1_id, team2_id');

  if (error) {
    console.error('[matchService] Error fetching match team ids:', error);
    throw new Error(error.message);
  }

  return data || [];
}

export async function updateMatchScore(
  matchId: string,
  team1Score: number,
  team2Score: number,
  penaltiesWinner: 1 | 2 | null
): Promise<void> {
  const { error } = await supabase
    .from('matches')
    .update({ team1_score: team1Score, team2_score: team2Score, penalties_winner: penaltiesWinner })
    .eq('id', matchId);

  if (error) {
    console.error('[matchService] Error updating match score:', error);
    throw new Error(error.message);
  }
}

export async function deleteMatch(matchId: string): Promise<void> {
  const { error } = await supabase.from('matches').delete().eq('id', matchId);

  if (error) {
    console.error('[matchService] Error deleting match:', error);
    throw new Error(error.message);
  }
}

export async function moveMatchPlayer(matchId: string, playerId: string, newTeamNumber: 1 | 2): Promise<void> {
  const { error } = await supabase
    .from('match_players')
    .update({ team_number: newTeamNumber })
    .eq('match_id', matchId)
    .eq('player_id', playerId);

  if (error) {
    console.error('[matchService] Error moving player:', error);
    throw new Error(error.message);
  }
}

export async function addPlayerToMatch(matchId: string, playerId: string, teamNumber: 1 | 2): Promise<void> {
  const { error } = await supabase
    .from('match_players')
    .insert({ match_id: matchId, player_id: playerId, team_number: teamNumber });

  if (error) {
    console.error('[matchService] Error adding player to match:', error);
    throw new Error(error.message);
  }
}
