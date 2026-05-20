import { useMutation, useQuery } from 'convex/react';
import { CheckCircle2, Loader2, Save, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

export interface RenderResultProps {
  jobId: Id<'renderJobs'>;
  title: string;
  onClose: () => void;
}

export function RenderResult({ jobId, title, onClose }: RenderResultProps) {
  const job = useQuery(api.renderJobs.getRenderJob, { id: jobId });
  const saveLook = useMutation(api.savedLooks.saveLookFromJob);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaving(true);
    saveLook({ jobId })
      .then(() => {
        setSaved(true);
        toast.success('Look saved.');
      })
      .catch((error: unknown) => {
        console.error(error);
        toast.error(error instanceof Error ? error.message : 'Could not save look.');
      })
      .finally(() => {
        setSaving(false);
      });
  };

  if (job === undefined) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3">
          <Loader2 className="text-muted-foreground size-5 animate-spin" />
          <span className="text-sm">Starting render…</span>
        </CardContent>
      </Card>
    );
  }
  if (job === null) {
    return null;
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-xs font-medium tracking-wide uppercase opacity-60">
              Rendering
            </span>
            <h3 className="text-base leading-tight font-semibold">{title}</h3>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>

        {(job.status === 'queued' || job.status === 'processing') && (
          <div className="text-muted-foreground flex items-center gap-3 text-sm">
            <Loader2 className="size-4 animate-spin" />
            {job.status === 'queued'
              ? 'Queued — waiting for the image model…'
              : 'Painting your look (this can take 15–30 s)…'}
          </div>
        )}

        {job.status === 'failed' && (
          <div className="text-destructive text-sm">
            Render failed{job.errorMessage !== undefined ? `: ${job.errorMessage}` : '.'}
          </div>
        )}

        {job.status === 'done' && job.resultUrl !== null && (
          <>
            <div className="bg-muted overflow-hidden rounded-lg">
              <img
                src={job.resultUrl}
                alt={title}
                className="size-full object-contain"
                loading="lazy"
                decoding="async"
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={handleSave}
                disabled={saving || saved}
                className="flex-1"
              >
                {saving ? (
                  <Loader2 className="animate-spin" />
                ) : saved ? (
                  <CheckCircle2 />
                ) : (
                  <Save />
                )}
                {saved ? 'Saved' : 'Save look'}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Done
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
