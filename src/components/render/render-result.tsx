import { Trans, useLingui } from '@lingui/react/macro';
import { Link } from '@tanstack/react-router';
import { useQuery } from 'convex/react';
import { AlertCircle, Bookmark, CheckCircle2, Loader2, Save } from 'lucide-react';
import { useState } from 'react';

import { translateStoredErrorMessage } from '@/i18n/server-errors';
import { useToastMutation } from '@/i18n/use-toast-mutation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

export interface RenderResultProps {
  jobId: Id<'renderJobs'>;
  title: string;
  avatarId: Id<'avatars'>;
  avatarName: string;
  baselineUrl: string;
  onClose: () => void;
}

/** Shows live render-job progress, before/after preview, and save-to-gallery action. */
export function RenderResult({
  jobId,
  title,
  avatarId,
  avatarName,
  baselineUrl,
  onClose,
}: RenderResultProps) {
  const { t } = useLingui();
  const job = useQuery(api.renderJobs.getRenderJob, { id: jobId });
  const saveLook = useToastMutation(api.savedLooks.saveLookFromJob, {
    successMessage: t`Saved to ${avatarName}'s looks.`,
  });
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    void saveLook.run({ jobId }).then((result) => {
      if (result !== undefined) setSaved(true);
    });
  };

  const status = job?.status;
  const isLoading = job === undefined || status === 'queued' || status === 'processing';
  const isFailed = status === 'failed';
  const resultUrl = job?.status === 'done' ? (job.resultUrl ?? null) : null;
  const errorMessage = job?.errorMessage;
  const translatedError =
    errorMessage === undefined ? undefined : translateStoredErrorMessage(errorMessage);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      ariaLabel={t`Render: ${title}`}
      className="w-[min(56rem,calc(100vw-2rem))]"
    >
      <DialogHeader>
        <Badge variant="accent" className="mb-1 w-fit">
          <Trans>Render</Trans>
        </Badge>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>

      <DialogBody>
        <div className="grid gap-3 sm:grid-cols-2">
          <CompareTile label={t`Original`} src={baselineUrl} alt={avatarName} />
          <CompareTile
            label={t`Render`}
            src={resultUrl}
            alt={title}
            loading={isLoading}
            failed={isFailed}
            {...(translatedError !== undefined && { failedMessage: translatedError })}
          />
        </div>

        {isLoading && (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" />
            <span>
              {status === 'queued' ? (
                <Trans>Queued — waiting for the image model…</Trans>
              ) : (
                <Trans>Painting your look (15–30 s)…</Trans>
              )}
            </span>
          </div>
        )}

        {saved && (
          <div className="border-border bg-muted/30 flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>
                <Trans>Saved under {avatarName}&apos;s looks.</Trans>
              </span>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/saved" search={{ avatarId }}>
                <Bookmark />
                <Trans>View gallery</Trans>
              </Link>
            </Button>
          </div>
        )}
      </DialogBody>

      <DialogFooter>
        {resultUrl !== null && !saved && (
          <>
            <Button type="button" variant="outline" onClick={onClose}>
              <Trans>Discard</Trans>
            </Button>
            <Button type="button" onClick={handleSave} disabled={saveLook.pending}>
              {saveLook.pending ? <Loader2 className="animate-spin" /> : <Save />}
              <Trans>Save look</Trans>
            </Button>
          </>
        )}
        {(isLoading || isFailed || saved) && (
          <Button type="button" variant={saved ? 'default' : 'outline'} onClick={onClose}>
            <Trans>Close</Trans>
          </Button>
        )}
      </DialogFooter>
    </Dialog>
  );
}

interface CompareTileProps {
  label: string;
  src: string | null;
  alt: string;
  loading?: boolean;
  failed?: boolean;
  failedMessage?: string;
}

function CompareTile({ label, src, alt, loading, failed, failedMessage }: CompareTileProps) {
  return (
    <figure className="flex flex-col gap-1.5">
      <div className="bg-muted relative aspect-square overflow-hidden rounded-lg">
        {src !== null && (
          <img
            src={src}
            alt={alt}
            className="size-full object-contain"
            loading="lazy"
            decoding="async"
          />
        )}
        {loading === true && src === null && (
          <div className="text-muted-foreground absolute inset-0 flex flex-col items-center justify-center gap-2 text-xs">
            <Loader2 className="size-5 animate-spin" />
            <span>
              <Trans>Rendering…</Trans>
            </span>
          </div>
        )}
        {failed === true && src === null && (
          <div className="text-destructive absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center text-xs">
            <AlertCircle className="size-5" />
            <span>
              {failedMessage !== undefined ? (
                <Trans>Render failed: {failedMessage}</Trans>
              ) : (
                <Trans>Render failed.</Trans>
              )}
            </span>
          </div>
        )}
      </div>
      <figcaption className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
        {label}
      </figcaption>
    </figure>
  );
}
