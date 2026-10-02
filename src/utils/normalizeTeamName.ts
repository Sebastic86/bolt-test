const SPECIAL_CHAR_MAP: Record<string, string> = {
  ü: 'u', ö: 'o', ä: 'a',
  Ü: 'U', Ö: 'O', Ä: 'A',
  ß: 'ss',
  é: 'e', è: 'e', ê: 'e', ë: 'e',
  É: 'E', È: 'E', Ê: 'E', Ë: 'E',
  á: 'a', à: 'a', â: 'a', å: 'a', ã: 'a',
  Á: 'A', À: 'A', Â: 'A', Å: 'A', Ã: 'A',
  í: 'i', ì: 'i', î: 'i', ï: 'i',
  Í: 'I', Ì: 'I', Î: 'I', Ï: 'I',
  ó: 'o', ò: 'o', ô: 'o', õ: 'o',
  Ó: 'O', Ò: 'O', Ô: 'O', Õ: 'O',
  ú: 'u', ù: 'u', û: 'u',
  Ú: 'U', Ù: 'U', Û: 'U',
  ñ: 'n', Ñ: 'N',
  ç: 'c', Ç: 'C',
  ø: 'o', Ø: 'O',
  æ: 'ae', Æ: 'AE',
  œ: 'oe', Œ: 'OE',
};

/**
 * Converts diacritics/special characters to their closest ASCII
 * equivalent — external team-lookup APIs (TheSportsDB in particular) often
 * match "Borussia Monchengladbach" but not "Borussia Mönchengladbach".
 * Used as a second attempt when the exact team name doesn't match.
 */
export function normalizeTeamName(name: string): string {
  let normalized = name;
  for (const [special, replacement] of Object.entries(SPECIAL_CHAR_MAP)) {
    // split/join instead of replaceAll — avoids depending on an ES2021+ lib target.
    normalized = normalized.split(special).join(replacement);
  }
  return normalized.trim();
}
