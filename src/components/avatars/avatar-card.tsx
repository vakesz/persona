import { Trans, useLingui } from '@lingui/react/macro';
import { Link } from '@tanstack/react-router';
import type { FunctionReturnType } from 'convex/server';
import { AlertCircle, Loader2, Pencil, RefreshCcw, Trash2, User, UserSquare2 } from 'lucide-react';

import { translateStoredErrorMessage } from '@/i18n/server-errors';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

// Derive from the query return so adding a status / gender variant in
// `convex/schema.ts` lights this file up at the type level.
type AvatarRow = FunctionReturnType<typeof api.avatars.listAvatars>[number];
type AvatarBaselineStatus = AvatarRow['baselineStatus'];
type AvatarGender = AvatarRow['gender'];
type AvatarType = AvatarRow['type'];

export interface AvatarCardProps {
  id: Id<'avatars'>;
  name: string;
  type: AvatarType;
  gender: AvatarGender;
  thumbnailUrl: string | null;
  baselineStatus: AvatarBaselineStatus;
  baselineErrorMessage: string | undefined;
  retrying: boolean;
  onRename: (id: Id<'avatars'>, name: string) => void;
  onDelete: (id: Id<'avatars'>, name: string) => void;
  onRetryBaseline: (id: Id<'avatars'>) => void;
}

/** Displays one avatar with baseline status, retry, rename, delete, and studio entry actions. */
export function AvatarCard({
  id,
  name,
  type,
  gender,
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
  const { t } = useLingui();
  return (
    <Card className="group hover:border-primary/40 hover:shadow-primary/5 overflow-hidden p-0 transition hover:shadow-md">
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
              className="size-full object-cover transition duration-500 group-hover:scale-[1.03]"
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
            {failed ? <Trans>Portrait failed</Trans> : <AvatarMeta type={type} gender={gender} />}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t`Rename ${name}`}
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
            aria-label={t`Delete ${name}`}
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

function AvatarMeta({ type, gender }: { type: AvatarType; gender: AvatarGender }) {
  const { t } = useLingui();
  const typeLabel = type === 'selfie' ? t`Selfie` : t`Full body`;
  const genderLabel = gender === 'male' ? t`Masculine` : gender === 'female' ? t`Feminine` : null;
  return <>{genderLabel === null ? typeLabel : `${typeLabel} · ${genderLabel}`}</>;
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
  status: Exclude<AvatarBaselineStatus, 'done'>;
  message: string | undefined;
  retrying: boolean;
  onRetry: () => void;
}

function BaselineBadge({ status, message, retrying, onRetry }: BaselineBadgeProps) {
  if (status === 'failed') {
    return (
      <div className="bg-background/80 absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center backdrop-blur-sm">
        <AlertCircle className="text-destructive size-6" />
        <p className="text-sm font-medium">
          <Trans>Portrait generation failed</Trans>
        </p>
        {message !== undefined && (
          <p className="text-muted-foreground text-xs">{translateStoredErrorMessage(message)}</p>
        )}
        <Button type="button" size="sm" variant="outline" onClick={onRetry} disabled={retrying}>
          {retrying ? <Loader2 className="animate-spin" /> : <RefreshCcw />}
          {retrying ? <Trans>Retrying…</Trans> : <Trans>Retry</Trans>}
        </Button>
      </div>
    );
  }
  return (
    <div className="bg-background/80 absolute inset-0 flex flex-col items-center justify-center gap-2 backdrop-blur-sm">
      <Loader2 className="text-muted-foreground size-6 animate-spin" />
      <p className="text-muted-foreground text-xs">
        <Trans>Preparing your portrait…</Trans>
      </p>
    </div>
  );
}
