import { useAuthActions } from '@convex-dev/auth/react';
import { Trans } from '@lingui/react/macro';
import { Link } from '@tanstack/react-router';
import { Authenticated, Unauthenticated } from 'convex/react';
import { Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';

import { LocaleSwitcher } from '@/components/i18n/locale-switcher';
import { clearStoredLocale } from '@/i18n/detect';
import { Button } from '@/components/ui/button';

export interface AppShellProps {
  children: ReactNode;
}

/** App-wide chrome: sticky header with auth-aware navigation. */
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="bg-aurora relative flex min-h-dvh flex-col">
      <header className="bg-background/70 supports-[backdrop-filter]:bg-background/50 border-border/60 sticky top-0 z-20 border-b backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4">
          <Link to="/" className="group flex items-center gap-2 font-semibold tracking-tight">
            <span className="from-primary/30 to-primary/10 ring-primary/30 group-hover:ring-primary/50 inline-flex size-7 items-center justify-center rounded-md bg-gradient-to-br ring-1 transition">
              <Sparkles className="text-primary size-4" />
            </span>
            <span>Persona</span>
          </Link>
          <nav className="flex items-center gap-1">
            <Authenticated>
              <NavLink to="/avatars">
                <Trans>Avatars</Trans>
              </NavLink>
              <NavLink to="/saved">
                <Trans>Saved</Trans>
              </NavLink>
              <NavLink to="/settings">
                <Trans>Settings</Trans>
              </NavLink>
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
      <main className="relative mx-auto w-full max-w-6xl flex-1 px-4 py-10">{children}</main>
    </div>
  );
}

interface NavLinkProps {
  to: '/avatars' | '/saved' | '/settings';
  children: ReactNode;
}

function NavLink({ to, children }: NavLinkProps) {
  return (
    <Button asChild variant="ghost" size="sm">
      <Link to={to} activeProps={{ className: 'bg-accent text-accent-foreground' }}>
        {children}
      </Link>
    </Button>
  );
}

function SignOutButton() {
  const { signOut } = useAuthActions();
  return (
    <Button
      variant="outline"
      size="sm"
      className="ml-1"
      onClick={() => {
        // Wipe the cached locale so the next user on this browser doesn't
        // inherit ours — Convex Auth doesn't clear app-side localStorage
        // and our provider only reads/writes when authenticated.
        clearStoredLocale();
        void signOut();
      }}
    >
      <Trans>Sign out</Trans>
    </Button>
  );
}
