import { useAuthActions } from '@convex-dev/auth/react';
import { Trans } from '@lingui/react/macro';
import { Link } from '@tanstack/react-router';
import { Authenticated, Unauthenticated } from 'convex/react';
import { Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';

import { LocaleSwitcher } from '@/components/i18n/locale-switcher';
import { Button } from '@/components/ui/button';

export interface AppShellProps {
  children: ReactNode;
}

/** App-wide chrome: sticky header with auth-aware navigation. */
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-background/80 sticky top-0 z-10 border-b backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <Sparkles className="text-primary size-5" />
            Persona
          </Link>
          <nav className="flex items-center gap-1">
            <Authenticated>
              <Button asChild variant="ghost" size="sm">
                <Link to="/avatars" activeProps={{ className: 'bg-accent text-accent-foreground' }}>
                  <Trans>Avatars</Trans>
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link to="/saved" activeProps={{ className: 'bg-accent text-accent-foreground' }}>
                  <Trans>Saved</Trans>
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link
                  to="/settings"
                  activeProps={{ className: 'bg-accent text-accent-foreground' }}
                >
                  <Trans>Settings</Trans>
                </Link>
              </Button>
              <SignOutButton />
            </Authenticated>
            <Unauthenticated>
              <LocaleSwitcher variant="minimal" className="mr-2" />
              <Button asChild size="sm">
                <Link to="/auth">
                  <Trans>Sign in</Trans>
                </Link>
              </Button>
            </Unauthenticated>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}

function SignOutButton() {
  const { signOut } = useAuthActions();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        void signOut();
      }}
    >
      <Trans>Sign out</Trans>
    </Button>
  );
}
