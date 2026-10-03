/**
 * Mock SoFIFA team search for the `sofifa-teams` Edge Function: renders a
 * SoFIFA-shaped list page (same markup the parser reads) from the mock FC27
 * teams whose name contains the keyword. Ratings are the mock team's plus a
 * "roster update" (+1 OVR, +2 ATT) so the dashboard check has something to show.
 */
import { normalizeTeamName } from '../utils/normalizeTeamName';

type Row = Record<string, unknown>;

const fold = (s: string) => normalizeTeamName(s).toLowerCase();
const cell = (col: string, value: number) => `<td class="" data-col="${col}"><em title="${value}">${value}</em></td>`;

export function mockSofifaSearchPage(keyword: string, teams: Row[]): string {
  const rows = teams
    .filter(t => t.version === 'FC27' && fold(String(t.name)).includes(fold(keyword)))
    .map((t, i) => {
      const league = t.league === 'Nation'
        ? '<a href="/teams?as=6" class="sub">UEFA</a>'
        : `<a href="/league/${i + 1}" class="sub">${t.league}</a>`;
      return `<tr><td class="a1"></td><td class="s20"><a href="/team/${9000 + i}/mock/270003/">${t.name}</a><br>${league}</td>` +
        cell('oa', Number(t.overallRating) + 1) + cell('at', Number(t.attackRating) + 2) +
        cell('md', Number(t.midfieldRating)) + cell('df', Number(t.defendRating)) + '</tr>';
    });

  return `<html><body>
<select id="select-version"><option value="/teams?r=270003&set=true" selected>FC27</option></select>
<select id="select-roster"><option value="/teams?r=270003&set=true" selected>Oct 1, 2026</option></select>
<table><tbody>${rows.join('\n')}</tbody></table>
</body></html>`;
}
