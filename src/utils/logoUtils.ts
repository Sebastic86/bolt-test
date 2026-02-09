/**
 * Utility function to get the local logo path from a team's logoUrl
 *
 * @deprecated Use the new logoService with API integration instead.
 *             This function is kept for backward compatibility with local logos.
 *
 * @param logoUrl - The logoUrl from the database (can be a URL or filename)
 * @returns The Vite-resolved path to the logo asset
 */
export const getLogoPath = (logoUrl: string): string => {
  try {
    // If it's already a full URL (http/https), return as-is
    if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
      return logoUrl;
    }

    // Extract filename from URL or use as-is if it's already a filename
    let filename = logoUrl;

    // If it's a URL path, extract the filename
    if (logoUrl.includes('/')) {
      const parts = logoUrl.split('/');
      filename = parts[parts.length - 1];
    }

    // If no extension, assume .png
    if (!filename.includes('.')) {
      filename = `${filename}.png`;
    }

    // Use Vite's dynamic import for asset resolution
    return new URL(`../assets/logos/${filename}`, import.meta.url).href;
  } catch (error) {
    console.error(`[logoUtils] Error loading logo for: ${logoUrl}`, error);
    // Return empty string to trigger onError handler
    return '';
  }
};
