import { createFileRoute, Link } from '@tanstack/react-router';

import { ComingSoon } from '@/components/coming-soon';
import { RequireAuth } from '@/components/require-auth';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/avatars/')({
  component: AvatarsPage,
});

function AvatarsPage() {
  return (
    <RequireAuth>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Your avatars</h1>
            <p className="text-muted-foreground text-sm">
              Create up to 3 private avatars from your own photos.
            </p>
          </div>
          <Button asChild>
            <Link to="/avatars/new">New avatar</Link>
          </Button>
        </div>
        <ComingSoon
          title="Avatar list"
          phase="Phase 2"
          description="Uploading a photo, browser-side compression, Convex storage, and the 3-avatar limit land here next."
        />
      </div>
    </RequireAuth>
  );
}
