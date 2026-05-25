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
import { ensureOwned, ownedOrNull, requireAuth } from './lib/auth';
import { errors, serializeError } from './lib/errors';
import {
  MAX_AVATAR_NAME_LENGTH,
  MAX_AVATARS_PER_USER,
  MAX_SOURCE_PHOTOS,
  STUCK_PROCESSING_THRESHOLD_MS,
} from './lib/limits';
import { parseInputStorageId } from './lib/renderInput';

const avatarType = v.union(v.literal('selfie'), v.literal('full_body'));
const avatarGender = v.union(v.literal('male'), v.literal('female'), v.literal('unspecified'));
const baselineStatus = v.union(
  v.literal('queued'),
  v.literal('processing'),
  v.literal('done'),
  v.literal('failed'),
);

const listAvatarReturn = v.object({
  _id: v.id('avatars'),
  _creationTime: v.number(),
  name: v.string(),
  type: avatarType,
  gender: avatarGender,
  baselineStatus,
  baselineErrorMessage: v.optional(v.string()),
  thumbnailUrl: v.union(v.string(), v.null()),
});

const getAvatarReturn = v.object({
  _id: v.id('avatars'),
  _creationTime: v.number(),
  name: v.string(),
  type: avatarType,
  gender: avatarGender,
  baselineStatus,
  baselineErrorMessage: v.optional(v.string()),
  baseImageUrl: v.union(v.string(), v.null()),
  landmarksJson: v.optional(v.string()),
  masksJson: v.optional(v.string()),
});

/** Lists the signed-in user's avatars with preview URLs and baseline status. */
export const listAvatars = query({
  args: {},
  returns: v.array(listAvatarReturn),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const avatars = await ctx.db
      .query('avatars')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .order('desc')
      .collect();
    return Promise.all(
      avatars.map(async (avatar) => {
        // Pre-Phase-8 rows have no `baselineStatus`; treat them as ready —
        // their `baseImageStorageId` already points at a finished image.
        const status = avatar.baselineStatus ?? 'done';
        // Prefer the generated baseline once it's ready. Fall back to the raw
        // upload thumbnail only while baseline generation is still pending.
        const previewStorageId =
          status === 'done' && avatar.baseImageStorageId !== undefined
            ? avatar.baseImageStorageId
            : (avatar.thumbnailStorageId ?? avatar.baseImageStorageId);
        return {
          _id: avatar._id,
          _creationTime: avatar._creationTime,
          name: avatar.name,
          type: avatar.type,
          gender: avatar.gender ?? 'unspecified',
          baselineStatus: status,
          ...(avatar.baselineErrorMessage !== undefined && {
            baselineErrorMessage: avatar.baselineErrorMessage,
          }),
          thumbnailUrl:
            previewStorageId !== undefined ? await ctx.storage.getUrl(previewStorageId) : null,
        };
      }),
    );
  },
});

/** Returns one owned avatar with its studio baseline URL and cached face data. */
export const getAvatar = query({
  args: { id: v.id('avatars') },
  returns: v.union(getAvatarReturn, v.null()),
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const avatar = ownedOrNull(await ctx.db.get(id), userId);
    if (avatar === null) return null;
    return {
      _id: avatar._id,
      _creationTime: avatar._creationTime,
      name: avatar.name,
      type: avatar.type,
      gender: avatar.gender ?? 'unspecified',
      baselineStatus: avatar.baselineStatus ?? 'done',
      ...(avatar.baselineErrorMessage !== undefined && {
        baselineErrorMessage: avatar.baselineErrorMessage,
      }),
      baseImageUrl:
        avatar.baseImageStorageId !== undefined
          ? await ctx.storage.getUrl(avatar.baseImageStorageId)
          : null,
      ...(avatar.landmarksJson !== undefined && { landmarksJson: avatar.landmarksJson }),
      ...(avatar.masksJson !== undefined && { masksJson: avatar.masksJson }),
    };
  },
});

/**
 * Internal helper for actions that need an avatar's raw storage handle (e.g.
 * to fetch image bytes for AI). Returns null if the baseline isn't ready
 * yet — callers should gate on `baselineStatus === 'done'`.
 */
export const getAvatarStorageForUser = internalQuery({
  args: { id: v.id('avatars'), userId: v.id('users') },
  returns: v.union(
    v.object({
      _id: v.id('avatars'),
      name: v.string(),
      type: avatarType,
      baseImageStorageId: v.id('_storage'),
    }),
    v.null(),
  ),
  handler: async (ctx, { id, userId }) => {
    const avatar = ownedOrNull(await ctx.db.get(id), userId);
    if (avatar === null) return null;
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
 * needs to feed the image model. Auth-less; the caller validates state.
 */
export const getAvatarForBaseline = internalQuery({
  args: { id: v.id('avatars') },
  returns: v.union(
    v.object({
      _id: v.id('avatars'),
      userId: v.id('users'),
      type: avatarType,
      sourcePhotoStorageIds: v.array(v.id('_storage')),
      baselineStatus,
    }),
    v.null(),
  ),
  handler: async (ctx, { id }) => {
    const avatar = await ctx.db.get(id);
    if (avatar === null) return null;
    return {
      _id: avatar._id,
      userId: avatar.userId,
      type: avatar.type,
      sourcePhotoStorageIds: avatar.sourcePhotoStorageIds ?? [],
      baselineStatus: avatar.baselineStatus ?? 'done',
    };
  },
});

/** Creates an avatar, cleans up rejected uploads, and queues baseline generation. */
export const createAvatar = mutation({
  args: {
    name: v.string(),
    type: avatarType,
    gender: avatarGender,
    sourcePhotoStorageIds: v.array(v.id('_storage')),
    thumbnailStorageId: v.id('_storage'),
  },
  returns: v.id('avatars'),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const name = args.name.trim();
    if (name.length === 0 || name.length > MAX_AVATAR_NAME_LENGTH) {
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

/** Persists browser-computed face landmarks and masks as a first-writer-wins cache. */
export const saveAvatarLandmarks = mutation({
  args: {
    id: v.id('avatars'),
    landmarksJson: v.string(),
    masksJson: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { id, landmarksJson, masksJson }) => {
    const userId = await requireAuth(ctx);
    const avatar = ensureOwned(await ctx.db.get(id), userId, errors.avatarNotFound);
    // First-writer-wins: if landmarks are already cached server-side, skip
    // the re-persist. Saves a write in the rare case the client re-runs
    // MediaPipe before the realtime query updates.
    if (avatar.landmarksJson !== undefined && avatar.masksJson !== undefined) {
      return null;
    }
    await ctx.db.patch(id, {
      landmarksJson,
      masksJson,
      updatedAt: Date.now(),
    });
    return null;
  },
});

/** Renames an owned avatar after trimming and validating the display name. */
export const updateAvatar = mutation({
  args: { id: v.id('avatars'), name: v.string() },
  returns: v.null(),
  handler: async (ctx, { id, name }) => {
    const userId = await requireAuth(ctx);
    ensureOwned(await ctx.db.get(id), userId, errors.avatarNotFound);
    const trimmed = name.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_AVATAR_NAME_LENGTH) {
      throw errors.nameRequired();
    }
    await ctx.db.patch(id, { name: trimmed, updatedAt: Date.now() });
    return null;
  },
});

/** Deletes an owned avatar and cascades every row and storage blob it owns. */
export const deleteAvatar = mutation({
  args: { id: v.id('avatars') },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const userId = await requireAuth(ctx);
    const avatar = ownedOrNull(await ctx.db.get(id), userId);
    if (avatar === null) return null;
    await cascadeDeleteAvatar(ctx, id);
    return null;
  },
});

/**
 * Re-runs baseline generation for an avatar that previously failed (e.g. quota
 * 429). Owner-only; only valid in the `failed` state so we don't queue duplicate
 * work while one is already running.
 */
export const retryAvatarBaseline = mutation({
  args: { id: v.id('avatars') },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const userId = await requireAuth(ctx);
    const avatar = ensureOwned(await ctx.db.get(id), userId, errors.avatarNotFound);
    if (avatar.baselineStatus !== 'failed') {
      throw errors.baselineNotFailed();
    }
    if ((avatar.sourcePhotoStorageIds ?? []).length === 0) {
      throw errors.baselineNoSources();
    }
    await ctx.db.patch(id, {
      baselineStatus: 'queued',
      baselineErrorMessage: undefined,
      landmarksJson: undefined,
      masksJson: undefined,
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.ai.generateAvatarBaseline, { avatarId: id });
    return null;
  },
});

/**
 * Atomic `queued|failed → processing` transition. The render action calls this
 * once instead of a separate read + `markBaselineProcessing` pair, so two
 * concurrent invocations (e.g. a fast double-tap on Retry that escaped client
 * de-duping) can't both pass the gate and double-bill the provider. Returns true
 * iff this caller actually claimed the work.
 */
export const claimBaselineGeneration = internalMutation({
  args: { id: v.id('avatars') },
  returns: v.boolean(),
  handler: async (ctx, { id }) => {
    const avatar = await ctx.db.get(id);
    if (avatar === null) return false;
    const status = avatar.baselineStatus ?? 'done';
    if (status !== 'queued' && status !== 'failed') return false;
    await ctx.db.patch(id, {
      baselineStatus: 'processing',
      updatedAt: Date.now(),
    });
    return true;
  },
});

/** Stores a finished baseline image and frees any replaced generated baseline blob. */
export const markBaselineDone = internalMutation({
  args: { id: v.id('avatars'), baseImageStorageId: v.id('_storage') },
  returns: v.null(),
  handler: async (ctx, { id, baseImageStorageId }) => {
    const avatar = await ctx.db.get(id);
    if (avatar === null) {
      // Avatar was deleted while baseline was rendering — clean up the orphan blob.
      await bestEffortDeleteStorage(ctx, baseImageStorageId);
      return null;
    }
    // Defensive: never free the new blob (e.g. if a retry path somehow set
    // both to the same id), and skip the patch when the new id matches.
    const sourceIds = new Set(avatar.sourcePhotoStorageIds ?? []);
    if (
      avatar.baseImageStorageId !== undefined &&
      avatar.baseImageStorageId !== baseImageStorageId &&
      !sourceIds.has(avatar.baseImageStorageId)
    ) {
      await bestEffortDeleteStorage(ctx, avatar.baseImageStorageId);
    }
    await ctx.db.patch(id, {
      baseImageStorageId,
      baselineStatus: 'done',
      baselineErrorMessage: undefined,
      updatedAt: Date.now(),
    });
    return null;
  },
});

/** Marks baseline generation as failed with a serialized, client-translatable error. */
export const markBaselineFailed = internalMutation({
  args: { id: v.id('avatars'), errorMessage: v.string() },
  returns: v.null(),
  handler: async (ctx, { id, errorMessage }) => {
    const avatar = await ctx.db.get(id);
    if (avatar === null) return null;
    await ctx.db.patch(id, {
      baselineStatus: 'failed',
      baselineErrorMessage: errorMessage,
      updatedAt: Date.now(),
    });
    return null;
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
    // Free the studio's single-use canvas snapshot if one was queued — its
    // pendingRenderInputs claim was already consumed by createRenderJob, so
    // the blob is referenced nowhere but in this job's inputJson. The TTL
    // sweep would eventually catch the orphan from another angle, but it's
    // cleaner to free it here.
    const inputStorageId = parseInputStorageId(job.inputJson);
    if (inputStorageId !== null) {
      await bestEffortDeleteStorage(ctx, inputStorageId);
    }
    if (job.resultStorageId !== undefined) {
      await bestEffortDeleteStorage(ctx, job.resultStorageId);
    }
    await ctx.db.delete(job._id);
  }

  const avatarStorageIds = [
    ...(avatar.sourcePhotoStorageIds ?? []),
    ...(avatar.baseImageStorageId !== undefined ? [avatar.baseImageStorageId] : []),
    ...(avatar.thumbnailStorageId !== undefined ? [avatar.thumbnailStorageId] : []),
  ];
  const deletedAvatarStorageIds = new Set<string>();
  for (const storageId of avatarStorageIds) {
    if (deletedAvatarStorageIds.has(storageId)) continue;
    deletedAvatarStorageIds.add(storageId);
    await bestEffortDeleteStorage(ctx, storageId);
  }
  await ctx.db.delete(avatarId);
}

/**
 * Rescue sweep for avatar baselines stuck in `processing` — usually because
 * `generateAvatarBaseline` was killed before its `catch` could mark the row
 * failed. Flips them to `failed` with a `render_stuck` payload so the user
 * can retry from the avatar card.
 */
export const rescueStaleProcessingBaselines = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const cutoff = Date.now() - STUCK_PROCESSING_THRESHOLD_MS;
    // No index on `(baselineStatus, updatedAt)`; the count of stuck rows is
    // expected to be near zero in steady state, so a small scan is fine.
    const all = await ctx.db.query('avatars').collect();
    for (const avatar of all) {
      if (avatar.baselineStatus !== 'processing') continue;
      if (avatar.updatedAt >= cutoff) continue;
      await ctx.db.patch(avatar._id, {
        baselineStatus: 'failed',
        baselineErrorMessage: serializeError(errors.renderStuck()),
        updatedAt: Date.now(),
      });
    }
    return null;
  },
});

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
  // `allSettled` so one failed delete doesn't strand the siblings.
  await Promise.allSettled([
    ...sourceIds.map((id) => ctx.storage.delete(id)),
    ctx.storage.delete(thumbnailId),
  ]);
}
