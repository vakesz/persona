import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { ensureOwned, ownedOrNull, requireAuth } from './lib/auth';
import { errors } from './lib/errors';

const savedLookReturn = v.object({
  _id: v.id('savedLooks'),
  _creationTime: v.number(),
  avatarId: v.id('avatars'),
  metadataJson: v.optional(v.string()),
  renderUrl: v.union(v.string(), v.null()),
});

/** Lists the signed-in user's saved looks, optionally narrowed to one avatar. */
export const listSavedLooks = query({
  args: { avatarId: v.optional(v.id('avatars')) },
  returns: v.array(savedLookReturn),
  handler: async (ctx, { avatarId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    // When `avatarId` is supplied, query `by_avatar` and re-check `userId`
    // per row — that scales with the avatar's saved-look count rather than
    // the user's total saved-look count, and is the indexed read in either
    // case.
    const rows =
      avatarId === undefined
        ? await ctx.db
            .query('savedLooks')
            .withIndex('by_user', (q) => q.eq('userId', userId))
            .order('desc')
            .collect()
        : (
            await ctx.db
              .query('savedLooks')
              .withIndex('by_avatar', (q) => q.eq('avatarId', avatarId))
              .order('desc')
              .collect()
          ).filter((look) => look.userId === userId);
    return Promise.all(
      rows.map(async (look) => ({
        _id: look._id,
        _creationTime: look._creationTime,
        avatarId: look.avatarId,
        ...(look.metadataJson !== undefined && { metadataJson: look.metadataJson }),
        renderUrl:
          look.renderStorageId !== undefined
            ? await ctx.storage.getUrl(look.renderStorageId)
            : null,
      })),
    );
  },
});

/**
 * Promotes a finished render job into a saved look. Re-uses the same storage
 * ID — we don't duplicate the bytes. Deleting the look later deletes the blob
 * unless another saved look still references it (see `deleteSavedLook`).
 *
 * Idempotent: if the caller already saved this job, return the existing look
 * id rather than creating a duplicate that would share the same storage id
 * and confuse the sibling-look reference check on delete.
 */
export const saveLookFromJob = mutation({
  args: { jobId: v.id('renderJobs') },
  returns: v.id('savedLooks'),
  handler: async (ctx, { jobId }) => {
    const userId = await requireAuth(ctx);
    const job = ensureOwned(await ctx.db.get(jobId), userId, errors.renderNotFound);
    if (job.status !== 'done' || job.resultStorageId === undefined) {
      throw errors.renderNotFinished();
    }
    const resultStorageId = job.resultStorageId;
    const existing = await ctx.db
      .query('savedLooks')
      .withIndex('by_renderStorageId', (q) => q.eq('renderStorageId', resultStorageId))
      .filter((q) => q.eq(q.field('userId'), userId))
      .first();
    if (existing !== null) {
      return existing._id;
    }
    return await ctx.db.insert('savedLooks', {
      userId,
      avatarId: job.avatarId,
      renderStorageId: resultStorageId,
      ...(job.inputJson.length > 0 && { metadataJson: job.inputJson }),
    });
  },
});

/** Deletes an owned saved look and frees its render blob when no sibling look references it. */
export const deleteSavedLook = mutation({
  args: { id: v.id('savedLooks') },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const userId = await requireAuth(ctx);
    const look = ownedOrNull(await ctx.db.get(id), userId);
    if (look === null) return null;
    if (look.renderStorageId !== undefined) {
      const storageId = look.renderStorageId;
      // Detach this user's renderJobs that still point at this blob —
      // `saveLookFromJob` re-uses the storage id, so the source job's
      // `resultStorageId` becomes stale when we free the bytes.
      const userJobs = await ctx.db
        .query('renderJobs')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .collect();
      for (const job of userJobs) {
        if (job.resultStorageId === storageId) {
          await ctx.db.patch(job._id, {
            resultStorageId: undefined,
            updatedAt: Date.now(),
          });
        }
      }
      // Only delete the blob when no *other* saved look (any user) still
      // references it. `saveLookFromJob` is idempotent now, but old rows
      // from before that change can still share a storage id.
      const siblingLook = await ctx.db
        .query('savedLooks')
        .withIndex('by_renderStorageId', (q) => q.eq('renderStorageId', storageId))
        .filter((q) => q.neq(q.field('_id'), id))
        .first();
      if (siblingLook === null) {
        try {
          await ctx.storage.delete(storageId);
        } catch (error) {
          console.warn(`Saved-look storage delete skipped (${storageId}):`, error);
        }
      }
    }
    await ctx.db.delete(id);
    return null;
  },
});
