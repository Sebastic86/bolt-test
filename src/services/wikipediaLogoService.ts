import { WikipediaCrest, WikipediaSearchPage, buildWikipediaSearch, pickWikipediaCrest } from '../utils/wikipediaCrest';
import { rateLimitErrorFrom } from './rateLimitError';

/**
 * Wikipedia client — free, no API key, CORS-enabled (origin=*). One request
 * per team: a full-text search whose results come back with each article's
 * lead image (the infobox crest). `pilicense=any` is needed because most club
 * crests are non-free files that the default "free images only" mode hides.
 * Images are served from upload.wikimedia.org, which allows hotlinking and
 * cross-origin fetches (so the storage migration can copy them).
 *
 * Wikimedia throttles bursts from one client, so callers should space
 * requests out (~1/s); a 429 throws a RateLimitError.
 */

const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php';
const THUMBNAIL_SIZE = 330; // one of Wikimedia's standard thumbnail widths

interface WikipediaSearchResponse {
  query?: { pages?: WikipediaSearchPage[] };
}

export async function fetchTeamLogoFromWikipedia(
  teamName: string,
  league?: string | null,
  { signal }: { signal?: AbortSignal } = {}
): Promise<WikipediaCrest | null> {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    origin: '*',
    generator: 'search',
    gsrsearch: buildWikipediaSearch(teamName, league),
    gsrlimit: '8',
    prop: 'pageimages',
    piprop: 'thumbnail',
    pithumbsize: String(THUMBNAIL_SIZE),
    pilicense: 'any',
  });

  const response = await fetch(`${WIKIPEDIA_API}?${params}`, {
    signal,
    // Browsers can't set User-Agent; Wikimedia asks client-side tools to identify via this header.
    headers: { 'Api-User-Agent': 'bolt-test team logo resolver' },
  });
  if (response.status === 429) throw rateLimitErrorFrom('Wikipedia', response);
  if (!response.ok) throw new Error(`Wikipedia request failed: ${response.status}`);

  const data: WikipediaSearchResponse = await response.json();
  return pickWikipediaCrest(data.query?.pages ?? [], teamName, league);
}
