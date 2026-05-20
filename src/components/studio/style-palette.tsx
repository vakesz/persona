import { type OverlayCategory, type SampleOverlay } from '@/lib/studio/sample-overlays';
import { cn } from '@/lib/utils';

export type PaletteTab = OverlayCategory | 'recent';

export interface RecentPaletteEntry {
  id: string;
  label: string;
  overlay: SampleOverlay;
}

export interface StylePaletteProps {
  activeTab: PaletteTab;
  onTabChange: (tab: PaletteTab) => void;
  samples: SampleOverlay[];
  recent: RecentPaletteEntry[];
  onPickSample: (overlay: SampleOverlay) => void;
  onPickRecent: (entry: RecentPaletteEntry) => void;
}

const TAB_LABELS: Record<PaletteTab, string> = {
  hair: 'Hair',
  makeup: 'Makeup',
  nails: 'Nails',
  recent: 'Recent',
};

const TABS: PaletteTab[] = ['hair', 'makeup', 'nails', 'recent'];

export function StylePalette({
  activeTab,
  onTabChange,
  samples,
  recent,
  onPickSample,
  onPickRecent,
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

      {activeTab === 'recent' ? (
        recent.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Items you try will appear here so you can re-apply them.
          </p>
        ) : (
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
        )
      ) : (
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
