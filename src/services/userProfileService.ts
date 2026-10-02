import { supabase } from '../lib/supabaseClient';
import { UserProfile } from '../types';

/**
 * User Profile Service — `user_profiles` table access + the
 * `admin_list_users` RPC (used by the admin user-management screen to
 * list auth.users with emails, without a service-role key on the client).
 */

export async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('[userProfileService] Error fetching user profile:', error);
    return null;
  }

  return data;
}

export interface AdminUserRow {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string;
}

export async function fetchAllUsersAsAdmin(): Promise<AdminUserRow[]> {
  const { data, error } = await supabase.rpc('admin_list_users');

  if (error) {
    console.error('[userProfileService] Error listing users:', error);
    throw new Error(error.message);
  }

  return data || [];
}

// admin_list_users() only returns auth.users columns (id/email/created_at/
// last_sign_in_at) — it has no `role`. The admin user-management screen
// merges this with every user_profiles row client-side to know who has
// which role (or none yet).
export async function fetchAllUserProfilesAsAdmin(): Promise<UserProfile[]> {
  const { data, error } = await supabase.from('user_profiles').select('*');

  if (error) {
    console.error('[userProfileService] Error fetching user profiles:', error);
    throw new Error(error.message);
  }

  return data || [];
}

export async function createUserProfile(userId: string, role: 'admin' | 'normal'): Promise<void> {
  const { error } = await supabase.from('user_profiles').insert({ id: userId, role });

  if (error) {
    console.error('[userProfileService] Error creating user profile:', error);
    throw new Error(error.message);
  }
}

export async function updateUserRole(userId: string, role: 'admin' | 'normal'): Promise<void> {
  const { error } = await supabase
    .from('user_profiles')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) {
    console.error('[userProfileService] Error updating user role:', error);
    throw new Error(error.message);
  }
}

export async function deleteUserProfile(userId: string): Promise<void> {
  const { error } = await supabase.from('user_profiles').delete().eq('id', userId);

  if (error) {
    console.error('[userProfileService] Error deleting user profile:', error);
    throw new Error(error.message);
  }
}
