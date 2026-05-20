import { createFileRoute, Link } from '@tanstack/react-router';
import { useMutation, useQuery } from 'convex/react';
import { Loader2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { RenderResult } from '@/components/render/render-result';
import { RequireAuth } from '@/components/require-auth';
import { LayerControls } from '@/components/studio/layer-controls';
import {
  type PaletteTab,
  type RecentPaletteEntry,
  StylePalette,
  type UploadedPaletteEntry,
} from '@/components/studio/style-palette';
import { StudioCanvas } from '@/components/studio/studio-canvas';
import { UploadedItemUploader } from '@/components/studio/uploaded-item-uploader';
import { Button } from '@/components/ui/button';
import {
  buildLayerFromSample,
  buildLayerFromUpload,
  type CanvasLayer,
  parseSampleLayerSettings,
  serializeSampleLayerSettings,
} from '@/lib/studio/layers';
import {
  type OverlayCategory,
  SAMPLE_OVERLAYS,
  type SampleOverlay,
  findSampleOverlay,
} from '@/lib/studio/sample-overlays';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

export const Route = createFileRoute('/studio/$avatarId')({
  component: StudioPage,
});

function StudioPage() {
  return (
    <RequireAuth>
      <Studio />
    </RequireAuth>
  );
}

const CATEGORY_TO_ITEM_TYPE: Record<OverlayCategory, 'hair' | 'makeup' | 'nails'> = {
  hair: 'hair',
  makeup: 'makeup',
  nails: 'nails',
};

interface ActiveTryOn {
  jobId: Id<'renderJobs'>;
  title: string;
}

function Studio() {
  const { avatarId } = Route.useParams();
  const typedAvatarId = avatarId as Id<'avatars'>;
  const avatar = useQuery(api.avatars.getAvatar, { id: typedAvatarId });
  const recent = useQuery(api.recentItems.listRecentItems, { avatarId: typedAvatarId });
  const uploads = useQuery(api.uploadedItems.listUploadedItems, {});
  const saveRecentItem = useMutation(api.recentItems.saveRecentItem);
  const createRenderJob = useMutation(api.renderJobs.createRenderJob);

  const [layers, setLayers] = useState<CanvasLayer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PaletteTab>('hair');
  const [stageSize, setStageSize] = useState<{ width: number; height: number } | null>(null);
  const [activeTryOn, setActiveTryOn] = useState<ActiveTryOn | null>(null);
  const [startingTryOn, setStartingTryOn] = useState(false);

  const handleStageReady = useCallback((size: { width: number; height: number }) => {
    setStageSize(size);
  }, []);

  const handleLayerChange = useCallback((id: string, patch: Partial<CanvasLayer>) => {
    setLayers((prev) => prev.map((layer) => (layer.id === id ? { ...layer, ...patch } : layer)));
  }, []);

  const recentEntries = useMemo<RecentPaletteEntry[]>(() => {
    if (recent === undefined) return [];
    const entries: RecentPaletteEntry[] = [];
    for (const item of recent) {
      const settings = parseSampleLayerSettings(item.settingsJson);
      if (settings === null) continue;
      const overlay = findSampleOverlay(settings.sampleOverlayId);
      if (overlay === undefined) continue;
      entries.push({ id: item._id, label: item.prompt ?? overlay.label, overlay });
    }
    return entries;
  }, [recent]);

  const uploadEntries = useMemo<UploadedPaletteEntry[]>(() => {
    if (uploads === undefined) return [];
    const entries: UploadedPaletteEntry[] = [];
    for (const item of uploads) {
      if (item.imageUrl === null) continue;
      entries.push({
        _id: item._id,
        imageUrl: item.imageUrl,
        label: item.label ?? prettyType(item.type),
      });
    }
    return entries;
  }, [uploads]);

  const selectedLayer = useMemo(
    () => layers.find((layer) => layer.id === selectedLayerId) ?? null,
    [layers, selectedLayerId],
  );

  const applyOverlay = (overlay: SampleOverlay) => {
    if (stageSize === null) return;
    const layer = buildLayerFromSample(overlay, stageSize);
    setLayers((prev) => [...prev, layer]);
    setSelectedLayerId(layer.id);
    const settings = serializeSampleLayerSettings(layer);
    if (settings === null) return;
    void saveRecentItem({
      avatarId: typedAvatarId,
      type: CATEGORY_TO_ITEM_TYPE[overlay.category],
      source: 'suggested',
      prompt: overlay.label,
      settingsJson: settings,
    }).catch((error: unknown) => {
      console.error(error);
      toast.error('Could not save to recents.');
    });
  };

  const reapplyRecent = (entry: RecentPaletteEntry) => {
    if (stageSize === null) return;
    const layer = buildLayerFromSample(entry.overlay, stageSize);
    setLayers((prev) => [...prev, layer]);
    setSelectedLayerId(layer.id);
  };

  const applyUpload = (entry: UploadedPaletteEntry) => {
    if (stageSize === null || uploads === undefined) return;
    const item = uploads.find((u) => u._id === entry._id);
    if (item === undefined) return;
    const layer = buildLayerFromUpload(
      { _id: item._id, type: item.type, imageUrl: entry.imageUrl },
      stageSize,
    );
    setLayers((prev) => [...prev, layer]);
    setSelectedLayerId(layer.id);
  };

  const deleteSelected = () => {
    if (selectedLayer === null) return;
    setLayers((prev) => prev.filter((layer) => layer.id !== selectedLayer.id));
    setSelectedLayerId(null);
  };

  const handleTryOn = () => {
    if (selectedLayer === null) return;
    if (selectedLayer.origin.kind !== 'upload') return;
    const title = `Try on ${selectedLayer.category}`;
    setStartingTryOn(true);
    createRenderJob({
      avatarId: typedAvatarId,
      prompt: `Wear the attached ${selectedLayer.category} item naturally.`,
      title,
      referenceUploadedItemId: selectedLayer.origin.uploadedItemId,
    })
      .then((jobId) => {
        setActiveTryOn({ jobId, title });
      })
      .catch((error: unknown) => {
        console.error(error);
        toast.error(error instanceof Error ? error.message : 'Could not start try-on.');
      })
      .finally(() => {
        setStartingTryOn(false);
      });
  };

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

  if (avatar.baseImageUrl === null) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{avatar.name}</h1>
        <p className="text-muted-foreground text-sm">
          Couldn&apos;t load this avatar&apos;s image. Try again in a moment.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{avatar.name}</h1>
          <p className="text-muted-foreground text-sm">
            Pick a style or upload clothing, position it on the canvas, then hit Try on for an AI
            render.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/avatars">All avatars</Link>
        </Button>
      </header>

      <StylePalette
        activeTab={activeTab}
        onTabChange={setActiveTab}
        samples={SAMPLE_OVERLAYS}
        recent={recentEntries}
        uploads={uploadEntries}
        onPickSample={applyOverlay}
        onPickRecent={reapplyRecent}
        onPickUpload={applyUpload}
        uploadButton={
          <UploadedItemUploader
            onUploaded={() => {
              setActiveTab('uploads');
            }}
          />
        }
      />

      <StudioCanvas
        baseImageUrl={avatar.baseImageUrl}
        altText={avatar.name}
        layers={layers}
        selectedLayerId={selectedLayerId}
        onSelectLayer={setSelectedLayerId}
        onLayerChange={handleLayerChange}
        onStageReady={handleStageReady}
      />

      {selectedLayer !== null && (
        <LayerControls
          opacity={selectedLayer.opacity}
          onOpacityChange={(opacity) => {
            handleLayerChange(selectedLayer.id, { opacity });
          }}
          onDelete={deleteSelected}
          {...(selectedLayer.origin.kind === 'upload' && {
            onTryOn: handleTryOn,
            tryOnBusy: startingTryOn || activeTryOn !== null,
          })}
        />
      )}

      {activeTryOn !== null && (
        <RenderResult
          jobId={activeTryOn.jobId}
          title={activeTryOn.title}
          onClose={() => {
            setActiveTryOn(null);
          }}
        />
      )}
    </div>
  );
}

function prettyType(type: string): string {
  return type.replace(/_/g, ' ');
}
