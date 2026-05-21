import { Trans } from '@lingui/react/macro';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Authenticated, Unauthenticated } from 'convex/react';
import { Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/')({
  component: LandingPage,
});

function LandingPage() {
  return (
    <section className="flex flex-col items-center gap-7 py-20 text-center sm:py-28">
      <span className="border-primary/30 bg-primary/10 text-primary inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium tracking-wide uppercase">
        <Sparkles className="size-3" />
        <Trans>2.5D AI Stylist</Trans>
      </span>
      <h1 className="from-foreground to-foreground/70 max-w-2xl bg-gradient-to-br bg-clip-text text-4xl font-semibold tracking-tight text-balance text-transparent sm:text-6xl">
        <Trans>See yourself in any look, instantly</Trans>
      </h1>
      <p className="text-muted-foreground max-w-xl text-lg text-pretty">
        <Trans>
          Upload a photo and try AI-suggested hairstyles, nails, makeup, and outfits on your own
          image. Adjust everything by hand, then render a polished result.
        </Trans>
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
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
