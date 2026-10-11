/**
 * Mock FIFA Index pages for the `fifaindex-teams` Edge Function: renders a
 * FIFA Index-shaped list page (same markup the parser reads) from the mock FC27
 * teams — clubs whose name contains `q`, or the national teams. Ratings are the
 * mock team's plus a "roster update" (+1 OVR, +2 ATT) so the dashboard check
 * has something to show.
 */
import { normalizeTeamName } from '../utils/normalizeTeamName';

type Row = Record<string, unknown>;

const fold = (s: string) => normalizeTeamName(s).toLowerCase();
const cell = (value: number) => `<td class="px-3 py-2 text-center font-bold">${value}</td>`;

export function mockFifaIndexPage({ q, category }: { q?: string; category?: string }, teams: Row[]): string {
  const nations = category === 'nations';
  const rows = teams
    .filter(t => t.version === 'FC27' && (t.league === 'Nation') === nations)
    .filter(t => !q || fold(String(t.name)).includes(fold(q)))
    .map((t, i) => {
      const league = nations ? 'International' : `${t.league} (1)`;
      return `<tr><td><a href="/teams/${9000 + i}-mock"><span>${t.name}</span></a></td>` +
        `<td><a href="/leagues/${i + 1}-mock">${league}</a></td>` +
        cell(Number(t.overallRating) + 1) + cell(Number(t.attackRating) + 2) +
        cell(Number(t.midfieldRating)) + cell(Number(t.defendRating)) + '</tr>';
    });

  return `<html><body><h1>Teams in FC 27</h1><table><tbody>${rows.join('\n')}</tbody></table></body></html>`;
}
