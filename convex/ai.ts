import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { action, internalAction } from './_generated/server';
import { errors, serializeError } from './lib/errors';

// @types/node v25 no longer exposes `process` on globalThis; Convex actions run
// in a V8 isolate that provides `process.env`, so a minimal local shim is the
// pragmatic fix.
declare const process: { env: Record<string, string | undefined> };

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash-lite';

const styleType = v.union(
  v.literal('hair'),
  v.literal('makeup'),
  v.literal('nails'),
  v.literal('clothes'),
);

const STYLIST_SYSTEM_PROMPT = `You are a friendly, confident stylist helping someone explore looks that would suit them. Look at the user's photo and read their question carefully.

Return exactly 3 concrete recommendations that genuinely complement them. For each:
- Short, memorable title (max 6 words).
- Friendly description in 1-2 sentences focused on WHY it suits them (skin tone, hair, face shape, vibe).
- Exactly one styleType: "hair", "makeup", "nails", or "clothes".
- A detailed renderPrompt (1-2 sentences) ready for an image-generation model — specify colour, texture, length, finish, and other visual specifics.

If the user's question targets a specific style type (e.g. "what hair?"), make all 3 recommendations that type. Otherwise spread across types based on what would genuinely benefit them most. Be specific, not generic. Avoid hedging.`;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          styleType: { type: 'string', enum: ['hair', 'makeup', 'nails', 'clothes'] },
          renderPrompt: { type: 'string' },
        },
        required: ['title', 'description', 'styleType', 'renderPrompt'],
      },
    },
  },
  required: ['recommendations'],
};

interface GeminiPart {
  text?: string;
}
interface GeminiCandidate {
  content?: { parts?: GeminiPart[] };
}
interface GeminiResponse {
  candidates?: GeminiCandidate[];
}

type StylistStyleType = 'hair' | 'makeup' | 'nails' | 'clothes';

interface StylistRecommendation {
  title: string;
  description: string;
  styleType: StylistStyleType;
  renderPrompt: string;
}

function isStylistStyleType(value: unknown): value is StylistStyleType {
  return value === 'hair' || value === 'makeup' || value === 'nails' || value === 'clothes';
}

function parseStylistRecommendation(item: unknown): StylistRecommendation {
  if (typeof item !== 'object' || item === null) {
    throw errors.stylistMalformedRecommendation();
  }
  if (!('title' in item) || typeof item.title !== 'string' || item.title.length === 0) {
    throw errors.stylistRecommendationMissingField('title');
  }
  if (!('description' in item) || typeof item.description !== 'string') {
    throw errors.stylistRecommendationMissingField('description');
  }
  if (!('renderPrompt' in item) || typeof item.renderPrompt !== 'string') {
    throw errors.stylistRecommendationMissingField('renderPrompt');
  }
  if (!('styleType' in item) || !isStylistStyleType(item.styleType)) {
    throw errors.stylistRecommendationUnknownStyle();
  }
  return {
    title: item.title,
    description: item.description,
    styleType: item.styleType,
    renderPrompt: item.renderPrompt,
  };
}

export const analyzeStyleWithGemini = action({
  args: { avatarId: v.id('avatars'), question: v.string() },
  returns: v.object({
    recommendations: v.array(
      v.object({
        title: v.string(),
        description: v.string(),
        styleType,
        renderPrompt: v.string(),
      }),
    ),
  }),
  handler: async (ctx, { avatarId, question }) => {
    const apiKey = process.env['GEMINI_API_KEY'];
    if (apiKey === undefined || apiKey === '') {
      throw errors.geminiKeyMissing();
    }
    const model = process.env['CONVEX_GEMINI_MODEL'] ?? DEFAULT_GEMINI_MODEL;

    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw errors.notAuthenticated();
    }

    const avatar = await ctx.runQuery(internal.avatars.getAvatarStorageForUser, {
      id: avatarId,
      userId,
    });
    if (avatar === null) {
      throw errors.avatarNotFound();
    }

    const blob = await ctx.storage.get(avatar.baseImageStorageId);
    if (blob === null) {
      throw errors.avatarImageMissing();
    }
    const mimeType = blob.type === '' ? 'image/jpeg' : blob.type;
    const imageBytes = new Uint8Array(await blob.arrayBuffer());
    const imageBase64 = bytesToBase64(imageBytes);

    const trimmedQuestion = question.trim();
    const userTurn =
      trimmedQuestion === ''
        ? 'Give me 3 looks that would really suit me, across hair / makeup / nails / clothes — whatever benefits me most.'
        : trimmedQuestion;

    const body = {
      systemInstruction: { parts: [{ text: STYLIST_SYSTEM_PROMPT }] },
      contents: [
        {
          role: 'user',
          parts: [{ text: userTurn }, { inlineData: { mimeType, data: imageBase64 } }],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.7,
      },
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      throw await geminiError('stylist', response);
    }

    const data = (await response.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== 'string' || text === '') {
      throw errors.stylistEmptyResponse();
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw errors.stylistMalformedJson();
    }

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('recommendations' in parsed) ||
      !Array.isArray(parsed.recommendations)
    ) {
      throw errors.stylistMissingRecommendations();
    }

    // Prompt asks for exactly 3. Trim defensively in case Gemini returns more.
    return {
      recommendations: parsed.recommendations.slice(0, 3).map(parseStylistRecommendation),
    };
  },
});

/**
 * Maps a non-OK Gemini response to a structured `ConvexError` the client can
 * translate. The free tier is small enough that 429 is the dominant failure
 * mode, so we surface it as its own code instead of dumping the JSON.
 */
async function geminiError(
  operation: 'stylist' | 'baseline' | 'render',
  response: Response,
): Promise<ReturnType<typeof errors.geminiQuota | typeof errors.geminiAuth>> {
  if (response.status === 429) {
    return errors.geminiQuota(operation);
  }
  if (response.status === 401 || response.status === 403) {
    return errors.geminiAuth(operation, response.status);
  }
  const errorText = await response.text().catch(() => '');
  return errors.geminiFailed(operation, response.status, errorText.slice(0, 200));
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return buffer;
}

const DEFAULT_GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image';

interface GeminiInlineDataPart {
  inlineData?: { mimeType?: string; data?: string };
}

interface GeminiImageResponse {
  candidates?: {
    content?: { parts?: GeminiInlineDataPart[] };
  }[];
  promptFeedback?: { blockReason?: string };
}

const BASELINE_INSTRUCTION = `Generate a single clean studio portrait of the person shown in the attached reference photo(s). Strict requirements:
- Front-facing, head and upper shoulders in frame.
- Neutral, relaxed expression (slight pleasant resting face, mouth closed).
- Even, diffuse studio lighting; no harsh shadows.
- Plain neutral light-grey background.
- No visible makeup. Clean, natural skin tone.
- Hair styled naturally and away from the face — no styling product, no accessories.
- Photorealistic, sharp focus, no painterly effects.
- Preserve identity exactly: same face shape, eye colour, hair colour and length, skin tone, apparent age as the reference photos. Use all references to infer 3D shape if multiple were provided.
Return only the generated portrait image — no text, no decorations.`;

export const generateAvatarBaseline = internalAction({
  args: { avatarId: v.id('avatars') },
  returns: v.null(),
  handler: async (ctx, { avatarId }) => {
    const apiKey = process.env['GEMINI_API_KEY'];
    if (apiKey === undefined || apiKey === '') {
      await ctx.runMutation(internal.avatars.markBaselineFailed, {
        id: avatarId,
        errorMessage: serializeError(errors.geminiKeyMissing()),
      });
      return null;
    }

    const avatar = await ctx.runQuery(internal.avatars.getAvatarForBaseline, { id: avatarId });
    if (avatar === null) return null;
    // Avatar was deleted between schedule and run, or status moved on. Bail.
    if (avatar.baselineStatus !== 'queued' && avatar.baselineStatus !== 'failed') {
      return null;
    }

    await ctx.runMutation(internal.avatars.markBaselineProcessing, { id: avatarId });

    try {
      const parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = [
        { text: BASELINE_INSTRUCTION },
      ];
      for (const storageId of avatar.sourcePhotoStorageIds) {
        const blob = await ctx.storage.get(storageId);
        if (blob === null) {
          throw errors.baselineSourceMissing();
        }
        const mime = blob.type === '' ? 'image/jpeg' : blob.type;
        const base64 = bytesToBase64(new Uint8Array(await blob.arrayBuffer()));
        parts.push({ inlineData: { mimeType: mime, data: base64 } });
      }

      const model = process.env['CONVEX_GEMINI_IMAGE_MODEL'] ?? DEFAULT_GEMINI_IMAGE_MODEL;
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts }],
            generationConfig: {
              responseModalities: ['IMAGE'],
              responseFormat: { image: { imageSize: '1K' } },
              temperature: 0.4,
            },
          }),
        },
      );

      if (!response.ok) {
        throw await geminiError('baseline', response);
      }

      const data = (await response.json()) as GeminiImageResponse;
      const blockReason = data.promptFeedback?.blockReason;
      if (blockReason !== undefined) {
        throw errors.baselineBlocked(blockReason);
      }

      const imagePart = data.candidates?.[0]?.content?.parts?.find(
        (part) => part.inlineData?.data !== undefined,
      );
      const inlineData = imagePart?.inlineData;
      if (inlineData?.data === undefined) {
        throw errors.baselineNoImage();
      }

      const outputMime = inlineData.mimeType ?? 'image/png';
      const outputBuffer = base64ToArrayBuffer(inlineData.data);
      const outputBlob = new Blob([outputBuffer], { type: outputMime });
      const baseImageStorageId = await ctx.storage.store(outputBlob);

      await ctx.runMutation(internal.avatars.markBaselineDone, {
        id: avatarId,
        baseImageStorageId,
      });
    } catch (error) {
      console.error('Baseline generation failed:', error);
      await ctx.runMutation(internal.avatars.markBaselineFailed, {
        id: avatarId,
        errorMessage: serializeError(error),
      });
    }

    return null;
  },
});

interface RenderInputJson {
  prompt: string;
  title?: string;
  referenceUploadedItemId?: string;
  inputStorageId?: string;
}

const RENDER_INSTRUCTION = (prompt: string) =>
  `Edit the attached photo to apply this look while preserving the person's identity, face, pose, lighting, and the rest of their body and background as much as possible. Style change to apply: ${prompt}. Return only the edited image.`;

const TRY_ON_INSTRUCTION = (prompt: string) =>
  `The first image is a photo of a person. The second image is a clothing or accessory reference. Edit the first photo so the person is realistically wearing the item from the second image, preserving their identity, face, pose, lighting, and the rest of their body and background as much as possible. Additional guidance: ${prompt}. Return only the edited image.`;

export const renderLookWithGemini = internalAction({
  args: { jobId: v.id('renderJobs') },
  returns: v.null(),
  handler: async (ctx, { jobId }) => {
    const apiKey = process.env['GEMINI_API_KEY'];
    if (apiKey === undefined || apiKey === '') {
      await ctx.runMutation(internal.renderJobs.markRenderJobFailed, {
        id: jobId,
        errorMessage: serializeError(errors.geminiKeyMissing()),
      });
      return null;
    }

    const job = await ctx.runQuery(internal.renderJobs.getRenderJobInternal, { id: jobId });
    if (job === null) return null;

    // Parse once up front so `finally` can free the single-use input blob even
    // if a later step throws. The JSON was just serialized by createRenderJob,
    // so a parse failure here is a hard corruption case we mark as failed.
    let input: RenderInputJson;
    try {
      input = JSON.parse(job.inputJson) as RenderInputJson;
    } catch (error) {
      console.error('Render job inputJson is corrupt:', error);
      await ctx.runMutation(internal.renderJobs.markRenderJobFailed, {
        id: jobId,
        errorMessage: serializeError(error),
      });
      return null;
    }

    await ctx.runMutation(internal.renderJobs.markRenderJobProcessing, { id: jobId });

    try {
      const prompt = input.prompt;

      // Prefer the studio's flattened canvas (baseline + tints) if the client
      // uploaded one — that way AI renders stack on top of makeup. Otherwise
      // fall back to the canonical baseline.
      let inputBlob: Blob | null = null;
      if (input.inputStorageId !== undefined) {
        inputBlob = await ctx.storage.get(input.inputStorageId as Id<'_storage'>);
      }
      if (inputBlob === null) {
        const avatar = await ctx.runQuery(internal.avatars.getAvatarStorageForUser, {
          id: job.avatarId,
          userId: job.userId,
        });
        if (avatar === null) {
          throw errors.avatarNotFound();
        }
        inputBlob = await ctx.storage.get(avatar.baseImageStorageId);
        if (inputBlob === null) {
          throw errors.avatarImageMissing();
        }
      }
      const inputMime = inputBlob.type === '' ? 'image/jpeg' : inputBlob.type;
      const inputBase64 = bytesToBase64(new Uint8Array(await inputBlob.arrayBuffer()));

      const parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = [];
      if (input.referenceUploadedItemId !== undefined) {
        const referenceItem = await ctx.runQuery(
          internal.uploadedItems.getUploadedItemStorageForUser,
          { id: input.referenceUploadedItemId as Id<'uploadedItems'>, userId: job.userId },
        );
        if (referenceItem === null) {
          throw errors.referenceItemNotFound();
        }
        const refBlob = await ctx.storage.get(referenceItem.imageStorageId);
        if (refBlob === null) {
          throw errors.referenceItemBytesMissing();
        }
        const refMime = refBlob.type === '' ? 'image/jpeg' : refBlob.type;
        const refBase64 = bytesToBase64(new Uint8Array(await refBlob.arrayBuffer()));
        parts.push({ text: TRY_ON_INSTRUCTION(prompt) });
        parts.push({ inlineData: { mimeType: inputMime, data: inputBase64 } });
        parts.push({ inlineData: { mimeType: refMime, data: refBase64 } });
      } else {
        parts.push({ text: RENDER_INSTRUCTION(prompt) });
        parts.push({ inlineData: { mimeType: inputMime, data: inputBase64 } });
      }

      const model = process.env['CONVEX_GEMINI_IMAGE_MODEL'] ?? DEFAULT_GEMINI_IMAGE_MODEL;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts }],
            generationConfig: {
              responseModalities: ['IMAGE'],
              responseFormat: { image: { imageSize: '1K' } },
              temperature: 0.7,
            },
          }),
        },
      );

      if (!response.ok) {
        throw await geminiError('render', response);
      }

      const data = (await response.json()) as GeminiImageResponse;
      const blockReason = data.promptFeedback?.blockReason;
      if (blockReason !== undefined) {
        throw errors.renderBlocked(blockReason);
      }

      const imagePart = data.candidates?.[0]?.content?.parts?.find(
        (part) => part.inlineData?.data !== undefined,
      );
      const inlineData = imagePart?.inlineData;
      if (inlineData === undefined) {
        throw errors.renderNoImage();
      }
      if (inlineData.data === undefined) {
        throw errors.renderNoImage();
      }

      const outputMime = inlineData.mimeType ?? 'image/png';
      const outputBuffer = base64ToArrayBuffer(inlineData.data);
      const outputBlob = new Blob([outputBuffer], { type: outputMime });
      const resultStorageId = await ctx.storage.store(outputBlob);

      await ctx.runMutation(internal.renderJobs.markRenderJobDone, {
        id: jobId,
        resultStorageId,
      });
    } catch (error) {
      console.error('Render job failed:', error);
      await ctx.runMutation(internal.renderJobs.markRenderJobFailed, {
        id: jobId,
        errorMessage: serializeError(error),
      });
    } finally {
      // Single-use studio canvas snapshot — free the storage blob whichever
      // way the action exited (success or failure). Doesn't apply to the
      // avatar baseline or uploaded reference items, which are owned blobs.
      if (input.inputStorageId !== undefined) {
        try {
          await ctx.storage.delete(input.inputStorageId as Id<'_storage'>);
        } catch (cleanupError) {
          console.warn('Render input cleanup failed:', cleanupError);
        }
      }
    }

    return null;
  },
});
