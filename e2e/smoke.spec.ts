import { expect, test } from '@playwright/test';
import { freshMockData, shot } from './helpers';

test.beforeEach(async ({ page }) => freshMockData(page));

test('dashboard loads signed in with seeded data', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /today's matches/i })).toBeVisible();
  await shot(page, 'dashboard');
});

test('night page start screen', async ({ page }) => {
  await page.goto('/night');
  await expect(page.getByText(/start a game night/i)).toBeVisible();
  await shot(page, 'night-start');
});

test('signed-out shows the login screen', async ({ page }) => {
  await page.goto('/?mockRole=out');
  await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
});

test('a user without a role sees account setup', async ({ page }) => {
  await page.goto('/?mockRole=none');
  await expect(page.getByText(/account setup required/i)).toBeVisible();
});
