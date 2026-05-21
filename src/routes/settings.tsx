import { Plural, Trans } from '@lingui/react/macro';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from 'convex/react';
import { useState } from 'react';

import { LocaleSwitcher } from '@/components/i18n/locale-switcher';
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
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">
          <Trans>Settings</Trans>
        </h1>
        <p className="text-muted-foreground text-sm">
          <Trans>Manage your account, language, and avatars.</Trans>
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>
            <Trans>Account</Trans>
          </CardTitle>
          <CardDescription>
            <Trans>Your private account details.</Trans>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {user === undefined ? (
            <p className="text-muted-foreground text-sm">
              <Trans>Loading…</Trans>
            </p>
          ) : (
            <dl className="grid gap-2 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">
                  <Trans>Email</Trans>
                </dt>
                <dd className="font-medium">{user?.email ?? '—'}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">
                  <Trans>Name</Trans>
                </dt>
                <dd className="font-medium">{user?.name ?? '—'}</dd>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <Trans>Language</Trans>
          </CardTitle>
          <CardDescription>
            <Trans>Pick the language used across the app.</Trans>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LocaleSwitcher />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <Trans>Avatars</Trans>
          </CardTitle>
          <CardDescription>
            <Trans>Rename or delete from the avatars page.</Trans>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <p className="text-muted-foreground text-sm">
            {avatars === undefined ? (
              <Trans>Loading…</Trans>
            ) : (
              <Plural value={avatars.length} one="# avatar." other="# avatars." />
            )}
          </p>
          <Button asChild variant="outline" size="sm">
            <Link to="/avatars">
              <Trans>Manage</Trans>
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">
            <Trans>Danger zone</Trans>
          </CardTitle>
          <CardDescription>
            <Trans>
              Deleting your account removes every avatar, saved look, render, and uploaded item.
            </Trans>
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
            <Trans>Delete account</Trans>
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
