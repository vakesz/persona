import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from 'convex/react';

import { api } from '@convex/_generated/api';
import { ComingSoon } from '@/components/coming-soon';
import { RequireAuth } from '@/components/require-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <RequireAuth>
      <SettingsContent />
    </RequireAuth>
  );
}

function SettingsContent() {
  const user = useQuery(api.users.getCurrentUser);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Your private account details.</CardDescription>
        </CardHeader>
        <CardContent>
          {user === undefined ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : (
            <dl className="grid gap-2 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">Email</dt>
                <dd className="font-medium">{user?.email ?? '—'}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">Name</dt>
                <dd className="font-medium">{user?.name ?? '—'}</dd>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>
      <ComingSoon
        title="Privacy controls"
        phase="Phase 6+"
        description="Delete account and avatars, auto-clear recent items, and remove unused renders."
      />
    </div>
  );
}
