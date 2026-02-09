import { supabase } from '../lib/supabaseClient';

/**
 * Team Upload Service
 *
 * Handles uploading team logo files to Supabase Storage
 */

const STORAGE_BUCKET = 'team-logos';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];

interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Validate file before upload
 */
function validateFile(file: File): { valid: boolean; error?: string } {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    };
  }

  // Check file type
  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `File type must be one of: ${ALLOWED_TYPES.join(', ')}`,
    };
  }

  return { valid: true };
}

/**
 * Get file extension from MIME type
 */
function getExtensionFromMimeType(mimeType: string): string {
  const mimeMap: { [key: string]: string } = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/svg+xml': 'svg',
    'image/webp': 'webp',
  };

  return mimeMap[mimeType] || 'png';
}

/**
 * Upload team logo file to Supabase Storage
 *
 * @param teamId - Team UUID
 * @param file - Image file to upload
 * @returns Upload result with success status and public URL
 */
export async function uploadTeamLogo(
  teamId: string,
  file: File
): Promise<UploadResult> {
  try {
    // Validate file
    const validation = validateFile(file);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const extension = getExtensionFromMimeType(file.type);
    const fileName = `${teamId}.${extension}`;

    console.log(`[teamUploadService] Uploading ${fileName} (${Math.round(file.size / 1024)}KB)`);

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(fileName, file, {
        contentType: file.type,
        upsert: true, // Overwrite if exists
      });

    if (error) {
      console.error('[teamUploadService] Upload error:', error);
      return { success: false, error: error.message };
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(fileName);

    console.log(`[teamUploadService] Upload successful: ${publicUrl}`);

    return { success: true, url: publicUrl };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[teamUploadService] Upload failed:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Delete team logo from Supabase Storage
 *
 * @param teamId - Team UUID
 * @returns Success status
 */
export async function deleteTeamLogo(teamId: string): Promise<boolean> {
  try {
    // Try common extensions
    const extensions = ['png', 'jpg', 'svg', 'webp'];

    for (const ext of extensions) {
      const fileName = `${teamId}.${ext}`;
      const { error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .remove([fileName]);

      if (!error) {
        console.log(`[teamUploadService] Deleted ${fileName} from storage`);
      }
    }

    return true;
  } catch (error) {
    console.error('[teamUploadService] Delete failed:', error);
    return false;
  }
}
