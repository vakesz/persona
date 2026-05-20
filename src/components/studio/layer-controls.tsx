import { Sparkles, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';

export interface LayerControlsProps {
  opacity: number;
  onOpacityChange: (opacity: number) => void;
  onDelete: () => void;
  /** When present, shows a "Try this on" button — appropriate for uploaded item layers. */
  onTryOn?: () => void;
  tryOnBusy?: boolean;
}

export function LayerControls({
  opacity,
  onOpacityChange,
  onDelete,
  onTryOn,
  tryOnBusy = false,
}: LayerControlsProps) {
  return (
    <div className="border-border bg-card flex items-center gap-4 rounded-md border p-3">
      <label className="flex flex-1 items-center gap-3 text-sm">
        <span className="text-muted-foreground w-16 shrink-0">Opacity</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={opacity}
          onChange={(event) => {
            onOpacityChange(Number(event.currentTarget.value));
          }}
          className="accent-foreground flex-1"
        />
        <span className="text-muted-foreground w-10 shrink-0 text-right tabular-nums">
          {Math.round(opacity * 100)}%
        </span>
      </label>
      {onTryOn !== undefined && (
        <Button type="button" size="sm" onClick={onTryOn} disabled={tryOnBusy}>
          <Sparkles className="size-4" />
          Try this on
        </Button>
      )}
      <Button type="button" variant="outline" size="sm" onClick={onDelete}>
        <Trash2 className="size-4" />
        Remove
      </Button>
    </div>
  );
}
