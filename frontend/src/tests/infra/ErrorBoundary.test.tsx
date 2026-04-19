import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../../infra/ErrorBoundary';

function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
}

describe('ErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  it('renders error fallback when child throws', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('应用遇到了错误')).toBeInTheDocument();
    expect(screen.getByText('Test error')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重新加载' })).toBeInTheDocument();
    consoleError.mockRestore();
  });

  it('uses custom fallback when provided', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const customFallback = (error: Error) => <div>Custom error: {error.message}</div>;
    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Custom error: Test error')).toBeInTheDocument();
    consoleError.mockRestore();
  });
});
