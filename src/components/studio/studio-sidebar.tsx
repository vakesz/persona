import { Trash2 } from 'lucide-react';
import { useState } from 'react';

import { UploadedItemUploader } from '@/components/studio/uploaded-item-uploader';
import { Button } from '@/components/ui/button';
import type {
  ColorTint,
  GeometryPlan,
  LipFinish,
  LipTint,
  StudioState,
} from '@/lib/studio/studio-state';
import { cn } from '@/lib/utils';
import type { Id } from '@convex/_generated/dataModel';

type TabId = 'lips' | 'eyes' | 'brows' | 'cheeks' | 'beard' | 'mustache' | 'hair' | 'uploads';

const TABS: { id: TabId; label: string }[] = [
  { id: 'lips', label: 'Lips' },
  { id: 'eyes', label: 'Eyes' },
  { id: 'brows', label: 'Brows' },
  { id: 'cheeks', label: 'Cheeks' },
  { id: 'beard', label: 'Beard' },
  { id: 'mustache', label: 'Mustache' },
  { id: 'hair', label: 'Hair' },
  { id: 'uploads', label: 'Uploads' },
];

const LIP_COLORS = ['#c41e3a', '#a4361e', '#cf6e6c', '#7a3a44', '#d68a8a', '#5a1a3e'];
const EYE_COLORS = ['#7a5230', '#5a3a20', '#9a7a5a', '#3a2a1a', '#4a3a55', '#234b6e'];
const BLUSH_COLORS = ['#ff8db5', '#ff7ba8', '#e89bb5', '#d97070', '#f2a07a'];
const BROW_COLORS = ['#3a2a1a', '#5a3e28', '#7a5a3a', '#2a1a10', '#1a1108'];

const BEARD_PRESETS = ['full beard', 'goatee', 'stubble', 'soul patch'];
const MUSTACHE_PRESETS = ['pencil mustache', 'thick mustache', 'handlebar mustache'];
const HAIRSTYLE_PRESETS = ['pixie cut', 'bob', 'undercut', 'long waves', 'high ponytail', 'shaved'];

const FINISH_OPTIONS: { id: LipFinish; label: string }[] = [
  { id: 'matte', label: 'Matte' },
  { id: 'satin', label: 'Satin' },
  { id: 'gloss', label: 'Gloss' },
];

export interface UploadedItemSummary {
  _id: Id<'uploadedItems'>;
  imageUrl: string;
  label: string;
}

export interface StudioSidebarProps {
  state: StudioState;
  onStateChange: (next: StudioState) => void;
  uploads: UploadedItemSummary[];
  onDeleteUpload: (id: Id<'uploadedItems'>) => void;
  faceReady: boolean;
}

export function StudioSidebar({
  state,
  onStateChange,
  uploads,
  onDeleteUpload,
  faceReady,
}: StudioSidebarProps) {
  const [active, setActive] = useState<TabId>('lips');

  return (
    <div className="border-border bg-card flex flex-col gap-3 rounded-lg border p-3">
      <nav
        className="border-border -mx-1 flex gap-1 overflow-x-auto border-b pb-1"
        aria-label="Studio tool"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActive(tab.id);
            }}
            className={cn(
              'shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition',
              active === tab.id
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
            aria-current={active === tab.id ? 'page' : undefined}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {!faceReady &&
        active !== 'uploads' &&
        active !== 'beard' &&
        active !== 'mustache' &&
        active !== 'hair' && (
          <p className="text-muted-foreground text-xs">
            Color tools become available once face landmarks finish computing.
          </p>
        )}

      {active === 'lips' && (
        <ColorTintPanel
          title="Lipstick"
          subtitle="Live preview — clips to your lip polygons."
          tint={state.lip}
          onChange={(next) => {
            onStateChange({ ...state, lip: { ...next, finish: state.lip.finish } });
          }}
          palette={LIP_COLORS}
          finish={state.lip.finish}
          onFinishChange={(finish) => {
            onStateChange({ ...state, lip: { ...state.lip, finish } });
          }}
        />
      )}

      {active === 'eyes' && (
        <ColorTintPanel
          title="Eyeshadow"
          subtitle="Tints the lid above each eye."
          tint={state.eyeshadow}
          onChange={(next) => {
            onStateChange({ ...state, eyeshadow: next });
          }}
          palette={EYE_COLORS}
        />
      )}

      {active === 'brows' && (
        <ColorTintPanel
          title="Brow tint"
          subtitle="Subtle color on the brow polygons."
          tint={state.browTint}
          onChange={(next) => {
            onStateChange({ ...state, browTint: next });
          }}
          palette={BROW_COLORS}
        />
      )}

      {active === 'cheeks' && (
        <ColorTintPanel
          title="Blush"
          subtitle="Feathered ellipse on each cheekbone."
          tint={state.blush}
          onChange={(next) => {
            onStateChange({ ...state, blush: next });
          }}
          palette={BLUSH_COLORS}
        />
      )}

      {active === 'beard' && (
        <GeometryPanel
          title="Beard"
          subtitle="Geometry change — runs the AI render."
          plan={state.beard}
          presets={BEARD_PRESETS}
          onChange={(next) => {
            onStateChange({ ...state, beard: next });
          }}
        />
      )}

      {active === 'mustache' && (
        <GeometryPanel
          title="Mustache"
          subtitle="Geometry change — runs the AI render."
          plan={state.mustache}
          presets={MUSTACHE_PRESETS}
          onChange={(next) => {
            onStateChange({ ...state, mustache: next });
          }}
        />
      )}

      {active === 'hair' && (
        <GeometryPanel
          title="Hairstyle"
          subtitle="Geometry change — runs the AI render."
          plan={state.hairstyle}
          presets={HAIRSTYLE_PRESETS}
          onChange={(next) => {
            onStateChange({ ...state, hairstyle: next });
          }}
        />
      )}

      {active === 'uploads' && (
        <UploadsPanel
          uploads={uploads}
          selectedId={state.selectedUploadId}
          onSelect={(id) => {
            onStateChange({ ...state, selectedUploadId: id });
          }}
          onDelete={onDeleteUpload}
        />
      )}
    </div>
  );
}

interface ColorTintPanelProps {
  title: string;
  subtitle: string;
  tint: ColorTint | LipTint;
  onChange: (next: ColorTint) => void;
  palette: string[];
  finish?: LipFinish;
  onFinishChange?: (finish: LipFinish) => void;
}

function ColorTintPanel({
  title,
  subtitle,
  tint,
  onChange,
  palette,
  finish,
  onFinishChange,
}: ColorTintPanelProps) {
  return (
    <div className="flex flex-col gap-3">
      <PanelHeader title={title} subtitle={subtitle} />
      <label className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">Enabled</span>
        <input
          type="checkbox"
          checked={tint.enabled}
          onChange={(event) => {
            onChange({ ...tint, enabled: event.currentTarget.checked });
          }}
          className="accent-foreground"
        />
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-muted-foreground text-xs">Color</span>
        <div className="grid grid-cols-6 gap-1.5">
          {palette.map((swatch) => (
            <button
              key={swatch}
              type="button"
              aria-label={swatch}
              onClick={() => {
                onChange({ ...tint, color: swatch, enabled: true });
              }}
              className={cn(
                'aspect-square rounded-md border-2 transition',
                tint.color === swatch && tint.enabled
                  ? 'border-foreground ring-foreground/40 ring-2'
                  : 'border-transparent',
              )}
              style={{ backgroundColor: swatch }}
            />
          ))}
          <label
            className="border-input hover:border-foreground/40 relative aspect-square cursor-pointer rounded-md border"
            aria-label="Custom color"
          >
            <input
              type="color"
              value={tint.color}
              onChange={(event) => {
                onChange({ ...tint, color: event.currentTarget.value, enabled: true });
              }}
              className="absolute inset-0 size-full cursor-pointer opacity-0"
            />
            <span className="text-muted-foreground absolute inset-0 flex items-center justify-center text-[10px]">
              ±
            </span>
          </label>
        </div>
      </div>

      <label className="flex flex-col gap-1 text-xs">
        <div className="text-muted-foreground flex items-center justify-between">
          <span>Intensity</span>
          <span className="tabular-nums">{Math.round(tint.intensity * 100)}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={tint.intensity}
          disabled={!tint.enabled}
          onChange={(event) => {
            onChange({ ...tint, intensity: Number(event.currentTarget.value) });
          }}
          className="accent-foreground"
        />
      </label>

      {finish !== undefined && onFinishChange !== undefined && (
        <div className="flex flex-col gap-2">
          <span className="text-muted-foreground text-xs">Finish</span>
          <div className="grid grid-cols-3 gap-1">
            {FINISH_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  onFinishChange(option.id);
                }}
                disabled={!tint.enabled}
                className={cn(
                  'rounded-md border px-2 py-1.5 text-xs transition disabled:opacity-50',
                  finish === option.id
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-input hover:bg-accent',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!tint.enabled}
        onClick={() => {
          onChange({ ...tint, enabled: false });
        }}
      >
        Reset
      </Button>
    </div>
  );
}

interface GeometryPanelProps {
  title: string;
  subtitle: string;
  plan: GeometryPlan;
  presets: string[];
  onChange: (next: GeometryPlan) => void;
}

function GeometryPanel({ title, subtitle, plan, presets, onChange }: GeometryPanelProps) {
  return (
    <div className="flex flex-col gap-3">
      <PanelHeader title={title} subtitle={subtitle} />
      <div className="flex flex-col gap-2">
        <span className="text-muted-foreground text-xs">Preset</span>
        <div className="flex flex-wrap gap-1.5">
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => {
                onChange({ ...plan, preset });
              }}
              className={cn(
                'rounded-full border px-3 py-1 text-xs transition',
                plan.preset === preset
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-input hover:bg-accent',
              )}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-muted-foreground">Detail (optional)</span>
        <input
          type="text"
          value={plan.custom}
          onChange={(event) => {
            onChange({ ...plan, custom: event.currentTarget.value });
          }}
          placeholder="e.g. salt-and-pepper, side parted"
          className="border-input rounded-md border px-3 py-2 text-sm"
          maxLength={80}
        />
      </label>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={plan.preset === null && plan.custom.length === 0}
        onClick={() => {
          onChange({ preset: null, custom: '' });
        }}
      >
        Clear
      </Button>
    </div>
  );
}

interface UploadsPanelProps {
  uploads: UploadedItemSummary[];
  selectedId: Id<'uploadedItems'> | null;
  onSelect: (id: Id<'uploadedItems'> | null) => void;
  onDelete: (id: Id<'uploadedItems'>) => void;
}

function UploadsPanel({ uploads, selectedId, onSelect, onDelete }: UploadsPanelProps) {
  return (
    <div className="flex flex-col gap-3">
      <PanelHeader
        title="Try on clothing"
        subtitle="Upload an item; renders use it as the reference."
      />
      <div className="grid grid-cols-3 gap-2">
        <UploadedItemUploader onUploaded={onSelect} />
        {uploads.map((item) => (
          <div key={item._id} className="group relative">
            <button
              type="button"
              onClick={() => {
                onSelect(selectedId === item._id ? null : item._id);
              }}
              className={cn(
                'aspect-square w-full overflow-hidden rounded-md border-2 transition',
                selectedId === item._id
                  ? 'border-foreground ring-foreground/40 ring-2'
                  : 'hover:border-foreground/40 border-transparent',
              )}
            >
              <img
                src={item.imageUrl}
                alt={item.label}
                className="size-full object-cover"
                loading="lazy"
                decoding="async"
              />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onDelete(item._id);
              }}
              aria-label={`Delete ${item.label}`}
              className="bg-background/80 absolute top-1 right-1 rounded-full p-1 opacity-0 shadow transition group-hover:opacity-100"
            >
              <Trash2 className="size-3" />
            </button>
          </div>
        ))}
      </div>
      {selectedId !== null && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            onSelect(null);
          }}
        >
          Clear selection
        </Button>
      )}
    </div>
  );
}

interface PanelHeaderProps {
  title: string;
  subtitle: string;
}

function PanelHeader({ title, subtitle }: PanelHeaderProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="text-muted-foreground text-xs">{subtitle}</p>
    </div>
  );
}
