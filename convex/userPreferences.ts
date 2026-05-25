import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { requireAuth } from './lib/auth';

const localeArg = v.union(v.literal('en'), v.literal('hu'));

/** Returns the signed-in user's saved locale preference, or null when unset. */
export const getMyLocale = query({
  args: {},
  returns: v.union(localeArg, v.null()),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    // Use `.first()` (not `.unique()`) so a rare duplicate row from a
    // concurrent insert race doesn't throw on reads — the mutation below
    // self-heals by consolidating duplicates on the next write.
    const pref = await ctx.db
      .query('userPreferences')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .first();
    return pref?.locale ?? null;
  },
});

/** Upserts the signed-in user's locale preference and collapses duplicate rows. */
export const setMyLocale = mutation({
  args: { locale: localeArg },
  returns: v.null(),
  handler: async (ctx, { locale }) => {
    const userId = await requireAuth(ctx);
    // `.collect()` instead of `.unique()` so a previously-raced insert
    // doesn't crash the write — we patch the first row and delete any
    // duplicates so subsequent reads converge.
    const existing = await ctx.db
      .query('userPreferences')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
    const now = Date.now();
    if (existing.length === 0) {
      await ctx.db.insert('userPreferences', { userId, locale, updatedAt: now });
      return null;
    }
    const [primary, ...duplicates] = existing;
    if (primary !== undefined) {
      await ctx.db.patch(primary._id, { locale, updatedAt: now });
    }
    for (const dup of duplicates) {
      await ctx.db.delete(dup._id);
    }
    return null;
  },
});
