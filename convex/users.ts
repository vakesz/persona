import { getAuthUserId } from '@convex-dev/auth/server';

import { cascadeDeleteAvatar } from './avatars';
import { mutation, query } from './_generated/server';
import { errors } from './lib/errors';

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

/**
 * Hard-deletes the signed-in user's account and every owned resource:
 * - cascades every avatar (savedLooks / renderJobs and their storage blobs)
 * - removes user-scoped uploadedItems (clothing references)
 * - deletes the `users` row itself
 *
 * Convex Auth bookkeeping rows (`authAccounts`, `authSessions`) reference
 * this user but cleaning them up requires Convex Auth internals we don't
 * expose. Removing the `users` row prevents the orphaned credentials from
 * authenticating any future session.
 */
export const deleteAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw errors.notAuthenticated();
    }

    const prefs = await ctx.db
      .query('userPreferences')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
    for (const pref of prefs) {
      await ctx.db.delete(pref._id);
    }

    const avatars = await ctx.db
      .query('avatars')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
    for (const avatar of avatars) {
      await cascadeDeleteAvatar(ctx, avatar._id);
    }

    const uploads = await ctx.db
      .query('uploadedItems')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
    for (const item of uploads) {
      await ctx.storage.delete(item.imageStorageId);
      await ctx.db.delete(item._id);
    }

    // Paranoid sweep — any rows that slipped past the per-avatar cascade
    // (e.g. the avatar was already deleted but its child rows lingered).
    const orphanLooks = await ctx.db
      .query('savedLooks')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
    for (const row of orphanLooks) {
      if (row.previewStorageId !== undefined) {
        await ctx.storage.delete(row.previewStorageId);
      }
      if (row.renderStorageId !== undefined) {
        await ctx.storage.delete(row.renderStorageId);
      }
      await ctx.db.delete(row._id);
    }
    const orphanJobs = await ctx.db
      .query('renderJobs')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
    for (const row of orphanJobs) {
      if (row.resultStorageId !== undefined) {
        await ctx.storage.delete(row.resultStorageId);
      }
      await ctx.db.delete(row._id);
    }

    await ctx.db.delete(userId);
  },
});
