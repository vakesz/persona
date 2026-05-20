import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import { mutation } from './_generated/server';
import { errors } from './lib/errors';

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
      throw errors.notAuthenticated();
    }
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Frees a blob the studio just uploaded as a render input when the subsequent
 * `createRenderJob` mutation failed (e.g. avatar was deleted between upload
 * and submit). Successful jobs free the blob in `renderLookWithGemini`'s
 * finally instead. Auth-only — storage IDs are opaque random tokens, not
 * enumerable across users, so deleting one without an ownership scan is fine.
 */
export const discardRenderInput = mutation({
  args: { storageId: v.id('_storage') },
  handler: async (ctx, { storageId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw errors.notAuthenticated();
    }
    await ctx.storage.delete(storageId);
  },
});
