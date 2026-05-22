import { Trans } from '@lingui/react/macro';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useQuery } from 'convex/react';

import { AvatarUploader } from '@/components/avatars/avatar-uploader';
import { PageSpinner } from '@/components/page-spinner';
import { RequireAuth } from '@/components/require-auth';
import { Button } from '@/components/ui/button';
import { api } from '@convex/_generated/api';
import { MAX_AVATARS_PER_USER } from '@convex/lib/limits';

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
    return <PageSpinner />;
  }

  if (avatars.length >= MAX_AVATARS_PER_USER) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          <Trans>Avatar limit reached</Trans>
        </h1>
        <p className="text-muted-foreground text-sm">
          <Trans>You already have {MAX_AVATARS_PER_USER} avatars. Delete one to add another.</Trans>
        </p>
        <Button asChild variant="outline" className="w-fit">
          <Link to="/avatars">
            <Trans>Back</Trans>
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          <Trans>Create an avatar</Trans>
        </h1>
        <p className="text-muted-foreground text-sm">
          <Trans>
            Upload a photo. We compress and strip metadata in your browser before it leaves your
            device.
          </Trans>
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
