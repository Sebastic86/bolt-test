import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  /** Optional hook for reporting caught errors (e.g. to an error tracker) — the boundary itself only logs to the console. */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Isolates a section of the dashboard so one broken stats widget (bad data
 * shape, a divide-by-zero, whatever) can't take the whole page down with it.
 * None of the old app's 10+ per-section usages had this — every section on
 * that page rendered unguarded.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const title = this.props.fallbackTitle ?? 'Something went wrong';
      return (
        <div className="my-2 border-2 border-red-600 bg-red-50 p-4 text-center">
          <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-red-600" />
          <h3 className="mb-1 text-sm font-black uppercase tracking-wide text-red-700">{title}</h3>
          <p className="mb-3 text-xs text-red-600">
            {this.state.error?.message ?? 'An unexpected error occurred in this section.'}
          </p>
          <button
            onClick={this.handleRetry}
            className="inline-flex items-center gap-1.5 border-2 border-red-600 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-red-700"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
