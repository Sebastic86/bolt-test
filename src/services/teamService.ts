import { supabase } from '../lib/supabaseClient';
import { Team } from '../types';

/**
 * Team Service
 *
 * Provides CRUD operations for teams
 */

/**
 * Fetch all teams from database
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

/**
 * Fetch a single team by ID
 */
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

/**
 * Create a new team
 */
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

/**
 * Update an existing team
 */
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

/**
 * Delete a team
 */
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

/**
 * Search teams by name or league
 */
export async function searchTeams(
  query: string,
  filterBy: 'name' | 'league' | 'all' = 'all'
): Promise<Team[]> {
  let queryBuilder = supabase
    .from('teams')
    .select('*')
    .order('name');

  if (query.trim() === '') {
    // Return all teams if query is empty
    const { data, error } = await queryBuilder;
    if (error) throw new Error(error.message);
    return data || [];
  }

  // Apply filter based on filterBy parameter
  if (filterBy === 'name') {
    queryBuilder = queryBuilder.ilike('name', `%${query}%`);
  } else if (filterBy === 'league') {
    queryBuilder = queryBuilder.ilike('league', `%${query}%`);
  } else {
    // Search in both name and league
    queryBuilder = queryBuilder.or(`name.ilike.%${query}%,league.ilike.%${query}%`);
  }

  const { data, error } = await queryBuilder;

  if (error) {
    console.error('[teamService] Error searching teams:', error);
    throw new Error(error.message);
  }

  return data || [];
}
