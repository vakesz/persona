import { Password } from '@convex-dev/auth/providers/Password';
import { convexAuth } from '@convex-dev/auth/server';

/**
 * Convex Auth setup. Phase 1 uses the email/password provider so no external
 * auth account is required for the MVP.
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password],
});
