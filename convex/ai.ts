import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import { internal } from './_generated/api';
import { action } from './_generated/server';

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
