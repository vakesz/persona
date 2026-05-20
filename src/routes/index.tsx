import { Trans } from '@lingui/react/macro';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Authenticated, Unauthenticated } from 'convex/react';

import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/')({
  component: LandingPage,
});

function LandingPage() {
  return (
    <section className="flex flex-col items-center gap-6 py-16 text-center">
      <span className="text-muted-foreground rounded-full border px-3 py-1 text-xs tracking-wide uppercase">
        <Trans>2.5D AI Stylist</Trans>
      </span>
      <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
        <Trans>See yourself in any look, instantly</Trans>
      </h1>
      <p className="text-muted-foreground max-w-xl text-pretty">
        <Trans>
          Upload a photo and try AI-suggested hairstyles, nails, makeup, and outfits on your own
          image. Adjust everything by hand, then render a polished result.
        </Trans>
      </p>
      <div className="flex gap-3">
        <Authenticated>
          <Button asChild size="lg">
            <Link to="/avatars">
              <Trans>Go to your avatars</Trans>
            </Link>
          </Button>
        </Authenticated>
        <Unauthenticated>
          <Button asChild size="lg">
            <Link to="/auth">
              <Trans>Get started</Trans>
            </Link>
          </Button>
        </Unauthenticated>
      </div>
    </section>
  );
}
