import { createFileRoute } from '@tanstack/react-router';

import { ComingSoon } from '@/components/coming-soon';
import { RequireAuth } from '@/components/require-auth';

export const Route = createFileRoute('/saved')({
  component: SavedLooksPage,
});

function SavedLooksPage() {
  return (
    <RequireAuth>
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold tracking-tight">Saved looks</h1>
        <ComingSoon
          title="Saved looks gallery"
          phase="Phase 6"
          description="Polished AI renders you save will appear here, grouped by avatar."
        />
      </div>
    </RequireAuth>
  );
}
