import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useQuery } from 'convex/react';
import { Loader2 } from 'lucide-react';

import { AvatarUploader } from '@/components/avatars/avatar-uploader';
import { RequireAuth } from '@/components/require-auth';
import { Button } from '@/components/ui/button';
import { api } from '@convex/_generated/api';

const MAX_AVATARS = 3;

export const Route = createFileRoute('/avatars/new')({
  component: NewAvatarPage,
});

function NewAvatarPage() {
  return (
    <RequireAuth>
      <NewAvatarFlow />
    </RequireAuth>
  );
}

function NewAvatarFlow() {
  const navigate = useNavigate();
  const avatars = useQuery(api.avatars.listAvatars);

  if (avatars === undefined) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    );
  }

  if (avatars.length >= MAX_AVATARS) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Avatar limit reached</h1>
        <p className="text-muted-foreground text-sm">
          You already have {MAX_AVATARS} avatars. Delete one to add another.
        </p>
        <Button asChild variant="outline" className="w-fit">
          <Link to="/avatars">Back to avatars</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Create an avatar</h1>
        <p className="text-muted-foreground text-sm">
          Upload a photo. We compress and strip metadata in your browser before it leaves your
          device.
        </p>
      </header>
      <AvatarUploader
        onCreated={() => {
          void navigate({ to: '/avatars' });
        }}
      />
    </div>
  );
}
