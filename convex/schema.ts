import { authTables } from '@convex-dev/auth/server';
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

/**
 * Convex data model for the 2.5D AI Stylist app.
 *
 * `authTables` provides the `users` table (and auth bookkeeping tables) managed
 * by Convex Auth. App tables below reference `users` by id and are always
 * scoped to their owner — every query/mutation must enforce owner-only access.
 */
export const itemType = v.union(
  v.literal('hair'),
  v.literal('nails'),
  v.literal('makeup'),
  v.literal('clothes'),
  v.literal('shoes'),
  v.literal('accessory'),
);

export const renderStatus = v.union(
  v.literal('queued'),
  v.literal('processing'),
  v.literal('done'),
  v.literal('failed'),
);

export default defineSchema({
  ...authTables,

  avatars: defineTable({
    userId: v.id('users'),
    name: v.string(),
    type: v.union(v.literal('selfie'), v.literal('full_body')),
    baseImageStorageId: v.id('_storage'),
    thumbnailStorageId: v.optional(v.id('_storage')),
    landmarksJson: v.optional(v.string()),
    masksJson: v.optional(v.string()),
    updatedAt: v.number(),
  }).index('by_user', ['userId']),

  recentItems: defineTable({
    userId: v.id('users'),
    avatarId: v.id('avatars'),
    type: itemType,
    source: v.union(v.literal('uploaded'), v.literal('generated'), v.literal('suggested')),
    prompt: v.optional(v.string()),
    imageStorageId: v.optional(v.id('_storage')),
    settingsJson: v.optional(v.string()),
  })
    .index('by_user', ['userId'])
    .index('by_avatar', ['avatarId']),

  savedLooks: defineTable({
    userId: v.id('users'),
    avatarId: v.id('avatars'),
    previewStorageId: v.optional(v.id('_storage')),
    renderStorageId: v.optional(v.id('_storage')),
    metadataJson: v.optional(v.string()),
  })
    .index('by_user', ['userId'])
    .index('by_avatar', ['avatarId']),

  renderJobs: defineTable({
    userId: v.id('users'),
    avatarId: v.id('avatars'),
    status: renderStatus,
    provider: v.string(),
    inputJson: v.string(),
    resultStorageId: v.optional(v.id('_storage')),
    errorMessage: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_avatar', ['avatarId']),

  uploadedItems: defineTable({
    userId: v.id('users'),
    type: v.union(
      v.literal('dress'),
      v.literal('top'),
      v.literal('shoes'),
      v.literal('nails_reference'),
      v.literal('hair_reference'),
    ),
    imageStorageId: v.id('_storage'),
    label: v.optional(v.string()),
  }).index('by_user', ['userId']),
});
