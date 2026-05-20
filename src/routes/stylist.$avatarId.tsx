import { createFileRoute, Link } from '@tanstack/react-router';
import { useAction, useMutation, useQuery } from 'convex/react';
import { Loader2, Sparkles } from 'lucide-react';
import { type SyntheticEvent, useState } from 'react';
import { toast } from 'sonner';

import { BaselineStatusGate } from '@/components/avatars/baseline-status-gate';
import { RenderResult } from '@/components/render/render-result';
import { RequireAuth } from '@/components/require-auth';
import { type Recommendation, RecommendationCard } from '@/components/stylist/recommendation-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

export const Route = createFileRoute('/stylist/$avatarId')({
  component: StylistPage,
});

function StylistPage() {
  return (
    <RequireAuth>
      <Stylist />
    </RequireAuth>
  );
}

const QUICK_PROMPTS = [
  'What hairstyle would suit me?',
  'What lip colour should I try?',
  'Suggest nail looks for me.',
  'What outfit would flatter my features?',
];

interface ActiveRender {
  jobId: Id<'renderJobs'>;
  title: string;
}

function Stylist() {
  const { avatarId } = Route.useParams();
  const typedAvatarId = avatarId as Id<'avatars'>;
  const avatar = useQuery(api.avatars.getAvatar, { id: typedAvatarId });
  const analyze = useAction(api.ai.analyzeStyleWithGemini);
  const createRenderJob = useMutation(api.renderJobs.createRenderJob);

  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [activeRender, setActiveRender] = useState<ActiveRender | null>(null);
  const [startingRender, setStartingRender] = useState(false);

  const ask = async (next: string) => {
    setBusy(true);
    try {
      const result = await analyze({ avatarId: typedAvatarId, question: next });
      setRecommendations(result.recommendations);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Could not reach the stylist.');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    void ask(question);
  };

  const handleRender = (recommendation: Recommendation) => {
    setStartingRender(true);
    createRenderJob({
      avatarId: typedAvatarId,
      prompt: recommendation.renderPrompt,
      title: recommendation.title,
    })
      .then((jobId) => {
        setActiveRender({ jobId, title: recommendation.title });
      })
      .catch((error: unknown) => {
        console.error(error);
        toast.error(error instanceof Error ? error.message : 'Could not start render.');
      })
      .finally(() => {
        setStartingRender(false);
      });
  };

  return (
    <BaselineStatusGate avatar={avatar}>
      {(ready) => (
        <div className="flex flex-col gap-6">
          <header className="flex items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Stylist for {ready.name}</h1>
              <p className="text-muted-foreground text-sm">
                Ask what would suit you. Free-tier Gemini reads your portrait and suggests looks.
                Render any of them to a real image and save it.
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/studio/$avatarId" params={{ avatarId: typedAvatarId }}>
                Open studio
              </Link>
            </Button>
          </header>

          <Card>
            <CardContent>
              <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
                <Label htmlFor="question">Ask the stylist</Label>
                <div className="flex gap-2">
                  <Input
                    id="question"
                    value={question}
                    onChange={(event) => {
                      setQuestion(event.currentTarget.value);
                    }}
                    placeholder="e.g. What hairstyle would suit me?"
                    disabled={busy}
                  />
                  <Button type="submit" disabled={busy}>
                    {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
                    Ask
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {QUICK_PROMPTS.map((quick) => (
                    <button
                      key={quick}
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setQuestion(quick);
                        void ask(quick);
                      }}
                      className="border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground rounded-full border px-3 py-1 text-xs transition disabled:opacity-50"
                    >
                      {quick}
                    </button>
                  ))}
                </div>
              </form>
            </CardContent>
          </Card>

          {busy && recommendations.length === 0 ? (
            <div className="text-muted-foreground flex items-center gap-3 text-sm">
              <Loader2 className="size-4 animate-spin" />
              Reading your portrait and thinking…
            </div>
          ) : null}

          {activeRender !== null && (
            <RenderResult
              jobId={activeRender.jobId}
              title={activeRender.title}
              onClose={() => {
                setActiveRender(null);
              }}
            />
          )}

          {recommendations.length > 0 && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {recommendations.map((recommendation, index) => (
                <RecommendationCard
                  key={index}
                  recommendation={recommendation}
                  busy={startingRender || activeRender !== null}
                  onRender={() => {
                    handleRender(recommendation);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </BaselineStatusGate>
  );
}
