import { describe, expect, it } from 'vitest';
import { WikipediaSearchPage, buildWikipediaSearch, isNationalTeamLeague, pickWikipediaCrest } from './wikipediaCrest';

const thumb = (file: string) => ({
  source: `https://upload.wikimedia.org/wikipedia/en/thumb/x/xx/${file}/330px-${file}.png?utm_source=en.wikipedia.org&utm_campaign=api`,
});

/** Search results in the order Wikipedia ranked them (index 1 = top hit). */
const results = (...pages: [title: string, file?: string][]): WikipediaSearchPage[] =>
  pages.map(([title, file], i) => ({ title, index: i + 1, ...(file ? { thumbnail: thumb(file) } : {}) }));

describe('buildWikipediaSearch', () => {
  it('searches clubs as football clubs and nations as national teams', () => {
    expect(buildWikipediaSearch('Club Brugge', 'Pro League')).toBe('Club Brugge football club');
    expect(buildWikipediaSearch('Spain', 'Nation')).toBe('Spain national football team');
    expect(buildWikipediaSearch('Spain', 'International')).toBe('Spain national football team');
  });

  it('expands short SoFIFA names that do not search well', () => {
    expect(buildWikipediaSearch('OL', 'Ligue 1')).toBe('Olympique Lyonnais football club');
    expect(buildWikipediaSearch('Spurs', 'Premier League')).toBe('Tottenham Hotspur football club');
  });
});

describe('isNationalTeamLeague', () => {
  it('recognises the leagues stored for national teams', () => {
    expect(isNationalTeamLeague('Nation')).toBe(true);
    expect(isNationalTeamLeague('International')).toBe(true);
    expect(isNationalTeamLeague('Premier League')).toBe(false);
    expect(isNationalTeamLeague(null)).toBe(false);
  });
});

describe('pickWikipediaCrest', () => {
  it('returns the top club article with its crest, without tracking params', () => {
    const pages = results(['Manchester United F.C.', 'Manchester_United_FC_crest.svg'], ['2020–21 Manchester United F.C. season']);
    expect(pickWikipediaCrest(pages, 'Manchester United', 'Premier League')).toEqual({
      title: 'Manchester United F.C.',
      url: 'https://upload.wikimedia.org/wikipedia/en/thumb/x/xx/Manchester_United_FC_crest.svg/330px-Manchester_United_FC_crest.svg.png',
    });
  });

  it('follows search rank, not the order the API lists pages in', () => {
    const pages: WikipediaSearchPage[] = [
      { title: 'Inter Miami CF', index: 4, thumbnail: thumb('Inter_Miami.svg') },
      { title: 'Inter Milan', index: 1, thumbnail: thumb('Inter.svg') },
    ];
    expect(pickWikipediaCrest(pages, 'Inter', 'Serie A')?.title).toBe('Inter Milan');
  });

  it('skips women’s sides, seasons, rivalries and lists', () => {
    const pages = results(
      ['FC Barcelona Femení', 'Barca.svg'],
      ['2026–27 FC Barcelona season', 'Season.svg'],
      ['El Clásico rivalry FC Barcelona', 'Rivalry.svg'],
      ['FC Barcelona', 'FC_Barcelona_crest.svg']
    );
    expect(pickWikipediaCrest(pages, 'FC Barcelona', 'LaLiga')?.title).toBe('FC Barcelona');
    expect(pickWikipediaCrest(results(['OL Lyonnes', 'OL.svg']), 'OL', 'Ligue 1')).toBeNull();
  });

  it('skips articles without an image', () => {
    const pages = results(['Atlético Madrid'], ['Atlético Madrid B', 'B.svg'], ['Atlético Madrid', 'Atletico.svg']);
    expect(pickWikipediaCrest(pages, 'Atlético de Madrid', 'LaLiga')?.url).toContain('Atletico.svg');
  });

  it('requires the article to share a meaningful word with the team name', () => {
    // "Promise David" is a player who shows up when searching Union Saint-Gilloise.
    const pages = results(['Promise David', 'Player.jpg'], ['Royale Union Saint-Gilloise', 'USG.svg']);
    expect(pickWikipediaCrest(pages, 'Union Saint-Gilloise', 'Pro League')?.title).toBe('Royale Union Saint-Gilloise');
    expect(pickWikipediaCrest(results(['Fleet Spurs F.C.', 'Fleet.png']), 'Tottenham Hotspur', 'Premier League')).toBeNull();
  });

  it('matches across diacritics (Kasımpaşa ↔ Kasimpaşa, München ↔ Munich)', () => {
    expect(pickWikipediaCrest(results(['Kasımpaşa S.K.', 'K.svg']), 'Kasimpaşa SK', 'Süper Lig')?.title).toBe('Kasımpaşa S.K.');
    expect(pickWikipediaCrest(results(['FC Bayern Munich', 'B.svg']), 'FC Bayern München', 'Bundesliga')?.title).toBe('FC Bayern Munich');
  });

  it('only accepts the senior national team for nations', () => {
    const pages = results(
      ['List of football clubs in Spain'],
      ['Football in Spain', 'Flag.svg'],
      ['Spain women’s national football team', 'W.svg'],
      ['Spain national under-21 football team', 'U21.svg'],
      ['Spain national football team', 'Spain_crest.svg']
    );
    expect(pickWikipediaCrest(pages, 'Spain', 'Nation')?.title).toBe('Spain national football team');
  });

  it('returns null when nothing fits', () => {
    expect(pickWikipediaCrest([], 'Arsenal', 'Premier League')).toBeNull();
  });
});
