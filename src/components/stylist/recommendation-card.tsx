import { Card, CardContent } from '@/components/ui/card';

type RecommendationStyleType = 'hair' | 'makeup' | 'nails' | 'clothes';

export interface Recommendation {
  title: string;
  description: string;
  styleType: RecommendationStyleType;
  renderPrompt: string;
}

export interface RecommendationCardProps {
  recommendation: Recommendation;
}

const STYLE_LABELS: Record<RecommendationStyleType, string> = {
  hair: 'Hair',
  makeup: 'Makeup',
  nails: 'Nails',
  clothes: 'Clothes',
};

export function RecommendationCard({ recommendation }: RecommendationCardProps) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base leading-tight font-semibold">{recommendation.title}</h3>
          <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-2 py-0.5 text-xs font-medium">
            {STYLE_LABELS[recommendation.styleType]}
          </span>
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {recommendation.description}
        </p>
        <details className="text-muted-foreground text-xs">
          <summary className="cursor-pointer select-none">Render prompt</summary>
          <p className="mt-1 font-mono leading-snug">{recommendation.renderPrompt}</p>
        </details>
      </CardContent>
    </Card>
  );
}
