/**
 * Seed data for mock mode.
 *
 * If `src/mock/seed.local.json` exists (created by `npm run mock:snapshot`
 * from the real database, git-ignored) it is used. Otherwise a synthetic,
 * deterministic data set is generated: 4 fictional players, real club names
 * with made-up ratings for FC26 + FC27, and six past FC26 game nights.
 */
import type { Row, Tables } from './db';
import { MOCK_USERS } from './users';

type Snapshot = Partial<Record<'teams' | 'players' | 'matches' | 'match_players', Row[]>>;

const snapshots = import.meta.glob<Snapshot>('./seed.local.json', { eager: true, import: 'default' });

/** Deterministic PRNG (mulberry32) so every fresh seed looks the same. */
function prng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// [name, league, overall]
const CLUBS: [string, string, number][] = [
  ['Manchester City', 'Premier League', 86], ['Arsenal', 'Premier League', 85], ['Liverpool', 'Premier League', 85],
  ['Chelsea', 'Premier League', 82], ['Tottenham Hotspur', 'Premier League', 81], ['Newcastle United', 'Premier League', 81],
  ['Aston Villa', 'Premier League', 80], ['Manchester United', 'Premier League', 80], ['Brighton', 'Premier League', 77],
  ['Real Madrid', 'LaLiga', 87], ['FC Barcelona', 'LaLiga', 85], ['Atlético de Madrid', 'LaLiga', 83],
  ['Athletic Club', 'LaLiga', 79], ['Real Sociedad', 'LaLiga', 78], ['Villarreal', 'LaLiga', 77],
  ['FC Bayern München', 'Bundesliga', 86], ['Bayer 04 Leverkusen', 'Bundesliga', 83], ['Borussia Dortmund', 'Bundesliga', 82],
  ['RB Leipzig', 'Bundesliga', 81], ['VfB Stuttgart', 'Bundesliga', 78], ['Eintracht Frankfurt', 'Bundesliga', 77],
  ['Inter', 'Serie A', 85], ['AC Milan', 'Serie A', 82], ['Juventus', 'Serie A', 82], ['Napoli', 'Serie A', 82],
  ['Atalanta', 'Serie A', 80], ['AS Roma', 'Serie A', 79], ['Lazio', 'Serie A', 78],
  ['Paris Saint-Germain', 'Ligue 1', 85], ['AS Monaco', 'Ligue 1', 79], ['Olympique de Marseille', 'Ligue 1', 79],
  ['LOSC Lille', 'Ligue 1', 78], ['OL', 'Ligue 1', 77],
  ['PSV', 'Eredivisie', 78], ['Feyenoord', 'Eredivisie', 77], ['Ajax', 'Eredivisie', 76],
  ['Sporting CP', 'Liga Portugal', 80], ['SL Benfica', 'Liga Portugal', 80], ['FC Porto', 'Liga Portugal', 79],
  ['Club Brugge', 'Pro League', 76], ['Celtic', 'Scottish Premiership', 75], ['Galatasaray', 'Süper Lig', 78],
  ['France', 'Nation', 86], ['England', 'Nation', 85], ['Spain', 'Nation', 85], ['Germany', 'Nation', 84],
  ['Portugal', 'Nation', 84], ['Argentina', 'Nation', 84], ['Belgium', 'Nation', 81], ['Netherlands', 'Nation', 82],
];

const toStars = (overall: number) => Math.min(5, Math.max(3, Math.round((overall - 70) / 3) / 2 + 2.5));

function syntheticSeed(): Pick<Tables, 'teams' | 'players' | 'matches' | 'match_players'> {
  const random = prng(27);
  const pick = <T,>(items: T[]) => items[Math.floor(random() * items.length)];
  const created = '2025-08-01T12:00:00.000Z';

  const teams: Row[] = [];
  for (const version of ['FC26', 'FC27']) {
    CLUBS.forEach(([name, league, base], i) => {
      const overall = version === 'FC27' ? base + Math.round(random() * 4 - 2) : base;
      const spread = () => overall + Math.round(random() * 6 - 3);
      teams.push({
        id: `team-${version.toLowerCase()}-${i}`,
        name, league, version,
        rating: toStars(overall),
        overallRating: overall, attackRating: spread(), midfieldRating: spread(), defendRating: spread(),
        logoUrl: '', apiTeamId: null, apiTeamName: name, resolvedLogoUrl: null,
        created_at: created,
      });
    });
  }

  const players: Row[] = ['Alex', 'Bram', 'Chris', 'Dani'].map((name, i) => ({
    id: `player-${i + 1}`, name, avatar_url: null, created_at: created,
  }));

  // Six past FC26 nights, ~7 matches each, 2v2 and 1v2 like the real group.
  const matches: Row[] = [];
  const matchPlayers: Row[] = [];
  const fc26 = teams.filter(t => t.version === 'FC26');
  for (let night = 0; night < 6; night++) {
    const day = new Date();
    day.setDate(day.getDate() - 7 * (6 - night));
    day.setHours(20, 15, 0, 0);
    const lineup = night % 2 === 0 ? players : players.slice(0, 3);

    for (let n = 0; n < 7; n++) {
      const playedAt = new Date(day.getTime() + n * 22 * 60_000).toISOString();
      const [team1, team2] = [pick(fc26), pick(fc26)];
      if (team1.id === team2.id) continue;
      const score1 = Math.floor(random() * 5);
      const score2 = Math.floor(random() * 5);
      const id = `match-${night}-${n}`;
      matches.push({
        id, team1_id: team1.id, team2_id: team2.id, team1_score: score1, team2_score: score2,
        penalties_winner: score1 === score2 ? (random() < 0.5 ? 1 : 2) : null,
        played_at: playedAt, created_at: playedAt, created_by: MOCK_USERS.admin.id, game_night_id: null,
      });
      const shuffled = [...lineup].sort(() => random() - 0.5);
      const side1 = lineup.length === 4 ? shuffled.slice(0, 2) : shuffled.slice(0, 1);
      const side2 = lineup.length === 4 ? shuffled.slice(2) : shuffled.slice(1);
      side1.forEach(p => matchPlayers.push({ id: `${id}-${p.id}`, match_id: id, player_id: p.id, team_number: 1, created_at: playedAt }));
      side2.forEach(p => matchPlayers.push({ id: `${id}-${p.id}`, match_id: id, player_id: p.id, team_number: 2, created_at: playedAt }));
    }
  }

  return { teams, players, matches, match_players: matchPlayers };
}

export function buildSeed(): Tables {
  const snapshot = Object.values(snapshots)[0];
  const data = snapshot?.teams?.length ? snapshot : syntheticSeed();
  return {
    teams: data.teams ?? [],
    players: data.players ?? [],
    matches: (data.matches ?? []).map(m => ({ game_night_id: null, ...m })),
    match_players: data.match_players ?? [],
    user_profiles: [
      { id: MOCK_USERS.admin.id, role: 'admin', created_at: '2025-01-01T00:00:00.000Z', updated_at: '2025-01-01T00:00:00.000Z' },
      { id: MOCK_USERS.normal.id, role: 'normal', created_at: '2025-01-01T00:00:00.000Z', updated_at: '2025-01-01T00:00:00.000Z' },
    ],
    game_nights: [],
    predictions: [],
    night_jokers: [],
  };
}
