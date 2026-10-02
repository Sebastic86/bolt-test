import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Info, PartyPopper, X } from 'lucide-react';
import { ToastContext, ToastFn, ToastOptions, ToastVariant } from './toastContext';

/** Max toasts on screen at once; extras wait their turn. */
export const MAX_VISIBLE_TOASTS = 3;
const DEFAULT_DURATION: Record<ToastVariant, number> = {
  milestone: 7000,
  success: 4000,
  error: 4000,
  info: 4000,
};

interface ToastEntry extends ToastOptions {
  id: string;
}

const ICONS: Record<ToastVariant, React.ElementType> = {
  milestone: PartyPopper,
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
};

const ACCENT: Record<ToastVariant, string> = {
  milestone: 'bg-(--color-green-bright)',
  success: 'bg-(--color-green-mid)',
  error: 'bg-red-600',
  info: 'bg-(--color-ink)',
};

const ToastCard: React.FC<{ entry: ToastEntry; onDismiss: (id: string) => void }> = ({ entry, onDismiss }) => {
  const { id, title, detail, variant, durationMs } = entry;

  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(id), durationMs ?? DEFAULT_DURATION[variant]);
    return () => window.clearTimeout(timer);
  }, [id, durationMs, variant, onDismiss]);

  const Icon = ICONS[variant];
  const isError = variant === 'error';

  return (
    <div
      data-variant={variant}
      onClick={() => onDismiss(id)}
      className={`animate-toast-in pointer-events-auto flex cursor-pointer items-stretch border-2 bg-white shadow-hard ${
        isError ? 'border-red-600' : 'border-(--color-ink)'
      }`}
    >
      <div className={`w-1.5 flex-none ${ACCENT[variant]}`} aria-hidden="true" />
      <div className="flex min-w-0 flex-1 items-start gap-2.5 py-2.5 pl-3">
        <Icon
          className={`mt-0.5 h-5 w-5 flex-none ${
            isError ? 'text-red-600' : variant === 'milestone' ? 'text-(--color-green-mid)' : 'text-(--color-ink)'
          }`}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p
            className={`text-sm leading-tight ${
              variant === 'milestone' ? 'font-black uppercase tracking-wide' : 'font-bold'
            } ${isError ? 'text-red-700' : 'text-(--color-ink)'}`}
          >
            {title}
          </p>
          {detail && <p className="mt-0.5 text-sm leading-snug text-gray-700">{detail}</p>}
        </div>
      </div>
      <button
        type="button"
        onClick={e => {
          e.stopPropagation();
          onDismiss(id);
        }}
        className="flex h-10 w-10 flex-none items-center justify-center self-start text-(--color-ink)"
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

let toastSeq = 0;

/**
 * Toast stack pinned just below the header (safe-area aware), newest on top,
 * at most MAX_VISIBLE_TOASTS at once. Tap a toast to dismiss it.
 * Use via `useToast()` from './toastContext'.
 */
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const idsRef = useRef(new Set<string>());

  const dismiss = useCallback((id: string) => {
    idsRef.current.delete(id);
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback<ToastFn>(options => {
    const id = options.id ?? `toast-${++toastSeq}`;
    if (idsRef.current.has(id)) return;
    idsRef.current.add(id);
    setToasts(prev => [{ ...options, id }, ...prev]);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {createPortal(
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-x-3 top-[calc(3.5rem+env(safe-area-inset-top)+8px)] z-[60] mx-auto flex max-w-md flex-col gap-2"
        >
          {toasts.slice(0, MAX_VISIBLE_TOASTS).map(entry => (
            <ToastCard key={entry.id} entry={entry} onDismiss={dismiss} />
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
};
