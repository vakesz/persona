import { Trans, useLingui } from '@lingui/react/macro';
import { Loader2, Sparkles, Trash2 } from 'lucide-react';
import { type SyntheticEvent, useState } from 'react';

import { UploadedItemUploader } from '@/components/studio/uploaded-item-uploader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { Id } from '@convex/_generated/dataModel';

import { PanelHeader } from './controls';
import { QUICK_ASK_PROMPTS, STYLE_LABEL_MESSAGES, type StylistRecommendation } from './presets';

export interface UploadedItemSummary {
  _id: Id<'uploadedItems'>;
  imageUrl: string;
  label: string;
}

interface UploadsPanelProps {
  uploads: UploadedItemSummary[];
  selectedId: Id<'uploadedItems'> | null;
  onSelect: (id: Id<'uploadedItems'> | null) => void;
  onDelete: (id: Id<'uploadedItems'>) => void;
}

export function UploadsPanel({ uploads, selectedId, onSelect, onDelete }: UploadsPanelProps) {
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

export function AskPanel({
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
                  <Trans>Render this look</Trans>
                </Button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
