import { Trans } from '@lingui/react/macro';
import { Component, type ErrorInfo, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';

export interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches uncaught render errors anywhere below it and shows a recovery UI
 * instead of white-screening the whole app. A reload button discards the
 * in-memory state and re-mounts the tree — the heaviest path (studio canvas
 * + MediaPipe) is forgiving of a fresh start because face data is cached
 * server-side.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, info);
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (error === null) return this.props.children;
    return (
      <div className="mx-auto flex max-w-md flex-col items-start gap-4 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">
          <Trans>Something went wrong</Trans>
        </h1>
        <p className="text-muted-foreground text-sm">
          <Trans>The app hit an unexpected error. Reload to start fresh.</Trans>
        </p>
        <pre className="bg-muted text-muted-foreground w-full overflow-auto rounded-md p-3 text-xs">
          {error.message}
        </pre>
        <Button
          type="button"
          onClick={() => {
            window.location.reload();
          }}
        >
          <Trans>Reload</Trans>
        </Button>
      </div>
    );
  }
}
