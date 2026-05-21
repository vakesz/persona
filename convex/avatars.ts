import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import {
  internalMutation,
  internalQuery,
  mutation,
  type MutationCtx,
  query,
} from './_generated/server';
import { errors } from './lib/errors';

const MAX_AVATARS_PER_USER = 3;
const MAX_SOURCE_PHOTOS = 5;

const avatarType = v.union(v.literal('selfie'), v.literal('full_body'));
const avatarGender = v.union(v.literal('male'), v.literal('female'), v.literal('unspecified'));

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
      avatars.map(async (avatar) => {
        // Pre-Phase-8 rows have no `baselineStatus`; treat them as ready —
        // their `baseImageStorageId` already points at a finished image.
        const baselineStatus = avatar.baselineStatus ?? 'done';
        // Prefer the Gemini-generated baseline once it's ready — that's the
        // canonical portrait the user sees in the studio, so the avatar card
        // should match. Fall back to the raw upload thumbnail only while the
        // baseline is still being generated (queued / processing / failed).
        const previewStorageId =
          baselineStatus === 'done' && avatar.baseImageStorageId !== undefined
            ? avatar.baseImageStorageId
            : (avatar.thumbnailStorageId ?? avatar.baseImageStorageId);
        return {
          _id: avatar._id,
          _creationTime: avatar._creationTime,
          name: avatar.name,
          type: avatar.type,
          gender: avatar.gender ?? 'unspecified',
          baselineStatus,
          baselineErrorMessage: avatar.baselineErrorMessage,
          thumbnailUrl:
            previewStorageId !== undefined ? await ctx.storage.getUrl(previewStorageId) : null,
        };
      }),
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
      gender: avatar.gender ?? 'unspecified',
      baselineStatus: avatar.baselineStatus ?? 'done',
      baselineErrorMessage: avatar.baselineErrorMessage,
      baseImageUrl:
        avatar.baseImageStorageId !== undefined
          ? await ctx.storage.getUrl(avatar.baseImageStorageId)
          : null,
      landmarksJson: avatar.landmarksJson,
      masksJson: avatar.masksJson,
    };
  },
});

/**
 * Internal helper for actions that need an avatar's raw storage handle (e.g.
 * to fetch image bytes for Gemini). Returns null if the baseline isn't ready
 * yet — callers should gate on `baselineStatus === 'done'`.
 */
export const getAvatarStorageForUser = internalQuery({
  args: { id: v.id('avatars'), userId: v.id('users') },
  handler: async (ctx, { id, userId }) => {
    const avatar = await ctx.db.get(id);
    if (avatar === null) return null;
    if (avatar.userId !== userId) return null;
    if (avatar.baseImageStorageId === undefined) return null;
    return {
      _id: avatar._id,
      name: avatar.name,
      type: avatar.type,
      baseImageStorageId: avatar.baseImageStorageId,
    };
  },
});

/**
 * Internal — used by `generateAvatarBaseline` to fetch the source photos it
 * needs to feed Gemini Flash Image. Auth-less; the caller validates state.
 */
export const getAvatarForBaseline = internalQuery({
  args: { id: v.id('avatars') },
  handler: async (ctx, { id }) => {
    const avatar = await ctx.db.get(id);
    if (avatar === null) return null;
    return {
      _id: avatar._id,
      userId: avatar.userId,
      sourcePhotoStorageIds: avatar.sourcePhotoStorageIds ?? [],
      baselineStatus: avatar.baselineStatus ?? 'done',
    };
  },
});

export const createAvatar = mutation({
  args: {
    name: v.string(),
    type: avatarType,
    gender: avatarGender,
    sourcePhotoStorageIds: v.array(v.id('_storage')),
    thumbnailStorageId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw errors.notAuthenticated();
    }
    const name = args.name.trim();
    if (name.length === 0) {
      await cleanupOnReject(ctx, args.sourcePhotoStorageIds, args.thumbnailStorageId);
      throw errors.nameRequired();
    }
    if (args.sourcePhotoStorageIds.length === 0) {
      await cleanupOnReject(ctx, [], args.thumbnailStorageId);
      throw errors.pickAtLeastOnePhoto();
    }
    if (args.sourcePhotoStorageIds.length > MAX_SOURCE_PHOTOS) {
      await cleanupOnReject(ctx, args.sourcePhotoStorageIds, args.thumbnailStorageId);
      throw errors.tooManyPhotos(MAX_SOURCE_PHOTOS);
    }
    const existing = await ctx.db
      .query('avatars')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
    if (existing.length >= MAX_AVATARS_PER_USER) {
      await cleanupOnReject(ctx, args.sourcePhotoStorageIds, args.thumbnailStorageId);
      throw errors.avatarLimitReached(MAX_AVATARS_PER_USER);
    }
    const avatarId = await ctx.db.insert('avatars', {
      userId,
      name,
      type: args.type,
      gender: args.gender,
      sourcePhotoStorageIds: args.sourcePhotoStorageIds,
      thumbnailStorageId: args.thumbnailStorageId,
      baselineStatus: 'queued',
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.ai.generateAvatarBaseline, { avatarId });
    return avatarId;
  },
});

export const saveAvatarLandmarks = mutation({
  args: {
    id: v.id('avatars'),
    landmarksJson: v.string(),
    masksJson: v.string(),
  },
  handler: async (ctx, { id, landmarksJson, masksJson }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw errors.notAuthenticated();
    }
    const avatar = await ctx.db.get(id);
    if (avatar === null) {
      throw errors.avatarNotFound();
    }
    if (avatar.userId !== userId) {
      throw errors.avatarNotFound();
    }
    await ctx.db.patch(id, {
      landmarksJson,
      masksJson,
      updatedAt: Date.now(),
    });
  },
});

export const updateAvatar = mutation({
  args: { id: v.id('avatars'), name: v.string() },
  handler: async (ctx, { id, name }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw errors.notAuthenticated();
    }
    const avatar = await ctx.db.get(id);
    if (avatar === null) {
      throw errors.avatarNotFound();
    }
    if (avatar.userId !== userId) {
      throw errors.avatarNotFound();
    }
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      throw errors.nameRequired();
    }
    await ctx.db.patch(id, { name: trimmed, updatedAt: Date.now() });
  },
});

export const deleteAvatar = mutation({
  args: { id: v.id('avatars') },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw errors.notAuthenticated();
    }
    const avatar = await ctx.db.get(id);
    if (avatar === null) return;
    if (avatar.userId !== userId) {
      throw errors.avatarNotFound();
    }
    await cascadeDeleteAvatar(ctx, id);
  },
});

/**
 * Re-runs the Gemini baseline for an avatar that previously failed (e.g. quota
 * 429). Owner-only; only valid in the `failed` state so we don't queue duplicate
 * work while one is already running.
 */
export const retryAvatarBaseline = mutation({
  args: { id: v.id('avatars') },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw errors.notAuthenticated();
    }
    const avatar = await ctx.db.get(id);
    if (avatar === null) {
      throw errors.avatarNotFound();
    }
    if (avatar.userId !== userId) {
      throw errors.avatarNotFound();
    }
    if (avatar.baselineStatus !== 'failed') {
      throw errors.baselineNotFailed();
    }
    if ((avatar.sourcePhotoStorageIds ?? []).length === 0) {
      throw errors.baselineNoSources();
    }
    await ctx.db.patch(id, {
      baselineStatus: 'queued',
      baselineErrorMessage: undefined,
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.ai.generateAvatarBaseline, { avatarId: id });
  },
});

export const markBaselineProcessing = internalMutation({
  args: { id: v.id('avatars') },
  handler: async (ctx, { id }) => {
    const avatar = await ctx.db.get(id);
    if (avatar === null) return;
    await ctx.db.patch(id, {
      baselineStatus: 'processing',
      updatedAt: Date.now(),
    });
  },
});

export const markBaselineDone = internalMutation({
  args: { id: v.id('avatars'), baseImageStorageId: v.id('_storage') },
  handler: async (ctx, { id, baseImageStorageId }) => {
    const avatar = await ctx.db.get(id);
    if (avatar === null) {
      // Avatar was deleted while baseline was rendering — clean up the orphan blob.
      await ctx.storage.delete(baseImageStorageId);
      return;
    }
    // If a previous baseline somehow exists (re-render path), free it.
    if (avatar.baseImageStorageId !== undefined) {
      await ctx.storage.delete(avatar.baseImageStorageId);
    }
    await ctx.db.patch(id, {
      baseImageStorageId,
      baselineStatus: 'done',
      baselineErrorMessage: undefined,
      updatedAt: Date.now(),
    });
  },
});

export const markBaselineFailed = internalMutation({
  args: { id: v.id('avatars'), errorMessage: v.string() },
  handler: async (ctx, { id, errorMessage }) => {
    const avatar = await ctx.db.get(id);
    if (avatar === null) return;
    await ctx.db.patch(id, {
      baselineStatus: 'failed',
      baselineErrorMessage: errorMessage,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Cascade-deletes an avatar and every owned blob/row that references it:
 * source photos, baseline + thumbnail, savedLooks (+ preview/render storage),
 * renderJobs (+ resultStorageId).
 *
 * Caller is responsible for ownership checks — `deleteAvatar` (the public
 * mutation) and `deleteAccount` (in users.ts) both run this after verifying
 * the user owns the avatar.
 */
export async function cascadeDeleteAvatar(
  ctx: MutationCtx,
  avatarId: Id<'avatars'>,
): Promise<void> {
  const avatar = await ctx.db.get(avatarId);
  if (avatar === null) return;

  const savedLooks = await ctx.db
    .query('savedLooks')
    .withIndex('by_avatar', (q) => q.eq('avatarId', avatarId))
    .collect();
  for (const look of savedLooks) {
    if (look.previewStorageId !== undefined) {
      await bestEffortDeleteStorage(ctx, look.previewStorageId);
    }
    if (look.renderStorageId !== undefined) {
      await bestEffortDeleteStorage(ctx, look.renderStorageId);
    }
    await ctx.db.delete(look._id);
  }

  const renderJobs = await ctx.db
    .query('renderJobs')
    .withIndex('by_avatar', (q) => q.eq('avatarId', avatarId))
    .collect();
  for (const job of renderJobs) {
    if (job.resultStorageId !== undefined) {
      await bestEffortDeleteStorage(ctx, job.resultStorageId);
    }
    await ctx.db.delete(job._id);
  }

  for (const storageId of avatar.sourcePhotoStorageIds ?? []) {
    await bestEffortDeleteStorage(ctx, storageId);
  }
  if (avatar.baseImageStorageId !== undefined) {
    await bestEffortDeleteStorage(ctx, avatar.baseImageStorageId);
  }
  if (avatar.thumbnailStorageId !== undefined) {
    await bestEffortDeleteStorage(ctx, avatar.thumbnailStorageId);
  }
  await ctx.db.delete(avatarId);
}

// Storage deletes aren't transactional with the DB, so an orphan reference
// (blob gone, row still points at it) shouldn't block the cascade.
async function bestEffortDeleteStorage(ctx: MutationCtx, storageId: Id<'_storage'>): Promise<void> {
  try {
    await ctx.storage.delete(storageId);
  } catch (error) {
    console.warn(`Storage delete skipped (id ${storageId} not found):`, error);
  }
}

async function cleanupOnReject(
  ctx: MutationCtx,
  sourceIds: Id<'_storage'>[],
  thumbnailId: Id<'_storage'>,
): Promise<void> {
  // Delete whichever blobs were uploaded so they don't orphan in storage.
  await Promise.all([
    ...sourceIds.map((id) => ctx.storage.delete(id)),
    ctx.storage.delete(thumbnailId),
  ]);
}
