import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg m-4">
          <h3 className="text-lg font-semibold text-destructive mb-2">Σφάλμα</h3>
          <p className="text-sm text-muted-foreground mb-2">
            Προέκυψε ένα σφάλμα κατά την εμφάνιση του panel.
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="text-sm text-primary hover:underline"
          >
            Δοκίμασε ξανά
          </button>
          {this.state.error && (
            <details className="mt-2">
              <summary className="text-xs cursor-pointer text-muted-foreground">
                Τεχνικές λεπτομέρειες
              </summary>
              <pre className="text-xs mt-2 p-2 bg-muted rounded overflow-auto">
                {this.state.error.toString()}
                {this.state.error.stack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

