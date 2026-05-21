import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import { cascadeDeleteAvatar } from './avatars';
import { mutation, query } from './_generated/server';
import { requireAuth } from './lib/auth';

/**
 * Returns the currently authenticated user, or `null` when signed out.
 * Used by the client to drive auth-aware UI.
 */
export const getCurrentUser = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id('users'),
      _creationTime: v.number(),
      email: v.optional(v.string()),
      name: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const row = await ctx.db.get(userId);
    if (row === null) return null;
    // Project explicitly so future additions to `authTables.users` don't
    // leak by default. Phone / verification timestamps stay server-side.
    return {
      _id: row._id,
      _creationTime: row._creationTime,
      ...(typeof row.email === 'string' && { email: row.email }),
      ...(typeof row.name === 'string' && { name: row.name }),
    };
  },
});

/**
 * Hard-deletes the signed-in user's account and every owned resource:
 * - cascades every avatar (savedLooks / renderJobs and their storage blobs)
 * - removes user-scoped uploadedItems (clothing references)
 * - clears pendingRenderInputs claims
 * - deletes the `users` row itself
 *
 * Convex Auth bookkeeping rows (`authAccounts`, `authSessions`) reference
 * this user but cleaning them up requires Convex Auth internals we don't
 * expose. Removing the `users` row prevents the orphaned credentials from
 * authenticating any future session.
 */
export const deleteAccount = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);

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

    // Pending render-input claims for this user — the blobs would orphan
    // otherwise (no row references them after `claimRenderInput`).
    const pending = await ctx.db
      .query('pendingRenderInputs')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
    for (const row of pending) {
      try {
        await ctx.storage.delete(row.storageId);
      } catch (error) {
        console.warn(`Pending input storage delete skipped (${row.storageId}):`, error);
      }
      await ctx.db.delete(row._id);
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
    return null;
  },
});
