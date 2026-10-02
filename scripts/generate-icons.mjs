// Renders the app icons (Scoreboard Mono style) to public/ with Playwright's Chromium.
//   node scripts/generate-icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const INK = '#111111';
const GREEN = '#22c55e';
const DEEP = '#14532d';

/**
 * Black tile, green scoreboard card with a hard deep-green shadow, "FC" in heavy
 * ink type and a green stripe at the bottom — like the app header.
 * `inset` shrinks the artwork into the maskable safe zone (inner 80%).
 */
function iconSvg({ inset = 0, rounded = false } = {}) {
  const s = 512;
  const pad = 84 + inset;
  const card = s - pad * 2;
  const shadow = Math.round(card * 0.07);
  const font = Math.round(card * 0.48);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}" width="${s}" height="${s}">
  <rect width="${s}" height="${s}" fill="${INK}"${rounded ? ' rx="96"' : ''}/>
  <rect x="${pad + shadow}" y="${pad + shadow - 14}" width="${card}" height="${card}" fill="${DEEP}"/>
  <rect x="${pad}" y="${pad - 14}" width="${card}" height="${card}" fill="${GREEN}" stroke="${INK}" stroke-width="10"/>
  <text x="${s / 2}" y="${pad - 14 + card / 2}" dominant-baseline="central" text-anchor="middle"
    font-family="Arial Black, 'Segoe UI Black', system-ui, sans-serif" font-weight="900"
    font-size="${font}" letter-spacing="-4" fill="${INK}">FC</text>
  <rect x="0" y="${s - 40 - inset / 2}" width="${s}" height="${14}" fill="${GREEN}"/>
</svg>`;
}

const outputs = [
  { file: 'icons/icon-192.png', size: 192, svg: iconSvg() },
  { file: 'icons/icon-512.png', size: 512, svg: iconSvg() },
  { file: 'icons/maskable-512.png', size: 512, svg: iconSvg({ inset: 40 }) },
  { file: 'apple-touch-icon.png', size: 180, svg: iconSvg() },
  { file: 'favicon-32.png', size: 32, svg: iconSvg({ rounded: true }) },
];

mkdirSync(new URL('../public/icons', import.meta.url), { recursive: true });
writeFileSync(new URL('../public/favicon.svg', import.meta.url), iconSvg({ rounded: true }));

const browser = await chromium.launch();
const page = await browser.newPage();
for (const { file, size, svg } of outputs) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${svg.replace('width="512" height="512"', `width="${size}" height="${size}"`)}</body></html>`,
  );
  await page.screenshot({ path: new URL(`../public/${file}`, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'), omitBackground: true });
  console.log(`public/${file}`);
}
await browser.close();
