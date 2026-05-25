import { Trans } from '@lingui/react/macro';
import { Link } from '@tanstack/react-router';
import type { FunctionReturnType } from 'convex/server';
import { AlertCircle, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

import { PageSpinner } from '@/components/page-spinner';
import { translateStoredErrorMessage } from '@/i18n/server-errors';
import { Button } from '@/components/ui/button';
import { api } from '@convex/_generated/api';

// Derive the avatar shape from the public query so adding a baseline status
// variant in `convex/schema.ts` lights this file up at the type level.
type AvatarDetail = NonNullable<FunctionReturnType<typeof api.avatars.getAvatar>>;
type AvatarStub = Pick<
  AvatarDetail,
  'name' | 'gender' | 'baselineStatus' | 'baselineErrorMessage' | 'baseImageUrl'
>;

export interface BaselineStatusGateProps {
  avatar: AvatarStub | null | undefined;
  /** Rendered when the baseline is `done` and `baseImageUrl` is non-null. */
  children: (avatar: AvatarStub & { baseImageUrl: string }) => ReactNode;
}

/**
 * Gates the studio + stylist routes on the avatar's baseline being ready:
 * - `undefined` → loading
 * - `null` → not found / not yours
 * - `queued | processing` → "preparing your portrait"
 * - `failed` → error message + back link
 * - `done` → render `children` with the resolved avatar
 */
export function BaselineStatusGate({ avatar, children }: BaselineStatusGateProps) {
  if (avatar === undefined) {
    return <PageSpinner />;
  }

  if (avatar === null) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          <Trans>Avatar not found</Trans>
        </h1>
        <p className="text-muted-foreground text-sm">
          <Trans>This avatar doesn&apos;t exist or it belongs to someone else.</Trans>
        </p>
        <Button asChild variant="outline" className="w-fit">
          <Link to="/avatars">
            <Trans>Back</Trans>
          </Link>
        </Button>
      </div>
    );
  }

  if (avatar.baselineStatus === 'failed') {
    return (
      <div className="flex flex-col items-start gap-4">
        <AlertCircle className="text-destructive size-6" />
        <h1 className="text-2xl font-semibold tracking-tight">
          <Trans>Portrait generation failed</Trans>
        </h1>
        <p className="text-muted-foreground max-w-md text-sm">
          <Trans>
            We couldn&apos;t generate a studio portrait of {avatar.name} from your photos.
          </Trans>
        </p>
        {avatar.baselineErrorMessage !== undefined && (
          <pre className="bg-muted text-muted-foreground max-w-full overflow-auto rounded-md p-3 text-xs">
            {translateStoredErrorMessage(avatar.baselineErrorMessage)}
          </pre>
        )}
        <Button asChild variant="outline" size="sm">
          <Link to="/avatars">
            <Trans>Back</Trans>
          </Link>
        </Button>
      </div>
    );
  }

  if (avatar.baselineStatus !== 'done' || avatar.baseImageUrl === null) {
    return (
      <div className="flex flex-col items-start gap-4">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
        <h1 className="text-2xl font-semibold tracking-tight">
          <Trans>Preparing your portrait…</Trans>
        </h1>
        <p className="text-muted-foreground max-w-md text-sm">
          <Trans>
            AI is composing your canonical studio portrait from the photos you uploaded. This
            usually takes 10–30 seconds. The page will update automatically.
          </Trans>
        </p>
        <Button asChild variant="outline" size="sm">
          <Link to="/avatars">
            <Trans>Back</Trans>
          </Link>
        </Button>
      </div>
    );
  }

  return <>{children({ ...avatar, baseImageUrl: avatar.baseImageUrl })}</>;
}
