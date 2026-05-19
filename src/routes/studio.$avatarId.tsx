import { createFileRoute } from '@tanstack/react-router';

import { ComingSoon } from '@/components/coming-soon';
import { RequireAuth } from '@/components/require-auth';

export const Route = createFileRoute('/studio/$avatarId')({
  component: StudioPage,
});

function StudioPage() {
  const { avatarId } = Route.useParams();

  return (
    <RequireAuth>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Studio</h1>
          <p className="text-muted-foreground text-sm">Avatar {avatarId}</p>
        </div>
        <ComingSoon
          title="2.5D editor"
          phase="Phase 3"
          description="The React-Konva canvas with layered hair, makeup, nail, and clothing overlays opens here."
        />
      </div>
    </RequireAuth>
  );
}
