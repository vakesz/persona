import { ConvexError } from 'convex/values';

/**
 * Structured server error codes. The client maps these to translated user-facing
 * strings via `src/i18n/server-errors.ts`. Server stays locale-agnostic.
 *
 * Add new codes by extending the union below — TypeScript then forces a
 * matching client-side translation.
 */
export type ServerErrorPayload =
  | { code: 'not_authenticated' }
  | { code: 'name_required' }
  | { code: 'pick_at_least_one_photo' }
  | { code: 'too_many_photos'; max: number }
  | { code: 'avatar_limit_reached'; max: number }
  | { code: 'avatar_not_found' }
  | { code: 'baseline_not_failed' }
  | { code: 'baseline_no_sources' }
  | { code: 'render_not_found' }
  | { code: 'render_not_finished' }
  | { code: 'prompt_required' }
  | { code: 'reference_item_not_found' }
  | { code: 'avatar_image_missing' }
  | { code: 'stylist_empty_response' }
  | { code: 'stylist_malformed_json' }
  | { code: 'stylist_missing_recommendations' }
  | { code: 'stylist_malformed_recommendation' }
  | {
      code: 'stylist_recommendation_missing_field';
      field: 'title' | 'description' | 'renderPrompt';
    }
  | { code: 'stylist_recommendation_unknown_style' }
  | { code: 'baseline_source_missing' }
  | { code: 'baseline_blocked'; reason: string }
  | { code: 'baseline_no_image' }
  | { code: 'render_blocked'; reason: string }
  | { code: 'render_no_image' }
  | { code: 'reference_item_bytes_missing' }
  | { code: 'image_provider_key_missing'; provider: string }
  | { code: 'image_provider_auth'; provider: string; operation: string; status: number }
  | { code: 'image_provider_quota'; provider: string; operation: string }
  | { code: 'image_provider_unavailable'; provider: string; operation: string; detail: string }
  | {
      code: 'image_provider_failed';
      provider: string;
      operation: string;
      status: number;
      detail: string;
    }
  | { code: 'render_concurrency_exceeded'; max: number }
  | { code: 'baseline_not_ready' }
  | { code: 'prompt_too_long'; max: number }
  | { code: 'render_input_already_claimed' }
  | { code: 'render_input_limit_exceeded'; max: number }
  | { code: 'generation_expired' }
  | { code: 'render_stuck' }
  | { code: 'unknown_error'; detail: string };

export const errors = {
  notAuthenticated: () => new ConvexError<ServerErrorPayload>({ code: 'not_authenticated' }),
  nameRequired: () => new ConvexError<ServerErrorPayload>({ code: 'name_required' }),
  pickAtLeastOnePhoto: () =>
    new ConvexError<ServerErrorPayload>({ code: 'pick_at_least_one_photo' }),
  tooManyPhotos: (max: number) =>
    new ConvexError<ServerErrorPayload>({ code: 'too_many_photos', max }),
  avatarLimitReached: (max: number) =>
    new ConvexError<ServerErrorPayload>({ code: 'avatar_limit_reached', max }),
  avatarNotFound: () => new ConvexError<ServerErrorPayload>({ code: 'avatar_not_found' }),
  baselineNotFailed: () => new ConvexError<ServerErrorPayload>({ code: 'baseline_not_failed' }),
  baselineNoSources: () => new ConvexError<ServerErrorPayload>({ code: 'baseline_no_sources' }),
  renderNotFound: () => new ConvexError<ServerErrorPayload>({ code: 'render_not_found' }),
  renderNotFinished: () => new ConvexError<ServerErrorPayload>({ code: 'render_not_finished' }),
  promptRequired: () => new ConvexError<ServerErrorPayload>({ code: 'prompt_required' }),
  referenceItemNotFound: () =>
    new ConvexError<ServerErrorPayload>({ code: 'reference_item_not_found' }),
  avatarImageMissing: () => new ConvexError<ServerErrorPayload>({ code: 'avatar_image_missing' }),
  stylistEmptyResponse: () =>
    new ConvexError<ServerErrorPayload>({ code: 'stylist_empty_response' }),
  stylistMalformedJson: () =>
    new ConvexError<ServerErrorPayload>({ code: 'stylist_malformed_json' }),
  stylistMissingRecommendations: () =>
    new ConvexError<ServerErrorPayload>({ code: 'stylist_missing_recommendations' }),
  stylistMalformedRecommendation: () =>
    new ConvexError<ServerErrorPayload>({ code: 'stylist_malformed_recommendation' }),
  stylistRecommendationMissingField: (field: 'title' | 'description' | 'renderPrompt') =>
    new ConvexError<ServerErrorPayload>({ code: 'stylist_recommendation_missing_field', field }),
  stylistRecommendationUnknownStyle: () =>
    new ConvexError<ServerErrorPayload>({ code: 'stylist_recommendation_unknown_style' }),
  baselineSourceMissing: () =>
    new ConvexError<ServerErrorPayload>({ code: 'baseline_source_missing' }),
  baselineBlocked: (reason: string) =>
    new ConvexError<ServerErrorPayload>({ code: 'baseline_blocked', reason }),
  baselineNoImage: () => new ConvexError<ServerErrorPayload>({ code: 'baseline_no_image' }),
  renderBlocked: (reason: string) =>
    new ConvexError<ServerErrorPayload>({ code: 'render_blocked', reason }),
  renderNoImage: () => new ConvexError<ServerErrorPayload>({ code: 'render_no_image' }),
  referenceItemBytesMissing: () =>
    new ConvexError<ServerErrorPayload>({ code: 'reference_item_bytes_missing' }),
  imageProviderKeyMissing: (provider: string) =>
    new ConvexError<ServerErrorPayload>({ code: 'image_provider_key_missing', provider }),
  imageProviderAuth: (provider: string, operation: string, status: number) =>
    new ConvexError<ServerErrorPayload>({
      code: 'image_provider_auth',
      provider,
      operation,
      status,
    }),
  imageProviderQuota: (provider: string, operation: string) =>
    new ConvexError<ServerErrorPayload>({ code: 'image_provider_quota', provider, operation }),
  imageProviderUnavailable: (provider: string, operation: string, detail: string) =>
    new ConvexError<ServerErrorPayload>({
      code: 'image_provider_unavailable',
      provider,
      operation,
      detail,
    }),
  imageProviderFailed: (provider: string, operation: string, status: number, detail: string) =>
    new ConvexError<ServerErrorPayload>({
      code: 'image_provider_failed',
      provider,
      operation,
      status,
      detail,
    }),
  renderConcurrencyExceeded: (max: number) =>
    new ConvexError<ServerErrorPayload>({ code: 'render_concurrency_exceeded', max }),
  baselineNotReady: () => new ConvexError<ServerErrorPayload>({ code: 'baseline_not_ready' }),
  promptTooLong: (max: number) =>
    new ConvexError<ServerErrorPayload>({ code: 'prompt_too_long', max }),
  renderInputAlreadyClaimed: () =>
    new ConvexError<ServerErrorPayload>({ code: 'render_input_already_claimed' }),
  renderInputLimitExceeded: (max: number) =>
    new ConvexError<ServerErrorPayload>({ code: 'render_input_limit_exceeded', max }),
  generationExpired: () => new ConvexError<ServerErrorPayload>({ code: 'generation_expired' }),
  renderStuck: () => new ConvexError<ServerErrorPayload>({ code: 'render_stuck' }),
};

/**
 * Extracts a `ServerErrorPayload` from any thrown value.
 *
 * Prefers the `instanceof ConvexError` check, but also accepts any value that
 * structurally exposes a `data` field with a `code`. That covers errors that
 * cross an action → mutation boundary, where the prototype chain isn't always
 * preserved by the Convex runtime — without this fallback, those would
 * collapse to `unknown_error` and lose the structured payload.
 */
export function errorPayloadFromUnknown(error: unknown): ServerErrorPayload {
  if (error instanceof ConvexError) {
    const data: unknown = error.data;
    if (typeof data === 'object' && data !== null && 'code' in data) {
      return data as ServerErrorPayload;
    }
  }
  if (typeof error === 'object' && error !== null && 'data' in error) {
    const { data } = error;
    if (typeof data === 'object' && data !== null && 'code' in data) {
      return data as ServerErrorPayload;
    }
  }
  if (error instanceof Error) {
    return { code: 'unknown_error', detail: error.message };
  }
  return { code: 'unknown_error', detail: String(error) };
}

/** Encodes a thrown value as a JSON string for storage in DB error fields. */
export function serializeError(error: unknown): string {
  return JSON.stringify(errorPayloadFromUnknown(error));
}
