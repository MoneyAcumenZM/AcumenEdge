import React from 'react';

interface Props { children: React.ReactNode; fallback?: React.ReactNode; }
interface State { hasError: boolean; }

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught:', error, info);
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen bg-background flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <h2 className="text-foreground text-xl font-bold mb-3">Something went wrong</h2>
            <p className="text-muted-foreground mb-6">
              An unexpected error occurred. Your data is safe. Please refresh the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-primary text-primary-foreground font-bold px-6 py-3 rounded-lg"
            >
              Refresh Page
            </button>
            <p className="text-muted-foreground text-sm mt-4">
              If this keeps happening, contact trading@moneyacumenadvisory.com
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
