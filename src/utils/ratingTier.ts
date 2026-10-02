export interface RatingTierColors {
  bg: string;
  fg: string;
}

/**
 * Maps a 0-99 attribute rating (ATT/MID/DEF/OVR) to the mono/green tier
 * colors from the approved design: an elite rating (>85) pops in green,
 * everything else is a grayscale scoreboard-style step down.
 */
export function ratingTier(value: number): RatingTierColors {
  if (value > 85) return { bg: '#22c55e', fg: '#ffffff' };
  if (value > 80) return { bg: '#e5e5e5', fg: '#111111' };
  if (value > 75) return { bg: '#eeeeee', fg: '#333333' };
  if (value > 70) return { bg: '#f3f3f3', fg: '#555555' };
  return { bg: '#ffffff', fg: '#999999' };
}
