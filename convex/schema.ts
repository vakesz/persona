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
    // Drives which studio tools are shown by default (e.g. beard/mustache for
    // male, blush/lipstick for female). Optional so legacy rows still validate
    // — those rows behave as `unspecified` (every tool visible).
    gender: v.optional(v.union(v.literal('male'), v.literal('female'), v.literal('unspecified'))),
    // 1–5 raw uploads (Phase 8+). Optional so pre-Phase-8 rows still
    // validate; those rows treat the original `baseImageStorageId` as the
    // ready-made baseline. New rows always set this.
    sourcePhotoStorageIds: v.optional(v.array(v.id('_storage'))),
    // Canonical baseline portrait — Gemini-generated from the source photos.
    // Optional because it's filled async after avatar creation; the studio
    // gates on `baselineStatus === 'done'`.
    baseImageStorageId: v.optional(v.id('_storage')),
    thumbnailStorageId: v.optional(v.id('_storage')),
    landmarksJson: v.optional(v.string()),
    masksJson: v.optional(v.string()),
    // Optional for the same reason as `sourcePhotoStorageIds` — legacy rows
    // are treated as `'done'` on read. New rows always set this field.
    baselineStatus: v.optional(renderStatus),
    baselineErrorMessage: v.optional(v.string()),
    updatedAt: v.number(),
  }).index('by_user', ['userId']),

  savedLooks: defineTable({
    userId: v.id('users'),
    avatarId: v.id('avatars'),
    previewStorageId: v.optional(v.id('_storage')),
    renderStorageId: v.optional(v.id('_storage')),
    metadataJson: v.optional(v.string()),
  })
    .index('by_user', ['userId'])
    .index('by_avatar', ['avatarId'])
    // Used by `sweepStaleRenderJobs` to check whether a stale job's
    // resultStorageId is still referenced by a saved look before freeing it.
    .index('by_renderStorageId', ['renderStorageId'])
    .index('by_previewStorageId', ['previewStorageId']),

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
    .index('by_avatar', ['avatarId'])
    // Drives the hourly TTL sweep — see `sweepStaleRenderJobs` in renderJobs.ts.
    .index('by_updatedAt', ['updatedAt']),

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

  // Per-user app preferences. Kept in a side table because `authTables.users`
  // is owned by Convex Auth and shouldn't be extended directly.
  userPreferences: defineTable({
    userId: v.id('users'),
    locale: v.union(v.literal('en'), v.literal('hu')),
    updatedAt: v.number(),
  }).index('by_user', ['userId']),

  // Ownership ledger for the studio's single-use canvas snapshot. The studio
  // uploads its flattened PNG, then claims the resulting `_storage` id here.
  // `createRenderJob` and `discardRenderInput` validate against this table so
  // an attacker who somehow learns another user's storage id can't trick
  // Gemini into reading those bytes, and can't delete the blob either.
  // Rows are deleted on consume; stale rows (upload happened but the user
  // never queued/discarded the job) age out via `sweepStalePendingInputs`.
  pendingRenderInputs: defineTable({
    userId: v.id('users'),
    storageId: v.id('_storage'),
    createdAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_storage', ['storageId'])
    .index('by_createdAt', ['createdAt']),
});
