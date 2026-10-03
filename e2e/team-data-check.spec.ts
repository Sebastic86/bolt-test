import { expect, test } from '@playwright/test';
import { freshMockData, shot } from './helpers';

test.beforeEach(async ({ page }) => freshMockData(page));

test('admin checks a drawn team against SoFIFA and updates it', async ({ page }) => {
  await page.goto('/?mockRole=admin');
  const check = page.getByRole('button', { name: /^check .+ on sofifa$/i }).first();
  await expect(check).toBeVisible();
  await shot(page, 'team-check-card');

  const teamName = (await check.getAttribute('aria-label'))!.replace(/^Check (.+) on SoFIFA$/, '$1');
  await check.click();

  const sheet = page.getByRole('dialog', { name: /check team data/i });
  const ovrRow = sheet.getByRole('row', { name: /ovr/i });
  await expect(ovrRow).toBeVisible();
  const [now, sofifa] = await ovrRow.getByRole('cell').allInnerTexts();
  expect(Number(sofifa)).toBe(Number(now) + 1); // the mock's "roster update"
  await page.screenshot({ path: 'e2e/screenshots/team-check-sheet.png' });

  await sheet.getByRole('button', { name: /update team/i }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByText(`${teamName} updated`)).toBeVisible();

  // The card shows the saved ratings, and a second check finds nothing left to change.
  await expect(page.getByText(`OVR ${sofifa}`, { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: `Check ${teamName} on SoFIFA` }).click();
  await expect(sheet.getByText(/already matches sofifa/i)).toBeVisible();
  await expect(sheet.getByRole('button', { name: /up to date/i })).toBeDisabled();
});

test('normal users do not see the SoFIFA check', async ({ page }) => {
  await page.goto('/?mockRole=normal');
  await expect(page.getByRole('heading', { name: /today's matches/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /on sofifa$/i })).toHaveCount(0);
});
