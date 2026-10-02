import { describe, expect, it } from 'vitest';
import { normalizeTeamName } from './normalizeTeamName';

describe('normalizeTeamName', () => {
  it('converts German umlauts and eszett', () => {
    expect(normalizeTeamName('Borussia Mönchengladbach')).toBe('Borussia Monchengladbach');
    expect(normalizeTeamName('FC St. Paulißen')).toBe('FC St. Paulissen');
  });

  it('converts French/Portuguese accents', () => {
    expect(normalizeTeamName('AS Saint-Étienne')).toBe('AS Saint-Etienne');
    expect(normalizeTeamName('Vitória Guimarães')).toBe('Vitoria Guimaraes');
  });

  it('converts Nordic and Turkish-adjacent characters', () => {
    expect(normalizeTeamName('FC København')).toBe('FC Kobenhavn');
  });

  it('leaves plain ASCII names untouched', () => {
    expect(normalizeTeamName('Manchester United')).toBe('Manchester United');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeTeamName('  Real Madrid  ')).toBe('Real Madrid');
  });
});
