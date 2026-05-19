import { createRootRoute, Outlet } from '@tanstack/react-router';

import { AppShell } from '@/components/app-shell';
import { Toaster } from '@/components/ui/sonner';

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <>
      <AppShell>
        <Outlet />
      </AppShell>
      <Toaster />
    </>
  );
}
