import { expect, Page, test } from '@playwright/test';
import { freshMockData, shot } from './helpers';

test.beforeEach(async ({ page }) => freshMockData(page));

async function startNight(page: Page) {
  await page.goto('/night');
  await page.getByRole('button', { name: /start game night/i }).click();
  await expect(page.getByText(/night #1/i).first()).toBeVisible();
}

/** Adds Alex vs Bram for the current matchup (from the dashboard). */
async function addMatch(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /add match/i }).click();
  const sheet = page.getByRole('dialog', { name: /add match/i });
  for (const [side, name] of [[0, 'Alex'], [1, 'Bram']] as const) {
    await sheet.getByRole('combobox').nth(side).selectOption({ label: name });
    await sheet.getByRole('button', { name: /add player to/i }).nth(side).click();
  }
  await sheet.getByRole('button', { name: /save & rematch/i }).click();
  await expect(sheet).toBeHidden();
}

const todayCount = (page: Page) =>
  page.getByRole('button', { name: /today's matches/i }).getByText(/^\d+$/);

test('delete a past night together with its matches', async ({ page }) => {
  await startNight(page);
  await addMatch(page);
  await expect(todayCount(page)).toHaveText('1');

  await page.goto('/night');
  await page.getByRole('button', { name: /^end night$/i }).click();
  await page.getByRole('dialog').getByRole('button', { name: /end night/i }).click();
  await page.getByRole('dialog', { name: /recap/i }).getByRole('button', { name: /close/i }).first().click();

  await page.getByRole('button', { name: /delete fc26 · night #1/i }).click();
  const sheet = page.getByRole('dialog', { name: /delete night/i });
  await expect(sheet.getByText(/also delete the 1 match/i)).toBeVisible();
  await sheet.getByRole('checkbox').check();
  await shot(page, 'delete-night-sheet');
  await sheet.getByRole('button', { name: /^delete$/i }).click();

  await expect(page.getByText(/night deleted/i)).toBeVisible();
  await expect(page.getByText(/no finished nights yet/i)).toBeVisible();
  await page.goto('/');
  await expect(todayCount(page)).toHaveText('0');
});

test('delete the running night but keep its match', async ({ page }) => {
  await startNight(page);
  await addMatch(page);

  await page.goto('/night');
  await page.getByRole('button', { name: /delete this night/i }).click();
  await page.getByRole('dialog', { name: /delete night/i }).getByRole('button', { name: /^delete$/i }).click();

  await expect(page.getByRole('button', { name: /start game night/i })).toBeVisible();
  await page.goto('/');
  await expect(todayCount(page)).toHaveText('1');
  await expect(page.getByText(/no game night running/i)).toBeVisible();
});

test("a player can't delete a night someone else started", async ({ page, context }) => {
  await startNight(page);

  const player = await context.newPage();
  await player.goto('/night?mockRole=normal');
  await expect(player.getByText(/night #1/i).first()).toBeVisible();
  await expect(player.getByRole('button', { name: /delete this night/i })).toHaveCount(0);
});
