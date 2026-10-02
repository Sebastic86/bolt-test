import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/**
 * The single replacement for every old `fixed inset-0` modal in the app —
 * portal-rendered (consistent stacking, no z-index guessing), slides up
 * from the bottom, closes on overlay click or Escape, and does a basic
 * focus trap (focuses the sheet on open, restores focus to whatever
 * triggered it on close). None of that existed in any of the old modals.
 */
export const BottomSheet: React.FC<BottomSheetProps> = ({ isOpen, onClose, title, children, footer }) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    triggerRef.current = document.activeElement as HTMLElement | null;
    sheetRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      triggerRef.current?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <button
        className="absolute inset-0 h-full w-full cursor-default bg-black/50"
        onClick={onClose}
        aria-label="Close"
        tabIndex={-1}
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="animate-sheet-up absolute inset-x-0 bottom-0 flex max-h-[88vh] flex-col border-t-[3px] border-(--color-ink) bg-white shadow-[0_-10px_30px_rgba(0,0,0,0.25)] focus:outline-none"
      >
        <div className="mx-auto mt-2.5 h-1 w-9 flex-none bg-(--color-ink)" />
        <div className="flex flex-none items-center justify-between border-b-2 border-(--color-ink) px-4 py-3">
          <h2 className="text-base font-black uppercase tracking-wide text-(--color-ink)">{title}</h2>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center border border-(--color-ink) text-(--color-ink)"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
        {footer && (
          <div className="flex-none border-t-2 border-(--color-ink) p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
