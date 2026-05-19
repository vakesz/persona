import { Navigate } from '@tanstack/react-router';
import { useConvexAuth } from 'convex/react';
import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Gates protected routes: shows a spinner while auth resolves and redirects to
 * `/auth` when the visitor is signed out. Server functions still enforce
 * owner-only access — this is purely for UX.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" />;
  }

  return children;
}
