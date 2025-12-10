import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    // Optionally trigger a full reset
    try {
      window.electronAPI?.triggerReset?.();
    } catch (e) {
      console.error('Error triggering reset:', e);
    }
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full border border-red-500/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <span className="text-red-500 text-xl">⚠️</span>
              </div>
              <div>
                <h2 className="text-white font-semibold">Something went wrong</h2>
                <p className="text-gray-400 text-sm">An error occurred in the application</p>
              </div>
            </div>
            
            {this.state.error && (
              <div className="bg-black/50 rounded p-3 mb-4 overflow-auto max-h-32">
                <code className="text-red-400 text-xs font-mono break-all">
                  {this.state.error.message}
                </code>
              </div>
            )}
            
            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md py-2 px-4 text-sm font-medium transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white rounded-md py-2 px-4 text-sm font-medium transition-colors"
              >
                Reload App
              </button>
            </div>
            
            <p className="text-gray-500 text-xs mt-4 text-center">
              Press Ctrl+R to reset queues or Ctrl+Q to quit
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
