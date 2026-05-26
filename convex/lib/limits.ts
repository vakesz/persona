/**
 * Single source of truth for the app's hard limits. Imported on both halves
 * (Convex backend + Vite client) so a bump server-side propagates to the UI
 * without a drift-prone duplicate constant.
 *
 * Convex modules import from `./lib/limits`; the client imports from
 * `@convex/lib/limits` (path alias `@convex/*` → `convex/*`).
 */

export const MAX_AVATARS_PER_USER = 3;
// Cloudflare FLUX.2 [dev] on Workers AI accepts up to 4 image inputs.
export const MAX_SOURCE_PHOTOS = 4;

/**
 * Maximum number of in-flight (`queued` or `processing`) render jobs a single
 * user can have. Prevents a logged-in attacker from queueing thousands of
 * AI-provider calls.
 */
export const MAX_CONCURRENT_RENDERS_PER_USER = 5;

/**
 * Cap on un-consumed `pendingRenderInputs` rows per user. The studio's
 * happy-path consumes a claim within seconds; anything beyond this is either
 * abuse or a stuck client tab.
 */
export const MAX_PENDING_INPUTS_PER_USER = 10;

/**
 * Hard cap on the composed render prompt length (in characters). Defends
 * against pathological clients that paste huge text into the studio's custom
 * detail fields — those would bloat `renderJobs.inputJson` and the provider
 * payload.
 */
export const MAX_RENDER_PROMPT_LENGTH = 4000;

/**
 * Hard cap on the stylist-question length sent to the model. Matches the client
 * textarea's `maxLength` but enforced server-side too.
 */
export const MAX_STYLIST_QUESTION_LENGTH = 1000;

/**
 * Hard cap on the avatar `name` length.
 */
export const MAX_AVATAR_NAME_LENGTH = 80;

/**
 * Threshold (ms) after which queued work expires before any AI request is
 * allowed. Convex scheduled functions normally start quickly; if one has not
 * started after this window, require an explicit user retry instead of
 * spending provider quota unattended.
 */
export const QUEUED_GENERATION_EXPIRY_MS = 5 * 60 * 1000;

/**
 * Threshold (ms) after which a row stuck in `processing` is rescued by the
 * cron sweep — flips it back to `failed` with a structured error so the UI
 * stops showing a spinner forever. Generous vs. a typical AI render, but well
 * under the 14-day TTL sweep.
 */
export const STUCK_PROCESSING_THRESHOLD_MS = 15 * 60 * 1000;
