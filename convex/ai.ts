import { v } from 'convex/values';

import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { action, internalAction } from './_generated/server';
import { requireAuth } from './lib/auth';
import { errors, serializeError } from './lib/errors';
import { MAX_SOURCE_PHOTOS, MAX_STYLIST_QUESTION_LENGTH } from './lib/limits';
import { parseInputStorageId } from './lib/renderInput';

// @types/node v25 no longer exposes `process` on globalThis; Convex actions run
// in a V8 isolate that provides `process.env`, so a minimal local shim is the
// pragmatic fix.
declare const process: { env: Record<string, string | undefined> };

const DEFAULT_CF_IMAGE_MODEL = '@cf/black-forest-labs/flux-2-dev';
const DEFAULT_CF_STYLIST_MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';
const CF_PROVIDER_NAME = 'Cloudflare Workers AI';

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
- renderPrompt: 1-2 directive sentences in English for an image-edit model. Use replace/render/apply verbs - never "change" or "add" alone, because the model interprets those as partial edits. Specify color, texture, length, finish, fit, and any other visual specifics needed to render the look faithfully on the existing photo.

If the question targets a specific style type, make all 3 recommendations that type. Otherwise spread across types based on what would genuinely benefit the user most.`;

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

type AiOperation = 'stylist' | 'baseline' | 'render';

type ImageOperation = 'baseline' | 'render';

interface WorkerConfig {
  baseUrl: string;
  secret: string;
  imageModel: string;
  stylistModel: string;
}

interface ImageReference {
  blob: Blob;
  filename: string;
}

interface GeneratedImage {
  bytes: ArrayBuffer;
  mimeType: string;
}

interface CloudflareImageResponse {
  image?: string;
  mimeType?: string;
}

interface CloudflareStylistResponse {
  recommendations?: unknown;
}

function normalizeWorkerBaseUrl(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function getCloudflareWorkerConfig(): WorkerConfig {
  const url = process.env['CONVEX_CF_IMAGE_WORKER_URL'];
  const secret = process.env['CONVEX_CF_IMAGE_WORKER_SECRET'];
  if (url === undefined || url === '' || secret === undefined || secret === '') {
    throw errors.imageProviderKeyMissing(CF_PROVIDER_NAME);
  }
  return {
    baseUrl: normalizeWorkerBaseUrl(url),
    secret,
    imageModel: process.env['CONVEX_CF_IMAGE_MODEL'] ?? DEFAULT_CF_IMAGE_MODEL,
    stylistModel: process.env['CONVEX_CF_STYLIST_MODEL'] ?? DEFAULT_CF_STYLIST_MODEL,
  };
}

async function cloudflareProviderError(
  operation: AiOperation,
  response: Response,
): Promise<
  ReturnType<
    | typeof errors.imageProviderQuota
    | typeof errors.imageProviderAuth
    | typeof errors.imageProviderFailed
  >
> {
  if (response.status === 429) {
    return errors.imageProviderQuota(CF_PROVIDER_NAME, operation);
  }
  if (response.status === 401 || response.status === 403) {
    return errors.imageProviderAuth(CF_PROVIDER_NAME, operation, response.status);
  }
  const errorText = await response.text().catch(() => '');
  return errors.imageProviderFailed(
    CF_PROVIDER_NAME,
    operation,
    response.status,
    errorText.slice(0, 200),
  );
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

function mimeExtension(mimeType: string): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

async function generateImageWithCloudflareWorker({
  operation,
  prompt,
  references,
  steps,
  guidance,
  width,
  height,
}: {
  operation: ImageOperation;
  prompt: string;
  references: ImageReference[];
  steps: number;
  guidance: number;
  width: number;
  height: number;
}): Promise<GeneratedImage> {
  const { baseUrl, secret, imageModel } = getCloudflareWorkerConfig();
  const form = new FormData();
  form.append('prompt', prompt);
  form.append('model', imageModel);
  form.append('steps', String(steps));
  form.append('guidance', String(guidance));
  form.append('width', String(width));
  form.append('height', String(height));

  for (const [index, reference] of references.slice(0, 4).entries()) {
    form.append(`input_image_${index}`, reference.blob, reference.filename);
  }

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}` },
    body: form,
  });

  if (!response.ok) {
    throw await cloudflareProviderError(operation, response);
  }

  const data = (await response.json()) as CloudflareImageResponse;
  if (typeof data.image !== 'string' || data.image === '') {
    throw operation === 'baseline' ? errors.baselineNoImage() : errors.renderNoImage();
  }

  return {
    bytes: base64ToArrayBuffer(data.image),
    mimeType: data.mimeType ?? 'image/png',
  };
}

async function analyzeStyleWithCloudflareWorker({
  image,
  mimeType,
  question,
}: {
  image: Uint8Array;
  mimeType: string;
  question: string;
}): Promise<{ recommendations: StylistRecommendation[] }> {
  const { baseUrl, secret, stylistModel } = getCloudflareWorkerConfig();
  const form = new FormData();
  const imageBuffer = image.buffer.slice(
    image.byteOffset,
    image.byteOffset + image.byteLength,
  ) as ArrayBuffer;

  form.append('model', stylistModel);
  form.append('system_prompt', STYLIST_SYSTEM_PROMPT);
  form.append('question', question);
  form.append(
    'input_image_0',
    new Blob([imageBuffer], { type: mimeType }),
    `portrait.${mimeExtension(mimeType)}`,
  );

  const response = await fetch(`${baseUrl}/stylist`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}` },
    body: form,
  });

  if (!response.ok) {
    throw await cloudflareProviderError('stylist', response);
  }

  const data = (await response.json()) as CloudflareStylistResponse;
  if (!Array.isArray(data.recommendations)) {
    throw errors.stylistMissingRecommendations();
  }

  return {
    recommendations: data.recommendations.slice(0, 3).map(parseStylistRecommendation),
  };
}

export const analyzeStyle: ReturnType<typeof action> = action({
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
    // Auth first so an anonymous caller can't fingerprint provider config.
    const userId = await requireAuth(ctx);

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
    const trimmedQuestion = question.trim().slice(0, MAX_STYLIST_QUESTION_LENGTH);
    const userTurn =
      trimmedQuestion === ''
        ? 'Give me 3 looks that would really suit me, across hair / makeup / nails / clothes - whatever benefits me most.'
        : trimmedQuestion;

    return await analyzeStyleWithCloudflareWorker({
      image: imageBytes,
      mimeType,
      question: userTurn,
    });
  },
});

const IMAGE_SYSTEM_INSTRUCTION = `This is a personal styling app. The user uploads photos of themselves to preview hairstyles, makeup, clothing, and accessories on their own portrait. Every reference image is of the user, supplied by the user, and only shown back to them; outputs are private.

When rendering the user, keep them photorealistic and recognizable: preserve their face, skin tone, apparent age, facial asymmetry, expression, and natural skin texture. Preserve every mole, beauty spot, freckle, birthmark, and scar exactly where it appears in the reference - never smooth, remove, or relocate them unless explicitly asked.

Other features (hair, makeup, clothing, eyewear, headwear, jewelry, facial hair) stay as in the reference unless the request changes them. When a request asks to change, replace, restyle, add, or remove a feature, apply it fully - completely remove the existing version of that feature and render the new one in its place, not a partial blend of old and new.

User descriptions may be written in any language (English, Hungarian, etc.), sometimes mixed within a single request; interpret them faithfully regardless of language. Never stylize, cartoonify, beautify, de-age, airbrush, or retouch beyond what the request asks for.`;

type AvatarBaselineType = 'selfie' | 'full_body';

function buildBaselineInstruction(avatarType: AvatarBaselineType): string {
  if (avatarType === 'full_body') {
    return `Use the attached reference photo(s) of me to produce a single clean studio full-body shot of me. Image 0 is the primary identity anchor; use any later images only as supporting references for angles, proportions, and details. This is the canonical baseline that the rest of the app edits on top of, so it must look unambiguously like me. Requirements:
- Full body in frame: head to feet, standing front-facing, arms relaxed at the sides.
- Relaxed, neutral expression with mouth closed.
- Even, diffuse studio lighting; no harsh shadows.
- Plain neutral light-grey backdrop covering the full height.
- Plain, neutral, well-fitting everyday outfit - keep it simple, since the app will edit clothing on top later.
- No visible makeup; clean, natural skin.
- Hair styled simply, away from the face; no accessories.
- Photorealistic, sharp focus, no painterly, illustrated, airbrushed, or stylized effects.
- Match my appearance to image 0 first: same facial proportions, face shape, eye shape and color, nose, mouth, jaw, skin tone, apparent age, and facial asymmetry. Use the supporting references for hair, height, build, and overall body proportions only when they agree with image 0.
- The references may be a mix of full-body shots and selfies (this is expected). Use selfies primarily for identity cues - face, hair, skin - and any full-body shots primarily for proportions and body shape. Infer whatever isn't directly visible from the strongest available evidence; do not refuse if a reference doesn't match the requested framing.
- Keep every mole, beauty spot, freckle, birthmark, scar, and similar identifying mark exactly where it appears in the reference(s). Do not smooth, retouch, or erase them.
Return only the edited portrait image - no text, no decorations.`;
  }
  return `Use the attached reference photo(s) of me to produce a single clean studio headshot of me. Image 0 is the primary identity anchor; use any later images only as supporting references for angles and details. This is the canonical baseline that the rest of the app edits on top of, so it must look unambiguously like me. Requirements:
- Front-facing, head and upper shoulders in frame.
- Relaxed, neutral expression with mouth closed.
- Even, diffuse studio lighting; no harsh shadows.
- Plain neutral light-grey background.
- No visible makeup; clean, natural skin.
- Hair styled simply, away from the face; no accessories.
- Photorealistic, sharp focus, no painterly, illustrated, airbrushed, or stylized effects.
- Match my appearance to image 0 first: same facial proportions, face shape, eye shape and color, nose, mouth, jaw, skin tone, apparent age, and facial asymmetry. If multiple references were given, use them only to infer my 3D structure without replacing the identity from image 0.
- The references may include some full-body shots even though this is a headshot baseline; that's fine - crop in mentally and use them for identity cues alongside the closer selfies. Do not refuse if a reference doesn't match the requested framing.
- Keep every mole, beauty spot, freckle, birthmark, scar, and similar identifying mark exactly where it appears in the reference(s). Do not smooth, retouch, or erase them.
Return only the edited portrait image - no text, no decorations.`;
}

function imageDimensionsForAvatar(
  avatarType: AvatarBaselineType,
  purpose: 'baseline' | 'render',
): { width: number; height: number } {
  if (avatarType === 'full_body') {
    return purpose === 'baseline' ? { width: 384, height: 512 } : { width: 768, height: 1024 };
  }
  return purpose === 'baseline' ? { width: 512, height: 512 } : { width: 768, height: 768 };
}

export const generateAvatarBaseline = internalAction({
  args: { avatarId: v.id('avatars') },
  returns: v.null(),
  handler: async (ctx, { avatarId }) => {
    try {
      getCloudflareWorkerConfig();
    } catch (error) {
      await ctx.runMutation(internal.avatars.markBaselineFailed, {
        id: avatarId,
        errorMessage: serializeError(error),
      });
      return null;
    }

    const avatar = await ctx.runQuery(internal.avatars.getAvatarForBaseline, { id: avatarId });
    if (avatar === null) return null;

    // Atomic queued|failed -> processing transition. If another invocation
    // raced ahead, we bail without duplicate work.
    const claimed = await ctx.runMutation(internal.avatars.claimBaselineGeneration, {
      id: avatarId,
    });
    if (!claimed) return null;

    try {
      const prompt = buildBaselineInstruction(avatar.type);
      const sourceBlobs: ImageReference[] = [];
      for (const storageId of avatar.sourcePhotoStorageIds.slice(0, MAX_SOURCE_PHOTOS)) {
        const blob = await ctx.storage.get(storageId);
        if (blob === null) {
          throw errors.baselineSourceMissing();
        }
        sourceBlobs.push({ blob, filename: `source-${sourceBlobs.length}.jpg` });
      }
      const dimensions = imageDimensionsForAvatar(avatar.type, 'baseline');

      const generated = await generateImageWithCloudflareWorker({
        operation: 'baseline',
        prompt: `${IMAGE_SYSTEM_INSTRUCTION}\n\n${prompt}`,
        references: sourceBlobs,
        steps: 20,
        guidance: 2.2,
        width: dimensions.width,
        height: dimensions.height,
      });

      const outputBlob = new Blob([generated.bytes], { type: generated.mimeType });
      const baseImageStorageId = await ctx.storage.store(outputBlob);
      try {
        await ctx.runMutation(internal.avatars.markBaselineDone, {
          id: avatarId,
          baseImageStorageId,
        });
      } catch (patchError) {
        try {
          await ctx.storage.delete(baseImageStorageId);
        } catch (cleanupError) {
          console.warn('Baseline orphan cleanup failed:', cleanupError);
        }
        throw patchError;
      }
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
  `Image 0 is the source portrait of me and must remain the identity anchor. Make a conservative photorealistic edit of image 0 to apply the requested look; do not generate a new person, a new face, or a beauty-retouched version of me. Preserve my face shape, facial proportions, eyes, nose, mouth, jaw, skin tone, apparent age, facial asymmetry, pose, lighting, body, crop, and background unless a requested local edit explicitly touches that area. Keep every mole, beauty spot, freckle, birthmark, and scar exactly where it appears - do not retouch or smooth them. When the request asks to change, replace, restyle, add, or remove a feature, apply that change fully: completely remove the existing version of the affected feature and render the new one in its place, not a partial blend. The request may be written in any language; interpret it faithfully. Requested change: ${prompt}. Return only the edited image.`;

const TRY_ON_INSTRUCTION = (prompt: string) =>
  `Image 0 is the source portrait of me and must remain the identity anchor. Image 1 is a clothing or accessory reference. Make a conservative photorealistic edit of image 0 so I am realistically wearing the item from image 1, fitted naturally to my body and matched to my lighting and pose. If I am already wearing a similar garment or accessory in image 0, replace it with the reference item rather than layering on top. Do not generate a new person, a new face, or a beauty-retouched version of me. Preserve my face shape, facial proportions, eyes, nose, mouth, jaw, skin tone, apparent age, facial asymmetry, pose, lighting, body, crop, and background unless the item naturally covers part of them. Keep every mole, beauty spot, freckle, birthmark, and scar exactly where it appears - do not retouch or smooth them. Additional guidance (may be in any language; interpret faithfully): ${prompt}. Return only the edited image.`;

export const renderLook = internalAction({
  args: { jobId: v.id('renderJobs') },
  returns: v.null(),
  handler: async (ctx, { jobId }) => {
    try {
      getCloudflareWorkerConfig();
    } catch (error) {
      await ctx.runMutation(internal.renderJobs.markRenderJobFailed, {
        id: jobId,
        errorMessage: serializeError(error),
      });
      return null;
    }

    const job = await ctx.runQuery(internal.renderJobs.getRenderJobInternal, { id: jobId });
    if (job === null) return null;

    const inputStorageId = parseInputStorageId(job.inputJson);

    let input: RenderInputJson | null = null;
    let parseFailure: unknown = null;
    try {
      input = JSON.parse(job.inputJson) as RenderInputJson;
    } catch (error) {
      parseFailure = error;
      console.error('Render job inputJson is corrupt:', error);
    }

    const claimed = await ctx.runMutation(internal.renderJobs.claimRenderJob, { id: jobId });
    if (!claimed) {
      return null;
    }

    let resultStorageId: Id<'_storage'> | null = null;
    try {
      if (input === null) {
        throw parseFailure instanceof Error
          ? parseFailure
          : new Error('Render job inputJson is corrupt');
      }
      const prompt = input.prompt;

      const avatar = await ctx.runQuery(internal.avatars.getAvatarStorageForUser, {
        id: job.avatarId,
        userId: job.userId,
      });
      if (avatar === null) {
        throw errors.avatarNotFound();
      }

      let inputBlob: Blob | null = null;
      if (inputStorageId !== null) {
        inputBlob = await ctx.storage.get(inputStorageId);
      }
      if (inputBlob === null) {
        inputBlob = await ctx.storage.get(avatar.baseImageStorageId);
        if (inputBlob === null) {
          throw errors.avatarImageMissing();
        }
      }

      const inputMime = inputBlob.type === '' ? 'image/jpeg' : inputBlob.type;
      const references: ImageReference[] = [
        { blob: inputBlob, filename: `portrait.${mimeExtension(inputMime)}` },
      ];
      let renderPrompt = RENDER_INSTRUCTION(prompt);
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
        references.push({ blob: refBlob, filename: `reference.${mimeExtension(refMime)}` });
        renderPrompt = TRY_ON_INSTRUCTION(prompt);
      }

      const dimensions = imageDimensionsForAvatar(avatar.type, 'render');
      const generated = await generateImageWithCloudflareWorker({
        operation: 'render',
        prompt: `${IMAGE_SYSTEM_INSTRUCTION}\n\n${renderPrompt}`,
        references,
        steps: 20,
        guidance: input.referenceUploadedItemId === undefined ? 1.6 : 1.8,
        width: dimensions.width,
        height: dimensions.height,
      });

      const outputBlob = new Blob([generated.bytes], { type: generated.mimeType });
      resultStorageId = await ctx.storage.store(outputBlob);

      await ctx.runMutation(internal.renderJobs.markRenderJobDone, {
        id: jobId,
        resultStorageId,
      });
      resultStorageId = null;
    } catch (error) {
      console.error('Render job failed:', error);
      if (resultStorageId !== null) {
        try {
          await ctx.storage.delete(resultStorageId);
        } catch (cleanupError) {
          console.warn('Render result orphan cleanup failed:', cleanupError);
        }
      }
      await ctx.runMutation(internal.renderJobs.markRenderJobFailed, {
        id: jobId,
        errorMessage: serializeError(error),
      });
    } finally {
      if (inputStorageId !== null) {
        try {
          await ctx.storage.delete(inputStorageId);
        } catch (cleanupError) {
          console.warn('Render input cleanup failed:', cleanupError);
        }
      }
    }

    return null;
  },
});
