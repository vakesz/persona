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
MediaPipe
Gemini API
fal.ai or similar image API
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
base_image_storage_id
thumbnail_storage_id
landmarks_json
masks_json
created_at
updated_at
```

Rules:

```
Max 3 avatars per user
Only owner can read/write
Deleting avatar deletes related looks/items/files
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
updateAvatar
deleteAvatar
saveRecentItem
pruneRecentItems
saveLook
deleteLook
createRenderJob
markRenderJobDone
markRenderJobFailed
```

### Actions
Use Convex actions for external APIs:

```
analyzeStyleWithGemini
renderLookWithFal
generateUploadUrl
fetchAndStoreRenderedImage
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

### Canvas layers

```
Base user image
Hair layer
Makeup layer
Nail layer
Clothing layer
Shoe layer
Accessory layer
Selection handles
Mask correction layer
```

Use: React-Konva

### Editor tools

```
Drag
Scale
Rotate
Flip
Opacity
Before/after toggle
Undo/redo
Reset layer
Erase/restore brush
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
Fast / Cheap / In-browser / Layer based / Editable
```

Used for: hair overlays, makeup color, nail color, clothing rough placement.

### Render mode

```
Slower / Costs money / Calls AI image provider / Returns polished realistic image
```

Triggered only by user button: `Render Look`

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

### Phase 1 — Foundation
Vite React setup, TanStack Router, shadcn/ui, Convex setup, Auth,
Protected routes, Basic layout.
Goal: User can sign in.

### Phase 2 — Avatar Creation
Upload image, compress in browser, store in Convex storage, create avatar
record, show avatar list, limit to 3 avatars.
Goal: User can create private avatars.

### Phase 3 — Personal Canvas
Build /studio/$avatarId, load avatar image, render in React-Konva, add
zoom/pan, layer system, mobile touch support.
Goal: User sees themselves on an editable canvas.

### Phase 4 — Manual Styling
Sample hairstyle/makeup/nail overlays, drag/scale/rotate/opacity controls,
save recent tried items.
Goal: User can customize their own image without AI cost.

### Phase 5 — AI Stylist
Stylist prompt box, Gemini action, analyze avatar image, return suggestions,
recommendation cards, convert suggestion to canvas layer.
Goal: User can ask what suits them.

### Phase 6 — AI Render
render_jobs table, render action, send image + prompt + layer metadata to
provider, store result, realtime job updates, save final look.
Goal: User gets a polished realistic image.

### Phase 7 — Clothing Upload
Upload clothing image, store as uploaded_item, show in studio, rough overlay
preview, manual adjustment, final AI try-on render.
Goal: User can upload a dress and try it on.

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

## Implementation Decisions (this build)

- **Package manager:** pnpm (all install/run commands use `pnpm`).
- **Auth:** Convex Auth (`@convex-dev/auth`) with Password provider — no
  external account required, keeps everything in Convex for the MVP.
- **Tailwind:** v4 with the `@tailwindcss/vite` plugin.
- **Routing:** TanStack Router file-based routing via its Vite plugin.
- **State:** Convex reactive queries; no TanStack Query for now.

## Manual Setup Steps (run once)

```
pnpm install
npx convex dev          # provisions the Convex deployment (interactive login)
npx @convex-dev/auth    # generates JWT keys + SITE_URL for Convex Auth
```

Add provider keys to the Convex deployment when reaching Phase 5/6:

```
npx convex env set GEMINI_API_KEY <key>
npx convex env set FAL_API_KEY <key>
```
