import { type MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { Loader2, Sparkles, Trash2 } from 'lucide-react';
import { type SyntheticEvent, useMemo, useState } from 'react';

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

type AvatarGender = 'male' | 'female' | 'unspecified';

type StylistStyleType = 'hair' | 'makeup' | 'nails' | 'clothes';

export interface StylistRecommendation {
  title: string;
  description: string;
  styleType: StylistStyleType;
  renderPrompt: string;
}

type TabId =
  | 'lips'
  | 'eyes'
  | 'brows'
  | 'cheeks'
  | 'beard'
  | 'mustache'
  | 'hair'
  | 'extras'
  | 'vibe'
  | 'uploads'
  | 'ask';

const ALL_TABS: { id: TabId; label: MessageDescriptor }[] = [
  { id: 'lips', label: msg`Lips` },
  { id: 'eyes', label: msg`Eyes` },
  { id: 'brows', label: msg`Brows` },
  { id: 'cheeks', label: msg`Cheeks` },
  { id: 'beard', label: msg`Beard` },
  { id: 'mustache', label: msg`Mustache` },
  { id: 'hair', label: msg`Hair` },
  { id: 'extras', label: msg`Extras` },
  { id: 'vibe', label: msg`Vibe` },
  { id: 'uploads', label: msg`Uploads` },
  { id: 'ask', label: msg`Ask AI` },
];

const TABS_BY_GENDER: Record<AvatarGender, TabId[]> = {
  male: ['brows', 'beard', 'mustache', 'hair', 'extras', 'vibe', 'uploads', 'ask'],
  female: ['lips', 'eyes', 'brows', 'cheeks', 'hair', 'extras', 'vibe', 'uploads', 'ask'],
  unspecified: [
    'lips',
    'eyes',
    'brows',
    'cheeks',
    'beard',
    'mustache',
    'hair',
    'extras',
    'vibe',
    'uploads',
    'ask',
  ],
};

const LIP_COLORS = ['#c41e3a', '#a4361e', '#cf6e6c', '#7a3a44', '#d68a8a', '#5a1a3e'];
const EYE_COLORS = ['#7a5230', '#5a3a20', '#9a7a5a', '#3a2a1a', '#4a3a55', '#234b6e'];
const BLUSH_COLORS = ['#ff8db5', '#ff7ba8', '#e89bb5', '#d97070', '#f2a07a'];
const BROW_COLORS = ['#3a2a1a', '#5a3e28', '#7a5a3a', '#2a1a10', '#1a1108'];

/**
 * A preset's `value` is the literal English phrase sent to Gemini in the
 * render prompt — that keeps prompt quality stable across locales. `label` is
 * the user-visible chip text; translators can render it idiomatically.
 */
interface PresetEntry {
  value: string;
  label: MessageDescriptor;
}

const LIP_SHAPE_PRESETS: PresetEntry[] = [
  { value: 'fuller, plumper lips', label: msg`fuller, plumper lips` },
  { value: 'softer, more natural lips', label: msg`softer, more natural lips` },
  { value: 'sharper, defined outline', label: msg`sharper, defined outline` },
  { value: 'cupid-bow accent', label: msg`cupid-bow accent` },
];

const BROW_SHAPE_PRESETS: PresetEntry[] = [
  { value: 'thin, refined brows', label: msg`thin, refined brows` },
  { value: 'arched brows', label: msg`arched brows` },
  { value: 'straight brows', label: msg`straight brows` },
  { value: 'soft natural brows', label: msg`soft natural brows` },
  { value: 'bold thick brows', label: msg`bold thick brows` },
  { value: 'feathered brows', label: msg`feathered brows` },
];

const BEARD_PRESETS: PresetEntry[] = [
  { value: 'full beard', label: msg`full beard` },
  { value: 'goatee', label: msg`goatee` },
  { value: 'stubble', label: msg`stubble` },
  { value: 'soul patch', label: msg`soul patch` },
  { value: 'short boxed beard', label: msg`short boxed beard` },
];

const MUSTACHE_PRESETS: PresetEntry[] = [
  { value: 'pencil mustache', label: msg`pencil mustache` },
  { value: 'thick mustache', label: msg`thick mustache` },
  { value: 'handlebar mustache', label: msg`handlebar mustache` },
  { value: 'chevron', label: msg`chevron` },
];

interface HairGroup {
  label: MessageDescriptor;
  presets: PresetEntry[];
}

const HAIR_SHORT_FEMALE: PresetEntry[] = [
  { value: 'pixie cut', label: msg`pixie cut` },
  { value: 'pixie with bangs', label: msg`pixie with bangs` },
  { value: 'short crop', label: msg`short crop` },
  { value: 'chin-length bob', label: msg`chin-length bob` },
  { value: 'lob', label: msg`lob` },
];

const HAIR_MEDIUM_FEMALE: PresetEntry[] = [
  { value: 'shoulder-length waves', label: msg`shoulder-length waves` },
  { value: 'shaggy layers', label: msg`shaggy layers` },
  { value: 'curtain bangs', label: msg`curtain bangs` },
  { value: 'messy bun', label: msg`messy bun` },
  { value: 'half-up half-down', label: msg`half-up half-down` },
];

const HAIR_LONG_FEMALE: PresetEntry[] = [
  { value: 'long straight', label: msg`long straight` },
  { value: 'long loose waves', label: msg`long loose waves` },
  { value: 'tight curls', label: msg`tight curls` },
  { value: 'box braids', label: msg`box braids` },
  { value: 'sleek high ponytail', label: msg`sleek high ponytail` },
  { value: 'low pony', label: msg`low pony` },
];

const HAIR_UPDO_FEMALE: PresetEntry[] = [
  { value: 'french twist updo', label: msg`french twist updo` },
  { value: 'classic chignon', label: msg`classic chignon` },
  { value: 'top knot', label: msg`top knot` },
  { value: 'braided crown', label: msg`braided crown` },
];

const HAIR_SHORT_MALE: PresetEntry[] = [
  { value: 'buzz cut', label: msg`buzz cut` },
  { value: 'crew cut', label: msg`crew cut` },
  { value: 'short fade', label: msg`short fade` },
  { value: 'french crop', label: msg`french crop` },
  { value: 'textured crop', label: msg`textured crop` },
  { value: 'caesar cut', label: msg`caesar cut` },
];

const HAIR_MEDIUM_MALE: PresetEntry[] = [
  { value: 'side part', label: msg`side part` },
  { value: 'pompadour', label: msg`pompadour` },
  { value: 'quiff', label: msg`quiff` },
  { value: 'messy textured', label: msg`messy textured` },
  { value: 'undercut with slick back', label: msg`undercut with slick back` },
  { value: 'taper fade', label: msg`taper fade` },
];

const HAIR_LONG_MALE: PresetEntry[] = [
  { value: 'long flow', label: msg`long flow` },
  { value: 'man bun', label: msg`man bun` },
  { value: 'low ponytail', label: msg`low ponytail` },
  { value: 'shoulder-length waves', label: msg`shoulder-length waves` },
];

const HAIR_SHAVED_MALE: PresetEntry[] = [
  { value: 'fully shaved', label: msg`fully shaved` },
  { value: 'shaved with stubble', label: msg`shaved with stubble` },
];

const HAIR_SHORT_UNSPECIFIED: PresetEntry[] = [
  { value: 'buzz cut', label: msg`buzz cut` },
  { value: 'crew cut', label: msg`crew cut` },
  { value: 'pixie cut', label: msg`pixie cut` },
  { value: 'short crop', label: msg`short crop` },
  { value: 'short fade', label: msg`short fade` },
  { value: 'french crop', label: msg`french crop` },
  { value: 'chin-length bob', label: msg`chin-length bob` },
];

const HAIR_MEDIUM_UNSPECIFIED: PresetEntry[] = [
  { value: 'side part', label: msg`side part` },
  { value: 'pompadour', label: msg`pompadour` },
  { value: 'shoulder-length waves', label: msg`shoulder-length waves` },
  { value: 'shaggy layers', label: msg`shaggy layers` },
  { value: 'curtain bangs', label: msg`curtain bangs` },
  { value: 'messy bun', label: msg`messy bun` },
  { value: 'half-up half-down', label: msg`half-up half-down` },
];

const HAIR_LONG_UNSPECIFIED: PresetEntry[] = [
  { value: 'long straight', label: msg`long straight` },
  { value: 'long loose waves', label: msg`long loose waves` },
  { value: 'tight curls', label: msg`tight curls` },
  { value: 'box braids', label: msg`box braids` },
  { value: 'sleek high ponytail', label: msg`sleek high ponytail` },
  { value: 'low pony', label: msg`low pony` },
  { value: 'man bun', label: msg`man bun` },
];

const HAIR_STATEMENT_UNSPECIFIED: PresetEntry[] = [
  { value: 'fully shaved', label: msg`fully shaved` },
  { value: 'undercut', label: msg`undercut` },
  { value: 'french twist updo', label: msg`french twist updo` },
  { value: 'classic chignon', label: msg`classic chignon` },
  { value: 'braided crown', label: msg`braided crown` },
];

const HAIRSTYLES_FEMALE: HairGroup[] = [
  { label: msg`Short`, presets: HAIR_SHORT_FEMALE },
  { label: msg`Medium`, presets: HAIR_MEDIUM_FEMALE },
  { label: msg`Long`, presets: HAIR_LONG_FEMALE },
  { label: msg`Updo`, presets: HAIR_UPDO_FEMALE },
];

const HAIRSTYLES_MALE: HairGroup[] = [
  { label: msg`Short`, presets: HAIR_SHORT_MALE },
  { label: msg`Medium`, presets: HAIR_MEDIUM_MALE },
  { label: msg`Long`, presets: HAIR_LONG_MALE },
  { label: msg`Shaved`, presets: HAIR_SHAVED_MALE },
];

const HAIRSTYLES_UNSPECIFIED: HairGroup[] = [
  { label: msg`Short`, presets: HAIR_SHORT_UNSPECIFIED },
  { label: msg`Medium`, presets: HAIR_MEDIUM_UNSPECIFIED },
  { label: msg`Long`, presets: HAIR_LONG_UNSPECIFIED },
  { label: msg`Statement`, presets: HAIR_STATEMENT_UNSPECIFIED },
];

const EYEWEAR_PRESETS: PresetEntry[] = [
  { value: 'round wire glasses', label: msg`round wire glasses` },
  { value: 'square black-frame glasses', label: msg`square black-frame glasses` },
  { value: 'cat-eye glasses', label: msg`cat-eye glasses` },
  { value: 'reading glasses', label: msg`reading glasses` },
  { value: 'aviator sunglasses', label: msg`aviator sunglasses` },
  { value: 'oversized sunglasses', label: msg`oversized sunglasses` },
  { value: 'rectangle sunglasses', label: msg`rectangle sunglasses` },
];

const HEADWEAR_PRESETS: PresetEntry[] = [
  { value: 'knit beanie', label: msg`knit beanie` },
  { value: 'baseball cap', label: msg`baseball cap` },
  { value: 'wide-brim sun hat', label: msg`wide-brim sun hat` },
  { value: 'fedora', label: msg`fedora` },
  { value: 'beret', label: msg`beret` },
  { value: 'headband', label: msg`headband` },
  { value: 'silk scarf', label: msg`silk scarf` },
];

const JEWELRY_PRESETS: PresetEntry[] = [
  { value: 'small stud earrings', label: msg`small stud earrings` },
  { value: 'gold hoop earrings', label: msg`gold hoop earrings` },
  { value: 'statement chandelier earrings', label: msg`statement chandelier earrings` },
  { value: 'delicate pendant necklace', label: msg`delicate pendant necklace` },
  { value: 'gold choker', label: msg`gold choker` },
  { value: 'layered chains', label: msg`layered chains` },
];

const VIBE_PRESETS: PresetEntry[] = [
  { value: 'soft tan', label: msg`soft tan` },
  { value: 'sun-kissed glow', label: msg`sun-kissed glow` },
  { value: 'dewy skin', label: msg`dewy skin` },
  { value: 'matte skin finish', label: msg`matte skin finish` },
  { value: 'light freckles', label: msg`light freckles` },
  { value: 'heavy freckles', label: msg`heavy freckles` },
  { value: 'soft natural smile', label: msg`soft natural smile` },
  { value: 'serene confident look', label: msg`serene confident look` },
];

const FINISH_OPTIONS: { id: LipFinish }[] = [{ id: 'matte' }, { id: 'satin' }, { id: 'gloss' }];

const QUICK_ASK_PROMPTS: MessageDescriptor[] = [
  msg`What hairstyle would suit me?`,
  msg`What lip colour should I try?`,
  msg`Suggest a complete look.`,
  msg`What outfit would flatter me?`,
];

const STYLE_LABEL_MESSAGES: Record<StylistStyleType, MessageDescriptor> = {
  hair: msg`Hair`,
  makeup: msg`Makeup`,
  nails: msg`Nails`,
  clothes: msg`Clothes`,
};

const FINISH_LABEL_MESSAGES: Record<LipFinish, MessageDescriptor> = {
  matte: msg`Matte`,
  satin: msg`Satin`,
  gloss: msg`Gloss`,
};

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
  gender: AvatarGender;
  askBusy: boolean;
  askError: string | null;
  recommendations: StylistRecommendation[];
  onAsk: (question: string) => void;
  onRenderRecommendation: (recommendation: StylistRecommendation) => void;
  renderBusy: boolean;
}

export function StudioSidebar({
  state,
  onStateChange,
  uploads,
  onDeleteUpload,
  faceReady,
  gender,
  askBusy,
  askError,
  recommendations,
  onAsk,
  onRenderRecommendation,
  renderBusy,
}: StudioSidebarProps) {
  const { i18n, t } = useLingui();
  const allowedTabs = TABS_BY_GENDER[gender];
  const visibleTabs = useMemo(
    () => ALL_TABS.filter((tab) => allowedTabs.includes(tab.id)),
    [allowedTabs],
  );
  const [active, setActive] = useState<TabId>(() => visibleTabs[0]?.id ?? 'ask');

  // If gender narrows after-the-fact, the previously-selected tab may disappear.
  const safeActive: TabId = visibleTabs.some((tab) => tab.id === active)
    ? active
    : (visibleTabs[0]?.id ?? 'ask');

  const hairGroups =
    gender === 'female'
      ? HAIRSTYLES_FEMALE
      : gender === 'male'
        ? HAIRSTYLES_MALE
        : HAIRSTYLES_UNSPECIFIED;

  return (
    <div className="border-border bg-card scroll-stable flex max-h-[calc(100dvh-7rem)] flex-col gap-3 overflow-y-auto rounded-lg border p-3 lg:max-h-[calc(100dvh-12rem)]">
      <nav
        className="bg-card sticky -top-3 z-10 -mx-3 -mt-3 flex flex-wrap gap-1 px-3 pt-3 pb-2"
        aria-label={t`Studio tool`}
      >
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActive(tab.id);
            }}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition',
              safeActive === tab.id
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
            aria-current={safeActive === tab.id ? 'page' : undefined}
          >
            {i18n._(tab.label)}
          </button>
        ))}
      </nav>

      <div className="border-border -mt-3 border-t pt-2" />

      {!faceReady && isColorTab(safeActive) && (
        <p className="text-muted-foreground text-xs">
          <Trans>Color tools become available once face landmarks finish computing.</Trans>
        </p>
      )}

      {safeActive === 'lips' && (
        <div className="flex flex-col gap-4">
          <ColorTintPanel
            title={t`Lipstick`}
            subtitle={t`Live preview — clips to your lip polygons.`}
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
          <GeometryPanel
            title={t`Lip shape`}
            subtitle={t`Reshape via AI render — preserves identity.`}
            plan={state.lipShape}
            presets={LIP_SHAPE_PRESETS}
            onChange={(next) => {
              onStateChange({ ...state, lipShape: next });
            }}
          />
        </div>
      )}

      {safeActive === 'eyes' && (
        <ColorTintPanel
          title={t`Eyeshadow`}
          subtitle={t`Tints the lid above each eye.`}
          tint={state.eyeshadow}
          onChange={(next) => {
            onStateChange({ ...state, eyeshadow: next });
          }}
          palette={EYE_COLORS}
        />
      )}

      {safeActive === 'brows' && (
        <div className="flex flex-col gap-4">
          <ColorTintPanel
            title={t`Brow tint`}
            subtitle={t`Subtle color on the brow polygons.`}
            tint={state.browTint}
            onChange={(next) => {
              onStateChange({ ...state, browTint: next });
            }}
            palette={BROW_COLORS}
          />
          <GeometryPanel
            title={t`Brow shape`}
            subtitle={t`Reshape via AI render — preserves identity.`}
            plan={state.browShape}
            presets={BROW_SHAPE_PRESETS}
            onChange={(next) => {
              onStateChange({ ...state, browShape: next });
            }}
          />
        </div>
      )}

      {safeActive === 'cheeks' && (
        <ColorTintPanel
          title={t`Blush`}
          subtitle={t`Feathered ellipse on each cheekbone.`}
          tint={state.blush}
          onChange={(next) => {
            onStateChange({ ...state, blush: next });
          }}
          palette={BLUSH_COLORS}
        />
      )}

      {safeActive === 'beard' && (
        <GeometryPanel
          title={t`Beard`}
          subtitle={t`Geometry change — runs the AI render.`}
          plan={state.beard}
          presets={BEARD_PRESETS}
          onChange={(next) => {
            onStateChange({ ...state, beard: next });
          }}
        />
      )}

      {safeActive === 'mustache' && (
        <GeometryPanel
          title={t`Mustache`}
          subtitle={t`Geometry change — runs the AI render.`}
          plan={state.mustache}
          presets={MUSTACHE_PRESETS}
          onChange={(next) => {
            onStateChange({ ...state, mustache: next });
          }}
        />
      )}

      {safeActive === 'hair' && (
        <GroupedGeometryPanel
          title={t`Hairstyle`}
          subtitle={t`Pick a length, then refine with detail text.`}
          plan={state.hairstyle}
          groups={hairGroups}
          onChange={(next) => {
            onStateChange({ ...state, hairstyle: next });
          }}
        />
      )}

      {safeActive === 'extras' && (
        <div className="flex flex-col gap-4">
          <GeometryPanel
            title={t`Eyewear`}
            subtitle={t`Glasses or sunglasses.`}
            plan={state.eyewear}
            presets={EYEWEAR_PRESETS}
            onChange={(next) => {
              onStateChange({ ...state, eyewear: next });
            }}
          />
          <GeometryPanel
            title={t`Headwear`}
            subtitle={t`Hats and head coverings.`}
            plan={state.headwear}
            presets={HEADWEAR_PRESETS}
            onChange={(next) => {
              onStateChange({ ...state, headwear: next });
            }}
          />
          <GeometryPanel
            title={t`Jewelry`}
            subtitle={t`Earrings, necklaces, layered chains.`}
            plan={state.jewelry}
            presets={JEWELRY_PRESETS}
            onChange={(next) => {
              onStateChange({ ...state, jewelry: next });
            }}
          />
        </div>
      )}

      {safeActive === 'vibe' && (
        <GeometryPanel
          title={t`Vibe`}
          subtitle={t`Skin finish, freckles, expression.`}
          plan={state.vibe}
          presets={VIBE_PRESETS}
          onChange={(next) => {
            onStateChange({ ...state, vibe: next });
          }}
        />
      )}

      {safeActive === 'uploads' && (
        <UploadsPanel
          uploads={uploads}
          selectedId={state.selectedUploadId}
          onSelect={(id) => {
            onStateChange({ ...state, selectedUploadId: id });
          }}
          onDelete={onDeleteUpload}
        />
      )}

      {safeActive === 'ask' && (
        <AskPanel
          busy={askBusy}
          renderBusy={renderBusy}
          error={askError}
          recommendations={recommendations}
          onAsk={onAsk}
          onRenderRecommendation={onRenderRecommendation}
        />
      )}
    </div>
  );
}

function isColorTab(tab: TabId): boolean {
  return tab === 'lips' || tab === 'eyes' || tab === 'brows' || tab === 'cheeks';
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
  const { i18n, t } = useLingui();
  return (
    <div className="flex flex-col gap-3">
      <PanelHeader title={title} subtitle={subtitle} />
      <label className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">
          <Trans>Enabled</Trans>
        </span>
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
        <span className="text-muted-foreground text-xs">
          <Trans>Color</Trans>
        </span>
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
            aria-label={t`Custom color`}
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

      <label className="flex flex-col gap-1.5 text-xs">
        <div className="text-muted-foreground flex items-center justify-between">
          <span>
            <Trans>Intensity</Trans>
          </span>
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
          className="studio-slider"
        />
      </label>

      {finish !== undefined && onFinishChange !== undefined && (
        <div className="flex flex-col gap-2">
          <span className="text-muted-foreground text-xs">
            <Trans>Finish</Trans>
          </span>
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
                {i18n._(FINISH_LABEL_MESSAGES[option.id])}
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
        <Trans>Reset</Trans>
      </Button>
    </div>
  );
}

interface GeometryPanelProps {
  title: string;
  subtitle: string;
  plan: GeometryPlan;
  presets: PresetEntry[];
  onChange: (next: GeometryPlan) => void;
}

function GeometryPanel({ title, subtitle, plan, presets, onChange }: GeometryPanelProps) {
  const { t } = useLingui();
  return (
    <div className="flex flex-col gap-3">
      <PanelHeader title={title} subtitle={subtitle} />
      <PresetChips
        presets={presets}
        selected={plan.preset}
        onSelect={(preset) => {
          onChange({ ...plan, preset });
        }}
      />
      <CustomDetailInput
        value={plan.custom}
        onChange={(value) => {
          onChange({ ...plan, custom: value });
        }}
        placeholder={t`Optional detail — e.g. salt-and-pepper, side parted`}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={plan.preset === null && plan.custom.length === 0}
        onClick={() => {
          onChange({ preset: null, custom: '' });
        }}
      >
        <Trans>Clear</Trans>
      </Button>
    </div>
  );
}

interface GroupedGeometryPanelProps {
  title: string;
  subtitle: string;
  plan: GeometryPlan;
  groups: HairGroup[];
  onChange: (next: GeometryPlan) => void;
}

function GroupedGeometryPanel({
  title,
  subtitle,
  plan,
  groups,
  onChange,
}: GroupedGeometryPanelProps) {
  const { i18n, t } = useLingui();
  return (
    <div className="flex flex-col gap-3">
      <PanelHeader title={title} subtitle={subtitle} />
      <div className="flex flex-col gap-3">
        {groups.map((group) => {
          const heading = i18n._(group.label);
          return (
            <div key={heading} className="flex flex-col gap-1.5">
              <span className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                {heading}
              </span>
              <PresetChips
                presets={group.presets}
                selected={plan.preset}
                onSelect={(preset) => {
                  onChange({ ...plan, preset });
                }}
              />
            </div>
          );
        })}
      </div>
      <CustomDetailInput
        value={plan.custom}
        onChange={(value) => {
          onChange({ ...plan, custom: value });
        }}
        placeholder={t`Optional detail — e.g. honey balayage, side parted`}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={plan.preset === null && plan.custom.length === 0}
        onClick={() => {
          onChange({ preset: null, custom: '' });
        }}
      >
        <Trans>Clear</Trans>
      </Button>
    </div>
  );
}

interface PresetChipsProps {
  presets: PresetEntry[];
  selected: string | null;
  onSelect: (preset: string | null) => void;
}

function PresetChips({ presets, selected, onSelect }: PresetChipsProps) {
  const { i18n } = useLingui();
  return (
    <div className="flex flex-wrap gap-1.5">
      {presets.map((preset) => {
        const isSelected = selected === preset.value;
        return (
          <button
            key={preset.value}
            type="button"
            onClick={() => {
              onSelect(isSelected ? null : preset.value);
            }}
            className={cn(
              'rounded-full border px-3 py-1 text-xs transition',
              isSelected
                ? 'border-foreground bg-foreground text-background'
                : 'border-input hover:bg-accent',
            )}
            aria-pressed={isSelected}
          >
            {i18n._(preset.label)}
          </button>
        );
      })}
    </div>
  );
}

interface CustomDetailInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

function CustomDetailInput({ value, onChange, placeholder }: CustomDetailInputProps) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-muted-foreground">
        <Trans>Detail (optional)</Trans>
      </span>
      <input
        type="text"
        value={value}
        onChange={(event) => {
          onChange(event.currentTarget.value);
        }}
        placeholder={placeholder}
        className="border-input rounded-md border px-3 py-2 text-sm"
        maxLength={80}
      />
    </label>
  );
}

interface UploadsPanelProps {
  uploads: UploadedItemSummary[];
  selectedId: Id<'uploadedItems'> | null;
  onSelect: (id: Id<'uploadedItems'> | null) => void;
  onDelete: (id: Id<'uploadedItems'>) => void;
}

function UploadsPanel({ uploads, selectedId, onSelect, onDelete }: UploadsPanelProps) {
  const { t } = useLingui();
  return (
    <div className="flex flex-col gap-3">
      <PanelHeader
        title={t`Try on clothing`}
        subtitle={t`Upload an item; renders use it as the reference.`}
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
              aria-label={t`Delete ${item.label}`}
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
          <Trans>Clear selection</Trans>
        </Button>
      )}
    </div>
  );
}

interface AskPanelProps {
  busy: boolean;
  renderBusy: boolean;
  error: string | null;
  recommendations: StylistRecommendation[];
  onAsk: (question: string) => void;
  onRenderRecommendation: (recommendation: StylistRecommendation) => void;
}

function AskPanel({
  busy,
  renderBusy,
  error,
  recommendations,
  onAsk,
  onRenderRecommendation,
}: AskPanelProps) {
  const { i18n, t } = useLingui();
  const [question, setQuestion] = useState('');

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (question.trim().length === 0) return;
    onAsk(question);
  };

  return (
    <div className="flex flex-col gap-3">
      <PanelHeader
        title={t`Ask the stylist`}
        subtitle={t`Gemini reads your portrait and suggests looks.`}
      />
      <form className="flex flex-col gap-2" onSubmit={handleSubmit}>
        <textarea
          value={question}
          onChange={(event) => {
            setQuestion(event.currentTarget.value);
          }}
          placeholder={t`e.g. What hairstyle would suit me?`}
          disabled={busy}
          rows={2}
          className="border-input min-h-16 resize-none rounded-md border px-3 py-2 text-sm"
          maxLength={300}
        />
        <Button type="submit" size="sm" disabled={busy || question.trim().length === 0}>
          {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
          <Trans>Ask</Trans>
        </Button>
      </form>

      <div className="flex flex-wrap gap-1.5">
        {QUICK_ASK_PROMPTS.map((quick) => {
          const text = i18n._(quick);
          return (
            <button
              key={text}
              type="button"
              disabled={busy}
              onClick={() => {
                setQuestion(text);
                onAsk(text);
              }}
              className="border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground rounded-full border px-3 py-1 text-xs transition disabled:opacity-50"
            >
              {text}
            </button>
          );
        })}
      </div>

      {error !== null && (
        <p className="text-destructive text-xs leading-snug" role="alert">
          {error}
        </p>
      )}

      {recommendations.length > 0 && (
        <div className="border-border flex flex-col gap-2 border-t pt-3">
          <span className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
            <Trans>Recommendations</Trans>
          </span>
          {recommendations.map((recommendation) => (
            <div
              key={`${recommendation.styleType}:${recommendation.title}`}
              className="border-border flex flex-col gap-1.5 rounded-md border p-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm leading-tight font-semibold">{recommendation.title}</h4>
                <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium">
                  {i18n._(STYLE_LABEL_MESSAGES[recommendation.styleType])}
                </span>
              </div>
              <p className="text-muted-foreground text-xs leading-snug">
                {recommendation.description}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onRenderRecommendation(recommendation);
                }}
                disabled={renderBusy}
              >
                {renderBusy ? <Loader2 className="animate-spin" /> : <Sparkles />}
                <Trans>Render this look</Trans>
              </Button>
            </div>
          ))}
        </div>
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
