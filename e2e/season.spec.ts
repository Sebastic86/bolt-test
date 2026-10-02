import { expect, Page, test } from '@playwright/test';
import { freshMockData } from './helpers';

/** Mock seed has FC26 and FC27 teams — FC27 is the current season. */
test.beforeEach(async ({ page }) => freshMockData(page));

const matchupVersions = (page: Page) => page.getByText(/^\(FC2\d\)$/);

async function versionSelect(page: Page) {
  await page.getByRole('button', { name: /^settings$/i }).click();
  const sheet = page.getByRole('dialog', { name: /settings/i });
  return { sheet, select: sheet.locator('select', { has: page.locator('option', { hasText: 'current season' }) }) };
}

test('a fresh phone generates FC27 matchups', async ({ page }) => {
  await page.goto('/');
  await expect(matchupVersions(page).first()).toHaveText('(FC27)');
  await expect(matchupVersions(page)).toHaveCount(2);
  await expect(matchupVersions(page).filter({ hasText: 'FC26' })).toHaveCount(0);

  const { select } = await versionSelect(page);
  await expect(select).toHaveValue('FC27');
  await expect(select.locator('option:checked')).toHaveText('FC27 (current season)');
});

test('a phone that had FC26 saved moves to FC27 once', async ({ page }) => {
  // Old builds always stored the version; no settings revision yet.
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('old-settings')) {
      localStorage.setItem('fcGeneratorSelectedVersion', 'FC26');
      sessionStorage.setItem('old-settings', '1');
    }
  });
  await page.goto('/');
  await expect(matchupVersions(page).first()).toHaveText('(FC27)');
});

test('choosing FC26 in settings sticks after a reload', async ({ page }) => {
  await page.goto('/');
  const { sheet, select } = await versionSelect(page);
  await select.selectOption('FC26');
  await sheet.getByRole('button', { name: /save & close/i }).click();
  await expect(matchupVersions(page).first()).toHaveText('(FC26)');

  await page.reload();
  await expect(matchupVersions(page).first()).toHaveText('(FC26)');

  // Back to the current season: stored as "follow the newest".
  const again = await versionSelect(page);
  await again.select.selectOption('FC27');
  await again.sheet.getByRole('button', { name: /save & close/i }).click();
  await expect(matchupVersions(page).first()).toHaveText('(FC27)');
  expect(await page.evaluate(() => localStorage.getItem('fcGeneratorSelectedVersion'))).toBeNull();
});

test('a new game night defaults to FC27', async ({ page }) => {
  await page.goto('/night');
  await expect(page.getByRole('combobox', { name: /version/i })).toHaveValue('FC27');
});
