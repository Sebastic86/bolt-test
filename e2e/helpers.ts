import { Page } from '@playwright/test';

/**
 * Screenshot of the whole app content. The app scrolls inside <main> (fixed
 * header + bottom nav), so a normal fullPage shot only shows one screen:
 * temporarily grow the viewport to fit main's content.
 */
export async function shot(page: Page, name: string) {
  const viewport = page.viewportSize()!;
  const height = await page.evaluate(() => {
    const main = document.querySelector('main');
    if (!main) return document.documentElement.scrollHeight;
    return document.documentElement.clientHeight - main.clientHeight + main.scrollHeight;
  });
  await page.setViewportSize({ width: viewport.width, height: Math.min(Math.max(height, viewport.height), 8000) });
  await page.waitForTimeout(150);
  await page.screenshot({ path: `e2e/screenshots/${name}.png` });
  await page.setViewportSize(viewport);
}

/** Wipe mock data once per test (before the app boots), keep it across reloads. */
export async function freshMockData(page: Page) {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e-booted')) {
      localStorage.clear();
      sessionStorage.setItem('e2e-booted', '1');
    }
  });
}
