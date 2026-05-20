import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import { internal } from './_generated/api';
import { internalMutation, internalQuery, mutation, query } from './_generated/server';

export const createRenderJob = mutation({
  args: {
    avatarId: v.id('avatars'),
    prompt: v.string(),
    title: v.optional(v.string()),
    referenceUploadedItemId: v.optional(v.id('uploadedItems')),
  },
  handler: async (ctx, { avatarId, prompt, title, referenceUploadedItemId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error('Not authenticated.');
    }
    const avatar = await ctx.db.get(avatarId);
    if (avatar === null) {
      throw new Error('Avatar not found.');
    }
    if (avatar.userId !== userId) {
      throw new Error('Avatar not found.');
    }
    const trimmedPrompt = prompt.trim();
    if (trimmedPrompt.length === 0) {
      throw new Error('Prompt is required.');
    }

    if (referenceUploadedItemId !== undefined) {
      const item = await ctx.db.get(referenceUploadedItemId);
      if (item === null) {
        throw new Error('Reference item not found.');
      }
      if (item.userId !== userId) {
        throw new Error('Reference item not found.');
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
