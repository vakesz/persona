import { createFileRoute } from '@tanstack/react-router';

import { ComingSoon } from '@/components/coming-soon';
import { RequireAuth } from '@/components/require-auth';

export const Route = createFileRoute('/avatars/new')({
  component: NewAvatarPage,
});

function NewAvatarPage() {
  return (
    <RequireAuth>
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold tracking-tight">Create an avatar</h1>
        <ComingSoon
          title="Avatar uploader"
          phase="Phase 2"
          description="Pick a selfie or full-body photo, strip EXIF, compress in the browser, and store it privately in Convex."
        />
      </div>
    </RequireAuth>
  );
}
