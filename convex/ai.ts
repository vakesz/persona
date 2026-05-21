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

const STYLIST_SYSTEM_PROMPT = `You are a confident, warm stylist helping someone preview looks that would suit them. Read their photo and question, then propose three concrete looks they should try.

The user's question may be in any language (English, Hungarian, etc.); interpret it faithfully. Write title and description in the user's language. styleType must stay in English (one of the four enum values below). renderPrompt must stay in English (it is fed to an image-edit model that responds best to English directives).

Output exactly 3 recommendations as structured JSON. For each:
- title: short, memorable, max 6 words.
- description: 1-2 sentences explaining WHY this suits them (skin tone, hair, face shape, vibe). Specific, not generic. No hedging.
- styleType: exactly one of "hair", "makeup", "nails", "clothes".
- renderPrompt: 2-3 directive sentences in English for an image-edit model. Describe the edit as a local change and name the important areas that must stay untouched. For hair, specify cut, length, silhouette, texture, fringe/bangs, and whether hair colour should stay natural. For makeup, specify exact region, colour, finish, and intensity while preserving skin texture and identity marks. Use replace/render/apply/restyle verbs — never "change" or "add" alone, because the model interprets those as partial edits.

If the question targets a specific style type, make all 3 recommendations that type. Otherwise spread across types based on what would genuinely benefit the user most.`;

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

const IMAGE_SYSTEM_INSTRUCTION = `This is a personal styling app. The user uploads photos of themselves to preview hairstyles, makeup, clothing, and accessories on their own portrait. Every reference image is of the user, supplied by the user, and only shown back to them; outputs are private.

When rendering the user, keep them photorealistic and recognizable: preserve their face shape, facial features, expression, skin tone, skin texture, body shape, and apparent age. Preserve every mole, beauty spot, freckle, birthmark, and scar exactly where it appears in the reference — never smooth, remove, or relocate them unless explicitly asked.

Other features (hair, makeup, clothing, eyewear, headwear, jewelry, facial hair) stay as in the reference unless the request changes them. Treat requested styling changes as targeted local edits: edit the requested feature cleanly, integrate it with the original lighting and perspective, and leave the rest of the image unchanged. For hairstyle requests, edit only the hair on the head; keep the user's face, forehead size, skull/head size, ears, neck, shoulders, clothing, background, crop, and aspect ratio unchanged. Keep hair attached naturally to the head and keep the natural hair colour unless the request explicitly asks for a different colour.

User descriptions may be written in any language (English, Hungarian, etc.), sometimes mixed within a single request; interpret them faithfully regardless of language. Never stylise, cartoonify, or retouch beyond what the request asks for.`;

type AvatarBaselineType = 'selfie' | 'full_body';

function buildBaselineInstruction(avatarType: AvatarBaselineType): string {
  if (avatarType === 'full_body') {
    return `Use the attached reference photo(s) of me to produce a single clean studio full-body shot of me. This is the canonical baseline that the rest of the app edits on top of, so it must look unambiguously like me. Requirements:
- Full body in frame: head to feet, standing front-facing, arms relaxed at the sides.
- Relaxed, neutral expression with mouth closed.
- Even, diffuse studio lighting; no harsh shadows.
- Plain neutral light-grey backdrop covering the full height.
- Plain, neutral, well-fitting everyday outfit — keep it simple, since the app will edit clothing on top later.
- No visible makeup; clean, natural skin.
- Hair styled simply, away from the face; no accessories.
- Photorealistic, sharp focus, no painterly, illustrated, airbrushed, or stylised effects.
- Match my appearance to the reference(s): same face shape, eye shape and colour, hair colour and length, skin tone, apparent age, height, build, and overall proportions.
- The references may be a mix of full-body shots and selfies (this is expected). Use selfies primarily for identity cues — face, hair, skin — and any full-body shots primarily for proportions and body shape. Infer whatever isn't directly visible from the strongest available evidence; do not refuse if a reference doesn't match the requested framing.
- Keep every mole, beauty spot, freckle, birthmark, scar, and similar identifying mark exactly where it appears in the reference(s). Do not smooth, retouch, or erase them.
Return only the edited portrait image — no text, no decorations.`;
  }
  return `Use the attached reference photo(s) of me to produce a single clean studio headshot of me. This is the canonical baseline that the rest of the app edits on top of, so it must look unambiguously like me. Requirements:
- Front-facing, head and upper shoulders in frame.
- Relaxed, neutral expression with mouth closed.
- Even, diffuse studio lighting; no harsh shadows.
- Plain neutral light-grey background.
- No visible makeup; clean, natural skin.
- Hair styled simply, away from the face; no accessories.
- Photorealistic, sharp focus, no painterly, illustrated, airbrushed, or stylised effects.
- Match my appearance to the reference(s): same face shape, eye shape and colour, hair colour and length, skin tone, and apparent age. If multiple references were given, combine them to infer my 3D structure.
- The references may include some full-body shots even though this is a headshot baseline; that's fine — crop in mentally and use them for identity cues alongside the closer selfies. Do not refuse if a reference doesn't match the requested framing.
- Keep every mole, beauty spot, freckle, birthmark, scar, and similar identifying mark exactly where it appears in the reference(s). Do not smooth, retouch, or erase them.
Return only the edited portrait image — no text, no decorations.`;
}

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
        { text: buildBaselineInstruction(avatar.type) },
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
            systemInstruction: { parts: [{ text: IMAGE_SYSTEM_INSTRUCTION }] },
            contents: [{ role: 'user', parts }],
            generationConfig: {
              responseModalities: ['IMAGE'],
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
        console.error(
          'Gemini blocked baseline:',
          JSON.stringify({
            promptFeedback: data.promptFeedback,
            candidate: data.candidates?.[0],
          }),
        );
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
  `Edit the attached photo of me to apply the requested look as a targeted local edit. Keep the original crop, aspect ratio, background, lighting, pose, expression, face shape, facial features, skin tone, skin texture, body shape, clothing, and accessories unchanged unless the request explicitly changes one of those areas. Keep every mole, beauty spot, freckle, birthmark, and scar exactly where it appears - do not retouch, smooth, erase, or relocate identity marks. For hairstyle requests, edit only the hair on my head: render the requested cut, length, silhouette, texture, fringe/bangs if specified, and realistic hairline while preserving my face, forehead size, head size, ears, neck, shoulders, glasses, makeup, clothing, crop, and aspect ratio. Keep my natural hair colour unless the request explicitly asks for a different colour. The request may be written in any language; interpret it faithfully. Requested change: ${prompt}. Return only the edited image.`;

const TRY_ON_INSTRUCTION = (prompt: string) =>
  `The first image is a photo of me; the second is a clothing or accessory reference. Edit the first photo so I am realistically wearing the item from the second - fitted naturally to my body, matched to my lighting and pose. If I am already wearing a similar garment or accessory in the first photo, replace it with the reference item rather than layering on top. Preserve my face, hair, pose, lighting, background, crop, and aspect ratio unless the additional guidance explicitly changes them. Keep every mole, beauty spot, freckle, birthmark, and scar exactly where it appears - do not retouch, smooth, erase, or relocate identity marks. Additional guidance (may be in any language; interpret faithfully): ${prompt}. Return only the edited image.`;

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
            systemInstruction: { parts: [{ text: IMAGE_SYSTEM_INSTRUCTION }] },
            contents: [{ role: 'user', parts }],
            generationConfig: {
              responseModalities: ['IMAGE'],
              temperature: 0.4,
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
        console.error(
          'Gemini blocked render:',
          JSON.stringify({
            promptFeedback: data.promptFeedback,
            candidate: data.candidates?.[0],
          }),
        );
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
