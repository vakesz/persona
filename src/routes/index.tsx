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
        2.5D AI Stylist
      </span>
      <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
        See yourself in any look, instantly
      </h1>
      <p className="text-muted-foreground max-w-xl text-pretty">
        Upload a photo and try AI-suggested hairstyles, nails, makeup, and outfits on your own
        image. Adjust everything by hand, then render a polished result.
      </p>
      <div className="flex gap-3">
        <Authenticated>
          <Button asChild size="lg">
            <Link to="/avatars">Go to your avatars</Link>
          </Button>
        </Authenticated>
        <Unauthenticated>
          <Button asChild size="lg">
            <Link to="/auth">Get started</Link>
          </Button>
        </Unauthenticated>
      </div>
    </section>
  );
}
