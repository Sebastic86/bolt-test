import { expect, test } from '@playwright/test';
import { freshMockData, shot } from './helpers';

test.beforeEach(async ({ page }) => freshMockData(page));

const card = (page: import('@playwright/test').Page) => page.getByRole('region', { name: /install the app/i });

test('manifest and icons are served', async ({ request }) => {
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest).toMatchObject({ display: 'standalone', start_url: '/' });
  for (const icon of manifest.icons as { src: string }[]) {
    expect((await request.get(icon.src)).status(), icon.src).toBe(200);
  }
  expect((await request.get('/apple-touch-icon.png')).status()).toBe(200);
  expect((await request.get('/sw.js')).status()).toBe(200);
});

test.describe('iPhone (Safari)', () => {
  // The project's iPhone 13 profile already uses an iOS Safari user agent.
  test('shows Add to Home Screen steps, and the tip can be hidden', async ({ page }) => {
    await page.goto('/');
    await expect(card(page)).toBeVisible();
    await shot(page, 'install-card');

    await card(page).getByRole('button', { name: /how/i }).click();
    const sheet = page.getByRole('dialog', { name: /add to home screen/i });
    await expect(sheet.getByText(/scroll down and tap/i)).toBeVisible();
    await page.waitForTimeout(400); // let the sheet finish sliding up
    await page.screenshot({ path: 'e2e/screenshots/install-ios-steps.png' });
    await sheet.getByRole('button', { name: /got it/i }).click();

    await card(page).getByRole('button', { name: /hide install tip/i }).click();
    await expect(card(page)).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('heading', { name: /today's matches/i })).toBeVisible();
    await expect(card(page)).toHaveCount(0);

    // Still available from the account menu.
    await page.getByRole('button', { name: /open account menu/i }).click();
    await page.getByRole('button', { name: /install app/i }).click();
    await expect(page.getByRole('dialog', { name: /add to home screen/i })).toBeVisible();
  });
});

test.describe('Android (Chrome)', () => {
  test.use({
    userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36',
  });

  test('uses the browser install prompt', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /today's matches/i })).toBeVisible();
    await expect(card(page)).toHaveCount(0); // nothing offered until the browser allows it

    // Simulate Chrome deciding the app is installable.
    await page.evaluate(() => {
      const event = new Event('beforeinstallprompt') as Event & Record<string, unknown>;
      event.prompt = async () => { (window as unknown as Record<string, boolean>).__prompted = true; };
      event.userChoice = Promise.resolve({ outcome: 'accepted' });
      window.dispatchEvent(event);
    });

    await card(page).getByRole('button', { name: /^install$/i }).click();
    expect(await page.evaluate(() => (window as unknown as Record<string, boolean>).__prompted)).toBe(true);
    await expect(page.getByText(/open the app from your home screen/i)).toBeVisible();
  });
});

test('no install hints when already running from the home screen', async ({ page }) => {
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = (query: string) =>
      query.includes('display-mode: standalone')
        ? ({ matches: true, media: query, addEventListener() {}, removeEventListener() {} } as unknown as MediaQueryList)
        : original(query);
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /today's matches/i })).toBeVisible();
  await expect(card(page)).toHaveCount(0);
  await page.getByRole('button', { name: /open account menu/i }).click();
  await expect(page.getByRole('button', { name: /install app/i })).toHaveCount(0);
});
