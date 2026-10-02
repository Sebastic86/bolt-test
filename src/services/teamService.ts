import { supabase } from '../lib/supabaseClient';
import { Team } from '../types';

/**
 * Team Service — CRUD operations for the `teams` table. This is the data
 * layer's only direct Supabase access point for teams; components go
 * through `src/queries/teams.ts` instead of calling this (or Supabase)
 * directly.
 */

export async function fetchAllTeams(): Promise<Team[]> {
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .order('name');

  if (error) {
    console.error('[teamService] Error fetching teams:', error);
    throw new Error(error.message);
  }

  return data || [];
}

export async function fetchTeamById(id: string): Promise<Team | null> {
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('[teamService] Error fetching team:', error);
    return null;
  }

  return data;
}

export async function createTeam(team: Omit<Team, 'id'>): Promise<Team> {
  const { data, error } = await supabase
    .from('teams')
    .insert([team])
    .select()
    .single();

  if (error) {
    console.error('[teamService] Error creating team:', error);
    throw new Error(error.message);
  }

  return data;
}

export async function updateTeam(id: string, updates: Partial<Team>): Promise<Team> {
  const { data, error } = await supabase
    .from('teams')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[teamService] Error updating team:', error);
    throw new Error(error.message);
  }

  return data;
}

export async function deleteTeam(id: string): Promise<void> {
  const { error } = await supabase
    .from('teams')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[teamService] Error deleting team:', error);
    throw new Error(error.message);
  }
}

export async function searchTeams(
  query: string,
  filterBy: 'name' | 'league' | 'all' = 'all'
): Promise<Team[]> {
  let queryBuilder = supabase
    .from('teams')
    .select('*')
    .order('name');

  if (query.trim() === '') {
    const { data, error } = await queryBuilder;
    if (error) throw new Error(error.message);
    return data || [];
  }

  if (filterBy === 'name') {
    queryBuilder = queryBuilder.ilike('name', `%${query}%`);
  } else if (filterBy === 'league') {
    queryBuilder = queryBuilder.ilike('league', `%${query}%`);
  } else {
    queryBuilder = queryBuilder.or(`name.ilike.%${query}%,league.ilike.%${query}%`);
  }

  const { data, error } = await queryBuilder;

  if (error) {
    console.error('[teamService] Error searching teams:', error);
    throw new Error(error.message);
  }

  return data || [];
}
