# Persona

Persona is an AI-powered beauty studio where users can upload photos, generate a
consistent baseline portrait, and create edited looks (makeup, hairstyle, and
try-on variants) on top of that baseline.

## What this app does

- Upload and manage up to 3 avatars per user.
- Generate a baseline portrait from uploaded source photos.
- Paint live makeup tints in a studio canvas (React-Konva).
- Submit render jobs that combine studio edits with AI image generation.
- Save favorite render outputs as reusable looks.
- Switch between English and Hungarian UI with Lingui i18n.

## Tech stack

- Vite + React 19 + TypeScript (strict)
- TanStack Router (file-based routes)
- Convex (database, storage, queries/mutations/actions, schedulers)
- Convex Auth (email/password)
- Tailwind CSS v4 + shadcn/ui
- React-Konva (interactive studio canvas)
- MediaPipe Tasks Vision (landmarks + face segmentation)
- Cloudflare Workers AI
  - Llama 3.2 Vision (stylist recommendations)
  - FLUX.2 (baseline generation + render edits)

## Requirements

- Node.js 22+
- pnpm 11+
- A Convex account/deployment
- A Cloudflare account with Workers AI enabled

## Quick start

1. Install dependencies.

```bash
pnpm install
```

2. Start Convex once to provision your deployment and populate local env values.

```bash
npx convex dev
```

3. Configure Convex Auth (one-time setup).

```bash
npx @convex-dev/auth
```

4. Deploy the image worker.

```bash
pnpm cf:image:deploy
```

5. Set a shared secret in both Cloudflare Worker and Convex.

```bash
openssl rand -base64 32
pnpm wrangler secret put IMAGE_API_SECRET --config workers/image-api/wrangler.jsonc
npx convex env set CONVEX_CF_IMAGE_WORKER_SECRET <same-secret>
```

6. Point Convex to your deployed worker URL.

```bash
npx convex env set CONVEX_CF_IMAGE_WORKER_URL https://persona-image-api.<your-subdomain>.workers.dev
```

7. Run development servers (separate terminals).

```bash
pnpm convex
pnpm dev
```

## Environment variables

Set these in Convex with `npx convex env set NAME value`:

- `CONVEX_CF_IMAGE_WORKER_URL` (required)
- `CONVEX_CF_IMAGE_WORKER_SECRET` (required)
- `CONVEX_CF_STYLIST_MODEL` (optional)
  - default: `@cf/meta/llama-3.2-11b-vision-instruct`
- `CONVEX_CF_IMAGE_MODEL` (optional)
  - default: `@cf/black-forest-labs/flux-2-dev`

## Scripts

| Command                | Description                                                         |
| ---------------------- | ------------------------------------------------------------------- |
| `pnpm dev`             | Start Vite dev server                                               |
| `pnpm convex`          | Start Convex in watch mode                                          |
| `pnpm build`           | Compile i18n catalogs, type-check, and build                        |
| `pnpm preview`         | Preview production build                                            |
| `pnpm typecheck`       | Run TypeScript project build (`tsc -b`)                             |
| `pnpm lint`            | Run ESLint                                                          |
| `pnpm lint:fix`        | Run ESLint with auto-fixes                                          |
| `pnpm format`          | Format files with Prettier                                          |
| `pnpm format:check`    | Check formatting                                                    |
| `pnpm knip`            | Detect unused files/exports/dependencies                            |
| `pnpm i18n:extract`    | Extract translatable messages                                       |
| `pnpm i18n:compile`    | Compile PO catalogs to TypeScript                                   |
| `pnpm check`           | Quality gate: i18n compile + typecheck + lint + format check + knip |
| `pnpm cf:image:dev`    | Run Cloudflare image worker locally                                 |
| `pnpm cf:image:deploy` | Deploy Cloudflare image worker                                      |
| `pnpm cf:image:types`  | Regenerate worker type bindings                                     |

`pnpm check` is the pre-commit gate and should pass before every commit.

## Architecture overview

### Client (`src/`)

- TanStack Router routes live in `src/routes`.
- Studio state and composition logic live in `src/lib/studio`.
- Face landmark and segmentation caching lives in `src/lib/mediapipe`.
- UI primitives are in `src/components/ui`.

### Backend (`convex/`)

- `schema.ts` defines data tables and indexes.
- `avatars.ts` manages avatar lifecycle and baseline generation scheduling.
- `renderJobs.ts` manages async render jobs.
- `savedLooks.ts` stores promoted render results.
- `uploadedItems.ts` stores user reference images for try-on.
- `ai.ts` calls the Cloudflare image worker.
- `crons.ts` cleans up stale render jobs and storage blobs.

### Image generation worker (`workers/image-api`)

- Validates shared-secret requests from Convex.
- Calls Workers AI models.
- Returns generated image data to Convex for persistence.

## Rendering flow

1. User creates an avatar from source photos.
2. Convex schedules baseline generation.
3. Baseline image becomes the canonical input for studio work.
4. In studio, user edits tints and/or geometry intent.
5. Convex schedules a render job (single-image edit or two-image try-on).
6. Worker calls FLUX.2, Convex stores result, user can save the look.

## i18n workflow

1. Add or update text using Lingui macros.
2. Extract messages:

```bash
pnpm i18n:extract
```

3. Translate `src/i18n/locales/hu/messages.po`.
4. Compile catalogs:

```bash
pnpm i18n:compile
```

## Notes for contributors

- There is currently no automated test suite.
- Validate behavior by running `pnpm dev` and `pnpm convex` and testing key
  flows in the browser.
- Do not edit generated files manually:
  - `convex/_generated/**`
  - `src/routeTree.gen.ts`

## Project structure (high level)

```text
src/                   React app (routes, UI, studio)
convex/                Backend functions and schema
workers/image-api/     Cloudflare Worker for AI calls
config/                Shared project configuration
```
