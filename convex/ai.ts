import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { action, internalAction } from './_generated/server';

// Declared locally so this file type-checks under both the convex tsconfig
// (which loads @types/node) and the app tsconfig (which reaches us via
// the generated `_generated/api.d.ts` type chain but has no node types).
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

interface StylistRecommendation {
  title: string;
  description: string;
  styleType: 'hair' | 'makeup' | 'nails' | 'clothes';
  renderPrompt: string;
}

interface StylistResponse {
  recommendations: StylistRecommendation[];
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
      throw new Error('GEMINI_API_KEY is not configured on the Convex deployment.');
    }
    const model = process.env['CONVEX_GEMINI_MODEL'] ?? DEFAULT_GEMINI_MODEL;

    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error('Not authenticated.');
    }

    const avatar = await ctx.runQuery(internal.avatars.getAvatarStorageForUser, {
      id: avatarId,
      userId,
    });
    if (avatar === null) {
      throw new Error('Avatar not found.');
    }

    const blob = await ctx.storage.get(avatar.baseImageStorageId);
    if (blob === null) {
      throw new Error('Avatar image is missing from storage.');
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
      const errorText = await response.text();
      console.error('Gemini error:', response.status, errorText);
      throw new Error(`Stylist call failed (HTTP ${response.status}).`);
    }

    const data = (await response.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== 'string' || text === '') {
      throw new Error('Stylist returned an empty response.');
    }

    let parsed: StylistResponse;
    try {
      parsed = JSON.parse(text) as StylistResponse;
    } catch {
      throw new Error('Stylist returned malformed JSON.');
    }

    if (!Array.isArray(parsed.recommendations)) {
      throw new Error('Stylist response is missing recommendations.');
    }

    return {
      recommendations: parsed.recommendations.slice(0, 5).map((item) => ({
        title: item.title,
        description: item.description,
        styleType: item.styleType,
        renderPrompt: item.renderPrompt,
      })),
    };
  },
});

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

interface RenderInputJson {
  prompt: string;
  title?: string;
  referenceUploadedItemId?: string;
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
        errorMessage: 'GEMINI_API_KEY is not configured.',
      });
      return null;
    }

    const job = await ctx.runQuery(internal.renderJobs.getRenderJobInternal, { id: jobId });
    if (job === null) return null;

    await ctx.runMutation(internal.renderJobs.markRenderJobProcessing, { id: jobId });

    try {
      const avatar = await ctx.runQuery(internal.avatars.getAvatarStorageForUser, {
        id: job.avatarId,
        userId: job.userId,
      });
      if (avatar === null) {
        throw new Error('Avatar not found.');
      }

      const blob = await ctx.storage.get(avatar.baseImageStorageId);
      if (blob === null) {
        throw new Error('Avatar image is missing from storage.');
      }
      const inputMime = blob.type === '' ? 'image/jpeg' : blob.type;
      const inputBase64 = bytesToBase64(new Uint8Array(await blob.arrayBuffer()));

      const input = JSON.parse(job.inputJson) as RenderInputJson;
      const prompt = input.prompt;

      const parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = [];
      if (input.referenceUploadedItemId !== undefined) {
        const referenceItem = await ctx.runQuery(
          internal.uploadedItems.getUploadedItemStorageForUser,
          { id: input.referenceUploadedItemId as Id<'uploadedItems'>, userId: job.userId },
        );
        if (referenceItem === null) {
          throw new Error('Reference item not found.');
        }
        const refBlob = await ctx.storage.get(referenceItem.imageStorageId);
        if (refBlob === null) {
          throw new Error('Reference item bytes are missing from storage.');
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
              temperature: 0.7,
            },
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Render failed (HTTP ${response.status}): ${errorText.slice(0, 200)}`);
      }

      const data = (await response.json()) as GeminiImageResponse;
      const blockReason = data.promptFeedback?.blockReason;
      if (blockReason !== undefined) {
        throw new Error(`Render was blocked: ${blockReason}`);
      }

      const imagePart = data.candidates?.[0]?.content?.parts?.find(
        (part) => part.inlineData?.data !== undefined,
      );
      const inlineData = imagePart?.inlineData;
      if (inlineData === undefined) {
        throw new Error('Render returned no image.');
      }
      if (inlineData.data === undefined) {
        throw new Error('Render returned no image.');
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
        errorMessage: error instanceof Error ? error.message : 'Render failed.',
      });
    }

    return null;
  },
});
