import { supabase } from '../lib/supabaseClient';
import { Player } from '../types';

/**
 * Player Service — `players` table access + avatar storage, consolidating
 * what used to be duplicated inline Supabase calls across useMatchData,
 * App.tsx's handleUpdatePlayerName, and SettingsModal's avatar flow.
 *
 * `createPlayer` fills a real gap the old app had: RLS restricts player
 * INSERT to admins, but no component there ever called it — new players
 * had to be added directly in the database. Added here on request.
 */

export async function fetchAllPlayers(): Promise<Player[]> {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .order('name');

  if (error) {
    console.error('[playerService] Error fetching players:', error);
    throw new Error(error.message);
  }

  return data || [];
}

export async function createPlayer(name: string): Promise<Player> {
  const { data, error } = await supabase
    .from('players')
    .insert({ name })
    .select()
    .single();

  if (error) {
    console.error('[playerService] Error creating player:', error);
    // players.name has a unique constraint — surface that case in plain language.
    if (error.code === '23505') {
      throw new Error('A player with this name already exists.');
    }
    throw new Error(error.message);
  }

  return data;
}

export async function updatePlayerName(id: string, name: string): Promise<Player> {
  const { data, error } = await supabase
    .from('players')
    .update({ name })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[playerService] Error updating player name:', error);
    if (error.code === '23505') {
      throw new Error('A player with this name already exists.');
    }
    throw new Error(error.message);
  }

  return data;
}

async function updatePlayerAvatarUrl(id: string, avatarUrl: string | null): Promise<Player> {
  const { data, error } = await supabase
    .from('players')
    .update({ avatar_url: avatarUrl })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[playerService] Error updating player avatar:', error);
    throw new Error(error.message);
  }

  return data;
}

const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

export async function uploadPlayerAvatar(playerId: string, file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please select an image file.');
  }
  if (file.size > AVATAR_MAX_BYTES) {
    throw new Error('File size must be less than 5MB.');
  }

  const fileExt = file.name.split('.').pop();
  const filePath = `player-avatars/${playerId}-${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, file, { upsert: true });

  if (uploadError) {
    console.error('[playerService] Error uploading avatar:', uploadError);
    throw new Error(uploadError.message);
  }

  const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
  await updatePlayerAvatarUrl(playerId, publicUrl);
  return publicUrl;
}

export async function removePlayerAvatar(playerId: string): Promise<void> {
  await updatePlayerAvatarUrl(playerId, null);
}
