import { type ReactNode } from 'react';

import { type OverlayCategory, type SampleOverlay } from '@/lib/studio/sample-overlays';
import { cn } from '@/lib/utils';
import type { Id } from '@convex/_generated/dataModel';

export type PaletteTab = OverlayCategory | 'recent' | 'uploads';

export interface RecentPaletteEntry {
  id: string;
  label: string;
  overlay: SampleOverlay;
}

export interface UploadedPaletteEntry {
  _id: Id<'uploadedItems'>;
  imageUrl: string;
  label: string;
}

export interface StylePaletteProps {
  activeTab: PaletteTab;
  onTabChange: (tab: PaletteTab) => void;
  samples: SampleOverlay[];
  recent: RecentPaletteEntry[];
  uploads: UploadedPaletteEntry[];
  onPickSample: (overlay: SampleOverlay) => void;
  onPickRecent: (entry: RecentPaletteEntry) => void;
  onPickUpload: (entry: UploadedPaletteEntry) => void;
  uploadButton: ReactNode;
}

const TAB_LABELS: Record<PaletteTab, string> = {
  hair: 'Hair',
  makeup: 'Makeup',
  nails: 'Nails',
  recent: 'Recent',
  uploads: 'Uploads',
};

const TABS: PaletteTab[] = ['hair', 'makeup', 'nails', 'uploads', 'recent'];

export function StylePalette({
  activeTab,
  onTabChange,
  samples,
  recent,
  uploads,
  onPickSample,
  onPickRecent,
  onPickUpload,
  uploadButton,
}: StylePaletteProps) {
  return (
    <div className="flex flex-col gap-3">
      <nav className="border-border flex gap-1 border-b" aria-label="Style category">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => {
              onTabChange(tab);
            }}
            className={cn(
              'px-3 py-2 text-sm font-medium transition',
              activeTab === tab
                ? 'border-foreground border-b-2'
                : 'text-muted-foreground hover:text-foreground',
            )}
            aria-current={activeTab === tab ? 'page' : undefined}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </nav>

      {activeTab === 'recent' && <RecentTab recent={recent} onPickRecent={onPickRecent} />}

      {activeTab === 'uploads' && (
        <UploadsTab uploads={uploads} onPickUpload={onPickUpload} uploadButton={uploadButton} />
      )}

      {activeTab !== 'recent' && activeTab !== 'uploads' && (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {samples
            .filter((s) => s.category === activeTab)
            .map((sample) => (
              <PaletteTile
                key={sample.id}
                label={sample.label}
                imageUrl={sample.imageUrl}
                onClick={() => {
                  onPickSample(sample);
                }}
              />
            ))}
        </div>
      )}
    </div>
  );
}

interface RecentTabProps {
  recent: RecentPaletteEntry[];
  onPickRecent: (entry: RecentPaletteEntry) => void;
}

function RecentTab({ recent, onPickRecent }: RecentTabProps) {
  if (recent.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Items you try will appear here so you can re-apply them.
      </p>
    );
  }
  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {recent.map((entry) => (
        <PaletteTile
          key={entry.id}
          label={entry.label}
          imageUrl={entry.overlay.imageUrl}
          onClick={() => {
            onPickRecent(entry);
          }}
        />
      ))}
    </div>
  );
}

interface UploadsTabProps {
  uploads: UploadedPaletteEntry[];
  onPickUpload: (entry: UploadedPaletteEntry) => void;
  uploadButton: ReactNode;
}

function UploadsTab({ uploads, onPickUpload, uploadButton }: UploadsTabProps) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {uploadButton}
      {uploads.map((entry) => (
        <PaletteTile
          key={entry._id}
          label={entry.label}
          imageUrl={entry.imageUrl}
          onClick={() => {
            onPickUpload(entry);
          }}
        />
      ))}
    </div>
  );
}

interface PaletteTileProps {
  label: string;
  imageUrl: string;
  onClick: () => void;
}

function PaletteTile({ label, imageUrl, onClick }: PaletteTileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border-border hover:border-foreground/40 group flex w-24 shrink-0 flex-col items-center gap-2 rounded-md border p-2 text-center transition"
    >
      <div className="bg-muted flex h-16 w-full items-center justify-center overflow-hidden rounded">
        <img
          src={imageUrl}
          alt={label}
          className="max-h-full max-w-full object-contain"
          loading="lazy"
          decoding="async"
        />
      </div>
      <span className="line-clamp-2 text-xs leading-tight">{label}</span>
    </button>
  );
}
