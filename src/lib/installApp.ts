import { useSyncExternalStore } from 'react';

/**
 * "Add to home screen" support.
 *
 * - Android / Chrome / Edge fire `beforeinstallprompt`; we keep that event so an
 *   Install button can show the browser's own install dialog later.
 * - iOS Safari has no install API: the user must use Share → Add to Home Screen,
 *   so we show instructions instead.
 * - Once launched from the home screen the app runs in standalone display mode
 *   and every install hint is hidden.
 *
 * Import this module early (main.tsx) — `beforeinstallprompt` can fire before
 * React renders.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallMode =
  /** Already running as an installed app. */
  | 'installed'
  /** The browser offered an install prompt — show an Install button. */
  | 'prompt'
  /** iPhone/iPad — show "Share → Add to Home Screen" steps. */
  | 'ios'
  /** Nothing we can offer (desktop Firefox, in-app browsers, ...). */
  | 'unsupported';

export function getInstallMode(input: { standalone: boolean; ios: boolean; hasPrompt: boolean }): InstallMode {
  if (input.standalone) return 'installed';
  if (input.hasPrompt) return 'prompt';
  if (input.ios) return 'ios';
  return 'unsupported';
}

export function isIosDevice(userAgent: string, maxTouchPoints: number): boolean {
  // iPadOS 13+ reports itself as a Mac — touch support gives it away.
  return /iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1);
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installedNow = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());

function isStandalone(): boolean {
  return installedNow
    || window.matchMedia?.('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault(); // keep it for our own Install button
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installedNow = true;
    notify();
  });
}

/** A plain string, so useSyncExternalStore can compare snapshots by value. */
function getSnapshot(): InstallMode {
  return getInstallMode({
    standalone: isStandalone(),
    ios: isIosDevice(navigator.userAgent, navigator.maxTouchPoints ?? 0),
    hasPrompt: deferredPrompt !== null,
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const media = window.matchMedia?.('(display-mode: standalone)');
  const onChange = () => notify();
  media?.addEventListener?.('change', onChange);
  return () => {
    listeners.delete(listener);
    media?.removeEventListener?.('change', onChange);
  };
}

/** Shows the browser's install dialog. Only works in 'prompt' mode. */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable';
  const event = deferredPrompt;
  deferredPrompt = null; // a prompt event can only be used once
  await event.prompt();
  const { outcome } = await event.userChoice;
  notify();
  return outcome;
}

export function useInstallMode(): InstallMode {
  return useSyncExternalStore(subscribe, getSnapshot, () => 'unsupported');
}

/** Registers the (non-caching) service worker in production builds. */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(error => {
      console.warn('[installApp] Service worker registration failed:', error);
    });
  });
}
