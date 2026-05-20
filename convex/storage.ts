import { getAuthUserId } from '@convex-dev/auth/server';

import { mutation } from './_generated/server';

/**
 * Issues a short-lived signed URL the browser POSTs the (already compressed
 * and EXIF-stripped) image bytes to. Authenticated callers only — anonymous
 * uploads would let anyone fill our storage quota.
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error('Not authenticated.');
    }
    return await ctx.storage.generateUploadUrl();
  },
});
