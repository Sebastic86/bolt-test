import { createContext, useContext } from 'react';

export type ToastVariant = 'milestone' | 'success' | 'error' | 'info';

export interface ToastOptions {
  title: string;
  detail?: string;
  variant: ToastVariant;
  /** Defaults: milestone 7s, others 4s. */
  durationMs?: number;
  /** Optional stable id — a toast with an id already on screen/queued is ignored. */
  id?: string;
}

export type ToastFn = (options: ToastOptions) => void;

export const ToastContext = createContext<ToastFn | null>(null);

export function useToast(): { toast: ToastFn } {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error('useToast must be used within a ToastProvider');
  return { toast };
}
