import { Link } from '@tanstack/react-router';
import { AlertCircle, Loader2, Pencil, RefreshCcw, Trash2, User, UserSquare2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { Id } from '@convex/_generated/dataModel';

type AvatarBaselineStatus = 'queued' | 'processing' | 'done' | 'failed';

export interface AvatarCardProps {
  id: Id<'avatars'>;
  name: string;
  type: 'selfie' | 'full_body';
  thumbnailUrl: string | null;
  baselineStatus: AvatarBaselineStatus;
  baselineErrorMessage: string | undefined;
  retrying: boolean;
  onRename: (id: Id<'avatars'>, name: string) => void;
  onDelete: (id: Id<'avatars'>, name: string) => void;
  onRetryBaseline: (id: Id<'avatars'>) => void;
}

export function AvatarCard({
  id,
  name,
  type,
  thumbnailUrl,
  baselineStatus,
  baselineErrorMessage,
  retrying,
  onRename,
  onDelete,
  onRetryBaseline,
}: AvatarCardProps) {
  const ready = baselineStatus === 'done';
  const failed = baselineStatus === 'failed';
  return (
    <Card className="group-hover:border-foreground/30 overflow-hidden p-0 transition">
      <ConditionalLink ready={ready} avatarId={id}>
        <div className="bg-muted relative aspect-[4/5] w-full overflow-hidden">
          {thumbnailUrl === null ? (
            <div className="text-muted-foreground flex size-full items-center justify-center">
              {type === 'selfie' ? (
                <User className="size-12" />
              ) : (
                <UserSquare2 className="size-12" />
              )}
            </div>
          ) : (
            <img
              src={thumbnailUrl}
              alt={name}
              className="size-full object-cover transition hover:scale-[1.02]"
              loading="lazy"
              decoding="async"
            />
          )}
          {!ready && (
            <BaselineBadge
              status={baselineStatus}
              message={baselineErrorMessage}
              retrying={retrying}
              onRetry={() => {
                onRetryBaseline(id);
              }}
            />
          )}
        </div>
      </ConditionalLink>
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">{name}</span>
          <span className="text-muted-foreground text-xs">
            {failed ? 'Portrait failed' : type === 'selfie' ? 'Selfie' : 'Full body'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Rename ${name}`}
            onClick={() => {
              onRename(id, name);
            }}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Delete ${name}`}
            onClick={() => {
              onDelete(id, name);
            }}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

interface ConditionalLinkProps {
  ready: boolean;
  avatarId: Id<'avatars'>;
  children: React.ReactNode;
}

function ConditionalLink({ ready, avatarId, children }: ConditionalLinkProps) {
  if (!ready) {
    return <div className="block cursor-not-allowed">{children}</div>;
  }
  return (
    <Link
      to="/studio/$avatarId"
      params={{ avatarId }}
      className="focus-visible:ring-ring block focus-visible:ring-2 focus-visible:outline-none"
    >
      {children}
    </Link>
  );
}

interface BaselineBadgeProps {
  status: 'queued' | 'processing' | 'failed';
  message: string | undefined;
  retrying: boolean;
  onRetry: () => void;
}

function BaselineBadge({ status, message, retrying, onRetry }: BaselineBadgeProps) {
  if (status === 'failed') {
    return (
      <div className="bg-background/80 absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center backdrop-blur-sm">
        <AlertCircle className="text-destructive size-6" />
        <p className="text-sm font-medium">Portrait generation failed</p>
        {message !== undefined && <p className="text-muted-foreground text-xs">{message}</p>}
        <Button type="button" size="sm" variant="outline" onClick={onRetry} disabled={retrying}>
          {retrying ? <Loader2 className="animate-spin" /> : <RefreshCcw />}
          {retrying ? 'Retrying…' : 'Retry'}
        </Button>
      </div>
    );
  }
  return (
    <div className="bg-background/80 absolute inset-0 flex flex-col items-center justify-center gap-2 backdrop-blur-sm">
      <Loader2 className="text-muted-foreground size-6 animate-spin" />
      <p className="text-muted-foreground text-xs">Preparing your portrait…</p>
    </div>
  );
}
