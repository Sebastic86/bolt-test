/**
 * Floating "MOCK" panel (plain DOM, no React) — switch the signed-in role for
 * this tab, open another tab as a different player, or reset the mock data.
 */
import { resetDatabase } from './db';
import { getMockRole, MOCK_ROLES, MockRole, setMockRole } from './users';

const LABELS: Record<MockRole, string> = {
  admin: 'Admin',
  normal: 'Player',
  none: 'No role',
  out: 'Signed out',
};

export function mountMockPanel() {
  if (typeof document === 'undefined' || document.getElementById('mock-panel')) return;

  const mount = () => {
    const panel = document.createElement('div');
    panel.id = 'mock-panel';
    panel.setAttribute('data-testid', 'mock-panel');
    panel.style.cssText = [
      'position:fixed', 'left:0', 'top:calc(3.5rem + env(safe-area-inset-top) + 64px)', 'z-index:45',
      'font:700 11px/1.2 system-ui,sans-serif', 'text-transform:uppercase', 'letter-spacing:.04em',
    ].join(';');

    const toggle = document.createElement('button');
    toggle.textContent = 'Mock';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.style.cssText = 'writing-mode:vertical-rl;padding:8px 4px;background:#facc15;color:#111;border:2px solid #111;border-left:0;cursor:pointer;font:inherit';

    const body = document.createElement('div');
    body.style.cssText = 'display:none;position:absolute;left:0;top:0;width:180px;padding:8px;background:#fff;border:2px solid #111;box-shadow:4px 4px 0 #14532d';

    const role = getMockRole();
    const title = document.createElement('div');
    title.textContent = `Mock data · ${LABELS[role]}`;
    title.style.cssText = 'margin-bottom:6px';
    body.appendChild(title);

    const button = (label: string, onClick: () => void, active = false) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.style.cssText = `display:block;width:100%;min-height:36px;margin-top:4px;border:2px solid #111;font:inherit;cursor:pointer;background:${active ? '#22c55e' : '#fff'};color:#111`;
      b.addEventListener('click', onClick);
      body.appendChild(b);
      return b;
    };

    MOCK_ROLES.forEach(r => button(LABELS[r], () => { setMockRole(r); location.reload(); }, r === role));
    button('New tab (player)', () => window.open(`${location.pathname}?mockRole=normal`, '_blank'));
    button('Reset data', () => {
      if (confirm('Reset all mock data to the seed?')) resetDatabase();
    });
    button('Close', () => setOpen(false));

    const setOpen = (open: boolean) => {
      body.style.display = open ? 'block' : 'none';
      toggle.style.display = open ? 'none' : 'block';
      toggle.setAttribute('aria-expanded', String(open));
    };
    toggle.addEventListener('click', () => setOpen(true));

    panel.append(toggle, body);
    document.body.appendChild(panel);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
}
