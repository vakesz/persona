import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import { internalQuery, mutation, query } from './_generated/server';
import { ownedOrNull, requireAuth } from './lib/auth';

const uploadedItemType = v.union(
  v.literal('dress'),
  v.literal('top'),
  v.literal('shoes'),
  v.literal('nails_reference'),
  v.literal('hair_reference'),
);

const uploadedItemReturn = v.object({
  _id: v.id('uploadedItems'),
  _creationTime: v.number(),
  type: uploadedItemType,
  label: v.optional(v.string()),
  imageUrl: v.union(v.string(), v.null()),
});

export const listUploadedItems = query({
  args: {},
  returns: v.array(uploadedItemReturn),
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
        ...(item.label !== undefined && { label: item.label }),
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
  returns: v.id('uploadedItems'),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
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
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const userId = await requireAuth(ctx);
    const item = ownedOrNull(await ctx.db.get(id), userId);
    if (item === null) return null;

    // Storage blobs are best-effort cleanup: a missing or transiently
    // unavailable object should not block removing the logical DB row.
    try {
      await ctx.storage.delete(item.imageStorageId);
    } catch (error) {
      console.warn('deleteUploadedItem: failed to delete storage blob', {
        uploadedItemId: id,
        imageStorageId: item.imageStorageId,
        error,
      });
    }

    await ctx.db.delete(id);
    return null;
  },
});

/**
 * Internal helper for the render action. Returns the storage ID after
 * verifying ownership.
 */
export const getUploadedItemStorageForUser = internalQuery({
  args: { id: v.id('uploadedItems'), userId: v.id('users') },
  returns: v.union(
    v.object({
      _id: v.id('uploadedItems'),
      type: uploadedItemType,
      imageStorageId: v.id('_storage'),
    }),
    v.null(),
  ),
  handler: async (ctx, { id, userId }) => {
    const item = ownedOrNull(await ctx.db.get(id), userId);
    if (item === null) return null;
    return {
      _id: item._id,
      type: item.type,
      imageStorageId: item.imageStorageId,
    };
  },
});
