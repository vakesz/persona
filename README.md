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
- **Cloudflare Workers AI Llama 3.2 11B Vision** — stylist recommendations (vision + text)
- **Cloudflare Workers AI FLUX.2** — baseline generation + image edit / virtual try-on

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

# Deploy the Worker with a Workers AI binding.
pnpm cf:image:deploy

# Set a random shared secret on the Worker.
openssl rand -base64 32
pnpm wrangler secret put IMAGE_API_SECRET --config workers/image-api/wrangler.jsonc

# Point Convex at the deployed Worker and set the same secret there.
npx convex env set CONVEX_CF_IMAGE_WORKER_URL https://persona-image-api.<your-subdomain>.workers.dev
npx convex env set CONVEX_CF_IMAGE_WORKER_SECRET <same-secret>
```

Then run the app and Convex backend together (two terminals):

```bash
pnpm dev        # Vite dev server
pnpm convex     # Convex backend in watch mode
```

## AI model configuration

All AI calls run through the included Cloudflare Worker. Override either model
without code changes using Convex env vars:

| Purpose                                 | Default model                            | Env var                   |
| --------------------------------------- | ---------------------------------------- | ------------------------- |
| Stylist recommendations (vision + text) | `@cf/meta/llama-3.2-11b-vision-instruct` | `CONVEX_CF_STYLIST_MODEL` |
| Baseline + image rendering              | `@cf/black-forest-labs/flux-2-dev`       | `CONVEX_CF_IMAGE_MODEL`   |

### Cloudflare Workers AI setup

Baseline portraits, stylist analysis, and render jobs run through the Cloudflare Worker.
The Worker calls Workers AI with multipart image references
(`input_image_0`, `input_image_1`, up to 4) and returns the generated base64
image to Convex, which still owns the app database and persisted image blobs.

```bash
# Deploy the Worker with a Workers AI binding.
pnpm cf:image:deploy

# Set a random shared secret on the Worker.
openssl rand -base64 32
pnpm wrangler secret put IMAGE_API_SECRET --config workers/image-api/wrangler.jsonc

# Point Convex at the deployed Worker and enable the same secret there.
npx convex env set CONVEX_CF_IMAGE_WORKER_URL https://persona-image-api.<your-subdomain>.workers.dev
npx convex env set CONVEX_CF_IMAGE_WORKER_SECRET <same-secret>

# Optional: use a faster/cheaper FLUX.2 model.
npx convex env set CONVEX_CF_IMAGE_MODEL @cf/black-forest-labs/flux-2-klein-9b

# Optional: change the stylist vision model.
npx convex env set CONVEX_CF_STYLIST_MODEL @cf/meta/llama-3.2-11b-vision-instruct
```

## Scripts

| Script                 | Description                                   |
| ---------------------- | --------------------------------------------- |
| `pnpm dev`             | Vite dev server                               |
| `pnpm convex`          | Convex backend in watch mode                  |
| `pnpm build`           | Type-check + production build                 |
| `pnpm typecheck`       | `tsc -b` across app, node, and convex configs |
| `pnpm lint`            | ESLint (strict, type-checked)                 |
| `pnpm format`          | Prettier write                                |
| `pnpm knip`            | Detect unused files, exports, dependencies    |
| `pnpm check`           | typecheck + lint + format check + knip        |
| `pnpm cf:image:dev`    | Run the Cloudflare image Worker locally       |
| `pnpm cf:image:deploy` | Deploy the Cloudflare image Worker            |

`pnpm check` is the gate — it must pass green before every commit.

## Project structure

```text
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
  ai.ts                    Cloudflare stylist + image provider adapter
  storage.ts               Auth-gated upload URL
workers/
  image-api/               Cloudflare Workers AI FLUX.2 adapter
PLAN.md                    Full MVP plan + engineering principles
```
