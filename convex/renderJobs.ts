import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import { internal } from './_generated/api';
import { internalMutation, internalQuery, mutation, query } from './_generated/server';
import { errors } from './lib/errors';

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
     */
    inputStorageId: v.optional(v.id('_storage')),
  },
  handler: async (ctx, { avatarId, prompt, title, referenceUploadedItemId, inputStorageId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw errors.notAuthenticated();
    }
    const avatar = await ctx.db.get(avatarId);
    if (avatar === null) {
      throw errors.avatarNotFound();
    }
    if (avatar.userId !== userId) {
      throw errors.avatarNotFound();
    }
    const trimmedPrompt = prompt.trim();
    if (trimmedPrompt.length === 0) {
      throw errors.promptRequired();
    }

    if (referenceUploadedItemId !== undefined) {
      const item = await ctx.db.get(referenceUploadedItemId);
      if (item === null) {
        throw errors.referenceItemNotFound();
      }
      if (item.userId !== userId) {
        throw errors.referenceItemNotFound();
      }
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
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const job = await ctx.db.get(id);
    if (job === null) return null;
    if (job.userId !== userId) return null;
    return {
      _id: job._id,
      status: job.status,
      provider: job.provider,
      errorMessage: job.errorMessage,
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

export const markRenderJobProcessing = internalMutation({
  args: { id: v.id('renderJobs') },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { status: 'processing', updatedAt: Date.now() });
  },
});

export const markRenderJobDone = internalMutation({
  args: { id: v.id('renderJobs'), resultStorageId: v.id('_storage') },
  handler: async (ctx, { id, resultStorageId }) => {
    await ctx.db.patch(id, {
      status: 'done',
      resultStorageId,
      updatedAt: Date.now(),
    });
  },
});

export const markRenderJobFailed = internalMutation({
  args: { id: v.id('renderJobs'), errorMessage: v.string() },
  handler: async (ctx, { id, errorMessage }) => {
    await ctx.db.patch(id, {
      status: 'failed',
      errorMessage,
      updatedAt: Date.now(),
    });
  },
});

const RENDER_JOB_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Hourly sweep (see `convex/crons.ts`). Removes render jobs older than 14
 * days. If the job has a `resultStorageId` and no `savedLook` references it
 * (either as its render or preview blob), the bytes are freed too — saved
 * looks are how users opt-in to keeping a render, so anything else is fair
 * game.
 */
export const sweepStaleRenderJobs = internalMutation({
  args: {},
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
          await ctx.storage.delete(resultStorageId);
        }
      }
      await ctx.db.delete(job._id);
    }
  },
});
