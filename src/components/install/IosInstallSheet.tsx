import React from 'react';
import { PlusSquare, Share } from 'lucide-react';
import { BottomSheet, Button } from '../ui';

function Step({ number, children }: { number: number; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 border-2 border-(--color-ink) bg-white p-3">
      <span className="flex h-7 w-7 flex-none items-center justify-center bg-(--color-ink) text-sm font-black text-white">
        {number}
      </span>
      <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm text-(--color-ink)">{children}</span>
    </li>
  );
}

/** iPhone/iPad: Safari has no install button — walk through the Share menu. */
export function IosInstallSheet({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Add to Home Screen"
      footer={<Button className="w-full" onClick={onClose}>Got it</Button>}
    >
      <ol className="space-y-2">
        <Step number={1}>
          Tap <span className="inline-flex items-center gap-1 font-bold"><Share className="h-4 w-4" aria-hidden="true" /> Share</span>
          in Safari's toolbar
        </Step>
        <Step number={2}>
          Scroll down and tap
          <span className="inline-flex items-center gap-1 font-bold"><PlusSquare className="h-4 w-4" aria-hidden="true" /> Add to Home Screen</span>
        </Step>
        <Step number={3}>
          <span>Tap <span className="font-bold">Add</span>. Then open the app from your home screen.</span>
        </Step>
      </ol>
      <p className="mt-3 text-xs text-gray-500">
        Don't see Add to Home Screen? Open this page in Safari first.
      </p>
    </BottomSheet>
  );
}

