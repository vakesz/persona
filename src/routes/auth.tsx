import { useAuthActions } from '@convex-dev/auth/react';
import { Trans, useLingui } from '@lingui/react/macro';
import { createFileRoute, Navigate, useNavigate } from '@tanstack/react-router';
import { useConvexAuth } from 'convex/react';
import { Loader2, Sparkles } from 'lucide-react';
import { type SyntheticEvent, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export const Route = createFileRoute('/auth')({
  component: AuthPage,
});

type Flow = 'signIn' | 'signUp';

function AuthPage() {
  const { signIn } = useAuthActions();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const navigate = useNavigate();
  const [flow, setFlow] = useState<Flow>('signIn');
  const [submitting, setSubmitting] = useState(false);
  const { t } = useLingui();

  if (isAuthenticated) {
    return <Navigate to="/avatars" />;
  }

  const isSignIn = flow === 'signIn';
  const busy = submitting || isLoading;

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set('flow', flow);
    setSubmitting(true);
    void signIn('password', formData)
      .then(() => navigate({ to: '/avatars' }))
      .catch((error: unknown) => {
        console.error(error);
        toast.error(
          isSignIn
            ? t`Could not sign in. Check your email and password.`
            : t`Could not create that account. Try a different email.`,
        );
      })
      .finally(() => {
        setSubmitting(false);
      });
  };

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="items-center text-center">
          <span className="from-primary/30 to-primary/10 ring-primary/30 mx-auto mb-2 inline-flex size-10 items-center justify-center rounded-xl bg-gradient-to-br ring-1">
            <Sparkles className="text-primary size-5" />
          </span>
          <CardTitle>
            {isSignIn ? <Trans>Welcome back</Trans> : <Trans>Create your account</Trans>}
          </CardTitle>
          <CardDescription>
            {isSignIn ? (
              <Trans>Sign in to your private styling studio.</Trans>
            ) : (
              <Trans>Your avatars and looks stay private to you.</Trans>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">
                <Trans>Email</Trans>
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                disabled={busy}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">
                <Trans>Password</Trans>
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete={isSignIn ? 'current-password' : 'new-password'}
                required
                minLength={8}
                disabled={busy}
              />
            </div>
            <Button type="submit" disabled={busy}>
              {submitting ? <Loader2 className="animate-spin" /> : null}
              {isSignIn ? <Trans>Sign in</Trans> : <Trans>Create account</Trans>}
            </Button>
          </form>
          <p className="text-muted-foreground mt-4 text-center text-sm">
            {isSignIn ? (
              <Trans>Don&apos;t have an account? </Trans>
            ) : (
              <Trans>Already have an account? </Trans>
            )}
            <button
              type="button"
              className="text-foreground font-medium underline-offset-4 hover:underline"
              onClick={() => {
                setFlow(isSignIn ? 'signUp' : 'signIn');
              }}
            >
              {isSignIn ? <Trans>Sign up</Trans> : <Trans>Sign in</Trans>}
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
