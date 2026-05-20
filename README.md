# Persona — 2.5D AI Stylist

Upload a photo, see yourself instantly, and try AI-suggested hairstyles, nails,
makeup, and outfits on your own image.

See [`PLAN.md`](./PLAN.md) for the full MVP plan, engineering bar, and phased
build order.

## Stack

- **Vite** + **React 19** + **TypeScript** (strict, `exactOptionalPropertyTypes`)
- **TanStack Router** — file-based routing
- **Convex** — database, file storage, realtime queries, server functions, scheduled actions
- **Convex Auth** — email/password authentication
- **Tailwind CSS v4** + **shadcn/ui**
- **React-Konva** — 2.5D studio canvas (zoom/pan/pinch, layered overlays, transformer)
- **Gemini 2.5 Flash Lite** — stylist recommendations (vision + text)
- **Gemini 2.5 Flash Image** — image edit / virtual try-on

## Prerequisites

- Node.js 22+
- pnpm 11+

## Setup

```bash
pnpm install

# Provision the Convex deployment (interactive — opens a browser to log in).
# Writes VITE_CONVEX_URL and CONVEX_DEPLOYMENT into .env.local.
npx convex dev

# Generate JWT keys + SITE_URL for Convex Auth (run once, after convex dev).
npx @convex-dev/auth

# AI provider key (free tier is fine for personal use).
# Get one at https://aistudio.google.com/apikey
npx convex env set GEMINI_API_KEY <key>
```

Then run the app and Convex backend together (two terminals):

```bash
pnpm dev        # Vite dev server
pnpm convex     # Convex backend in watch mode
```

## AI model configuration

Defaults are the cheapest stable GA Gemini models that support what we need;
both are accessible on the free tier. To check what your key can call:

```bash
curl "https://generativelanguage.googleapis.com/v1beta/models?key=$GEMINI_API_KEY" \
  | jq '.models[] | select(.supportedGenerationMethods[] | contains("generateContent")) | .name'
```

Override either model without a code change by setting Convex env vars:

| Purpose                        | Default (free tier, stable) | Env var to override         | Newer preview (optional)         |
| ------------------------------ | --------------------------- | --------------------------- | -------------------------------- |
| Stylist recommendations (text) | `gemini-2.5-flash-lite`     | `CONVEX_GEMINI_MODEL`       | `gemini-3.1-flash-lite-preview`  |
| AI render (image edit)         | `gemini-2.5-flash-image`    | `CONVEX_GEMINI_IMAGE_MODEL` | `gemini-3.1-flash-image-preview` |

```bash
# Example
npx convex env set CONVEX_GEMINI_IMAGE_MODEL gemini-3.1-flash-image-preview
```

Preview models can change behaviour without notice; stay on GA unless quality
demands an upgrade.

## Scripts

| Script           | Description                                   |
| ---------------- | --------------------------------------------- |
| `pnpm dev`       | Vite dev server                               |
| `pnpm convex`    | Convex backend in watch mode                  |
| `pnpm build`     | Type-check + production build                 |
| `pnpm typecheck` | `tsc -b` across app, node, and convex configs |
| `pnpm lint`      | ESLint (strict, type-checked)                 |
| `pnpm format`    | Prettier write                                |
| `pnpm knip`      | Detect unused files, exports, dependencies    |
| `pnpm check`     | typecheck + lint + format check + knip        |

`pnpm check` is the gate — it must pass green before every commit.

## Project structure

```
src/
  routes/                  TanStack Router file routes
  components/
    avatars/               Avatar list + uploader
    studio/                Konva canvas, palette, layer controls
    stylist/               Recommendation card, render result
    ui/                    shadcn/ui primitives
  lib/
    studio/                Layer model, sample overlays, useImage
    image-compression.ts   Browser-side compress + EXIF strip
convex/
  schema.ts                Data model
  auth.ts, http.ts         Convex Auth wiring
  avatars.ts               listAvatars, getAvatar, createAvatar, …
  recentItems.ts           Tried-item history per avatar
  renderJobs.ts            Job lifecycle (queued → processing → done/failed)
  savedLooks.ts            Promoted renders the user kept
  ai.ts                    Gemini calls (text + image edit)
  storage.ts               Auth-gated upload URL
PLAN.md                    Full MVP plan + engineering principles
```
