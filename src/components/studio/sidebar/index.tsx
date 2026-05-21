import { Trans, useLingui } from '@lingui/react/macro';
import { useMemo, useState } from 'react';

import { Separator } from '@/components/ui/separator';
import type { StudioState } from '@/lib/studio/studio-state';
import { cn } from '@/lib/utils';
import type { Id } from '@convex/_generated/dataModel';

import { ColorTintPanel, GeometryPanel, GroupedGeometryPanel } from './controls';
import {
  ALL_TABS,
  BEARD_PRESETS,
  BLUSH_COLORS,
  BROW_COLORS,
  BROW_SHAPE_PRESETS,
  EYEWEAR_PRESETS,
  EYE_COLORS,
  HAIRSTYLES_FEMALE,
  HAIRSTYLES_MALE,
  HAIRSTYLES_UNSPECIFIED,
  HEADWEAR_PRESETS,
  JEWELRY_PRESETS,
  LIP_COLORS,
  LIP_SHAPE_PRESETS,
  MUSTACHE_PRESETS,
  TABS_BY_GENDER,
  VIBE_PRESETS,
  isColorTab,
  type AvatarGender,
  type StylistRecommendation,
  type TabId,
} from './presets';
import { AskPanel, UploadsPanel, type UploadedItemSummary } from './specialty-panels';

export type { StylistRecommendation } from './presets';
export type { UploadedItemSummary } from './specialty-panels';

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
