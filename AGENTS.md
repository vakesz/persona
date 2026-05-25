# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Stack at a glance

Vite + React 19 + TypeScript (strict, `exactOptionalPropertyTypes`) on the client; **Convex** for DB, file storage, realtime queries, scheduled actions, and auth (email/password via `@convex-dev/auth`). UI is shadcn/ui on Tailwind v4. The studio canvas is **React-Konva** for live makeup tints. AI calls go to **Cloudflare Workers AI** (Llama 3.2 vision for stylist recommendations, FLUX.2 for image generation/editing). i18n is **Lingui v6** with `en` + `hu`. In-browser face landmarks/segmentation come from **MediaPipe Tasks Vision**.

Node 22+, pnpm 11+.

## Commands

```bash
pnpm dev              # Vite dev server (port 5173)
pnpm convex           # Convex backend in watch mode — run in a second terminal
pnpm build            # i18n:compile + tsc -b + vite build
pnpm typecheck        # tsc -b across src + convex + node
pnpm lint             # ESLint (strict, type-checked)
pnpm format           # Prettier write
pnpm knip             # detect unused files/exports/deps
pnpm check            # i18n:compile + typecheck + lint + format:check + knip — MUST pass before every commit
pnpm i18n:extract     # collect strings from src/**, writes to locales/{en,hu}/messages.po
pnpm i18n:compile     # po → TS catalogs (locales/{locale}/messages.ts)
```

`pnpm check` is the gate. CI / pre-commit should treat any warning from it as a failure.

There are no test commands — the project has no test suite. Verify UI changes by running `pnpm dev` and exercising the feature in a browser.

Convex env vars (set with `npx convex env set NAME value`):

- `CONVEX_CF_IMAGE_WORKER_URL` — required for `ai.ts`
- `CONVEX_CF_IMAGE_WORKER_SECRET` — shared secret used by Convex and the Worker
- `CONVEX_CF_STYLIST_MODEL` — optional text+vision model override (default `@cf/meta/llama-3.2-11b-vision-instruct`)
- `CONVEX_CF_IMAGE_MODEL` — optional image model override (default `@cf/black-forest-labs/flux-2-dev`)

## Architecture

### Two halves: `src/` (Vite client) and `convex/` (Convex backend)

Path aliases: `@/*` → `src/*`, `@convex/*` → `convex/*` (set in `tsconfig.app.json` _and_ `vite.config.ts` — keep them in sync).

The client never imports Convex `internal*` symbols; it goes through `api.*` mutations/queries/actions. Auth-gated routes wrap their content in `<RequireAuth>` (`src/components/require-auth.tsx`); server functions enforce ownership independently.

### Convex data model (`convex/schema.ts`)

Every app row carries `userId: v.id('users')` and is indexed `by_user`. Every public query/mutation re-checks `avatar.userId === userId` after fetching — there is no row-level security to fall back on.

Tables:

- `avatars` — source photos + generated `baseImageStorageId` (the canonical portrait). Has `baselineStatus` (`queued` → `processing` → `done` / `failed`); the studio gates on `'done'`. Pre-Phase-8 rows have no `baselineStatus`; the read paths default to `'done'`.
- `renderJobs` — async image-render jobs. Status state machine identical to baseline. Indexed `by_updatedAt` for the TTL sweep.
- `savedLooks` — promoted renders the user kept. Re-uses the job's `resultStorageId` (no byte duplication).
- `uploadedItems` — clothing / nails / hair _reference_ images for try-on.
- `userPreferences` — side table for per-user locale (kept out of the Convex-Auth-owned `users` table).

### Async pipelines

Two long-running flows, both scheduled via `ctx.scheduler.runAfter(0, internal.…)` from a mutation, both using the same status state machine:

1. **Avatar baseline** — `createAvatar` mutation → `internal.ai.generateAvatarBaseline` action → Cloudflare FLUX.2 with `BASELINE_INSTRUCTION` → stores the result and patches `baselineStatus = 'done'`. `retryAvatarBaseline` re-queues a failed avatar.
2. **Render job** — `createRenderJob` mutation → `internal.ai.renderLook` action → Cloudflare FLUX.2 (single-image edit OR two-image try-on when `referenceUploadedItemId` is set) → stores the result and patches `status = 'done'`.

The render action accepts an optional `inputStorageId` — when set, the studio has uploaded a **flattened Konva canvas** (baseline + makeup tints) as the input so the model doesn't drop the makeup. That blob is **single-use** and gets `ctx.storage.delete`'d in the action's `finally` block whichever way it exited.

`crons.ts` runs `sweepStaleRenderJobs` hourly; jobs older than 14 days are deleted, and their `resultStorageId` blobs freed if no `savedLook` still references them.

### Studio composition model (`src/lib/studio/studio-state.ts`)

The studio has two kinds of edits:

- **Color tints** (lip / eyeshadow / blush / brow tint) — rendered live in `StudioCanvas` as Konva `<Path>` overlays clipped to MediaPipe-derived face polygons. These get _baked into the render input_ by exporting the Konva group as PNG and uploading it as `inputStorageId`.
- **Geometry plans** (lip shape, brow shape, beard, mustache, hairstyle, eyewear, headwear, jewelry, vibe, plus `selectedUploadId` for try-on) — described textually and concatenated into the render prompt by `composeRenderPrompt`. No client-side preview.

When _only_ geometry plans are set (no tints), the studio skips the PNG export and sends the canonical baseline directly. The flattening guarantee is in `studio.$avatarId.tsx` (`handleRender`) — search for `hasAnyTint`.

### Face data

`useAvatarFace` (in `src/lib/mediapipe/use-avatar-face.ts`) is the cache layer. If `avatar.landmarksJson` / `masksJson` are already populated in Convex, MediaPipe never runs. Otherwise it runs both Tasks Vision models in the browser against the baseline image, then persists the JSON via `saveAvatarLandmarks` so the next visit is free.

### Routing (TanStack Router)

File-based routes in `src/routes/`. The route tree is **auto-generated** into `src/routeTree.gen.ts` by `@tanstack/router-plugin/vite` — never edit it; restart `pnpm dev` if it stops regenerating. Routes use `defaultPreload: 'intent'`.

### i18n (Lingui v6)

- `<Trans>foo</Trans>` and `` t`foo` `` (from `useLingui`) are macros — they get transformed at build time by `@lingui/swc-plugin`.
- `pnpm i18n:extract` then translate `src/i18n/locales/hu/messages.po`, then `pnpm i18n:compile` to regenerate `messages.ts`. `pnpm check` (and `pnpm build`) run `i18n:compile` first so stale catalogs don't break the build.
- Active locale is decided by `src/i18n/detect.ts` (URL / localStorage / browser), persisted to `userPreferences` for signed-in users.
- Generated catalog files (`src/i18n/locales/**/messages.ts`) are ESLint-ignored.

### Server errors

Convex code **never throws localized strings**. Throw structured `ConvexError`s via the `errors` helper in `convex/lib/errors.ts` (e.g. `errors.avatarNotFound()`). The `ServerErrorPayload` union there is the source of truth — adding a new code forces a matching arm in `src/i18n/server-errors.ts`'s `messageFor`. Two client entry points:

- `translateServerError(error)` — for thrown errors caught in `.catch(...)`.
- `translateStoredErrorMessage(stored)` — for the JSON payloads stored in `avatars.baselineErrorMessage` / `renderJobs.errorMessage`.

### Storage cleanup

Storage blobs aren't reference-counted by Convex, so cleanup is explicit:

- `cascadeDeleteAvatar` (exported from `convex/avatars.ts`) is the single source of truth for tearing down an avatar and every blob it owns. `deleteAvatar` and `deleteAccount` both call it.
- `createAvatar` validates _after_ receiving storage IDs — `cleanupOnReject` deletes the just-uploaded blobs on validation failure so they don't orphan.
- The render action `finally`-block deletes the single-use `inputStorageId`.

## Conventions and gotchas

- **`exactOptionalPropertyTypes` is on.** Don't pass `undefined` to an optional field; use conditional spread: `...(x !== undefined && { x })`. See `convex/renderJobs.ts:55` and the studio render call for the pattern.
- **`noUncheckedIndexedAccess` is on.** Indexing arrays / records yields `T | undefined`; narrow before use.
- The Convex action runtime in V8 doesn't expose `process` on `globalThis` under `@types/node v25` — actions that need env vars declare a local shim: `declare const process: { env: Record<string, string | undefined> };` (see `convex/ai.ts:12`).
- `convex/_generated/**` is auto-generated by `npx convex dev`; never edit. `src/routeTree.gen.ts` likewise.
- shadcn/ui primitives live in `src/components/ui/` — they're knip-ignored and ESLint-relaxed (no `react-refresh/only-export-components` warning) since they re-export utilities alongside components.
- Don't add `Co-Authored-By: Codex` (or any Codex attribution) to commit messages.
- The hard limits enforced server-side: 3 avatars/user, 5 source photos/avatar (`MAX_AVATARS_PER_USER` / `MAX_SOURCE_PHOTOS` in `convex/avatars.ts`).
