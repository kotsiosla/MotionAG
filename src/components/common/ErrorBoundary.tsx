import { Component, ErrorInfo, ReactNode } from 'react';

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

    // Handle dynamic import failures (common after new deployments)
    const errorMsg = error.message || error.toString();
    const isDynamicImportError =
      error.name === 'ChunkLoadError' ||
      errorMsg.includes('Failed to fetch dynamically imported module') ||
      errorMsg.includes('error loading dynamically imported module');

    if (isDynamicImportError) {
      console.warn('[ErrorBoundary] 🚨 Dynamic import failed. Force reloading to get latest assets...');

      // Only reload if we haven't reloaded in the last 10 seconds to prevent loops
      const lastReload = sessionStorage.getItem('last_asset_reload');
      const now = Date.now();
      if (!lastReload || now - parseInt(lastReload) > 10000) {
        sessionStorage.setItem('last_asset_reload', now.toString());
        window.location.reload();
      }
    }
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

