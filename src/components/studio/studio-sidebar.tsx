import { type MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { Check, Loader2, Pipette, Sparkles, Trash2 } from 'lucide-react';
import { type SyntheticEvent, useMemo, useState } from 'react';

import { UploadedItemUploader } from '@/components/studio/uploaded-item-uploader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
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
  { value: 'classic pixie cut with soft natural texture', label: msg`pixie cut` },
  { value: 'pixie cut with soft side-swept bangs', label: msg`pixie with bangs` },
  { value: 'short crop with neat natural texture', label: msg`short crop` },
  { value: 'chin-length bob with a clean rounded silhouette', label: msg`chin-length bob` },
  {
    value: 'long bob (lob), collarbone length, soft blunt ends, natural side volume',
    label: msg`lob`,
  },
];

const HAIR_MEDIUM_FEMALE: PresetEntry[] = [
  { value: 'shoulder-length soft waves with natural volume', label: msg`shoulder-length waves` },
  {
    value:
      'medium-length layered shag, face-framing layers, soft feathered texture, controlled volume',
    label: msg`shaggy layers`,
  },
  {
    value:
      'curtain bangs parted softly in the center, cheekbone-length fringe blended into the existing hair length',
    label: msg`curtain bangs`,
  },
  { value: 'messy bun with soft loose face-framing strands', label: msg`messy bun` },
  {
    value: 'half-up half-down hairstyle with the top section pinned back and the lower hair loose',
    label: msg`half-up half-down`,
  },
];

const HAIR_LONG_FEMALE: PresetEntry[] = [
  { value: 'long straight hair with smooth natural shine', label: msg`long straight` },
  { value: 'long loose waves with soft natural movement', label: msg`long loose waves` },
  { value: 'tight defined curls with realistic volume', label: msg`tight curls` },
  { value: 'long box braids with neat even parts', label: msg`box braids` },
  { value: 'sleek high ponytail with a smooth crown', label: msg`sleek high ponytail` },
  { value: 'low ponytail gathered at the nape with a clean natural finish', label: msg`low pony` },
];

const HAIR_UPDO_FEMALE: PresetEntry[] = [
  { value: 'french twist updo', label: msg`french twist updo` },
  { value: 'classic chignon', label: msg`classic chignon` },
  { value: 'top knot', label: msg`top knot` },
  { value: 'braided crown', label: msg`braided crown` },
];

const HAIR_SHORT_MALE: PresetEntry[] = [
  { value: 'even buzz cut with a clean natural hairline', label: msg`buzz cut` },
  { value: 'classic crew cut, short sides, slightly longer top', label: msg`crew cut` },
  { value: 'short fade with natural blending at the temples and neckline', label: msg`short fade` },
  { value: 'french crop with a short textured fringe', label: msg`french crop` },
  {
    value: 'textured crop with short sides and natural matte texture on top',
    label: msg`textured crop`,
  },
  { value: 'caesar cut with a short straight fringe and even texture', label: msg`caesar cut` },
];

const HAIR_MEDIUM_MALE: PresetEntry[] = [
  { value: 'classic side part with neat natural volume', label: msg`side part` },
  { value: 'medium pompadour with controlled height and clean sides', label: msg`pompadour` },
  { value: 'modern quiff with lifted front and natural texture', label: msg`quiff` },
  {
    value: 'messy textured medium haircut with controlled natural volume',
    label: msg`messy textured`,
  },
  {
    value: 'undercut with slicked-back top, clean sides, realistic product shine',
    label: msg`undercut with slick back`,
  },
  { value: 'taper fade with natural blending and a tidy top', label: msg`taper fade` },
];

const HAIR_LONG_MALE: PresetEntry[] = [
  {
    value: 'long flow hairstyle with natural movement around the shoulders',
    label: msg`long flow`,
  },
  { value: 'man bun tied neatly at the back with natural loose strands', label: msg`man bun` },
  {
    value: 'low ponytail gathered at the nape with a clean natural finish',
    label: msg`low ponytail`,
  },
  { value: 'shoulder-length soft waves with natural volume', label: msg`shoulder-length waves` },
];

const HAIR_SHAVED_MALE: PresetEntry[] = [
  {
    value: 'fully shaved head with natural scalp texture and hairline shadow',
    label: msg`fully shaved`,
  },
  {
    value: 'shaved head with very short stubble and natural scalp texture',
    label: msg`shaved with stubble`,
  },
];

const HAIR_SHORT_UNSPECIFIED: PresetEntry[] = [
  { value: 'even buzz cut with a clean natural hairline', label: msg`buzz cut` },
  { value: 'classic crew cut, short sides, slightly longer top', label: msg`crew cut` },
  { value: 'classic pixie cut with soft natural texture', label: msg`pixie cut` },
  { value: 'short crop with neat natural texture', label: msg`short crop` },
  { value: 'short fade with natural blending at the temples and neckline', label: msg`short fade` },
  { value: 'french crop with a short textured fringe', label: msg`french crop` },
  { value: 'chin-length bob with a clean rounded silhouette', label: msg`chin-length bob` },
];

const HAIR_MEDIUM_UNSPECIFIED: PresetEntry[] = [
  { value: 'classic side part with neat natural volume', label: msg`side part` },
  { value: 'medium pompadour with controlled height and clean sides', label: msg`pompadour` },
  { value: 'shoulder-length soft waves with natural volume', label: msg`shoulder-length waves` },
  {
    value:
      'medium-length layered shag, face-framing layers, soft feathered texture, controlled volume',
    label: msg`shaggy layers`,
  },
  {
    value:
      'curtain bangs parted softly in the center, cheekbone-length fringe blended into the existing hair length',
    label: msg`curtain bangs`,
  },
  { value: 'messy bun with soft loose face-framing strands', label: msg`messy bun` },
  {
    value: 'half-up half-down hairstyle with the top section pinned back and the lower hair loose',
    label: msg`half-up half-down`,
  },
];

const HAIR_LONG_UNSPECIFIED: PresetEntry[] = [
  { value: 'long straight hair with smooth natural shine', label: msg`long straight` },
  { value: 'long loose waves with soft natural movement', label: msg`long loose waves` },
  { value: 'tight defined curls with realistic volume', label: msg`tight curls` },
  { value: 'long box braids with neat even parts', label: msg`box braids` },
  { value: 'sleek high ponytail with a smooth crown', label: msg`sleek high ponytail` },
  { value: 'low ponytail gathered at the nape with a clean natural finish', label: msg`low pony` },
  { value: 'man bun tied neatly at the back with natural loose strands', label: msg`man bun` },
];

const HAIR_STATEMENT_UNSPECIFIED: PresetEntry[] = [
  {
    value: 'fully shaved head with natural scalp texture and hairline shadow',
    label: msg`fully shaved`,
  },
  { value: 'undercut with clean sides and natural top volume', label: msg`undercut` },
  { value: 'french twist updo with a smooth elegant shape', label: msg`french twist updo` },
  {
    value: 'classic chignon at the nape with a polished natural finish',
    label: msg`classic chignon`,
  },
  { value: 'braided crown wrapped naturally around the head', label: msg`braided crown` },
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
    <div className="border-border/60 bg-card text-card-foreground scroll-stable flex max-h-[calc(100dvh-7rem)] flex-col overflow-y-auto rounded-xl border shadow-sm lg:max-h-[calc(100dvh-13rem)]">
      <div
        className="bg-card/95 supports-[backdrop-filter]:bg-card/80 border-border/60 sticky top-0 z-10 border-b px-3 pt-3 pb-2 backdrop-blur"
        role="tablist"
        aria-label={t`Studio tool`}
      >
        <div className="flex flex-wrap gap-1">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={safeActive === tab.id}
              onClick={() => {
                setActive(tab.id);
              }}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                safeActive === tab.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              {i18n._(tab.label)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4 p-3">
        {!faceReady && isColorTab(safeActive) && (
          <p className="text-muted-foreground bg-muted/40 rounded-md px-3 py-2 text-xs">
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
            <Separator />
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
            <Separator />
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
            <Separator />
            <GeometryPanel
              title={t`Headwear`}
              subtitle={t`Hats and head coverings.`}
              plan={state.headwear}
              presets={HEADWEAR_PRESETS}
              onChange={(next) => {
                onStateChange({ ...state, headwear: next });
              }}
            />
            <Separator />
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
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <PanelHeader title={title} subtitle={subtitle} />
        <label className="bg-muted/50 border-border/60 hover:border-foreground/30 flex shrink-0 cursor-pointer items-center gap-2 rounded-full border py-1 pr-1.5 pl-3 text-xs font-medium transition">
          <span className={cn(tint.enabled ? 'text-foreground' : 'text-muted-foreground')}>
            {tint.enabled ? <Trans>On</Trans> : <Trans>Off</Trans>}
          </span>
          <Switch
            checked={tint.enabled}
            onCheckedChange={(checked) => {
              onChange({ ...tint, enabled: checked });
            }}
            aria-label={t`Toggle ${title.toLowerCase()}`}
          />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
          <Trans>Color</Trans>
        </span>
        <div className="grid grid-cols-7 gap-1.5">
          {palette.map((swatch) => {
            const isSelected = tint.color === swatch && tint.enabled;
            return (
              <button
                key={swatch}
                type="button"
                aria-label={swatch}
                aria-pressed={isSelected}
                onClick={() => {
                  onChange({ ...tint, color: swatch, enabled: true });
                }}
                className={cn(
                  'group ring-offset-card relative aspect-square rounded-md ring-offset-2 transition focus-visible:outline-none',
                  isSelected
                    ? 'ring-foreground scale-105 ring-2'
                    : 'ring-border hover:ring-foreground/30 ring-1 hover:scale-105',
                )}
                style={{ backgroundColor: swatch }}
              >
                {isSelected && (
                  <Check
                    className="absolute inset-0 m-auto size-3.5 text-white drop-shadow"
                    strokeWidth={3}
                  />
                )}
              </button>
            );
          })}
          <label
            className="border-input hover:border-foreground/40 text-muted-foreground hover:text-foreground relative flex aspect-square cursor-pointer items-center justify-center rounded-md border border-dashed transition"
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
            <Pipette className="size-3" />
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="text-muted-foreground flex items-center justify-between text-xs">
          <span className="text-[11px] font-medium tracking-wide uppercase">
            <Trans>Intensity</Trans>
          </span>
          <span className="text-foreground tabular-nums">{Math.round(tint.intensity * 100)}%</span>
        </div>
        <Slider
          min={0}
          max={1}
          step={0.05}
          value={[tint.intensity]}
          disabled={!tint.enabled}
          onValueChange={(next) => {
            const v = next[0];
            if (v === undefined) return;
            onChange({ ...tint, intensity: v });
          }}
        />
      </div>

      {finish !== undefined && onFinishChange !== undefined && (
        <div className="flex flex-col gap-2">
          <span className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
            <Trans>Finish</Trans>
          </span>
          <div className="bg-muted/60 grid grid-cols-3 gap-1 rounded-md p-1">
            {FINISH_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  onFinishChange(option.id);
                }}
                disabled={!tint.enabled}
                aria-pressed={finish === option.id}
                className={cn(
                  'rounded px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50',
                  finish === option.id
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
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
        variant="ghost"
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
        variant="ghost"
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
        variant="ghost"
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
              'rounded-full border px-3 py-1 text-xs transition-colors',
              isSelected
                ? 'border-primary bg-primary/15 text-primary'
                : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground',
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
    <label className="flex flex-col gap-1.5 text-xs">
      <span className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
        <Trans>Detail (optional)</Trans>
      </span>
      <input
        type="text"
        value={value}
        onChange={(event) => {
          onChange(event.currentTarget.value);
        }}
        placeholder={placeholder}
        className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/40 rounded-md border px-3 py-2 text-sm shadow-xs transition outline-none focus-visible:ring-[3px]"
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
                'aspect-square w-full overflow-hidden rounded-md ring-1 transition',
                selectedId === item._id
                  ? 'ring-primary ring-2'
                  : 'ring-border hover:ring-foreground/40',
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
              className="bg-background/90 hover:bg-background absolute top-1 right-1 rounded-full p-1 opacity-0 shadow transition group-hover:opacity-100"
            >
              <Trash2 className="size-3" />
            </button>
          </div>
        ))}
      </div>
      {selectedId !== null && (
        <Button
          type="button"
          variant="ghost"
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
          className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/40 min-h-16 resize-none rounded-md border px-3 py-2 text-sm shadow-xs transition outline-none focus-visible:ring-[3px]"
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
              className="border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground rounded-full border px-3 py-1 text-xs transition disabled:opacity-50"
            >
              {text}
            </button>
          );
        })}
      </div>

      {error !== null && (
        <p
          className="text-destructive bg-destructive/5 border-destructive/30 rounded-md border px-3 py-2 text-xs leading-snug"
          role="alert"
        >
          {error}
        </p>
      )}

      {recommendations.length > 0 && (
        <>
          <Separator />
          <div className="flex flex-col gap-2">
            <span className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
              <Trans>Recommendations</Trans>
            </span>
            {recommendations.map((recommendation) => (
              <div
                key={`${recommendation.styleType}:${recommendation.title}`}
                className="bg-muted/40 border-border/60 flex flex-col gap-2 rounded-lg border p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm leading-tight font-semibold">{recommendation.title}</h4>
                  <Badge variant="accent" className="shrink-0">
                    {i18n._(STYLE_LABEL_MESSAGES[recommendation.styleType])}
                  </Badge>
                </div>
                <p className="text-muted-foreground text-xs leading-snug">
                  {recommendation.description}
                </p>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    onRenderRecommendation(recommendation);
                  }}
                  disabled={renderBusy}
                >
                  {renderBusy ? <Loader2 className="animate-spin" /> : <Sparkles />}
                  <Trans>Render</Trans>
                </Button>
              </div>
            ))}
          </div>
        </>
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
      <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      <p className="text-muted-foreground text-xs leading-snug">{subtitle}</p>
    </div>
  );
}
