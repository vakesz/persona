import { useAuthActions } from '@convex-dev/auth/react';
import { Link } from '@tanstack/react-router';
import { Authenticated, Unauthenticated } from 'convex/react';
import { Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';

const NAV_LINKS = [
  { to: '/avatars', label: 'Avatars' },
  { to: '/saved', label: 'Saved' },
  { to: '/settings', label: 'Settings' },
] as const;

/** App-wide chrome: sticky header with auth-aware navigation. */
export function AppShell({ children }: { children: ReactNode }) {
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
              {NAV_LINKS.map((link) => (
                <Button key={link.to} asChild variant="ghost" size="sm">
                  <Link
                    to={link.to}
                    activeProps={{ className: 'bg-accent text-accent-foreground' }}
                  >
                    {link.label}
                  </Link>
                </Button>
              ))}
              <SignOutButton />
            </Authenticated>
            <Unauthenticated>
              <Button asChild size="sm">
                <Link to="/auth">Sign in</Link>
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
      Sign out
    </Button>
  );
}
