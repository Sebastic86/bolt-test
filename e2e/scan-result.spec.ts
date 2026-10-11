import { expect, test } from '@playwright/test';
import { freshMockData, shot } from './helpers';

/**
 * Scan the result in mock mode on a phone. The mock vision reading has the
 * second team as home winning 3-1 for the away side (1-3 on screen), so the
 * app has to put 3 on team 1 and 1 on team 2 — then the user saves.
 */
test.beforeEach(async ({ page }) => freshMockData(page));

// 2x2 grey PNG: enough for the in-browser resize (the mock doesn't look at it).
const PHOTO = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAADklEQVR4nGNoAAMGCAUAKg4GARWeQtcAAAAASUVORK5CYII=',
  'base64'
);

test('scan the result screen to fill in the score', async ({ page }) => {
  await page.goto('/');

  // Record a match first.
  await page.getByRole('button', { name: /add match/i }).click();
  const addSheet = page.getByRole('dialog', { name: /add match/i });
  await addSheet.getByRole('combobox').nth(0).selectOption({ label: 'Alex' });
  await addSheet.getByRole('button', { name: /add player to/i }).nth(0).click();
  await addSheet.getByRole('combobox').nth(1).selectOption({ label: 'Bram' });
  await addSheet.getByRole('button', { name: /add player to/i }).nth(1).click();
  await addSheet.getByRole('button', { name: /save & rematch/i }).click();
  await expect(addSheet).toBeHidden();

  await page.getByRole('button', { name: /add score/i }).first().click();
  await expect(page.getByRole('button', { name: /scan result screen/i })).toBeVisible();

  await page.getByLabel('Photo of the result screen').setInputFiles({ name: 'fulltime.png', mimeType: 'image/png', buffer: PHOTO });
  await expect(page.getByText(/scanned: .+ 3–1 /i)).toBeVisible();
  await expect(page.getByRole('spinbutton').nth(0)).toHaveValue('3');
  await expect(page.getByRole('spinbutton').nth(1)).toHaveValue('1');
  await shot(page, 'scan-result-filled');

  await page.getByRole('button', { name: 'Save score' }).click();
  await expect(page.getByText(/scanned: .+ 3–1 /i)).toBeHidden();
  await expect(page.getByRole('button', { name: /edit score/i }).first()).toBeVisible();
});
