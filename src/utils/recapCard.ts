import { RecapData } from './recapData';

/**
 * Canvas renderer for the shareable game-night recap image, in the
 * Scoreboard Mono style (ink header with green stripe, heavy uppercase type,
 * square boxes with a hard green shadow). TEXT ONLY: no crests/avatars, since
 * cross-origin images would taint the canvas and break toBlob().
 *
 * drawRecapCard only touches a small slice of the 2D context API so it can be
 * unit-tested with a fake context (jsdom has no canvas).
 */

export const RECAP_WIDTH = 1080;
export const RECAP_HEIGHT = 1350;

export type RecapContext = Pick<
  CanvasRenderingContext2D,
  'fillStyle' | 'font' | 'textAlign' | 'textBaseline' | 'fillRect' | 'fillText' | 'measureText' | 'save' | 'restore'
>;

const INK = '#111111';
const BG = '#fafafa';
const GREEN = '#22c55e';
const GREEN_MID = '#16a34a';
const GREEN_DEEP = '#14532d';
const GRAY = '#6b7280';
const LIGHT_GRAY = '#e5e7eb';
const WHITE = '#ffffff';

const FONT_STACK = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const PAD = 64;
const BORDER = 6;
const SHADOW = 12;
const MAX_TABLE_ROWS = 6;

const font = (size: number, weight = 900) => `${weight} ${size}px ${FONT_STACK}`;

/** Ellipsize `text` so it fits `maxWidth` in the current font. */
export function fitText(ctx: Pick<RecapContext, 'measureText'>, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let end = text.length;
  while (end > 0 && ctx.measureText(`${text.slice(0, end)}…`).width > maxWidth) end -= 1;
  return end > 0 ? `${text.slice(0, end)}…` : '';
}

function text(
  ctx: RecapContext,
  value: string,
  x: number,
  y: number,
  opts: { size: number; color: string; weight?: number; align?: CanvasTextAlign; maxWidth?: number }
) {
  ctx.font = font(opts.size, opts.weight ?? 900);
  ctx.fillStyle = opts.color;
  ctx.textAlign = opts.align ?? 'left';
  ctx.fillText(opts.maxWidth ? fitText(ctx, value, opts.maxWidth) : value, x, y);
}

/** White box with an ink border and optional hard green shadow. */
function box(ctx: RecapContext, x: number, y: number, w: number, h: number, opts: { shadow?: boolean; fill?: string } = {}) {
  if (opts.shadow) {
    ctx.fillStyle = GREEN_DEEP;
    ctx.fillRect(x + SHADOW, y + SHADOW, w, h);
  }
  ctx.fillStyle = INK;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = opts.fill ?? WHITE;
  ctx.fillRect(x + BORDER, y + BORDER, w - BORDER * 2, h - BORDER * 2);
}

const upper = (s: string) => s.toUpperCase();

export function drawRecapCard(ctx: RecapContext, data: RecapData): void {
  const W = RECAP_WIDTH;
  const H = RECAP_HEIGHT;
  const innerW = W - PAD * 2;

  ctx.save();
  ctx.textBaseline = 'alphabetic';

  // Background
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // Header bar + green stripe
  const headerH = 240;
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, headerH);
  ctx.fillStyle = GREEN;
  ctx.fillRect(0, headerH, W, 9);

  text(ctx, 'GAME NIGHT RECAP', PAD, 76, { size: 30, color: GREEN });
  text(ctx, upper(data.title), PAD, 160, { size: 84, color: WHITE, maxWidth: innerW });
  text(ctx, upper(data.subtitle), PAD, 210, { size: 30, color: '#d1d5db', weight: 700, maxWidth: innerW });

  let y = headerH + 9 + 40;

  // Player of the night
  const potnH = 180;
  box(ctx, PAD, y, innerW - SHADOW, potnH, { shadow: true });
  text(ctx, 'PLAYER OF THE NIGHT', PAD + 36, y + 54, { size: 28, color: GREEN_MID });
  const potn = data.playerOfTheNight;
  if (potn) {
    text(ctx, upper(potn.name), PAD + 36, y + 118, { size: 60, color: INK, maxWidth: innerW - SHADOW - 72 });
    text(
      ctx,
      `${potn.wins}W  ${potn.losses}L  ·  ${potn.points} PTS  ·  GD ${potn.gd}`,
      PAD + 36,
      y + 158,
      { size: 30, color: GRAY, weight: 800, maxWidth: innerW - SHADOW - 72 }
    );
  } else {
    text(ctx, 'NO RESULTS YET', PAD + 36, y + 118, { size: 52, color: GRAY });
  }
  y += potnH + SHADOW + 36;

  // Final table
  text(ctx, 'FINAL TABLE', PAD, y, { size: 28, color: INK });
  y += 18;
  const rows = data.table.slice(0, MAX_TABLE_ROWS);
  const rowH = 64;
  const colPts = W - PAD - 24;
  const colGd = colPts - 120;
  const colL = colGd - 110;
  const colW = colL - 80;
  const nameX = PAD + 24 + 56;
  // Column header
  ctx.fillStyle = INK;
  ctx.fillRect(PAD, y, innerW, 44);
  const headY = y + 31;
  text(ctx, 'PLAYER', nameX + 16, headY, { size: 22, color: WHITE });
  text(ctx, 'W', colW, headY, { size: 22, color: WHITE, align: 'right' });
  text(ctx, 'L', colL, headY, { size: 22, color: WHITE, align: 'right' });
  text(ctx, 'GD', colGd, headY, { size: 22, color: WHITE, align: 'right' });
  text(ctx, 'PTS', colPts, headY, { size: 22, color: GREEN, align: 'right' });
  y += 44;

  if (rows.length === 0) {
    ctx.fillStyle = WHITE;
    ctx.fillRect(PAD, y, innerW, rowH);
    text(ctx, 'NO SCORED MATCHES', PAD + 24, y + 42, { size: 26, color: GRAY });
    y += rowH;
  }
  rows.forEach((row, i) => {
    ctx.fillStyle = i % 2 === 0 ? WHITE : '#f3f4f6';
    ctx.fillRect(PAD, y, innerW, rowH);
    ctx.fillStyle = LIGHT_GRAY;
    ctx.fillRect(PAD, y + rowH - 2, innerW, 2);
    // Rank square
    ctx.fillStyle = i === 0 ? GREEN : INK;
    ctx.fillRect(PAD + 20, y + 14, 36, 36);
    text(ctx, String(i + 1), PAD + 38, y + 42, { size: 24, color: WHITE, align: 'center' });
    const baseline = y + 43;
    text(ctx, upper(row.name), nameX + 16, baseline, { size: 32, color: INK, maxWidth: colW - 60 - (nameX + 16) });
    text(ctx, String(row.wins), colW, baseline, { size: 32, color: INK, align: 'right' });
    text(ctx, String(row.losses), colL, baseline, { size: 32, color: INK, align: 'right' });
    text(ctx, row.gd, colGd, baseline, { size: 32, color: INK, align: 'right' });
    text(ctx, String(row.points), colPts, baseline, { size: 36, color: GREEN_MID, align: 'right' });
    y += rowH;
  });
  // Table border (left/right/bottom lines, square corners)
  const tableTop = y - Math.max(rows.length, 1) * rowH - 44;
  ctx.fillStyle = INK;
  ctx.fillRect(PAD, tableTop, 4, y - tableTop);
  ctx.fillRect(PAD + innerW - 4, tableTop, 4, y - tableTop);
  ctx.fillRect(PAD, y - 4, innerW, 4);
  y += 36;

  // Stat tiles
  const tiles: [string, number][] = [
    ['MATCHES', data.matchCount],
    ['GOALS', data.totalGoals],
    ['PENALTIES', data.penaltyCount],
  ];
  const gap = 20;
  const tileW = (innerW - gap * 2) / 3;
  const tileH = 120;
  tiles.forEach(([label, value], i) => {
    const x = PAD + i * (tileW + gap);
    box(ctx, x, y, tileW, tileH);
    text(ctx, String(value), x + tileW / 2, y + 72, { size: 56, color: INK, align: 'center' });
    text(ctx, label, x + tileW / 2, y + 104, { size: 22, color: GRAY, align: 'center' });
  });
  y += tileH + 36;

  // Highlights: biggest win + prediction champion
  const footerH = 72;
  const lineGap = 84;
  const maxY = H - footerH - 24;
  if (data.biggestWin && y + 70 <= maxY) {
    const bw = data.biggestWin;
    text(ctx, 'BIGGEST WIN', PAD, y, { size: 24, color: GREEN_MID });
    text(ctx, upper(`${bw.winnerTeam} ${bw.score} ${bw.loserTeam}`), PAD, y + 42, { size: 34, color: INK, maxWidth: innerW });
    y += lineGap;
  }
  if (data.predictionChampion && y + 70 <= maxY) {
    const pc = data.predictionChampion;
    text(ctx, 'PREDICTION CHAMPION', PAD, y, { size: 24, color: GREEN_MID });
    const exact = pc.exact > 0 ? ` · ${pc.exact} EXACT` : '';
    text(ctx, upper(`${pc.name} · ${pc.points} PTS${exact}`), PAD, y + 42, { size: 34, color: INK, maxWidth: innerW });
  }

  // Footer bar
  ctx.fillStyle = INK;
  ctx.fillRect(0, H - footerH, W, footerH);
  ctx.fillStyle = GREEN;
  ctx.fillRect(0, H - footerH, W, 6);
  text(ctx, 'EA FC GENERATOR', PAD, H - 26, { size: 26, color: WHITE });
  text(ctx, `${data.matchCount} MATCHES · ${data.totalGoals} GOALS`, W - PAD, H - 26, { size: 22, color: GREEN, align: 'right' });

  ctx.restore();
}

/** Renders the recap card to a PNG Blob (browser only). */
export function renderRecapPng(data: RecapData): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = RECAP_WIDTH;
    canvas.height = RECAP_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Canvas is not supported on this device.'));
      return;
    }
    try {
      drawRecapCard(ctx, data);
    } catch (error) {
      reject(error instanceof Error ? error : new Error('Could not draw the recap image.'));
      return;
    }
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Could not create the recap image.'));
    }, 'image/png');
  });
}
