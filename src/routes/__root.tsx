import { createRootRoute, Outlet } from '@tanstack/react-router';

import { AppShell } from '@/components/app-shell';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/sonner';

export const Route = createRootRoute({
  component: RootLayout,
});

// ErrorBoundary wraps AppShell (not just the routed children) so a render
// crash in the header / nav / locale switcher also lands in the recovery UI
// instead of white-screening the whole page.
function RootLayout() {
  return (
    <>
      <ErrorBoundary>
        <AppShell>
          <Outlet />
        </AppShell>
      </ErrorBoundary>
      <Toaster />
    </>
  );
}
