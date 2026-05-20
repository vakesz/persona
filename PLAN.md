# MVP Plan: 2.5D AI Stylist App

## Stack

```
Vite
React
TypeScript
TanStack Router
TanStack Query (optional)
shadcn/ui
Tailwind CSS
Convex
Convex Auth or Clerk
React-Konva
MediaPipe Tasks (FaceLandmarker + ImageSegmenter)
Gemini API (Flash Lite for text/vision, Flash Image for image edit)
```

With Convex, you may not need much TanStack Query because Convex already gives
realtime reactive queries. Keep TanStack Router, but use Convex queries/mutations
for backend state.

---

## Product Goal

User can:

```
Create 1–3 private avatars
See themselves on a 2.5D canvas
Try hairstyles, makeup, nails, clothes, shoes
Upload clothing images
Ask AI what would suit them
Manually adjust overlays
Click Render for realistic AI output
Save looks
Keep recent tried items
```

---

## Core User Flow

```
Sign up
→ Create avatar
→ Upload selfie or full-body photo
→ App creates personal canvas
→ User sees themselves
→ User applies hair/nails/makeup/clothes
→ User manually adjusts layers
→ User clicks Render
→ Convex creates render job
→ AI provider returns image
→ Convex updates job in realtime
→ User saves final look
```

---

## Architecture

```
React app
→ Convex auth/session
→ Convex database
→ Convex file storage
→ Convex actions for AI calls
→ MediaPipe runs in browser
→ React-Konva renders 2.5D editor
```

---

## App Pages

```
/                         landing
/auth                     login/signup
/avatars                  avatar list
/avatars/new              create avatar
/studio/$avatarId         main editor
/stylist/$avatarId        AI stylist chat/recommendations
/saved                    saved looks
/settings                 account/privacy
```

---

## Convex Data Model

### users

Usually managed through auth, but app data can be mirrored:

```
auth_user_id
display_name
email
plan
created_at
```

### avatars

```
user_id
name
type: selfie | full_body
source_photo_storage_ids: array (1–5)      ← raw uploads, used to generate the baseline
base_image_storage_id                        ← canonical baseline portrait (Gemini-generated)
thumbnail_storage_id
landmarks_json                               ← MediaPipe FaceLandmarker on the baseline
masks_json                                   ← MediaPipe ImageSegmenter on the baseline
baseline_status: queued | processing | done | failed
baseline_error_message
created_at
updated_at
```

Rules:

```
Max 3 avatars per user
Only owner can read/write
Deleting avatar cascades source photos + baseline + thumbnail +
  recentItems + savedLooks + renderJobs and every referenced _storage blob
Deleting account cascades every avatar plus uploadedItems and the auth identity
```

### recent_items

```
user_id
avatar_id
type: hair | nails | makeup | clothes | shoes | accessory
source: uploaded | generated | suggested
prompt
image_storage_id
settings_json
created_at
```

Keep only last 10–20 per avatar.

### saved_looks

```
user_id
avatar_id
preview_storage_id
render_storage_id
metadata_json
created_at
```

### render_jobs

```
user_id
avatar_id
status: queued | processing | done | failed
provider
input_json
result_storage_id
error_message
created_at
updated_at
```

### uploaded_items

For user-uploaded dresses/shoes/etc:

```
user_id
type: dress | top | shoes | nails_reference | hair_reference
image_storage_id
label
created_at
```

---

## Convex Functions

### Queries

```
getCurrentUser
listAvatars
getAvatar
listRecentItems
listSavedLooks
getRenderJob
listUploadedItems
```

### Mutations

```
createAvatar
updateAvatar           ← rename only
deleteAvatar           ← cascade delete (Phase 12)
saveRecentItem         ← prunes by count + crons.ts prunes by age
saveLookFromJob
deleteSavedLook
createRenderJob
markRenderJobDone
markRenderJobFailed
deleteAccount          ← full user cascade + Convex Auth deletion (Phase 12)
saveAvatarLandmarks    ← write MediaPipe output (Phase 9)
```

### Actions

Use Convex actions for external APIs:

```
analyzeStyleWithGemini      ← Gemini 2.5 Flash Lite (text + vision)
renderLookWithGemini        ← Gemini 2.5 Flash Image (image edit / try-on)
generateAvatarBaseline      ← Gemini 2.5 Flash Image (multi-image → canonical portrait, Phase 8)
generateUploadUrl
```

### Crons (Phase 12)

```
sweepStaleRenderJobs        ← hourly: delete renderJobs older than 14d not promoted to a look
sweepOldRecentItems         ← daily: delete recentItems older than 30d
```

---

## Image Upload Flow

```
User selects photo
→ browser compresses/resizes
→ Convex generates upload URL
→ image uploads to Convex storage
→ frontend runs MediaPipe landmarks
→ createAvatar mutation saves image + landmarks
→ user enters studio
```

---

## 2.5D Studio

### Canvas layers (Phase 10 redesign)

```
Baseline portrait (canonical, Gemini-generated)
Makeup tint layer        ← Konva paths clipped to MediaPipe lip/eye/brow/cheek polygons
Mask correction layer    ← brush nudges where MediaPipe got a region wrong
Pending render preview   ← flattened-to-PNG snapshot sent to Gemini Flash Image
```

There is no free-position drag layer. Color tools clip to face geometry;
geometry-changing tools (beard, mustache, hairstyle) go through AI render.

Use: React-Konva

### Editor tools (Phase 10 redesign)

```
Per-tool color picker      ← lips, eyes, brows, cheeks, nails
Per-tool finish            ← matte / satin / gloss (lips)
Per-tool intensity slider
Reset tool / Clear all tools
Before/after slider against the baseline
Undo / redo per tool state
Erase/restore brush on the mask correction layer
```

Keep canvas movement local. Do not write every drag movement to Convex.

Save only:

```
when user saves look
when user tries an item
when render starts
```

---

## AI Stylist

User asks:

```
What nails suit me?
What hairstyle should I try?
What clothes would look good on me?
Upload this dress and show me
```

Flow:

```
User asks question
→ Convex action sends avatar image/reference to Gemini
→ Gemini returns recommendations
→ frontend shows cards
→ user clicks Preview or Render
```

Recommendation card contains:

```
title
description
style_type
colors
prompt
preview_settings
render_prompt
```

---

## Preview vs Render

### Preview mode

```
Fast / Cheap / In-browser / Landmark-anchored / Editable
```

Used for: makeup color (lips, brows, eyes, cheeks) and nail color — tinted in
the browser, clipped to MediaPipe FaceLandmarker polygons. No free-position
overlays. Cost: zero per change.

### Render mode

```
Slower / Costs money / Calls AI image provider / Returns polished realistic image
```

Triggered only by user button: `Render Look`. Used for every geometry-changing
change: beard, mustache, hairstyle, clothing try-on. Input is the _flattened_
canvas (baseline + applied color tints), so AI renders stack on top of
whatever makeup the user already applied.

---

## AI Render Flow

```
User clicks Render
→ createRenderJob mutation
→ Convex action starts provider request
→ job status = processing
→ provider returns image
→ Convex stores final image
→ job status = done
→ UI updates automatically
```

---

## Frontend Folder Structure

```
src/
  main.tsx
  router.tsx
  routes/
    __root.tsx
    index.tsx
    auth.tsx
    avatars.index.tsx
    avatars.new.tsx
    studio.$avatarId.tsx
    stylist.$avatarId.tsx
    saved.tsx
    settings.tsx
  components/
    ui/
    studio/
      avatar-stage.tsx
      canvas-layer.tsx
      layer-transformer.tsx
      bottom-toolbar.tsx
      style-tabs.tsx
      render-button.tsx
      adjustment-panel.tsx
    avatars/
      avatar-card.tsx
      avatar-uploader.tsx
    stylist/
      recommendation-card.tsx
      prompt-box.tsx
  lib/
    mediapipe/ { face.ts, hands.ts, pose.ts, segmentation.ts }
    canvas/ { layer-types.ts, transforms.ts, masks.ts }
    ai/ { prompts.ts }
  types/ { avatar.ts, look.ts, canvas.ts, ai.ts }
```

---

## Convex Folder Structure

```
convex/
  schema.ts
  auth.ts
  avatars.ts
  recentItems.ts
  savedLooks.ts
  renderJobs.ts
  uploadedItems.ts
  ai.ts
  storage.ts
  crons.ts
```

---

## Build Order

### Phase 1 — Foundation ✅ Done

Vite React setup, TanStack Router, shadcn/ui, Convex setup, Auth,
Protected routes, Basic layout.
Goal: User can sign in.

Implemented: strict-TS Vite/React project; file-based routes for every page
in the plan; Convex schema for the full data model; Convex Auth (password) with
sign-in/sign-up; `RequireAuth` route guard; auth-aware app shell; `getCurrentUser`
query wired into `/settings`. `pnpm check` and `pnpm build` pass green.
Run `npx convex dev` then `npx @convex-dev/auth` to make auth live.

### Phase 2 — Avatar Creation ✅ Done

Upload image, compress in browser, store in Convex storage, create avatar
record, show avatar list, limit to 3 avatars.
Goal: User can create private avatars.

Implemented: `convex/storage.ts:generateUploadUrl` (auth-gated mutation),
`convex/avatars.ts:{listAvatars, createAvatar}` (owner-scoped, 3-avatar
limit enforced server-side with storage cleanup on rejection),
`src/lib/image-compression.ts` (canvas re-encode → strips EXIF + caps
2048 px base / 512 px thumbnail), self-contained `AvatarCard` and
`AvatarUploader` components, and avatar list / create routes with realtime
limit awareness via Convex queries. `pnpm check` + `pnpm build` pass green.

### Phase 3 — Personal Canvas ✅ Done

Build /studio/$avatarId, load avatar image, render in React-Konva, add
zoom/pan, layer system, mobile touch support.
Goal: User sees themselves on an editable canvas.

Implemented: `convex/avatars.ts:getAvatar` (owner-scoped, returns a signed
base-image URL); self-contained `StudioCanvas` component using
React-Konva — `ResizeObserver`-driven responsive Stage, fit-to-container
initial layout, mouse-wheel zoom around pointer, two-finger pinch zoom for
mobile, draggable pan, single Konva `Layer` ready to receive Phase 4
overlays. Konva (≈ 310 kB) is isolated in the studio route chunk via
`autoCodeSplitting`. `pnpm check` + `pnpm build` pass green.

### Phase 4 — Manual Styling ✅ Done

Sample hairstyle/makeup/nail overlays, drag/scale/rotate/opacity controls,
save recent tried items.
Goal: User can customize their own image without AI cost.

Implemented: built-in inline-SVG sample overlays (2 hair, 2 makeup, 1 nail)
via `src/lib/studio/sample-overlays.ts`; canonical `CanvasLayer` type and
defaults in `src/lib/studio/layers.ts`; `useImage` hook for any Konva
image. Studio canvas now renders each layer with drag, plus a Konva
`Transformer` for scale/rotate on the selected layer; click empty stage
to deselect. `StylePalette` provides Hair/Makeup/Nails/Recent tabs;
picking a sample drops a centered layer and writes a `recentItems` entry
(prompt + serialized layer settings). `LayerControls` exposes an opacity
slider and a remove button when a layer is selected.
`convex/recentItems.ts` exposes `listRecentItems` and `saveRecentItem`
(owner-scoped, prunes to 20 per avatar). `pnpm check` + `pnpm build` pass
green; Konva still isolated in the per-route chunk.

### Phase 5 — AI Stylist ✅ Done

Stylist prompt box, Gemini action, analyze avatar image, return suggestions,
recommendation cards.
Goal: User can ask what suits them.

Model: **Gemini 2.5 Flash Lite** (free-tier friendly). Override with the
`CONVEX_GEMINI_MODEL` env var. Phase 6 takes a recommendation's
`renderPrompt` and turns it into an actual rendered look.

Implemented: `convex/ai.ts:analyzeStyleWithGemini` action — fetches the
owner's avatar bytes via an `internalQuery` helper in `convex/avatars.ts`,
sends an inline image + question to Gemini via direct REST (no SDK
dependency), uses `responseSchema` JSON mode for reliable structured
output (title / description / styleType / renderPrompt). Self-contained
`RecommendationCard` component plus `/stylist/$avatarId` route with a
prompt box and quick-prompt chips. Stylist chunk is ~4 kB gzipped (no
Konva pulled in). `pnpm check` + `pnpm build` pass green.

### Phase 6 — AI Render ✅ Done

render_jobs table, render action, send image + prompt to provider, store
result, realtime job updates, save final look.
Goal: User gets a polished realistic image.

Provider: **Gemini 2.5 Flash Image** (multimodal output — accepts the
avatar photo plus a text prompt and returns an edited image). Same free
Gemini API key as Phase 5; the model is overridable via
`CONVEX_GEMINI_IMAGE_MODEL`.

Implemented: `convex/renderJobs.ts` (createRenderJob mutation auto-schedules
the internal action; internal helpers for status transitions; getRenderJob
query returns a signed result URL once done). `convex/ai.ts:renderLookWithGemini`
internal action fetches the avatar bytes via the internalQuery from Phase 5,
calls Gemini Flash Image with `responseModalities: ["IMAGE"]`, decodes the
returned inline base64 into a blob, stores it, and patches the job to
`done` (or `failed` with the error). `convex/savedLooks.ts` exposes
`listSavedLooks`, `saveLookFromJob` (promotes the job's storage ref —
no byte copy), and `deleteSavedLook` (cascades the storage delete).
Self-contained `RenderResult` component handles the queued/processing/done/failed
states reactively; `RecommendationCard` got a "Render this look" button.
`/saved` route renders the gallery with per-look delete. `pnpm check` +
`pnpm build` pass green.

### Phase 7 — Clothing Upload ✅ Done

Upload clothing image, store as uploaded_item, show in studio, rough overlay
preview, manual adjustment, final AI try-on render.
Goal: User can upload a dress and try it on.

Implemented: `convex/uploadedItems.ts` (listUploadedItems, createUploadedItem,
deleteUploadedItem, internalQuery `getUploadedItemStorageForUser`). The
existing `createRenderJob` mutation now accepts an optional
`referenceUploadedItemId`; the render action branches to a dedicated
two-image prompt (`TRY_ON_INSTRUCTION`) sending avatar + reference image to
Gemini Flash Image. `CanvasLayer` carries a discriminated `origin` field
(`sample` or `upload`), so the same drag/transform/opacity machinery serves
both kinds of layer. New `Uploads` palette tab + self-contained
`UploadedItemUploader` widget (re-uses the EXIF-stripping
`processAvatarImage`). `LayerControls` exposes a conditional "Try this on"
button that only appears when the selected layer is an upload. Render
result reuses the Phase 6 `RenderResult` component, now lifted to
`src/components/render/` since both stylist and studio consume it.
`pnpm check` + `pnpm build` pass green.

---

## Studio Redesign (Phases 8–12)

The first seven phases got the app to "see yourself + drop draggable
overlays". Phase 4 cut a corner: it shipped free-position SVG sample
overlays instead of landmark-anchored tools, which makes the studio feel
like collage. Phases 8–12 fix that and finish promises PLAN.md already
made but earlier phases skipped.

Order: **Phase 12 → 8 → 9 → 10 → 11**. Phase 12 lands first because Phase 8
churns the avatar schema and doubles the storage footprint per avatar —
cascade-delete needs to exist before that lands so we don't accumulate
orphan blobs.

Q1 / Q3 interpretation (2026-05-20 planning): generate the canonical baseline
**and** compute landmarks/masks against that baseline. Q1 rejected the
"smart-masked original photo" base, not MediaPipe entirely; Q3 needs landmarks
to drive the live color preview. Running landmarks on the _baseline_ (not the
upload) means the geometry matches what the user sees in the canvas.

### Phase 12 — Privacy & lifecycle

Cascade-delete avatars, allow account deletion, sweep stale renders + recent
items via crons. Lands first so Phase 8's new storage footprint doesn't leak.

Scope:

- `deleteAvatar` mutation — cascades source photos, baseline, thumbnail,
  recentItems (+ imageStorageId), savedLooks (+ previewStorageId,
  renderStorageId), renderJobs (+ resultStorageId).
- `updateAvatar` mutation — rename only.
- `deleteAccount` mutation — cascades every avatar (via the same path) plus
  uploadedItems, then deletes the Convex Auth identity.
- `convex/crons.ts`:
  - hourly: delete renderJobs older than 14 days that were never promoted to
    a savedLook (+ resultStorageId);
  - daily: delete recentItems older than 30 days (+ imageStorageId).
- `AvatarCard` gets a three-dot menu (rename / delete with confirm).
- `/settings` Account section: real avatar list with delete + a Delete
  account dialog. Drop the `ComingSoon` placeholder.

### Phase 8 — Multi-photo avatar + canonical baseline

Goal: User uploads 1–5 photos; the studio canvas is a Gemini-generated
canonical portrait, not the raw selfie.

Scope:

- Schema: add `sourcePhotoStorageIds: v.array(v.id('_storage'))`,
  `baselineStatus`, `baselineErrorMessage`. Repurpose `baseImageStorageId` to
  the _generated baseline_ (no longer the upload).
- `AvatarUploader` becomes a multi-file picker (1–5) with per-file thumbnail
  - remove. Each file goes through the existing
    `processAvatarImage` (compress + EXIF-strip).
- `createAvatar` accepts the storage-ID array, inserts the row in
  `baselineStatus: 'queued'`, schedules `internal.ai.generateAvatarBaseline`.
- New action `generateAvatarBaseline`: fetches all source photo bytes; calls
  Gemini Flash Image with a fixed studio-portrait prompt + 1–5 inline images;
  stores the result as the baseline; flips status to `done`. On failure
  records `baselineErrorMessage` and flips to `failed`. Source-photo blobs
  are cleaned up if the schedule fails to even start.
- Avatar list shows a "Preparing your portrait…" state while
  `baselineStatus !== 'done'`. Studio gates entry until ready.
- Cascade-delete from Phase 12 extended to walk `sourcePhotoStorageIds`.

Cost: 1 Flash Image call per avatar (max 3 per user). Stays well inside the
free tier for personal use.

### Phase 9 — Landmarks + masks (finish Phase 3's promise)

Goal: populate the `landmarksJson` / `masksJson` fields the schema already
declares but Phase 3 left empty.

Library: `@mediapipe/tasks-vision` (current Tasks Web API — not the legacy
`face-mesh` package). Lazy-loaded inside the studio chunk only.

Scope:

- `src/lib/mediapipe/face.ts` — `runFaceLandmarker(image)` returns 478 points
  - per-feature polygons (lipsOuter, lipsInner, leftEye, rightEye, leftBrow,
    rightBrow, leftCheek, rightCheek, faceOval).
- `src/lib/mediapipe/segmentation.ts` — `runImageSegmenter(image)` returns
  hair / skin / background masks (multiclass selfie segmenter).
- Studio runs both once on the baseline after Phase 8 completes, then writes
  the serialized JSON via a new `saveAvatarLandmarks` mutation.
- IndexedDB cache keyed by `avatarId + baselineStorageId` so subsequent
  visits skip recompute.
- Mask correction brush: when MediaPipe's polygon misses (e.g. clips through
  a mole), a brush on the mask correction layer adds/removes coverage. The
  correction is persisted with the landmarks.

Privacy: MediaPipe runs entirely in-browser. Only serialized JSON crosses
the wire; no per-pixel masks are uploaded to Convex.

### Phase 10 — Feature-anchored studio (replaces Phase 4 layers)

Goal: real-feeling makeup application, AI render for everything else.

Delete:

- `src/lib/studio/sample-overlays.ts`
- The free-position drag / `Konva.Transformer` machinery in `StudioCanvas`
- `src/components/studio/style-palette.tsx` (Hair/Makeup/Nails drag-anywhere tabs)
- `src/components/studio/layer-controls.tsx` opacity/remove on draggable layers

Build (color tools — live in-browser preview, zero AI cost per change):

- `LipColorTool` — Konva `Path` from lipsOuter minus lipsInner, blended with
  the baseline via `globalCompositeOperation: 'multiply'`. Finish toggle:
  matte / satin / gloss (highlight overlay polygon).
- `EyeshadowTool` — path between brow and eye polygons; multiply blend +
  intensity slider.
- `BlushTool` — feathered radial gradient clipped to cheek region.
- `BrowTintTool` — path along brow polygon; color + opacity.
- (Nail tool needs hand landmarks — defer.)

Build (geometry tools — AI render only, no drag handles):

- `BeardTool`, `MustacheTool`, `HairstyleTool` are prompt-builders.
  Categorical pickers (e.g. _full / goatee / stubble_; _pixie / bob /
  undercut / waves_) + optional free-text input.
- On render click, the Konva stage is exported to PNG, uploaded to Convex
  storage, and passed to Gemini Flash Image as the input image. Tints
  baked-in to the AI render input means beards land on top of any lipstick
  the user already chose.
- `renderLookWithGemini` accepts an optional `inputStorageId` override; if
  present, reads from there instead of `avatar.baseImageStorageId`.

State: a single typed `studioState` (lip / eye / brow / cheek entries +
queued geometry prompts) replaces per-layer identity. Save look writes both
the flattened-preview PNG and the AI-rendered PNG to `savedLooks`.

### Phase 11 — Studio polish ✅ Done

- `recentItems` deleted entirely (table, queries, mutation, cron). With
  Phase 10 there's nothing left to "remember" per-avatar — saved looks are
  the durable artefact. Cleaner schema, less storage to GC.
- Before/after slider — vertical wipe across the canvas. Tints are clipped
  to the right of the handle; the left half shows the canonical baseline.
- Studio sidebar reorganized in Phase 10: Lips / Eyes / Brows / Cheeks /
  Beard / Mustache / Hair / Uploads.
- Undo / redo deferred — `Reset all tools` covers most "I want to start
  over" cases. Pick up when granular history pays its own complexity cost.

---

## Low-Budget Strategy

Do in browser: image resize, compression, landmark detection, preview canvas,
manual adjustments, basic masking.

Use paid APIs only for: style advice, final render, virtual try-on.

---

## Privacy Requirements

```
Owner-only access checks in every Convex function
Do not expose public image URLs casually
Strip EXIF before upload
Compress images before upload
Delete unused renders
Add account/avatar delete
Clear recent items automatically
```

---

## What to Build First

First usable MVP: Sign in → Create avatar → See yourself on canvas → Apply
sample hair/makeup/nail overlays → Ask AI what suits me → Save last tried
items → Render one polished final image → Save look.

Delay: full outfit try-on, shoes, payments, public sharing, marketplace,
advanced body adjustment, video, real 3D.

---

## Final MVP Positioning

> Upload a photo, see yourself instantly, and try AI-suggested hairstyles,
> nails, makeup, and outfits on your own image.

---

## Engineering Principles (non-negotiable bar)

These apply to **every** change in this repo. `pnpm check` is the gate.

1. **Modern best practices and patterns throughout, always.** React 19
   idioms, current Convex APIs, current TanStack Router APIs. No deprecated
   APIs even when they still work.
2. **Strict TypeScript.** `strict` + `noUncheckedIndexedAccess` +
   `exactOptionalPropertyTypes` + `noPropertyAccessFromIndexSignature` +
   `erasableSyntaxOnly` stay on. Fix type errors at the root — never widen
   to `any` to get past them.
3. **Simple and clean.** No premature abstractions, no "for future
   flexibility" wrappers, no dead code paths. Three similar lines beats a
   clever abstraction.
4. **Properly organized.** `src/routes/`, `src/components/<feature>/`,
   `src/lib/<domain>/`, `convex/`. New files go in the matching folder, not
   next to unrelated siblings.
5. **Every component is properly self-contained.** Clear, complete prop
   interface (named `<Component>Props`). No hidden coupling to sibling
   components. No reaching outside its props for data it should receive.
   Sub-components used in only one place may live in the same file — they
   still take everything via props.
6. **`pnpm check` (typecheck + lint + format + knip) passes green before
   every commit.**

## Implementation Decisions (this build)

- **Package manager:** pnpm (all install/run commands use `pnpm`).
- **Auth:** Convex Auth (`@convex-dev/auth`) with Password provider — no
  external account required, keeps everything in Convex for the MVP.
- **Tailwind:** v4 with the `@tailwindcss/vite` plugin.
- **Routing:** TanStack Router file-based routing via its Vite plugin.
- **State:** Convex reactive queries; no TanStack Query for now.
- **Image processing:** `browser-image-compression` — canvas re-encode strips
  EXIF metadata and caps the longest edge, keeping the upload path
  local-first per the privacy spec.
- **LLM cost stance:** default to the cheapest model that can still do the
  job. Phase 5 uses Gemini 2.5 Flash Lite. Never pick a more expensive
  model without an explicit signal that quality is insufficient.
- **MediaPipe (Phase 9):** `@mediapipe/tasks-vision` (current Tasks Web API).
  FaceLandmarker for per-feature polygons + ImageSegmenter for hair/skin
  masks, both running in-browser only. JSON-only persistence; no per-pixel
  masks uploaded.
- **Canonical baseline (Phase 8):** Gemini 2.5 Flash Image generates a single
  clean studio portrait from 1–5 source photos at avatar creation. That
  baseline is the canvas — landmarks, makeup tints, and AI renders all
  operate on it, not on the raw upload.

## Manual Setup Steps (run once)

```
pnpm install
npx convex dev          # provisions the Convex deployment (interactive login)
npx @convex-dev/auth    # generates JWT keys + SITE_URL for Convex Auth
```

Add the Gemini API key to the Convex deployment (Phases 5/6/8 all use it):

```
npx convex env set GEMINI_API_KEY <key>
```
