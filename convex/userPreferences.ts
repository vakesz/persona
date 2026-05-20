import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { errors } from './lib/errors';

const localeArg = v.union(v.literal('en'), v.literal('hu'));

export const getMyLocale = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const pref = await ctx.db
      .query('userPreferences')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    return pref?.locale ?? null;
  },
});

export const setMyLocale = mutation({
  args: { locale: localeArg },
  handler: async (ctx, { locale }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw errors.notAuthenticated();
    }
    const existing = await ctx.db
      .query('userPreferences')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    const now = Date.now();
    if (existing === null) {
      await ctx.db.insert('userPreferences', { userId, locale, updatedAt: now });
    } else {
      await ctx.db.patch(existing._id, { locale, updatedAt: now });
    }
  },
});
