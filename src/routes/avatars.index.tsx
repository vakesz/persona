import { Trans } from '@lingui/react/macro';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useMutation, useQuery } from 'convex/react';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { AvatarCard } from '@/components/avatars/avatar-card';
import { DeleteAvatarDialog } from '@/components/avatars/delete-avatar-dialog';
import { RenameAvatarDialog } from '@/components/avatars/rename-avatar-dialog';
import { RequireAuth } from '@/components/require-auth';
import { translateServerError } from '@/i18n/server-errors';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

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

interface DialogTarget {
  id: Id<'avatars'>;
  name: string;
}

function AvatarsList() {
  const avatars = useQuery(api.avatars.listAvatars);
  const retryBaseline = useMutation(api.avatars.retryAvatarBaseline);
  const [renameTarget, setRenameTarget] = useState<DialogTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DialogTarget | null>(null);
  const [retryingId, setRetryingId] = useState<Id<'avatars'> | null>(null);

  const handleRetry = (id: Id<'avatars'>) => {
    setRetryingId(id);
    retryBaseline({ id })
      .catch((error: unknown) => {
        console.error(error);
        toast.error(translateServerError(error));
      })
      .finally(() => {
        setRetryingId(null);
      });
  };

  if (avatars === undefined) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    );
  }

  const atLimit = avatars.length >= MAX_AVATARS;

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
                You&apos;ve reached the {MAX_AVATARS}-avatar limit. Delete one to add another.
              </Trans>
            ) : (
              <Trans>
                Create up to {MAX_AVATARS} private avatars ({avatars.length} so far).
              </Trans>
            )}
          </p>
        </div>
        {atLimit ? (
          <Button disabled>
            <Trans>New avatar</Trans>
          </Button>
        ) : (
          <Button asChild>
            <Link to="/avatars/new">
              <Trans>New avatar</Trans>
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
