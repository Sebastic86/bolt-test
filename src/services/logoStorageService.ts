import { supabase } from '../lib/supabaseClient';

/**
 * Logo Storage Service
 *
 * Downloads logo images from external URLs and uploads them to Supabase Storage.
 * Updates team records with new Supabase Storage URLs.
 */

const STORAGE_BUCKET = 'team-logos';

interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Download an image from a URL as a Blob
 */
async function downloadImageAsBlob(url: string): Promise<Blob> {
  console.log(`[logoStorageService] Downloading image from: ${url.substring(0, 60)}...`);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
  }

  const blob = await response.blob();

  // Verify it's an image
  if (!blob.type.startsWith('image/')) {
    throw new Error(`Downloaded content is not an image: ${blob.type}`);
  }

  console.log(`[logoStorageService] Downloaded successfully: ${blob.type}, ${Math.round(blob.size / 1024)}KB`);
  return blob;
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
    'image/gif': 'gif',
  };

  return mimeMap[mimeType] || 'png';
}

/**
 * Upload image blob to Supabase Storage
 */
async function uploadImageToStorage(
  teamId: string,
  imageBlob: Blob,
  contentType: string
): Promise<string> {
  const extension = getExtensionFromMimeType(contentType);
  const fileName = `${teamId}.${extension}`;

  console.log(`[logoStorageService] Uploading ${fileName} (${Math.round(imageBlob.size / 1024)}KB)`);

  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(fileName, imageBlob, {
      contentType,
      upsert: true, // Overwrite if exists
    });

  if (error) {
    throw new Error(`Failed to upload to storage: ${error.message}`);
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(fileName);

  return publicUrl;
}

/**
 * Update team's resolvedLogoUrl in database
 */
async function updateTeamLogoUrl(teamId: string, logoUrl: string): Promise<void> {
  const { error } = await supabase
    .from('teams')
    .update({ resolvedLogoUrl: logoUrl })
    .eq('id', teamId);

  if (error) {
    throw new Error(`Failed to update team logo URL: ${error.message}`);
  }
}

/**
 * Main function: Download logo from URL and upload to Supabase Storage
 *
 * @param teamId - Team UUID
 * @param teamName - Team name (for logging)
 * @param sourceUrl - External URL to download from (e.g., TheSportsDB)
 * @param forceUpdate - If true, re-upload even if already in storage
 * @returns Upload result with success status and new URL
 */
export async function migrateLogoToStorage(
  teamId: string,
  teamName: string,
  sourceUrl: string,
  forceUpdate = false
): Promise<UploadResult> {
  try {
    console.log(`[logoStorageService] Migrating logo for ${teamName}...`);

    // Check if already in Supabase Storage
    if (!forceUpdate && isLogoInStorage(sourceUrl)) {
      console.log(`[logoStorageService] Already in Supabase Storage, skipping: ${teamName}`);
      return { success: true, url: sourceUrl };
    }

    // Step 1: Download image from source URL
    const imageBlob = await downloadImageAsBlob(sourceUrl);
    console.log(`[logoStorageService] Downloaded ${teamName} logo: ${imageBlob.type}, ${Math.round(imageBlob.size / 1024)}KB`);

    // Step 2: Upload to Supabase Storage
    const publicUrl = await uploadImageToStorage(teamId, imageBlob, imageBlob.type);
    console.log(`[logoStorageService] Uploaded to storage: ${publicUrl}`);

    // Step 3: Update database with new URL
    await updateTeamLogoUrl(teamId, publicUrl);
    console.log(`[logoStorageService] ✅ Successfully migrated ${teamName}`);

    return { success: true, url: publicUrl };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[logoStorageService] ❌ Failed to migrate ${teamName}:`, errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Check if a team's logo is already in Supabase Storage
 */
export function isLogoInStorage(resolvedLogoUrl?: string | null): boolean {
  if (!resolvedLogoUrl) return false;
  return resolvedLogoUrl.includes('supabase.co/storage') ||
         resolvedLogoUrl.includes('.supabase.co/storage') ||
         resolvedLogoUrl.includes('/storage/v1/object/public/team-logos/');
}

/**
 * Get migration status for a specific team
 */
export async function getTeamMigrationStatus(teamId: string): Promise<{
  teamId: string;
  teamName: string;
  resolvedLogoUrl: string | null;
  isInStorage: boolean;
}> {
  const { data, error } = await supabase
    .from('teams')
    .select('id, name, resolvedLogoUrl')
    .eq('id', teamId)
    .single();

  if (error || !data) {
    throw new Error(`Failed to fetch team: ${error?.message || 'Team not found'}`);
  }

  return {
    teamId: data.id,
    teamName: data.name,
    resolvedLogoUrl: data.resolvedLogoUrl,
    isInStorage: isLogoInStorage(data.resolvedLogoUrl),
  };
}

/**
 * Delete logo from Supabase Storage
 * Useful for cleanup or re-migration
 */
export async function deleteLogoFromStorage(teamId: string): Promise<void> {
  // Try common extensions
  const extensions = ['png', 'jpg', 'svg', 'webp'];

  for (const ext of extensions) {
    const fileName = `${teamId}.${ext}`;
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([fileName]);

    if (!error) {
      console.log(`[logoStorageService] Deleted ${fileName} from storage`);
    }
  }
}

/**
 * Get all teams that need migration (have resolvedLogoUrl but not in storage)
 */
export async function getTeamsNeedingMigration(): Promise<Array<{
  id: string;
  name: string;
  resolvedLogoUrl: string;
}>> {
  const { data, error } = await supabase
    .from('teams')
    .select('id, name, resolvedLogoUrl')
    .not('resolvedLogoUrl', 'is', null)
    .not('resolvedLogoUrl', 'like', '%supabase.co/storage%')
    .not('resolvedLogoUrl', 'like', '%/storage/v1/object/public/team-logos/%');

  if (error) {
    throw new Error(`Failed to fetch teams: ${error.message}`);
  }

  // Filter out any remaining Supabase storage URLs (for custom domains)
  return (data || []).filter(team => !isLogoInStorage(team.resolvedLogoUrl));
}

/**
 * Get storage statistics
 */
export async function getStorageStats(): Promise<{
  totalTeams: number;
  teamsInStorage: number;
  teamsNeedingMigration: number;
  teamsWithoutLogos: number;
}> {
  // Get all teams
  const { data: allTeams, error: allError } = await supabase
    .from('teams')
    .select('id, resolvedLogoUrl');

  if (allError || !allTeams) {
    throw new Error(`Failed to fetch teams: ${allError?.message || 'Unknown error'}`);
  }

  const totalTeams = allTeams.length;
  const teamsInStorage = allTeams.filter(t => isLogoInStorage(t.resolvedLogoUrl)).length;
  const teamsWithoutLogos = allTeams.filter(t => !t.resolvedLogoUrl).length;
  const teamsNeedingMigration = totalTeams - teamsInStorage - teamsWithoutLogos;

  return {
    totalTeams,
    teamsInStorage,
    teamsNeedingMigration,
    teamsWithoutLogos,
  };
}
