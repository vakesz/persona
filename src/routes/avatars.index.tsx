import { Trans } from '@lingui/react/macro';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from 'convex/react';
import { useState } from 'react';

import { AvatarCard } from '@/components/avatars/avatar-card';
import { DeleteAvatarDialog } from '@/components/avatars/delete-avatar-dialog';
import { RenameAvatarDialog } from '@/components/avatars/rename-avatar-dialog';
import { PageSpinner } from '@/components/page-spinner';
import { RequireAuth } from '@/components/require-auth';
import { useToastMutation } from '@/i18n/use-toast-mutation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { MAX_AVATARS_PER_USER } from '@convex/lib/limits';

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

interface DialogTarget {
  id: Id<'avatars'>;
  name: string;
}

function AvatarsList() {
  const avatars = useQuery(api.avatars.listAvatars);
  const retryBaseline = useToastMutation(api.avatars.retryAvatarBaseline);
  const [renameTarget, setRenameTarget] = useState<DialogTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DialogTarget | null>(null);
  const [retryingId, setRetryingId] = useState<Id<'avatars'> | null>(null);

  const handleRetry = (id: Id<'avatars'>) => {
    setRetryingId(id);
    void retryBaseline.run({ id }).finally(() => {
      setRetryingId(null);
    });
  };

  if (avatars === undefined) {
    return <PageSpinner />;
  }

  const atLimit = avatars.length >= MAX_AVATARS_PER_USER;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">
            <Trans>Your avatars</Trans>
          </h1>
          <p className="text-muted-foreground text-sm">
            {atLimit ? (
              <Trans>
                You&apos;ve reached the {MAX_AVATARS_PER_USER}-avatar limit. Delete one to add
                another.
              </Trans>
            ) : (
              <Trans>
                Create up to {MAX_AVATARS_PER_USER} private avatars ({avatars.length} so far).
              </Trans>
            )}
          </p>
        </div>
        {atLimit ? (
          <Button disabled>
            <Trans>New</Trans>
          </Button>
        ) : (
          <Button asChild>
            <Link to="/avatars/new">
              <Trans>New</Trans>
            </Link>
          </Button>
        )}
      </header>

      {avatars.length === 0 ? (
        <Card className="bg-card/40 border-dashed p-12 text-center">
          <h2 className="text-lg font-medium">
            <Trans>No avatars yet</Trans>
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            <Trans>Upload a photo to create your first private avatar.</Trans>
          </p>
          <Button asChild className="mt-5 w-fit self-center">
            <Link to="/avatars/new">
              <Trans>Get started</Trans>
            </Link>
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
              gender={avatar.gender}
              thumbnailUrl={avatar.thumbnailUrl}
              baselineStatus={avatar.baselineStatus}
              baselineErrorMessage={avatar.baselineErrorMessage}
              retrying={retryingId === avatar._id}
              onRename={(id, name) => {
                setRenameTarget({ id, name });
              }}
              onDelete={(id, name) => {
                setDeleteTarget({ id, name });
              }}
              onRetryBaseline={handleRetry}
            />
          ))}
        </div>
      )}

      <RenameAvatarDialog
        key={`rename:${renameTarget?.id ?? 'closed'}`}
        avatarId={renameTarget?.id ?? null}
        currentName={renameTarget?.name ?? ''}
        onClose={() => {
          setRenameTarget(null);
        }}
      />
      <DeleteAvatarDialog
        key={`delete:${deleteTarget?.id ?? 'closed'}`}
        avatarId={deleteTarget?.id ?? null}
        avatarName={deleteTarget?.name ?? ''}
        onClose={() => {
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
