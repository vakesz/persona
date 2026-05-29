import { msg } from '@lingui/core/macro';
import type { MessageDescriptor } from '@lingui/core';
import { Trans, useLingui } from '@lingui/react/macro';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useAction, useMutation, useQuery } from 'convex/react';
import { AlertCircle, Bookmark, Loader2, Sparkles } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { BaselineStatusGate } from '@/components/avatars/baseline-status-gate';
import { RenderResult } from '@/components/render/render-result';
import { RequireAuth } from '@/components/require-auth';
import { StudioCanvas, type StudioCanvasHandle } from '@/components/studio/studio-canvas';
import {
  StudioSidebar,
  type StylistRecommendation,
  type UploadedItemSummary,
} from '@/components/studio/sidebar';
import { translateServerError } from '@/i18n/server-errors';
import { useToastMutation } from '@/i18n/use-toast-mutation';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useAvatarFace } from '@/lib/mediapipe/use-avatar-face';
import { uploadBlobToConvex } from '@/lib/storage/upload';
import {
  composeRenderPrompt,
  composeRenderTitle,
  DEFAULT_STUDIO_STATE,
  hasAnyChange,
  hasAnyTint,
  type AvatarGender,
  type StudioState,
} from '@/lib/studio/studio-state';
import { useImage } from '@/lib/studio/use-image';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import type { FunctionReturnType } from 'convex/server';

// Derived from the public query so adding a new upload type in
// `convex/schema.ts` flows through the type system to this file. Used by
// `UPLOADED_ITEM_TYPE_LABELS` to give untitled uploads a localized fallback.
type UploadedItemType = FunctionReturnType<
  typeof api.uploadedItems.listUploadedItems
>[number]['type'];

const UPLOADED_ITEM_TYPE_LABELS: Record<UploadedItemType, MessageDescriptor> = {
  dress: msg`Dress`,
  top: msg`Top`,
  shoes: msg`Shoes`,
  nails_reference: msg`Nails reference`,
  hair_reference: msg`Hair reference`,
};

export const Route = createFileRoute('/studio/$avatarId')({
  parseParams: ({ avatarId }) => ({ avatarId: avatarId as Id<'avatars'> }),
  component: StudioPage,
});

function StudioPage() {
  const { avatarId } = Route.useParams();
  return (
    <RequireAuth>
      {/*
        `key={avatarId}` forces Studio to remount when the user navigates
        between avatars. Without it, `studioState` / `activeRender` would
        bleed across avatars since TanStack Router reuses the component on
        same-route param changes.
      */}
      <Studio key={avatarId} avatarId={avatarId} />
    </RequireAuth>
  );
}

interface ActiveRender {
  jobId: Id<'renderJobs'>;
  title: string;
}

interface StudioProps {
  avatarId: Id<'avatars'>;
}

interface AnalyzeStyleResult {
  recommendations: StylistRecommendation[];
}

function Studio({ avatarId }: StudioProps) {
  const { i18n, t } = useLingui();
  const avatar = useQuery(api.avatars.getAvatar, { id: avatarId });
  const uploads = useQuery(api.uploadedItems.listUploadedItems, {});
  const savedLooks = useQuery(api.savedLooks.listSavedLooks, { avatarId });
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);
  const claimRenderInput = useMutation(api.storage.claimRenderInput);
  const discardRenderInput = useMutation(api.storage.discardRenderInput);
  const createRenderJob = useMutation(api.renderJobs.createRenderJob);
  const deleteUpload = useToastMutation(api.uploadedItems.deleteUploadedItem);
  const analyze = useAction(api.ai.analyzeStyle) as (args: {
    avatarId: Id<'avatars'>;
    question: string;
  }) => Promise<AnalyzeStyleResult>;

  const baselineImage = useImage(avatar?.baseImageUrl ?? '');
  const face = useAvatarFace(avatarId, baselineImage, avatar?.landmarksJson, avatar?.masksJson);

  const [studioState, setStudioState] = useState<StudioState>(DEFAULT_STUDIO_STATE);
  const [activeRender, setActiveRender] = useState<ActiveRender | null>(null);
  const [renderBusy, setRenderBusy] = useState(false);
  const [compareSliderX, setCompareSliderX] = useState(0);
  const [askBusy, setAskBusy] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<StylistRecommendation[]>([]);
  const canvasRef = useRef<StudioCanvasHandle | null>(null);

  const anyTints = hasAnyTint(studioState);
  const faceReady = face.status === 'ready';
  const savedCount = savedLooks?.length ?? 0;
  // A render is "occupying the studio" while activeRender is set — we only
  // free the next-render slot when the user closes the result dialog, so a
  // fast double-click can't queue two AI calls.
  const renderSlotBusy = renderBusy || activeRender !== null;
  // When tints are applied we MUST flatten the canvas; that needs face
  // landmarks. Disable the Render button until both are true so we never
  // silently fall back to "no input image" with active tints.
  const renderBlockedByFace = anyTints && !faceReady;

  const uploadSummaries = useMemo<UploadedItemSummary[]>(() => {
    if (uploads === undefined) return [];
    const out: UploadedItemSummary[] = [];
    for (const item of uploads) {
      if (item.imageUrl === null) continue;
      out.push({
        _id: item._id,
        imageUrl: item.imageUrl,
        label: item.label ?? i18n._(UPLOADED_ITEM_TYPE_LABELS[item.type]),
      });
    }
    return out;
  }, [uploads, i18n]);

  const handleDeleteUpload = (id: Id<'uploadedItems'>) => {
    void deleteUpload.run({ id });
    // Functional updater so concurrent state changes (e.g. user mid-edit on
    // a different control) don't get clobbered by a stale snapshot.
    setStudioState((prev) =>
      prev.selectedUploadId === id ? { ...prev, selectedUploadId: null } : prev,
    );
  };

  const handleAsk = (question: string) => {
    setAskBusy(true);
    setAskError(null);
    analyze({ avatarId, question })
      .then((result: AnalyzeStyleResult) => {
        setRecommendations(result.recommendations);
      })
      .catch((error: unknown) => {
        console.error(error);
        const message = translateServerError(error);
        setAskError(message);
        toast.error(message);
      })
      .finally(() => {
        setAskBusy(false);
      });
  };

  const handleRenderRecommendation = (recommendation: StylistRecommendation) => {
    if (renderSlotBusy) return;
    setRenderBusy(true);
    createRenderJob({
      avatarId,
      prompt: recommendation.renderPrompt,
      title: recommendation.title,
      styleType: recommendation.styleType,
    })
      .then((jobId) => {
        setActiveRender({ jobId, title: recommendation.title });
      })
      .catch((error: unknown) => {
        console.error(error);
        toast.error(translateServerError(error));
      })
      .finally(() => {
        setRenderBusy(false);
      });
  };

  const handleRender = async (gender: AvatarGender) => {
    if (renderSlotBusy) return;
    if (!hasAnyChange(studioState)) {
      toast.error(t`Apply at least one style change first.`);
      return;
    }
    // Snapshot the studio state up-front so every downstream await
    // (`exportPng`, upload, claim, prompt+title build, `createRenderJob`)
    // sees a single coherent view. The sidebar isn't disabled while we
    // render, so user edits between awaits would otherwise cause the
    // exported PNG and the prompt to describe different states.
    const snapshot = studioState;
    const snapshotHasTints = hasAnyTint(snapshot);
    if (snapshotHasTints && !faceReady) {
      toast.error(t`Wait for face landmarks to finish before rendering tinted looks.`);
      return;
    }

    setRenderBusy(true);
    // Held outside the try so the catch can free the blob if createRenderJob
    // throws after we've already uploaded the snapshot. On the success path
    // we clear it — the render action then owns the blob and deletes it
    // itself when it finishes.
    let pendingInputStorageId: Id<'_storage'> | undefined;
    try {
      // Bake the live makeup into the render input only when the user has
      // applied some — preserves an exact handoff so AI doesn't drop the
      // makeup. When no tints are applied, the avatar baseline is the input
      // and we skip the upload entirely.
      if (snapshotHasTints) {
        const handle = canvasRef.current;
        if (handle === null) {
          // The Stage isn't mounted yet (face / image still loading). The
          // guard above should make this unreachable, but if it happens we
          // hard-error rather than silently submit without the flatten.
          throw new Error('Canvas not ready for export.');
        }
        const blob = await handle.exportPng();
        if (blob === null) {
          throw new Error('Canvas snapshot returned no bytes.');
        }
        const url = await generateUploadUrl();
        const storageId = await uploadBlobToConvex(
          url,
          blob,
          t`Could not upload the canvas snapshot.`,
        );
        // Claim ownership of the blob before referencing it from a render
        // job; `createRenderJob` consumes the claim and `discardRenderInput`
        // verifies it on cleanup.
        await claimRenderInput({ storageId });
        pendingInputStorageId = storageId;
      }

      const prompt = composeRenderPrompt(snapshot, gender);
      const title = composeRenderTitle(snapshot, gender);
      const jobId = await createRenderJob({
        avatarId,
        prompt,
        title,
        ...(snapshot.selectedUploadId !== null && {
          referenceUploadedItemId: snapshot.selectedUploadId,
        }),
        ...(pendingInputStorageId !== undefined && { inputStorageId: pendingInputStorageId }),
      });
      // Job accepted — the action now owns the blob.
      pendingInputStorageId = undefined;
      setActiveRender({ jobId, title });
    } catch (error) {
      console.error(error);
      toast.error(translateServerError(error));
      if (pendingInputStorageId !== undefined) {
        void discardRenderInput({ storageId: pendingInputStorageId }).catch(
          (cleanupError: unknown) => {
            console.warn('Render input cleanup failed:', cleanupError);
          },
        );
      }
    } finally {
      setRenderBusy(false);
    }
  };

  return (
    <BaselineStatusGate avatar={avatar}>
      {(ready) => (
        <div className="flex flex-col gap-6">
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-1">
              <Link
                to="/avatars"
                className="text-muted-foreground hover:text-foreground text-xs font-medium tracking-wide uppercase transition"
              >
                <Trans>Avatars</Trans>
                <span className="px-1">/</span>
                <span className="text-foreground">{ready.name}</span>
              </Link>
              <h1 className="text-3xl font-semibold tracking-tight">{ready.name}</h1>
              <p className="text-muted-foreground max-w-2xl text-sm">
                <Trans>
                  Tint makeup live, pick extras, ask the stylist, then render the look — every saved
                  look stays under {ready.name}.
                </Trans>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to="/saved" search={{ avatarId }}>
                  <Bookmark />
                  {savedCount > 0 ? (
                    <Trans>
                      {ready.name}&apos;s looks ({savedCount.toString()})
                    </Trans>
                  ) : (
                    <Trans>{ready.name}&apos;s looks</Trans>
                  )}
                </Link>
              </Button>
            </div>
          </header>

          <FaceStatusBanner status={face.status} errorCode={face.errorCode} />

          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <div className="flex flex-col gap-3">
              <div className="border-border/60 bg-card overflow-hidden rounded-xl border shadow-sm">
                <StudioCanvas
                  ref={canvasRef}
                  baseImage={baselineImage}
                  altText={ready.name}
                  face={face.face?.landmarks ?? null}
                  state={studioState}
                  compareSliderX={compareSliderX}
                />
              </div>
              {anyTints && (
                <div className="border-border/60 bg-card flex items-center gap-3 rounded-xl border px-4 py-3 text-xs shadow-sm">
                  <span className="text-muted-foreground shrink-0 font-medium">
                    <Trans>Before · After</Trans>
                  </span>
                  <Slider
                    min={0}
                    max={1}
                    step={0.01}
                    value={[compareSliderX]}
                    onValueChange={(v) => {
                      const x = v[0];
                      if (x === undefined) return;
                      setCompareSliderX(x);
                    }}
                    className="flex-1"
                    aria-label={t`Before / after slider`}
                  />
                  <span className="text-muted-foreground w-10 shrink-0 text-right tabular-nums">
                    {Math.round(compareSliderX * 100)}%
                  </span>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-3">
              <StudioSidebar
                state={studioState}
                onStateChange={setStudioState}
                uploads={uploadSummaries}
                onDeleteUpload={handleDeleteUpload}
                faceReady={face.status === 'ready'}
                gender={ready.gender}
                askBusy={askBusy}
                askError={askError}
                recommendations={recommendations}
                onAsk={handleAsk}
                onRenderRecommendation={handleRenderRecommendation}
                renderBusy={renderSlotBusy}
              />
              <Button
                type="button"
                size="lg"
                onClick={() => {
                  void handleRender(ready.gender);
                }}
                disabled={renderSlotBusy || !hasAnyChange(studioState) || renderBlockedByFace}
              >
                {renderBusy ? <Loader2 className="animate-spin" /> : <Sparkles />}
                <Trans>Render look</Trans>
              </Button>
              {renderBlockedByFace && (
                <p className="text-muted-foreground text-xs">
                  <Trans>
                    Face landmarks are still loading — tinted renders unlock once ready.
                  </Trans>
                </p>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStudioState(DEFAULT_STUDIO_STATE);
                }}
                disabled={!hasAnyChange(studioState)}
              >
                <Trans>Reset all tools</Trans>
              </Button>
            </div>
          </div>

          {activeRender !== null && (
            <RenderResult
              key={activeRender.jobId}
              jobId={activeRender.jobId}
              title={activeRender.title}
              avatarId={avatarId}
              avatarName={ready.name}
              baselineUrl={avatar?.baseImageUrl ?? ''}
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

interface FaceStatusBannerProps {
  status: ReturnType<typeof useAvatarFace>['status'];
  errorCode: ReturnType<typeof useAvatarFace>['errorCode'];
}

function FaceStatusBanner({ status, errorCode }: FaceStatusBannerProps) {
  if (status === 'ready') return null;
  if (status === 'failed') {
    return (
      <div
        role="alert"
        className="border-destructive/40 bg-destructive/5 text-destructive flex items-center gap-2 rounded-md border p-3 text-xs"
      >
        <AlertCircle className="size-4 shrink-0" />
        <span>
          <FaceErrorMessage code={errorCode} />
        </span>
      </div>
    );
  }
  return (
    <div
      role="status"
      aria-live="polite"
      className="border-border text-muted-foreground bg-muted/40 flex items-center gap-2 rounded-md border p-3 text-xs"
    >
      <Loader2 className="size-4 shrink-0 animate-spin" />
      <span>
        <Trans>
          Preparing studio tools (face landmarks + segmentation, runs in your browser, only your
          canonical portrait is analysed)…
        </Trans>
      </span>
    </div>
  );
}

function FaceErrorMessage({ code }: { code: ReturnType<typeof useAvatarFace>['errorCode'] }) {
  switch (code) {
    case 'no_face':
      return <Trans>No face detected in the baseline portrait.</Trans>;
    case 'segmentation_failed':
      return <Trans>Couldn&apos;t segment the portrait. Try a clearer photo.</Trans>;
    case 'unknown':
    case null:
      return <Trans>Could not prepare studio tools.</Trans>;
  }
}
