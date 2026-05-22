import { v } from 'convex/values';

import type { Id } from './_generated/dataModel';
import { mutation, type MutationCtx } from './_generated/server';
import { requireAuth } from './lib/auth';
import { errors } from './lib/errors';
import { MAX_PENDING_INPUTS_PER_USER } from './lib/limits';

/**
 * Issues a short-lived signed URL the browser POSTs the (already compressed
 * and EXIF-stripped) image bytes to. Authenticated callers only — anonymous
 * uploads would let anyone fill our storage quota.
 */
export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireAuth(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Records that the signed-in user just uploaded `storageId` as a render input
 * (the studio's flattened canvas snapshot). Required before
 * `createRenderJob({inputStorageId})` will accept the id — see the table doc
 * in `schema.ts` for the threat model.
 *
 * Defends against three abuses by an authenticated attacker:
 *  1. Claiming arbitrary storage ids to shadow another user's blob:
 *     `by_storage` is checked first; an existing claim (by anyone) rejects.
 *  2. Spam-claiming unbounded ids: per-user cap of `MAX_PENDING_INPUTS_PER_USER`.
 *  3. Duplicate-claiming the same blob so `discardRenderInput`'s `.unique()`
 *     would throw — eliminated by the first check.
 */
export const claimRenderInput = mutation({
  args: { storageId: v.id('_storage') },
  returns: v.null(),
  handler: async (ctx, { storageId }) => {
    const userId = await requireAuth(ctx);
    const existing = await ctx.db
      .query('pendingRenderInputs')
      .withIndex('by_storage', (q) => q.eq('storageId', storageId))
      .first();
    if (existing !== null) {
      throw errors.renderInputAlreadyClaimed();
    }
    const userPending = await ctx.db
      .query('pendingRenderInputs')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
    if (userPending.length >= MAX_PENDING_INPUTS_PER_USER) {
      throw errors.renderInputLimitExceeded(MAX_PENDING_INPUTS_PER_USER);
    }
    await ctx.db.insert('pendingRenderInputs', {
      userId,
      storageId,
      createdAt: Date.now(),
    });
    return null;
  },
});

/**
 * Frees a blob the studio just uploaded as a render input when the subsequent
 * `createRenderJob` mutation failed (e.g. avatar was deleted between upload
 * and submit). Successful jobs free the blob in `renderLookWithGemini`'s
 * finally instead.
 *
 * Ownership: only blobs the caller claimed via `claimRenderInput` are
 * deletable here. That prevents an authenticated user from passing an
 * arbitrary `Id<'_storage'>` and wiping someone else's avatar baseline.
 *
 * Uses `.first()` instead of `.unique()` so a stray duplicate row (defence
 * in depth — `claimRenderInput` already rejects duplicates) doesn't crash the
 * cleanup path.
 */
export const discardRenderInput = mutation({
  args: { storageId: v.id('_storage') },
  returns: v.null(),
  handler: async (ctx, { storageId }) => {
    const userId = await requireAuth(ctx);
    const claim = await ctx.db
      .query('pendingRenderInputs')
      .withIndex('by_storage', (q) => q.eq('storageId', storageId))
      .first();
    if (claim?.userId !== userId) {
      // Mirror `errors.renderNotFound` rather than leaking whether the blob
      // exists / belongs to someone else.
      throw errors.renderNotFound();
    }
    await ctx.db.delete(claim._id);
    await ctx.storage.delete(storageId);
    return null;
  },
});

/**
 * Internal helper for `renderJobs.createRenderJob`: verifies the caller claimed
 * this storage id, deletes the `pendingRenderInputs` row, and returns. Throws
 * `renderNotFound` if the claim is missing or owned by someone else.
 */
export async function consumePendingRenderInput(
  ctx: MutationCtx,
  userId: Id<'users'>,
  storageId: Id<'_storage'>,
): Promise<void> {
  const claim = await ctx.db
    .query('pendingRenderInputs')
    .withIndex('by_storage', (q) => q.eq('storageId', storageId))
    .first();
  if (claim?.userId !== userId) {
    throw errors.renderNotFound();
  }
  await ctx.db.delete(claim._id);
}
