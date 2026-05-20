import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from 'convex/react';
import { Loader2 } from 'lucide-react';

import { AvatarCard } from '@/components/avatars/avatar-card';
import { RequireAuth } from '@/components/require-auth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { api } from '@convex/_generated/api';

const MAX_AVATARS = 3;

export const Route = createFileRoute('/avatars/')({
  component: AvatarsPage,
});

function AvatarsPage() {
  return (
    <RequireAuth>
      <AvatarsList />
    </RequireAuth>
  );
}

function AvatarsList() {
  const avatars = useQuery(api.avatars.listAvatars);

  if (avatars === undefined) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    );
  }

  const atLimit = avatars.length >= MAX_AVATARS;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your avatars</h1>
          <p className="text-muted-foreground text-sm">
            {atLimit
              ? `You've reached the ${MAX_AVATARS}-avatar limit. Delete one to add another.`
              : `Create up to ${MAX_AVATARS} private avatars (${avatars.length} so far).`}
          </p>
        </div>
        {atLimit ? (
          <Button disabled>New avatar</Button>
        ) : (
          <Button asChild>
            <Link to="/avatars/new">New avatar</Link>
          </Button>
        )}
      </header>

      {avatars.length === 0 ? (
        <Card className="border-dashed p-10 text-center">
          <h2 className="text-lg font-medium">No avatars yet</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Upload a photo to create your first private avatar.
          </p>
          <Button asChild className="mt-4">
            <Link to="/avatars/new">Get started</Link>
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {avatars.map((avatar) => (
            <AvatarCard
              key={avatar._id}
              id={avatar._id}
              name={avatar.name}
              type={avatar.type}
              thumbnailUrl={avatar.thumbnailUrl}
            />
          ))}
        </div>
      )}
    </div>
  );
}
