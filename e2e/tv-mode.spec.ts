import { expect, Page, test } from '@playwright/test';
import { freshMockData } from './helpers';

/**
 * TV mode next to a phone (two tabs = two devices, synced like realtime):
 * the TV follows the phone's New Match (with reveal), shows the picks once
 * everyone picked, and the table/latest results after a scored match.
 * A TV opened later gets the current matchup from the phone ("hello").
 */

// Cross-tab sync in mock mode is occasionally slow (also on main: night.spec "two tabs").
const SYNC = { timeout: 25_000 };

const predictionButtons = (page: Page) => page.getByRole('button', { name: /^Pick (?!& Ban)/ });

async function openTv(page: Page) {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/tv');
  await expect(page.getByText(/night #1 · live/i)).toBeVisible();
}

test('the TV follows the phone during a game night', async ({ context }) => {
  const phone = await context.newPage();
  await freshMockData(phone);
  await phone.goto('/night');
  await phone.getByRole('button', { name: /start game night/i }).click();
  await expect(phone.getByText(/night #1/i).first()).toBeVisible();

  const tv = await context.newPage();
  await openTv(tv);
  // The phone's automatic first draw is not announced.
  await expect(tv.getByText(/waiting for the next matchup/i)).toBeVisible();
  await tv.screenshot({ path: 'e2e/screenshots/tv-waiting.png' });

  // New Match on the phone → the TV plays the reveal and lands on the same teams.
  await phone.goto('/');
  await phone.getByRole('button', { name: /new match/i }).click();
  await expect(predictionButtons(phone).first()).toBeVisible({ timeout: 15_000 });
  const home = (await predictionButtons(phone).nth(0).getAttribute('aria-label'))!.replace(/^Pick /, '');
  const away = (await predictionButtons(phone).nth(1).getAttribute('aria-label'))!.replace(/^Pick /, '');

  const matchup = tv.getByRole('region', { name: /current matchup/i });
  await expect(matchup.getByText(home, { exact: true }).first()).toBeVisible({ timeout: 15_000 });
  await expect(matchup.getByText(away, { exact: true }).first()).toBeVisible();
  await expect(matchup.getByText(/who wins\? · 0\/4 picked/i)).toBeVisible();

  // Everyone picks the home team → the TV reveals the picks.
  for (let i = 0; i < 4; i++) {
    await phone.getByRole('button', { name: `Pick ${home}` }).first().click();
    await expect(phone.getByRole('button', { name: `Pick ${home}` })).toHaveCount(3 - i);
  }
  await expect(matchup.getByText(/all picked/i)).toBeVisible(SYNC);
  await tv.screenshot({ path: 'e2e/screenshots/tv-matchup.png' });

  // Save and score the match → table and latest results on the TV.
  await phone.getByRole('button', { name: /add match/i }).click();
  const addSheet = phone.getByRole('dialog', { name: /add match/i });
  for (const [side, name] of [[0, 'Alex'], [0, 'Bram'], [1, 'Chris'], [1, 'Dani']] as const) {
    await addSheet.getByRole('combobox').nth(side).selectOption({ label: name });
    await addSheet.getByRole('button', { name: /add player to/i }).nth(side).click();
  }
  await addSheet.getByRole('button', { name: /save & rematch/i }).click();
  await expect(addSheet).toBeHidden();
  await phone.getByRole('button', { name: /add score/i }).first().click();
  await phone.getByRole('spinbutton').nth(0).fill('2');
  await phone.getByRole('spinbutton').nth(1).fill('1');
  await phone.getByRole('button', { name: 'Save score' }).click();

  const table = tv.getByRole('region', { name: 'Tonight' });
  await expect(table.getByText('Alex')).toBeVisible(SYNC);
  await expect(tv.getByRole('region', { name: /latest results/i }).getByText('2', { exact: true })).toBeVisible(SYNC);
  await tv.screenshot({ path: 'e2e/screenshots/tv-live.png' });

  // A second TV opened now asks the phone and gets the current matchup straight away.
  const tv2 = await context.newPage();
  await openTv(tv2);
  await expect(tv2.getByRole('region', { name: /current matchup/i }).getByText(home, { exact: true }).first()).toBeVisible();
});
