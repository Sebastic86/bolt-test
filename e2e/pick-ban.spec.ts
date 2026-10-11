import { expect, test } from '@playwright/test';
import { freshMockData, shot } from './helpers';

/** Pick & Ban draft in mock mode on a phone: ban, ban, pick, pick → the drafted matchup is on the dashboard. */
test.beforeEach(async ({ page }) => freshMockData(page));

test('draft a matchup with pick & ban', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /pick & ban instead/i }).click();

  const sheet = page.getByRole('dialog', { name: /pick & ban/i });
  await expect(sheet).toBeVisible();
  await shot(page, 'pick-ban-start');

  const radios = (label: RegExp) => sheet.getByRole('radiogroup', { name: label }).getByRole('radio');

  // 1. Home bans one of Away's teams.
  await radios(/away options to ban/i).first().click();
  await sheet.getByRole('button', { name: /^ban /i }).click();
  // 2. Away bans one of Home's teams.
  await radios(/home options to ban/i).first().click();
  await sheet.getByRole('button', { name: /^ban /i }).click();
  await shot(page, 'pick-ban-picking');

  // 3 + 4. Each side picks (auto-filled when only one option is left).
  for (const label of [/home options to pick/i, /away options to pick/i]) {
    const group = sheet.getByRole('radiogroup', { name: label });
    if (await group.count()) {
      await group.getByRole('radio').last().click();
      await sheet.getByRole('button', { name: /^pick /i }).click();
    }
  }

  await expect(sheet.getByText(/draft done/i)).toBeVisible();
  const summary = (await sheet.getByText(/draft done/i).textContent())!;
  const [home, away] = summary.replace(/^Draft done:\s*/, '').replace(/\.$/, '').split(' vs ');
  await shot(page, 'pick-ban-done');

  await sheet.getByRole('button', { name: /play this matchup/i }).click();
  await expect(sheet).toBeHidden();

  // Reveal animation, then both drafted teams are on the cards.
  await expect(page.getByText(home, { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(away, { exact: true }).first()).toBeVisible();
  await shot(page, 'pick-ban-result');
});
