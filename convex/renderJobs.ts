import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import { internal } from './_generated/api';
import { internalMutation, internalQuery, mutation, query } from './_generated/server';
import { ensureOwned, ownedOrNull, requireAuth } from './lib/auth';
import { errors } from './lib/errors';
import { renderStatus } from './schema';
import { consumePendingRenderInput } from './storage';

const renderJobInternalReturn = v.object({
  _id: v.id('renderJobs'),
  userId: v.id('users'),
  avatarId: v.id('avatars'),
  inputJson: v.string(),
});

const renderJobPublicReturn = v.object({
  _id: v.id('renderJobs'),
  status: renderStatus,
  provider: v.string(),
  errorMessage: v.optional(v.string()),
  resultUrl: v.union(v.string(), v.null()),
});

export const createRenderJob = mutation({
  args: {
    avatarId: v.id('avatars'),
    prompt: v.string(),
    title: v.optional(v.string()),
    referenceUploadedItemId: v.optional(v.id('uploadedItems')),
    /**
     * When set, the render uses this storage blob as the input image instead
     * of the avatar's canonical baseline. The studio uploads the flattened
     * Konva canvas (baseline + applied color tints) here so geometry edits
     * stack on top of any makeup the user already chose. The blob is
     * single-use — the action consumes and deletes it.
     *
     * Must have been claimed by the same user via `storage.claimRenderInput`
     * — see `pendingRenderInputs` in `schema.ts` for the threat model.
     */
    inputStorageId: v.optional(v.id('_storage')),
  },
  returns: v.id('renderJobs'),
  handler: async (ctx, { avatarId, prompt, title, referenceUploadedItemId, inputStorageId }) => {
    const userId = await requireAuth(ctx);
    ensureOwned(await ctx.db.get(avatarId), userId, errors.avatarNotFound);
    const trimmedPrompt = prompt.trim();
    if (trimmedPrompt.length === 0) {
      throw errors.promptRequired();
    }

    if (referenceUploadedItemId !== undefined) {
      ensureOwned(await ctx.db.get(referenceUploadedItemId), userId, errors.referenceItemNotFound);
    }

    // Validate the studio's flattened-canvas blob is one this user actually
    // uploaded. Without this check, an authenticated attacker who learned
    // another user's storage id could ship those bytes to Gemini and read
    // them back from the rendered output.
    if (inputStorageId !== undefined) {
      await consumePendingRenderInput(ctx, userId, inputStorageId);
    }

    const jobId = await ctx.db.insert('renderJobs', {
      userId,
      avatarId,
      status: 'queued',
      provider: 'gemini-flash-image',
      inputJson: JSON.stringify({
        prompt: trimmedPrompt,
        ...(title !== undefined && { title }),
        ...(referenceUploadedItemId !== undefined && { referenceUploadedItemId }),
        ...(inputStorageId !== undefined && { inputStorageId }),
      }),
      updatedAt: Date.now(),
    });

    await ctx.scheduler.runAfter(0, internal.ai.renderLookWithGemini, { jobId });
    return jobId;
  },
});

export const getRenderJob = query({
  args: { id: v.id('renderJobs') },
  returns: v.union(renderJobPublicReturn, v.null()),
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const job = ownedOrNull(await ctx.db.get(id), userId);
    if (job === null) return null;
    return {
      _id: job._id,
      status: job.status,
      provider: job.provider,
      ...(job.errorMessage !== undefined && { errorMessage: job.errorMessage }),
      resultUrl:
        job.resultStorageId !== undefined ? await ctx.storage.getUrl(job.resultStorageId) : null,
    };
  },
});

/**
 * Internal helpers used by the scheduled render action. Auth is not enforced
 * here — the caller (the action) supplies the job ID it received from
 * `createRenderJob`, which already verified ownership.
 */
export const getRenderJobInternal = internalQuery({
  args: { id: v.id('renderJobs') },
  returns: v.union(renderJobInternalReturn, v.null()),
  handler: async (ctx, { id }) => {
    const job = await ctx.db.get(id);
    if (job === null) return null;
    return {
      _id: job._id,
      userId: job.userId,
      avatarId: job.avatarId,
      inputJson: job.inputJson,
    };
  },
});

/**
 * Atomic `queued → processing` transition mirroring `claimBaselineGeneration`.
 * Returns true iff this caller actually claimed the work, false if the job
 * has already been claimed (status moved past `queued`) or deleted.
 */
export const claimRenderJob = internalMutation({
  args: { id: v.id('renderJobs') },
  returns: v.boolean(),
  handler: async (ctx, { id }) => {
    const job = await ctx.db.get(id);
    if (job === null) return false;
    if (job.status !== 'queued') return false;
    await ctx.db.patch(id, { status: 'processing', updatedAt: Date.now() });
    return true;
  },
});

export const markRenderJobDone = internalMutation({
  args: { id: v.id('renderJobs'), resultStorageId: v.id('_storage') },
  returns: v.null(),
  handler: async (ctx, { id, resultStorageId }) => {
    const job = await ctx.db.get(id);
    if (job === null) {
      // Job was cascade-deleted (avatar removed mid-render). Free the orphan
      // blob so it doesn't sit in storage forever — the periodic sweep walks
      // `renderJobs`, not storage, so it wouldn't catch this otherwise.
      await ctx.storage.delete(resultStorageId);
      return null;
    }
    await ctx.db.patch(id, {
      status: 'done',
      resultStorageId,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const markRenderJobFailed = internalMutation({
  args: { id: v.id('renderJobs'), errorMessage: v.string() },
  returns: v.null(),
  handler: async (ctx, { id, errorMessage }) => {
    const job = await ctx.db.get(id);
    if (job === null) return null;
    await ctx.db.patch(id, {
      status: 'failed',
      errorMessage,
      updatedAt: Date.now(),
    });
    return null;
  },
});

const RENDER_JOB_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const PENDING_INPUT_TTL_MS = 24 * 60 * 60 * 1000; // 1 day — far longer than a render takes.

/**
 * Hourly sweep (see `convex/crons.ts`). Removes render jobs older than 14
 * days. If the job has a `resultStorageId` and no `savedLook` references it
 * (either as its render or preview blob), the bytes are freed too — saved
 * looks are how users opt-in to keeping a render, so anything else is fair
 * game.
 */
export const sweepStaleRenderJobs = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const cutoff = Date.now() - RENDER_JOB_TTL_MS;
    const stale = await ctx.db
      .query('renderJobs')
      .withIndex('by_updatedAt', (q) => q.lt('updatedAt', cutoff))
      .collect();
    for (const job of stale) {
      if (job.resultStorageId !== undefined) {
        const resultStorageId = job.resultStorageId;
        // Indexed point lookups instead of scanning the whole savedLooks
        // table — keeps the sweep O(stale) instead of O(stale + saved).
        const referencingRender = await ctx.db
          .query('savedLooks')
          .withIndex('by_renderStorageId', (q) => q.eq('renderStorageId', resultStorageId))
          .first();
        const referencingPreview =
          referencingRender === null
            ? await ctx.db
                .query('savedLooks')
                .withIndex('by_previewStorageId', (q) => q.eq('previewStorageId', resultStorageId))
                .first()
            : null;
        if (referencingRender === null && referencingPreview === null) {
          try {
            await ctx.storage.delete(resultStorageId);
          } catch (error) {
            console.warn(`Sweep storage delete skipped (${resultStorageId}):`, error);
          }
        }
      }
      await ctx.db.delete(job._id);
    }
    return null;
  },
});

/**
 * Hourly sweep of `pendingRenderInputs` claims that nobody consumed (the
 * studio uploaded a snapshot but neither queued the job nor discarded it,
 * e.g. tab crash mid-flow). Older than 1 day → frees the blob and removes
 * the row.
 */
export const sweepStalePendingInputs = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const cutoff = Date.now() - PENDING_INPUT_TTL_MS;
    const stale = await ctx.db
      .query('pendingRenderInputs')
      .withIndex('by_createdAt', (q) => q.lt('createdAt', cutoff))
      .collect();
    for (const row of stale) {
      try {
        await ctx.storage.delete(row.storageId);
      } catch (error) {
        console.warn(`Pending input storage delete skipped (${row.storageId}):`, error);
      }
      await ctx.db.delete(row._id);
    }
    return null;
  },
});
