import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import { internalQuery, mutation, query } from './_generated/server';
import { errors } from './lib/errors';

const uploadedItemType = v.union(
  v.literal('dress'),
  v.literal('top'),
  v.literal('shoes'),
  v.literal('nails_reference'),
  v.literal('hair_reference'),
);

export const listUploadedItems = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const items = await ctx.db
      .query('uploadedItems')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .order('desc')
      .collect();
    return Promise.all(
      items.map(async (item) => ({
        _id: item._id,
        _creationTime: item._creationTime,
        type: item.type,
        label: item.label,
        imageUrl: await ctx.storage.getUrl(item.imageStorageId),
      })),
    );
  },
});

export const createUploadedItem = mutation({
  args: {
    type: uploadedItemType,
    imageStorageId: v.id('_storage'),
    label: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw errors.notAuthenticated();
    }
    return await ctx.db.insert('uploadedItems', {
      userId,
      type: args.type,
      imageStorageId: args.imageStorageId,
      ...(args.label !== undefined && { label: args.label }),
    });
  },
});

export const deleteUploadedItem = mutation({
  args: { id: v.id('uploadedItems') },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw errors.notAuthenticated();
    }
    const item = await ctx.db.get(id);
    if (item === null) return;
    if (item.userId !== userId) return;
    await ctx.storage.delete(item.imageStorageId);
    await ctx.db.delete(id);
  },
});

/**
 * Internal helper for the render action. Returns the storage ID after
 * verifying ownership.
 */
export const getUploadedItemStorageForUser = internalQuery({
  args: { id: v.id('uploadedItems'), userId: v.id('users') },
  handler: async (ctx, { id, userId }) => {
    const item = await ctx.db.get(id);
    if (item === null) return null;
    if (item.userId !== userId) return null;
    return {
      _id: item._id,
      type: item.type,
      imageStorageId: item.imageStorageId,
    };
  },
});
