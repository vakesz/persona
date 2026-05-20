import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import { mutation, query } from './_generated/server';

const MAX_AVATARS_PER_USER = 3;

const avatarType = v.union(v.literal('selfie'), v.literal('full_body'));

export const listAvatars = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return [];
    }
    const avatars = await ctx.db
      .query('avatars')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .order('desc')
      .collect();
    return Promise.all(
      avatars.map(async (avatar) => ({
        _id: avatar._id,
        _creationTime: avatar._creationTime,
        name: avatar.name,
        type: avatar.type,
        thumbnailUrl: await ctx.storage.getUrl(
          avatar.thumbnailStorageId ?? avatar.baseImageStorageId,
        ),
      })),
    );
  },
});

export const getAvatar = query({
  args: { id: v.id('avatars') },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }
    const avatar = await ctx.db.get(id);
    if (avatar === null) {
      return null;
    }
    if (avatar.userId !== userId) {
      return null;
    }
    return {
      _id: avatar._id,
      _creationTime: avatar._creationTime,
      name: avatar.name,
      type: avatar.type,
      baseImageUrl: await ctx.storage.getUrl(avatar.baseImageStorageId),
    };
  },
});

export const createAvatar = mutation({
  args: {
    name: v.string(),
    type: avatarType,
    baseImageStorageId: v.id('_storage'),
    thumbnailStorageId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error('Not authenticated.');
    }
    const name = args.name.trim();
    if (name.length === 0) {
      throw new Error('Name is required.');
    }
    const existing = await ctx.db
      .query('avatars')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
    if (existing.length >= MAX_AVATARS_PER_USER) {
      // Don't leave orphaned uploads in storage when the limit blocks us.
      await Promise.all([
        ctx.storage.delete(args.baseImageStorageId),
        ctx.storage.delete(args.thumbnailStorageId),
      ]);
      throw new Error(`You can only have ${MAX_AVATARS_PER_USER} avatars.`);
    }
    return await ctx.db.insert('avatars', {
      userId,
      name,
      type: args.type,
      baseImageStorageId: args.baseImageStorageId,
      thumbnailStorageId: args.thumbnailStorageId,
      updatedAt: Date.now(),
    });
  },
});
