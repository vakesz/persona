const DEFAULT_IMAGE_MODEL = '@cf/black-forest-labs/flux-2-dev';
const DEFAULT_STYLIST_MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';
const MAX_REFERENCE_IMAGES = 4;
const STYLIST_TRANSIENT_PROVIDER_RETRIES = 2;

const STYLIST_RESPONSE_SCHEMA = {
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
} as const;

type WorkerEnv = Env & {
  IMAGE_API_SECRET: string;
};

interface FluxImageResponse {
  image?: unknown;
}

interface StylistResponse {
  recommendations?: unknown;
  response?: unknown;
}

interface ErrorPayload {
  code:
    | 'bad_request'
    | 'unauthorized'
    | 'method_not_allowed'
    | 'provider_error'
    | 'provider_quota'
    | 'provider_unavailable'
    | 'internal_error';
  error: string;
  detail?: string;
  providerStatus?: number;
}

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

function jsonError(body: ErrorPayload, status: number): Response {
  return jsonResponse(body, status);
}

function providerMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown provider error';
  }
}

function sanitizedProviderDetail(error: unknown): string {
  return providerMessage(error).replace(/\s+/g, ' ').slice(0, 300);
}

function isProviderQuotaError(error: unknown): boolean {
  const message = providerMessage(error).toLowerCase();
  return (
    message.includes('4006:') ||
    message.includes('daily free allocation') ||
    message.includes('used up your') ||
    message.includes('upgrade to cloudflare') ||
    message.includes('workers paid plan') ||
    message.includes('quota') ||
    message.includes('billing')
  );
}

function isProviderUnavailableError(error: unknown): boolean {
  const message = providerMessage(error).toLowerCase();
  return (
    message.includes('unavailable') ||
    message.includes('overload') ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('no more data centers')
  );
}

function providerHttpStatus(error: unknown): 429 | 502 | 503 {
  if (isProviderQuotaError(error)) return 429;
  if (isProviderUnavailableError(error)) return 503;
  return 502;
}

function providerCode(error: unknown): ErrorPayload['code'] {
  if (isProviderQuotaError(error)) return 'provider_quota';
  if (isProviderUnavailableError(error)) return 'provider_unavailable';
  return 'provider_error';
}

function providerErrorLabel(code: ErrorPayload['code'], scope: 'image' | 'stylist'): string {
  if (code === 'provider_quota') return `Workers AI ${scope} quota reached`;
  if (code === 'provider_unavailable') return `Workers AI ${scope} temporarily unavailable`;
  return `Workers AI ${scope} request failed`;
}

function providerStatusCode(error: unknown): number | undefined {
  const message = providerMessage(error).toLowerCase();
  const match = /\b(4\d\d|5\d\d)\b/.exec(message);
  if (match === null) {
    return undefined;
  }
  return Number(match[1]);
}

function providerError(error: unknown, scope: 'image' | 'stylist'): Response {
  console.error(`workers-ai-${scope}-error`, error);
  const code = providerCode(error);
  const status = providerHttpStatus(error);
  const rawProviderStatus = providerStatusCode(error);
  return jsonError(
    {
      code,
      error: providerErrorLabel(code, scope),
      detail: sanitizedProviderDetail(error),
      ...(rawProviderStatus !== undefined && { providerStatus: rawProviderStatus }),
    },
    status,
  );
}

function isTransientProviderError(error: unknown): boolean {
  if (isProviderQuotaError(error)) return false;
  const message = providerMessage(error).toLowerCase();
  return (
    message.includes('unavailable') ||
    message.includes('overload') ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('internal error') ||
    message.includes('gateway') ||
    message.includes('502') ||
    message.includes('503') ||
    message.includes('504')
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runWorkersAiWithRetry<T>(
  env: WorkerEnv,
  model: string,
  input: Parameters<WorkerEnv['AI']['run']>[1],
  maxRetries: number,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return (await env.AI.run(model, input)) as T;
    } catch (error) {
      lastError = error;
      if (attempt === maxRetries || !isTransientProviderError(error)) {
        throw error;
      }
      console.warn('workers-ai-retry', {
        model,
        attempt: attempt + 1,
        detail: sanitizedProviderDetail(error),
      });
      await sleep(350 * 2 ** attempt);
    }
  }
  throw lastError;
}

async function isAuthorized(request: Request, secret: string): Promise<boolean> {
  const header = request.headers.get('authorization');
  const token = header?.startsWith('Bearer ') === true ? header.slice('Bearer '.length) : '';
  const encoder = new TextEncoder();
  const [tokenHash, secretHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(token)),
    crypto.subtle.digest('SHA-256', encoder.encode(secret)),
  ]);
  const tokenBytes = new Uint8Array(tokenHash);
  const secretBytes = new Uint8Array(secretHash);
  let diff = 0;
  for (let i = 0; i < tokenBytes.length; i += 1) {
    diff |= (tokenBytes[i] ?? 0) ^ (secretBytes[i] ?? 0);
  }
  return diff === 0 && token.length > 0 && secret.length > 0;
}

function textField(form: FormData, name: string, fallback: string): string {
  const value = form.get(name);
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback;
}

function boundedNumberField({
  form,
  name,
  fallback,
  min,
  max,
}: {
  form: FormData;
  name: string;
  fallback: number;
  min: number;
  max: number;
}): string {
  const value = Number(textField(form, name, String(fallback)));
  if (!Number.isFinite(value)) return String(fallback);
  return String(Math.min(max, Math.max(min, Math.round(value))));
}

function boundedFloatField({
  form,
  name,
  fallback,
  min,
  max,
}: {
  form: FormData;
  name: string;
  fallback: number;
  min: number;
  max: number;
}): string {
  const value = Number(textField(form, name, String(fallback)));
  if (!Number.isFinite(value)) return String(fallback);
  return String(Math.min(max, Math.max(min, value)));
}

function appendReferenceImages(source: FormData, target: FormData): void {
  for (let index = 0; index < MAX_REFERENCE_IMAGES; index += 1) {
    const value = source.get(`input_image_${index}`);
    if (value instanceof File) {
      target.append(`input_image_${index}`, value, value.name || `input-${index}.jpg`);
    }
  }
}

function hasTooManyReferenceImages(source: FormData): boolean {
  for (const key of source.keys()) {
    const match = /^input_image_(\d+)$/.exec(key);
    if (match === null) continue;
    const index = Number(match[1]);
    if (Number.isInteger(index) && index >= MAX_REFERENCE_IMAGES) return true;
  }
  return false;
}

function fileField(form: FormData, name: string): File | null {
  const value = form.get(name);
  return value instanceof File ? value : null;
}

async function fileToDataUrl(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  const base64 = btoa(binary);
  const mimeType = file.type === '' ? 'image/jpeg' : file.type;
  return `data:${mimeType};base64,${base64}`;
}

function parseStylistPayload(result: unknown): unknown {
  if (typeof result !== 'object' || result === null) {
    return null;
  }
  const payload = result as StylistResponse;
  if (payload.recommendations !== undefined) {
    return { recommendations: payload.recommendations };
  }
  if (payload.response !== undefined) {
    if (typeof payload.response === 'string') {
      try {
        return JSON.parse(payload.response);
      } catch {
        return null;
      }
    }
    return payload.response;
  }
  return null;
}

async function handleImageRequest(env: WorkerEnv, incoming: FormData): Promise<Response> {
  const prompt = textField(incoming, 'prompt', '');
  if (prompt === '') {
    return jsonError({ code: 'bad_request', error: 'Missing prompt' }, 400);
  }
  if (hasTooManyReferenceImages(incoming)) {
    return jsonError(
      { code: 'bad_request', error: `Too many reference images; max is ${MAX_REFERENCE_IMAGES}` },
      400,
    );
  }

  const model = textField(incoming, 'model', DEFAULT_IMAGE_MODEL);
  const form = new FormData();
  form.append('prompt', prompt);
  form.append(
    'steps',
    boundedNumberField({ form: incoming, name: 'steps', fallback: 25, min: 1, max: 50 }),
  );
  form.append(
    'guidance',
    boundedFloatField({ form: incoming, name: 'guidance', fallback: 2, min: 1, max: 10 }),
  );
  form.append(
    'width',
    boundedNumberField({ form: incoming, name: 'width', fallback: 1024, min: 256, max: 1920 }),
  );
  form.append(
    'height',
    boundedNumberField({ form: incoming, name: 'height', fallback: 1024, min: 256, max: 1920 }),
  );
  appendReferenceImages(incoming, form);

  const serialized = new Response(form);
  const contentType = serialized.headers.get('content-type');
  if (contentType === null) {
    return jsonError({ code: 'internal_error', error: 'Could not serialize request' }, 500);
  }

  let result: FluxImageResponse;
  try {
    result = await runWorkersAiWithRetry<FluxImageResponse>(
      env,
      model,
      {
        multipart: {
          body: serialized.body,
          contentType,
        },
      },
      0,
    );
  } catch (error) {
    return providerError(error, 'image');
  }

  if (typeof result.image !== 'string' || result.image === '') {
    return jsonError({ code: 'provider_error', error: 'Workers AI returned no image' }, 502);
  }

  return jsonResponse({ image: result.image, mimeType: 'image/png', model });
}

async function handleStylistRequest(env: WorkerEnv, incoming: FormData): Promise<Response> {
  const question = textField(incoming, 'question', '');
  if (question === '') {
    return jsonError({ code: 'bad_request', error: 'Missing question' }, 400);
  }
  const systemPrompt = textField(incoming, 'system_prompt', '');
  if (systemPrompt === '') {
    return jsonError({ code: 'bad_request', error: 'Missing system prompt' }, 400);
  }
  const image = fileField(incoming, 'input_image_0');
  if (image === null) {
    return jsonError({ code: 'bad_request', error: 'Missing input image' }, 400);
  }

  const model = textField(incoming, 'model', DEFAULT_STYLIST_MODEL);
  const imageUrl = await fileToDataUrl(image);

  let result: unknown;
  try {
    result = await runWorkersAiWithRetry(
      env,
      model,
      {
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: question,
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl,
                },
              },
            ],
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: STYLIST_RESPONSE_SCHEMA,
        },
        max_tokens: 900,
        temperature: 0.35,
      },
      STYLIST_TRANSIENT_PROVIDER_RETRIES,
    );
  } catch (error) {
    return providerError(error, 'stylist');
  }

  const payload = parseStylistPayload(result);
  if (typeof payload !== 'object' || payload === null) {
    return jsonError(
      { code: 'provider_error', error: 'Workers AI returned invalid stylist payload' },
      502,
    );
  }

  return jsonResponse({ ...(payload as Record<string, unknown>), model });
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    if (request.method !== 'POST') {
      return jsonError({ code: 'method_not_allowed', error: 'Method not allowed' }, 405);
    }
    if (!(await isAuthorized(request, env.IMAGE_API_SECRET))) {
      return jsonError({ code: 'unauthorized', error: 'Unauthorized' }, 401);
    }

    let incoming: FormData;
    try {
      incoming = await request.formData();
    } catch {
      return jsonError({ code: 'bad_request', error: 'Expected multipart/form-data body' }, 400);
    }

    const pathname = new URL(request.url).pathname;

    try {
      if (pathname === '/stylist') {
        return await handleStylistRequest(env, incoming);
      }

      return await handleImageRequest(env, incoming);
    } catch (error) {
      console.error('worker-unhandled-error', error);
      return jsonError({ code: 'internal_error', error: 'Internal server error' }, 500);
    }
  },
};
