import { Link } from '@tanstack/react-router';
import { AlertCircle, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';

type AvatarBaselineStatus = 'queued' | 'processing' | 'done' | 'failed';

interface AvatarStub {
  name: string;
  baselineStatus: AvatarBaselineStatus;
  baselineErrorMessage: string | undefined;
  baseImageUrl: string | null;
}

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

  if (avatar.baselineStatus === 'failed') {
    return (
      <div className="flex flex-col items-start gap-4">
        <AlertCircle className="text-destructive size-6" />
        <h1 className="text-2xl font-semibold tracking-tight">Portrait generation failed</h1>
        <p className="text-muted-foreground max-w-md text-sm">
          We couldn&apos;t generate a studio portrait of {avatar.name} from your photos.
        </p>
        {avatar.baselineErrorMessage !== undefined && (
          <pre className="bg-muted text-muted-foreground max-w-full overflow-auto rounded-md p-3 text-xs">
            {avatar.baselineErrorMessage}
          </pre>
        )}
        <Button asChild variant="outline" size="sm">
          <Link to="/avatars">Back to avatars</Link>
        </Button>
      </div>
    );
  }

  if (avatar.baselineStatus !== 'done' || avatar.baseImageUrl === null) {
    return (
      <div className="flex flex-col items-start gap-4">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
        <h1 className="text-2xl font-semibold tracking-tight">Preparing your portrait…</h1>
        <p className="text-muted-foreground max-w-md text-sm">
          Gemini is composing your canonical studio portrait from the photos you uploaded. This
          usually takes 10–30 seconds. The page will update automatically.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link to="/avatars">Back to avatars</Link>
        </Button>
      </div>
    );
  }

  return <>{children({ ...avatar, baseImageUrl: avatar.baseImageUrl })}</>;
}
