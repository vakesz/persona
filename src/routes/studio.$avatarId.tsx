import { createFileRoute, Link } from '@tanstack/react-router';
import { useMutation, useQuery } from 'convex/react';
import { AlertCircle, Loader2, Sparkles } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { BaselineStatusGate } from '@/components/avatars/baseline-status-gate';
import { RenderResult } from '@/components/render/render-result';
import { RequireAuth } from '@/components/require-auth';
import { StudioCanvas, type StudioCanvasHandle } from '@/components/studio/studio-canvas';
import { StudioSidebar, type UploadedItemSummary } from '@/components/studio/studio-sidebar';
import { Button } from '@/components/ui/button';
import { useAvatarFace } from '@/lib/mediapipe/use-avatar-face';
import {
  composeRenderPrompt,
  composeRenderTitle,
  DEFAULT_STUDIO_STATE,
  hasAnyChange,
  hasAnyTint,
  type StudioState,
} from '@/lib/studio/studio-state';
import { useImage } from '@/lib/studio/use-image';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

export const Route = createFileRoute('/studio/$avatarId')({
  parseParams: ({ avatarId }) => ({ avatarId: avatarId as Id<'avatars'> }),
  component: StudioPage,
});

function StudioPage() {
  return (
    <RequireAuth>
      <Studio />
    </RequireAuth>
  );
}

interface ActiveRender {
  jobId: Id<'renderJobs'>;
  title: string;
}

function Studio() {
  const { avatarId } = Route.useParams();
  const avatar = useQuery(api.avatars.getAvatar, { id: avatarId });
  const uploads = useQuery(api.uploadedItems.listUploadedItems, {});
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);
  const createRenderJob = useMutation(api.renderJobs.createRenderJob);
  const deleteUploadedItem = useMutation(api.uploadedItems.deleteUploadedItem);

  const baselineImage = useImage(avatar?.baseImageUrl ?? '');
  const face = useAvatarFace(avatarId, baselineImage, avatar?.landmarksJson, avatar?.masksJson);

  const [studioState, setStudioState] = useState<StudioState>(DEFAULT_STUDIO_STATE);
  const [activeRender, setActiveRender] = useState<ActiveRender | null>(null);
  const [renderBusy, setRenderBusy] = useState(false);
  const [compareSliderX, setCompareSliderX] = useState(0);
  const canvasRef = useRef<StudioCanvasHandle | null>(null);

  const anyTints = hasAnyTint(studioState);

  const uploadSummaries = useMemo<UploadedItemSummary[]>(() => {
    if (uploads === undefined) return [];
    const out: UploadedItemSummary[] = [];
    for (const item of uploads) {
      if (item.imageUrl === null) continue;
      out.push({
        _id: item._id,
        imageUrl: item.imageUrl,
        label: item.label ?? prettyType(item.type),
      });
    }
    return out;
  }, [uploads]);

  const handleDeleteUpload = (id: Id<'uploadedItems'>) => {
    void deleteUploadedItem({ id }).catch((error: unknown) => {
      console.error(error);
      toast.error('Could not delete upload.');
    });
    if (studioState.selectedUploadId === id) {
      setStudioState({ ...studioState, selectedUploadId: null });
    }
  };

  const handleRender = async () => {
    if (!hasAnyChange(studioState)) {
      toast.error('Apply at least one style change first.');
      return;
    }
    setRenderBusy(true);
    try {
      let inputStorageId: Id<'_storage'> | undefined;
      // Bake the live makeup into the render input only when the user has
      // applied some — preserves an exact handoff so Gemini doesn't drop the
      // makeup. When no tints are applied, the avatar baseline is the input
      // and we skip the upload entirely.
      if (hasAnyTint(studioState)) {
        const blob = await canvasRef.current?.exportPng();
        if (blob !== undefined && blob !== null) {
          const url = await generateUploadUrl();
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': blob.type },
            body: blob,
          });
          if (!response.ok) {
            throw new Error('Could not upload the canvas snapshot.');
          }
          const json = (await response.json()) as { storageId: Id<'_storage'> };
          inputStorageId = json.storageId;
        }
      }

      const prompt = composeRenderPrompt(studioState);
      const title = composeRenderTitle(studioState);
      const jobId = await createRenderJob({
        avatarId,
        prompt,
        title,
        ...(studioState.selectedUploadId !== null && {
          referenceUploadedItemId: studioState.selectedUploadId,
        }),
        ...(inputStorageId !== undefined && { inputStorageId }),
      });
      setActiveRender({ jobId, title });
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Could not start render.');
    } finally {
      setRenderBusy(false);
    }
  };

  return (
    <BaselineStatusGate avatar={avatar}>
      {(ready) => (
        <div className="flex flex-col gap-4">
          <header className="flex items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{ready.name}</h1>
              <p className="text-muted-foreground text-sm">
                Tint makeup live on your canonical portrait, then render the look (beard, mustache,
                hairstyle, clothing try-on) via Gemini.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to="/avatars">All avatars</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/stylist/$avatarId" params={{ avatarId }}>
                  Stylist
                </Link>
              </Button>
            </div>
          </header>

          <FaceStatusBanner status={face.status} error={face.error} />

          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <div className="flex flex-col gap-2">
              <StudioCanvas
                ref={canvasRef}
                baseImage={baselineImage}
                altText={ready.name}
                face={face.face?.landmarks ?? null}
                state={studioState}
                compareSliderX={compareSliderX}
              />
              {anyTints && (
                <label className="flex items-center gap-3 text-xs">
                  <span className="text-muted-foreground w-24 shrink-0">Before · After</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={compareSliderX}
                    onChange={(event) => {
                      setCompareSliderX(Number(event.currentTarget.value));
                    }}
                    className="accent-foreground flex-1"
                    aria-label="Before / after slider"
                  />
                  <span className="text-muted-foreground w-12 shrink-0 text-right tabular-nums">
                    {Math.round(compareSliderX * 100)}%
                  </span>
                </label>
              )}
            </div>
            <div className="flex flex-col gap-3">
              <StudioSidebar
                state={studioState}
                onStateChange={setStudioState}
                uploads={uploadSummaries}
                onDeleteUpload={handleDeleteUpload}
                faceReady={face.status === 'ready'}
              />
              <Button
                type="button"
                onClick={() => {
                  void handleRender();
                }}
                disabled={renderBusy || !hasAnyChange(studioState)}
              >
                {renderBusy ? <Loader2 className="animate-spin" /> : <Sparkles />}
                Render look
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setStudioState(DEFAULT_STUDIO_STATE);
                }}
                disabled={!hasAnyChange(studioState)}
              >
                Reset all tools
              </Button>
            </div>
          </div>

          {activeRender !== null && (
            <RenderResult
              jobId={activeRender.jobId}
              title={activeRender.title}
              onClose={() => {
                setActiveRender(null);
              }}
            />
          )}
        </div>
      )}
    </BaselineStatusGate>
  );
}

function prettyType(type: string): string {
  return type.replace(/_/g, ' ');
}

interface FaceStatusBannerProps {
  status: ReturnType<typeof useAvatarFace>['status'];
  error: string | null;
}

function FaceStatusBanner({ status, error }: FaceStatusBannerProps) {
  if (status === 'ready') return null;
  if (status === 'failed') {
    return (
      <div className="border-destructive/40 bg-destructive/5 text-destructive flex items-center gap-2 rounded-md border p-3 text-xs">
        <AlertCircle className="size-4 shrink-0" />
        <span>{error ?? 'Could not prepare studio tools.'}</span>
      </div>
    );
  }
  return (
    <div className="border-border text-muted-foreground bg-muted/40 flex items-center gap-2 rounded-md border p-3 text-xs">
      <Loader2 className="size-4 shrink-0 animate-spin" />
      <span>
        Preparing studio tools (face landmarks + segmentation, runs in your browser, only your
        canonical portrait is analysed)…
      </span>
    </div>
  );
}
