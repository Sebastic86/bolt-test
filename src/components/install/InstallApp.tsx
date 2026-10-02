import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { Button } from '../ui';
import { useInstallFlow } from './useInstallFlow';

const DISMISSED_KEY = 'fcInstallCardDismissed';

/** Dismissible "install on your home screen" card for the dashboard. */
export const InstallAppCard: React.FC = () => {
  const { canInstall, mode, start, sheet } = useInstallFlow();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISSED_KEY) === '1';
    } catch {
      return false;
    }
  });

  if (!canInstall || dismissed) return sheet;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // ignore
    }
  };

  return (
    <>
      <section
        aria-label="Install the app"
        className="flex items-center gap-3 border-2 border-(--color-ink) bg-white py-2 pr-2 pl-3"
      >
        <Smartphone className="h-6 w-6 flex-none text-(--color-green-mid)" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-wide text-(--color-ink)">Add to home screen</p>
          <p className="text-[11px] text-gray-500">Opens full-screen, like an app.</p>
        </div>
        <Button onClick={start} className="h-10 flex-none px-3 text-xs">
          <Download className="h-4 w-4" aria-hidden="true" />
          {mode === 'ios' ? 'How' : 'Install'}
        </Button>
        <button
          type="button"
          onClick={dismiss}
          className="flex h-10 w-10 flex-none items-center justify-center text-gray-500"
          aria-label="Hide install tip"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </section>
      {sheet}
    </>
  );
};
