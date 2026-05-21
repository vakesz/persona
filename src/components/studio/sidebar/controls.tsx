import { Trans, useLingui } from '@lingui/react/macro';
import { Check, Pipette } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import type { ColorTint, GeometryPlan, LipFinish, LipTint } from '@/lib/studio/studio-state';
import { cn } from '@/lib/utils';

import { FINISH_LABEL_MESSAGES, FINISH_OPTIONS, type HairGroup, type PresetEntry } from './presets';

interface PanelHeaderProps {
  title: string;
  subtitle: string;
}

export function PanelHeader({ title, subtitle }: PanelHeaderProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      <p className="text-muted-foreground text-xs leading-snug">{subtitle}</p>
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

interface ColorTintPanelProps {
  title: string;
  subtitle: string;
  tint: ColorTint | LipTint;
  onChange: (next: ColorTint) => void;
  palette: string[];
  finish?: LipFinish;
  onFinishChange?: (finish: LipFinish) => void;
}

export function ColorTintPanel({
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

export function GeometryPanel({ title, subtitle, plan, presets, onChange }: GeometryPanelProps) {
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

export function GroupedGeometryPanel({
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
