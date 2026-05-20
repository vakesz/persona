import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from 'convex/react';
import { Loader2 } from 'lucide-react';

import { RequireAuth } from '@/components/require-auth';
import { StudioCanvas } from '@/components/studio/studio-canvas';
import { Button } from '@/components/ui/button';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

export const Route = createFileRoute('/studio/$avatarId')({
  component: StudioPage,
});

function StudioPage() {
  return (
    <RequireAuth>
      <Studio />
    </RequireAuth>
  );
}

function Studio() {
  const { avatarId } = Route.useParams();
  const avatar = useQuery(api.avatars.getAvatar, { id: avatarId as Id<'avatars'> });

  if (avatar === undefined) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    );
  }

  if (avatar === null) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Avatar not found</h1>
        <p className="text-muted-foreground text-sm">
          This avatar doesn&apos;t exist or it belongs to someone else.
        </p>
        <Button asChild variant="outline" className="w-fit">
          <Link to="/avatars">Back to avatars</Link>
        </Button>
      </div>
    );
  }

  if (avatar.baseImageUrl === null) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{avatar.name}</h1>
        <p className="text-muted-foreground text-sm">
          Couldn&apos;t load this avatar&apos;s image. Try again in a moment.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{avatar.name}</h1>
          <p className="text-muted-foreground text-sm">
            Scroll or pinch to zoom. Drag to pan. Styling tools land next.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/avatars">All avatars</Link>
        </Button>
      </header>
      <StudioCanvas baseImageUrl={avatar.baseImageUrl} altText={avatar.name} />
    </div>
  );
}
