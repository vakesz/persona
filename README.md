# Persona — 2.5D AI Stylist

Upload a photo, see yourself instantly, and try AI-suggested hairstyles, nails,
makeup, and outfits on your own image.

See [`PLAN.md`](./PLAN.md) for the full MVP plan and phased build order.

## Stack

- **Vite** + **React 19** + **TypeScript** (strict)
- **TanStack Router** — file-based routing
- **Convex** — database, file storage, realtime queries, server functions
- **Convex Auth** — email/password authentication
- **Tailwind CSS v4** + **shadcn/ui**
- **React-Konva** + **MediaPipe** — added in Phase 3 (2.5D canvas editor)

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
```

Then run the app and Convex backend together (two terminals):

```bash
pnpm dev        # Vite dev server
pnpm convex     # Convex backend in watch mode
```

For later phases, set AI provider keys on the Convex deployment:

```bash
npx convex env set GEMINI_API_KEY <key>
npx convex env set FAL_API_KEY <key>
```

## Scripts

| Script              | Description                                  |
| ------------------- | -------------------------------------------- |
| `pnpm dev`          | Vite dev server                              |
| `pnpm convex`       | Convex backend in watch mode                 |
| `pnpm build`        | Type-check + production build                |
| `pnpm typecheck`    | `tsc -b` across app, node, and convex configs |
| `pnpm lint`         | ESLint (strict, type-checked)                |
| `pnpm format`       | Prettier write                               |
| `pnpm knip`         | Detect unused files, exports, dependencies   |
| `pnpm check`        | typecheck + lint + format check + knip       |

## Project structure

```
src/        React app — routes, components, lib, types
convex/     Convex schema, queries, mutations, actions
PLAN.md     Full MVP plan and phased build order
```
