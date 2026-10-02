/**
 * Shared plumbing for the admin Dev Tools: every tool reports through a
 * ToolContext (log lines + progress) instead of the console, and honours an
 * AbortSignal so long runs can be cancelled from the panel.
 */

export type LogLevel = 'info' | 'success' | 'warn' | 'error';

export interface ToolContext {
  log: (level: LogLevel, message: string, imageUrl?: string) => void;
  progress: (done: number, total: number, label?: string) => void;
  signal: AbortSignal;
}

export interface RunStats {
  total: number;
  success: number;
  failed: number;
  skipped: number;
  cancelled: boolean;
}

export const emptyStats = (total = 0): RunStats => ({ total, success: 0, failed: 0, skipped: 0, cancelled: false });

/** setTimeout that resolves early (without throwing) when the signal aborts. */
export function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    if (signal.aborted || ms <= 0) return resolve();
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    }
    signal.addEventListener('abort', done, { once: true });
  });
}

export function summarize(ctx: ToolContext, title: string, stats: RunStats): void {
  const line = `${title}: ${stats.success} ok, ${stats.failed} failed, ${stats.skipped} skipped (of ${stats.total})`;
  if (stats.cancelled) ctx.log('warn', `${line} — cancelled`);
  else ctx.log(stats.failed > 0 ? 'warn' : 'success', line);
}

export const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));
