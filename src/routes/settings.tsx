import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from 'convex/react';
import { useState } from 'react';

import { RequireAuth } from '@/components/require-auth';
import { DeleteAccountDialog } from '@/components/settings/delete-account-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@convex/_generated/api';

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
  const avatars = useQuery(api.avatars.listAvatars);
  const [deleteOpen, setDeleteOpen] = useState(false);

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

      <Card>
        <CardHeader>
          <CardTitle>Avatars</CardTitle>
          <CardDescription>Rename or delete from the avatars page.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <p className="text-muted-foreground text-sm">
            {avatars === undefined
              ? 'Loading…'
              : `${avatars.length} avatar${avatars.length === 1 ? '' : 's'}.`}
          </p>
          <Button asChild variant="outline" size="sm">
            <Link to="/avatars">Manage avatars</Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">Danger zone</CardTitle>
          <CardDescription>
            Deleting your account removes every avatar, saved look, render, and uploaded item.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              setDeleteOpen(true);
            }}
          >
            Delete account
          </Button>
        </CardContent>
      </Card>

      <DeleteAccountDialog
        key={deleteOpen ? 'open' : 'closed'}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </div>
  );
}
