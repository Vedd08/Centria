import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches rendering errors in the component tree and shows a friendly fallback UI
 * instead of unmounting the entire React app with a white screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[300px] flex items-center justify-center p-8">
          <div className="bg-surface-card rounded-[10px] border border-border p-8 max-w-md w-full text-center space-y-4 shadow-xs">
            <div className="w-12 h-12 rounded-full bg-status-danger/10 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6 text-status-danger" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-ink-primary">Something went wrong</h3>
              <p className="text-xs text-ink-secondary">
                {this.state.error?.message || 'An unexpected error occurred while rendering this section.'}
              </p>
            </div>
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Try again</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
