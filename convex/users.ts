import { getAuthUserId } from '@convex-dev/auth/server';

import { query } from './_generated/server';

/**
 * Returns the currently authenticated user, or `null` when signed out.
 * Used by the client to drive auth-aware UI.
 */
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }
    return await ctx.db.get(userId);
  },
});
