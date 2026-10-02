import { expect, Page, test } from '@playwright/test';
import { freshMockData, shot } from './helpers';

/**
 * A full game night in mock mode on an iPhone-sized screen:
 * start night → joker → predictions → add match → score → milestone and
 * prediction toasts → night page → end night → recap.
 */
test.beforeEach(async ({ page }) => freshMockData(page));

async function startNight(page: Page) {
  await page.goto('/night');
  await page.getByRole('button', { name: /start game night/i }).click();
  await expect(page.getByText(/night #1/i).first()).toBeVisible();
}

test('a full game night on a phone', async ({ page }) => {
  await startNight(page);
  await shot(page, 'night-live-empty');

  await page.goto('/');
  await expect(page.getByText('Live', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: /who wins/i })).toBeVisible();
  await shot(page, 'dashboard-live');

  // Joker: Alex replaces the second team with the first candidate.
  await page.getByRole('button', { name: /use a joker/i }).click();
  const sheet = page.getByRole('dialog', { name: /joker/i });
  await sheet.getByRole('button', { name: /alex/i }).first().click();
  await shot(page, 'joker-player');
  await sheet.getByRole('button').filter({ hasText: /ovr|\d{2}/i }).last().click();
  await sheet.getByRole('radiogroup', { name: /joker candidates/i }).getByRole('radio').first().click();
  await shot(page, 'joker-candidates');
  await sheet.getByRole('button', { name: /use joker/i }).click();
  await expect(sheet).toBeHidden();

  // Predictions: each player picks the home team; picks reveal once all 4 picked.
  const firstPick = page.getByRole('button', { name: /^Pick / }).first();
  const homeTeam = (await firstPick.getAttribute('aria-label'))!.replace(/^Pick /, '');
  for (let i = 0; i < 4; i++) {
    await page.getByRole('button', { name: `Pick ${homeTeam}` }).first().click();
    await expect(page.getByRole('button', { name: `Pick ${homeTeam}` })).toHaveCount(3 - i);
  }
  await expect(page.getByText(/all picked/i)).toBeVisible();

  // Alex also calls the exact score: 5-0 (worth +3 once the result is in).
  await page.getByRole('button', { name: /add exact score for alex/i }).click();
  await page.getByRole('spinbutton', { name: /goals/i }).nth(0).fill('5');
  await page.getByRole('spinbutton', { name: /goals/i }).nth(1).fill('0');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('button', { name: /alex's exact score 5–0/i })).toBeVisible();
  await page.getByRole('heading', { name: /who wins/i }).locator('xpath=../..').screenshot({ path: 'e2e/screenshots/predictions-panel.png' });
  await shot(page, 'predictions');

  // Add the match: Alex + Bram vs Chris + Dani.
  await page.getByRole('button', { name: /add match/i }).click();
  const addSheet = page.getByRole('dialog', { name: /add match/i });
  for (const [side, name] of [[0, 'Alex'], [0, 'Bram'], [1, 'Chris'], [1, 'Dani']] as const) {
    await addSheet.getByRole('combobox').nth(side).selectOption({ label: name });
    await addSheet.getByRole('button', { name: /add player to/i }).nth(side).click();
  }
  await shot(page, 'add-match');
  await addSheet.getByRole('button', { name: /save & rematch/i }).click();
  await expect(addSheet).toBeHidden();
  await expect(page.getByText(/locked for the saved match/i)).toBeVisible();

  // Score 5-0 → hammering milestone + prediction results.
  await page.getByRole('button', { name: /add score/i }).first().click();
  await page.getByRole('spinbutton').nth(0).fill('5');
  await page.getByRole('spinbutton').nth(1).fill('0');
  await page.getByRole('button', { name: 'Save score' }).click();
  await expect(page.getByText(/hammering/i)).toBeVisible();
  await expect(page.getByText(/Alex called it 5-0 \(\+3\)/)).toBeVisible();
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'e2e/screenshots/toasts.png' });

  // Night page: table, player of the night, prediction leaderboard; then end + recap.
  await page.goto('/night');
  // Alex & Bram won 5-0 together: they share the title.
  await expect(page.getByText(/players of the night/i).first()).toBeVisible();
  await shot(page, 'night-live');
  await page.getByRole('button', { name: /^end night$/i }).click();
  await page.getByRole('dialog').getByRole('button', { name: /end night/i }).click();
  const recap = page.getByRole('dialog', { name: /recap/i });
  await expect(recap).toBeVisible();
  await expect(recap.getByRole('button', { name: /share|download/i }).first()).toBeVisible();
  await page.waitForTimeout(500);
  await shot(page, 'recap');
});

test('two tabs stay in sync (two phones)', async ({ context }) => {
  const phoneA = await context.newPage();
  await freshMockData(phoneA);
  await phoneA.goto('/night');
  const phoneB = await context.newPage();
  await phoneB.goto('/night?mockRole=normal');
  await expect(phoneB.getByRole('button', { name: /start game night/i })).toBeVisible();

  await phoneA.getByRole('button', { name: /start game night/i }).click();
  await expect(phoneB.getByText(/night #1/i).first()).toBeVisible();
});
