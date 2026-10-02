import { supabase } from '../lib/supabaseClient';

/**
 * Team Upload Service — uploads an admin-provided team logo file to the
 * `team-logos` Supabase Storage bucket (see supabase/migrations/004_storage.sql).
 */

const STORAGE_BUCKET = 'team-logos';
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];

const MIME_TO_EXTENSION: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
};

export async function uploadTeamLogo(teamId: string, file: File): Promise<string> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error(`File type must be one of: ${ALLOWED_TYPES.join(', ')}.`);
  }

  const extension = MIME_TO_EXTENSION[file.type] || 'png';
  const fileName = `${teamId}.${extension}`;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(fileName, file, { contentType: file.type, upsert: true });

  if (error) {
    console.error('[teamUploadService] Upload error:', error);
    throw new Error(error.message);
  }

  const { data: { publicUrl } } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(fileName);
  return publicUrl;
}

export async function deleteTeamLogo(teamId: string): Promise<void> {
  const extensions = ['png', 'jpg', 'svg', 'webp'];
  await Promise.all(
    extensions.map(ext =>
      supabase.storage.from(STORAGE_BUCKET).remove([`${teamId}.${ext}`])
    )
  );
}
