import { Component, ReactNode } from 'react';

type ErrorBoundaryProps = {
  children: ReactNode;
  fallback?: (error: Error, retry: () => void) => ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

function DefaultErrorFallback({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '2rem',
        backgroundColor: '#0b1017',
        color: '#e5e7eb',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: '500px',
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            fontSize: '1.5rem',
            fontWeight: '600',
            marginBottom: '1rem',
            color: '#f59b42',
          }}
        >
          应用遇到了错误
        </h1>
        <p
          style={{
            fontSize: '0.875rem',
            marginBottom: '1.5rem',
            color: '#9ca3af',
            lineHeight: '1.5',
          }}
        >
          {error.message || '发生了未知错误'}
        </p>
        <button
          type="button"
          onClick={onRetry}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '0.875rem',
            fontWeight: '500',
            color: '#fff',
            backgroundColor: '#18a58d',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#22b49c';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#18a58d';
          }}
        >
          重新加载
        </button>
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleRetry);
      }
      return <DefaultErrorFallback error={this.state.error} onRetry={this.handleRetry} />;
    }

    return this.props.children;
  }
}
