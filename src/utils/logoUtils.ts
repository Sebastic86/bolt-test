/**
 * Utility function to get the local logo path from a team's logoUrl
 * @param logoUrl - The logoUrl from the database (can be a URL or filename)
 * @returns The Vite-resolved path to the logo asset
 */
export const getLogoPath = (logoUrl: string): string => {
  try {
    // Extract filename from URL or use as-is if it's already a filename
    let filename = logoUrl;

    // If it's a URL, extract the filename
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
