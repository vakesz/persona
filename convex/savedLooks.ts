import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { errors } from './lib/errors';

export const listSavedLooks = query({
  args: { avatarId: v.optional(v.id('avatars')) },
  handler: async (ctx, { avatarId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const all = await ctx.db
      .query('savedLooks')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .order('desc')
      .collect();
    const filtered = avatarId === undefined ? all : all.filter((l) => l.avatarId === avatarId);
    return Promise.all(
      filtered.map(async (look) => ({
        _id: look._id,
        _creationTime: look._creationTime,
        avatarId: look.avatarId,
        metadataJson: look.metadataJson,
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
 * ID — we don't duplicate the bytes. Deleting the look later deletes the
 * blob, so the render job's resultStorageId reference becomes stale; that's
 * fine, callers fetch the look (not the job) for display.
 */
export const saveLookFromJob = mutation({
  args: { jobId: v.id('renderJobs') },
  handler: async (ctx, { jobId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw errors.notAuthenticated();
    }
    const job = await ctx.db.get(jobId);
    if (job === null) {
      throw errors.renderNotFound();
    }
    if (job.userId !== userId) {
      throw errors.renderNotFound();
    }
    if (job.status !== 'done' || job.resultStorageId === undefined) {
      throw errors.renderNotFinished();
    }
    return await ctx.db.insert('savedLooks', {
      userId,
      avatarId: job.avatarId,
      renderStorageId: job.resultStorageId,
      metadataJson: job.inputJson,
    });
  },
});

export const deleteSavedLook = mutation({
  args: { id: v.id('savedLooks') },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw errors.notAuthenticated();
    }
    const look = await ctx.db.get(id);
    if (look === null) return;
    if (look.userId !== userId) return;
    if (look.renderStorageId !== undefined) {
      await ctx.storage.delete(look.renderStorageId);
    }
    await ctx.db.delete(id);
  },
});
