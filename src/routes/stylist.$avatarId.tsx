import { createFileRoute } from '@tanstack/react-router';

import { ComingSoon } from '@/components/coming-soon';
import { RequireAuth } from '@/components/require-auth';

export const Route = createFileRoute('/stylist/$avatarId')({
  component: StylistPage,
});

function StylistPage() {
  const { avatarId } = Route.useParams();

  return (
    <RequireAuth>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI stylist</h1>
          <p className="text-muted-foreground text-sm">Avatar {avatarId}</p>
        </div>
        <ComingSoon
          title="Stylist recommendations"
          phase="Phase 5"
          description="Ask what suits you and get Gemini-powered recommendation cards you can preview on the canvas."
        />
      </div>
    </RequireAuth>
  );
}
