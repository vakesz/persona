import { useAuthActions } from '@convex-dev/auth/react';
import { createFileRoute, Navigate, useNavigate } from '@tanstack/react-router';
import { useConvexAuth } from 'convex/react';
import { Loader2 } from 'lucide-react';
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
            ? 'Could not sign in. Check your email and password.'
            : 'Could not create that account. Try a different email.',
        );
      })
      .finally(() => {
        setSubmitting(false);
      });
  };

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{isSignIn ? 'Welcome back' : 'Create your account'}</CardTitle>
          <CardDescription>
            {isSignIn
              ? 'Sign in to your private styling studio.'
              : 'Your avatars and looks stay private to you.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
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
              <Label htmlFor="password">Password</Label>
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
              {isSignIn ? 'Sign in' : 'Create account'}
            </Button>
          </form>
          <p className="text-muted-foreground mt-4 text-center text-sm">
            {isSignIn ? "Don't have an account? " : 'Already have an account? '}
            <button
              type="button"
              className="text-foreground font-medium underline-offset-4 hover:underline"
              onClick={() => {
                setFlow(isSignIn ? 'signUp' : 'signIn');
              }}
            >
              {isSignIn ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
