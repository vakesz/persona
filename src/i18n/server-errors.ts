import { msg } from '@lingui/core/macro';
import { ConvexError } from 'convex/values';

import { i18n } from './index';

import type { ServerErrorPayload } from '@convex/lib/errors';

type AnyMessage = ReturnType<typeof msg>;

/**
 * Translates a `ServerErrorPayload` (or JSON-encoded one stored in a DB field)
 * into a localized string using the active locale.
 */
function translateServerErrorPayload(payload: ServerErrorPayload): string {
  return i18n._(messageFor(payload));
}

/** Tries to extract a structured payload from a thrown value (mutation/action). */
function payloadFromError(error: unknown): ServerErrorPayload | null {
  if (error instanceof ConvexError) {
    const data: unknown = error.data;
    if (typeof data === 'object' && data !== null && 'code' in data) {
      return data as ServerErrorPayload;
    }
  }
  return null;
}

/**
 * Maps any thrown server error to a localized message. Falls back to a
 * generic string when the value isn't a structured `ConvexError`.
 */
export function translateServerError(error: unknown): string {
  const payload = payloadFromError(error);
  if (payload !== null) return translateServerErrorPayload(payload);
  return i18n._(msg`Something went wrong.`);
}

/**
 * Translates a JSON-encoded payload stored in a DB field (e.g.
 * `avatars.baselineErrorMessage`, `renderJobs.errorMessage`). If the string
 * isn't valid JSON for a known code, it is returned as-is — that covers
 * legacy rows that were written before structured codes.
 */
export function translateStoredErrorMessage(stored: string): string {
  try {
    const parsed: unknown = JSON.parse(stored);
    if (typeof parsed === 'object' && parsed !== null && 'code' in parsed) {
      return translateServerErrorPayload(parsed as ServerErrorPayload);
    }
  } catch {
    // not JSON — legacy plain string
  }
  return stored;
}

function messageFor(payload: ServerErrorPayload): AnyMessage {
  switch (payload.code) {
    case 'not_authenticated':
      return msg`You're not signed in.`;
    case 'name_required':
      return msg`Name is required.`;
    case 'pick_at_least_one_photo':
      return msg`Pick at least one photo.`;
    case 'too_many_photos':
      return msg`Pick at most ${payload.max} photos.`;
    case 'avatar_limit_reached':
      return msg`You can only have ${payload.max} avatars.`;
    case 'avatar_not_found':
      return msg`Avatar not found.`;
    case 'baseline_not_failed':
      return msg`Baseline is not in a failed state.`;
    case 'baseline_no_sources':
      return msg`Avatar has no source photos to retry from.`;
    case 'render_not_found':
      return msg`Render not found.`;
    case 'render_not_finished':
      return msg`Render is not finished.`;
    case 'prompt_required':
      return msg`Prompt is required.`;
    case 'reference_item_not_found':
      return msg`Reference item not found.`;
    case 'gemini_key_missing':
      return msg`GEMINI_API_KEY is not configured.`;
    case 'avatar_image_missing':
      return msg`Avatar image is missing from storage.`;
    case 'stylist_empty_response':
      return msg`Stylist returned an empty response.`;
    case 'stylist_malformed_json':
      return msg`Stylist returned malformed JSON.`;
    case 'stylist_missing_recommendations':
      return msg`Stylist response is missing recommendations.`;
    case 'stylist_malformed_recommendation':
      return msg`Stylist returned a malformed recommendation.`;
    case 'stylist_recommendation_missing_field':
      switch (payload.field) {
        case 'title':
          return msg`Stylist returned a recommendation without a title.`;
        case 'description':
          return msg`Stylist returned a recommendation without a description.`;
        case 'renderPrompt':
          return msg`Stylist returned a recommendation without a render prompt.`;
      }
      return msg`Stylist returned an incomplete recommendation.`;
    case 'stylist_recommendation_unknown_style':
      return msg`Stylist returned a recommendation with an unknown style type.`;
    case 'baseline_source_missing':
      return msg`A source photo is missing from storage.`;
    case 'baseline_blocked':
      return msg`Baseline generation was blocked: ${payload.reason}`;
    case 'baseline_no_image':
      return msg`Baseline generation returned no image.`;
    case 'render_blocked':
      return msg`Render was blocked: ${payload.reason}`;
    case 'render_no_image':
      return msg`Render returned no image.`;
    case 'reference_item_bytes_missing':
      return msg`Reference item bytes are missing from storage.`;
    case 'gemini_quota':
      return msg`Gemini quota reached for ${payload.operation}. Try again later, or upgrade billing.`;
    case 'gemini_auth':
      return msg`Gemini rejected the request for ${payload.operation} (HTTP ${payload.status}). Check your API key.`;
    case 'gemini_failed':
      return msg`Gemini failed for ${payload.operation} (HTTP ${payload.status}): ${payload.detail}`;
    case 'unknown_error':
      return msg`Something went wrong: ${payload.detail}`;
  }
}
