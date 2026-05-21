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

export const listSavedLooks = query({
  args: { avatarId: v.optional(v.id('avatars')) },
  returns: v.array(savedLookReturn),
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
 * ID — we don't duplicate the bytes. Deleting the look later deletes the
 * blob and detaches the source `renderJobs.resultStorageId` reference so it
 * doesn't dangle.
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
    return await ctx.db.insert('savedLooks', {
      userId,
      avatarId: job.avatarId,
      renderStorageId: job.resultStorageId,
      ...(job.inputJson !== '' && { metadataJson: job.inputJson }),
    });
  },
});

export const deleteSavedLook = mutation({
  args: { id: v.id('savedLooks') },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const userId = await requireAuth(ctx);
    const look = ownedOrNull(await ctx.db.get(id), userId);
    if (look === null) return null;
    if (look.renderStorageId !== undefined) {
      const storageId = look.renderStorageId;
      // Detach any of this user's render jobs that still point at this blob
      // — `saveLookFromJob` re-uses the storage id, so the source job's
      // `resultStorageId` becomes stale when we free the bytes. Scoping by
      // `by_user` keeps the scan bounded (one user's jobs only).
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
      await ctx.storage.delete(storageId);
    }
    await ctx.db.delete(id);
    return null;
  },
});
