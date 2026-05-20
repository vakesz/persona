import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { itemType } from './schema';

const MAX_RECENT_PER_AVATAR = 20;

const source = v.union(v.literal('uploaded'), v.literal('generated'), v.literal('suggested'));

export const listRecentItems = query({
  args: { avatarId: v.id('avatars') },
  handler: async (ctx, { avatarId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const avatar = await ctx.db.get(avatarId);
    if (avatar === null) return [];
    if (avatar.userId !== userId) return [];
    const items = await ctx.db
      .query('recentItems')
      .withIndex('by_avatar', (q) => q.eq('avatarId', avatarId))
      .order('desc')
      .take(MAX_RECENT_PER_AVATAR);
    return items.map((item) => ({
      _id: item._id,
      _creationTime: item._creationTime,
      type: item.type,
      source: item.source,
      prompt: item.prompt,
      settingsJson: item.settingsJson,
    }));
  },
});

export const saveRecentItem = mutation({
  args: {
    avatarId: v.id('avatars'),
    type: itemType,
    source,
    prompt: v.optional(v.string()),
    settingsJson: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error('Not authenticated.');
    }
    const avatar = await ctx.db.get(args.avatarId);
    if (avatar === null) {
      throw new Error('Avatar not found.');
    }
    if (avatar.userId !== userId) {
      throw new Error('Avatar not found.');
    }
    const id = await ctx.db.insert('recentItems', {
      userId,
      avatarId: args.avatarId,
      type: args.type,
      source: args.source,
      ...(args.prompt !== undefined && { prompt: args.prompt }),
      ...(args.settingsJson !== undefined && { settingsJson: args.settingsJson }),
    });

    // Trim the trailing items so the avatar keeps only the most recent N.
    const all = await ctx.db
      .query('recentItems')
      .withIndex('by_avatar', (q) => q.eq('avatarId', args.avatarId))
      .order('desc')
      .collect();
    const expired = all.slice(MAX_RECENT_PER_AVATAR);
    await Promise.all(expired.map((item) => ctx.db.delete(item._id)));

    return id;
  },
});
