import { Navigate } from '@tanstack/react-router';
import { useConvexAuth } from 'convex/react';
import type { ReactNode } from 'react';

import { PageSpinner } from '@/components/page-spinner';

export interface RequireAuthProps {
  children: ReactNode;
}

/**
 * Gates protected routes: shows a spinner while auth resolves and redirects to
 * `/auth` when the visitor is signed out. Server functions still enforce
 * owner-only access — this is purely for UX.
 *
 * Uses `<Navigate replace>` so the blocked URL doesn't sit in history. After
 * sign-in the user lands on `/avatars` rather than bouncing back into the
 * gate via the back button.
 */
export function RequireAuth({ children }: RequireAuthProps) {
  const { isLoading, isAuthenticated } = useConvexAuth();

  if (isLoading) {
    return <PageSpinner minHeight="60vh" />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}
