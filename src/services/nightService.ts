import { supabase } from '../lib/supabaseClient';
import { GameNight, NightJoker, Prediction } from '../types';

/**
 * Night Service — `game_nights`, `predictions` and `night_jokers` table access
 * (supabase/migrations/20261003090000_match_nights.sql).
 *
 * Matches are linked to the active night by a DB trigger, and predictions are
 * linked to the saved match by another trigger — neither needs client code.
 */

function fail(context: string, error: { message: string; code?: string }): never {
  console.error(`[nightService] ${context}:`, error);
  // 23505 on game_nights = the "one active night" unique index.
  if (error.code === '23505' && context === 'Error starting night') {
    throw new Error('A game night is already running.');
  }
  throw new Error(error.message);
}

export async function fetchActiveNight(): Promise<GameNight | null> {
  const { data, error } = await supabase
    .from('game_nights')
    .select('*')
    .is('ended_at', null)
    .maybeSingle();
  if (error) fail('Error fetching active night', error);
  return data;
}

export async function fetchNights(): Promise<GameNight[]> {
  const { data, error } = await supabase
    .from('game_nights')
    .select('*')
    .order('started_at', { ascending: false });
  if (error) fail('Error fetching nights', error);
  return data ?? [];
}

export async function startNight(input: { version: string | null; jokersPerPlayer: number }): Promise<GameNight> {
  const { data, error } = await supabase
    .from('game_nights')
    .insert({ version: input.version, jokers_per_player: input.jokersPerPlayer })
    .select()
    .single();
  if (error) fail('Error starting night', error);
  return data;
}

export async function endNight(nightId: string): Promise<GameNight> {
  const { data, error } = await supabase
    .from('game_nights')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', nightId)
    .select()
    .single();
  if (error) fail('Error ending night', error);
  return data;
}

export async function fetchPredictions(nightId?: string): Promise<Prediction[]> {
  let query = supabase.from('predictions').select('*').order('created_at', { ascending: true });
  if (nightId) query = query.eq('game_night_id', nightId);
  const { data, error } = await query;
  if (error) fail('Error fetching predictions', error);
  return data ?? [];
}

export interface PlacePredictionInput {
  nightId: string;
  playerId: string;
  team1Id: string;
  team2Id: string;
  predictedWinner: 1 | 2;
  predictedTeam1Score: number | null;
  predictedTeam2Score: number | null;
}

/** Places or replaces a player's open pick for a matchup. */
export async function placePrediction(input: PlacePredictionInput): Promise<Prediction> {
  const { error: deleteError } = await supabase
    .from('predictions')
    .delete()
    .eq('game_night_id', input.nightId)
    .eq('player_id', input.playerId)
    .eq('team1_id', input.team1Id)
    .eq('team2_id', input.team2Id)
    .is('match_id', null);
  if (deleteError) fail('Error replacing prediction', deleteError);

  const { data, error } = await supabase
    .from('predictions')
    .insert({
      game_night_id: input.nightId,
      player_id: input.playerId,
      team1_id: input.team1Id,
      team2_id: input.team2Id,
      predicted_winner: input.predictedWinner,
      predicted_team1_score: input.predictedTeam1Score,
      predicted_team2_score: input.predictedTeam2Score,
    })
    .select()
    .single();
  if (error) fail('Error placing prediction', error);
  return data;
}

export async function deletePrediction(predictionId: string): Promise<void> {
  const { error } = await supabase.from('predictions').delete().eq('id', predictionId);
  if (error) fail('Error deleting prediction', error);
}

export async function fetchJokers(nightId: string): Promise<NightJoker[]> {
  const { data, error } = await supabase
    .from('night_jokers')
    .select('*')
    .eq('game_night_id', nightId)
    .order('used_at', { ascending: true });
  if (error) fail('Error fetching jokers', error);
  return data ?? [];
}

export async function spendJoker(input: {
  nightId: string;
  playerId: string;
  replacedTeamId: string | null;
  chosenTeamId: string | null;
}): Promise<NightJoker> {
  const { data, error } = await supabase
    .from('night_jokers')
    .insert({
      game_night_id: input.nightId,
      player_id: input.playerId,
      replaced_team_id: input.replacedTeamId,
      chosen_team_id: input.chosenTeamId,
    })
    .select()
    .single();
  if (error) fail('Error using joker', error);
  return data;
}
