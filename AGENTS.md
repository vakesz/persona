# AGENTS.md

AI agent operating manual for this repository.

Primary objective: deliver the requested change end to end with the smallest safe diff, validated locally.

## 1) Agent Execution Contract

Follow this sequence on every task unless the user asks otherwise.

1. Understand intent.
2. Gather the necessary code context required.
3. Implement the smallest safe change.
4. Validate with the relevant commands.
5. Report exactly what changed, where, and how it was verified.

Do not stop at planning if the user asked for implementation.

## 2) Quick Start For Agents

Requirements: Node 22+, pnpm 11+

```bash
pnpm install
pnpm dev
```

In a second terminal:

```bash
pnpm convex
```

Before finishing a coding task:

```bash
pnpm check
```

`pnpm check` is the gate: i18n compile, typecheck, lint, format check, knip.

## 3) Hard Rules (Non-Negotiable)

1. Keep diffs surgical. No unrelated refactors.
2. Preserve server-side ownership checks (`userId`-based authorization).
3. Client code must not import Convex `internal*` APIs.
4. Never hand-edit generated files:
   - `convex/_generated/**`
   - `src/routeTree.gen.ts`
5. Respect strict TypeScript settings:
   - do not pass `undefined` to optional fields
   - narrow indexed access before use
6. If user-facing text changes, update Lingui extraction/compile artifacts.
7. Do not claim verification you did not run.

## 4) Decision Policy For AI Agents

1. Prefer direct edits over large rewrites.
2. If multiple options exist, choose the one with lower regression risk.
3. If a request conflicts with existing architecture, preserve architecture and explain tradeoff.
4. Ask for clarification only when blocked by ambiguity that can cause wrong behavior.
5. If blocked by missing credentials/secrets/external services, report blocker and provide exact next action.

## 5) Repo Mental Model

### Frontend (`src/`)

- Vite + React 19 + TanStack Router
- shadcn/ui + Tailwind v4
- Studio preview via React-Konva tint overlays
- Lingui v6 i18n (`en`, `hu`)
- MediaPipe Tasks Vision runs in browser and caches results to Convex

### Backend (`convex/`)

- Convex queries/mutations/actions, storage, scheduler, auth
- AI orchestration in `convex/ai.ts`
- Async baseline and render pipelines

### Worker (`workers/image-api/`)

- Cloudflare Worker endpoint used by Convex actions

## 6) Critical Domain Invariants

1. Studio has two edit classes:
   - color tints: flattened into PNG input for render
   - geometry plans: prompt text only
2. If no tint exists, render should use baseline directly (no flatten upload).
3. `savedLooks` should reuse `renderJobs.resultStorageId` (no duplicate blobs).
4. Render/baseline jobs follow status machine: `queued -> processing -> done/failed`.
5. Temporary render input blobs must be cleaned up in action `finally`.
6. Server limits must remain enforced:
   - 3 avatars per user
   - 5 source photos per avatar

## 7) Workflow Playbooks

### UI change

1. Edit route/component under `src/routes/` or `src/components/`.
2. If studio behavior changes, inspect `src/lib/studio/studio-state.ts`.
3. For new/changed strings, run i18n extraction and compile.
4. Run `pnpm check`.

### Convex behavior change

1. Update schema/indexes in `convex/schema.ts` if needed.
2. Update query/mutation/action implementation.
3. Re-verify ownership checks and cleanup paths.
4. Run `pnpm check`.

### Render pipeline change

1. Trace `convex/renderJobs.ts` to `convex/ai.ts`.
2. Preserve status transitions and try-on branching.
3. Preserve `inputStorageId` cleanup in `finally`.
4. Validate with manual flow test.

## 8) Error + i18n Contract

1. Throw structured `ConvexError` payloads, never localized server strings.
2. Keep error code union authoritative in `convex/lib/errors.ts`.
3. Keep client mapping exhaustive in `src/i18n/server-errors.ts`.
4. For persisted error payloads, use stored-payload translation flow.

## 9) Commands Agents Should Use Most

```bash
pnpm dev
pnpm convex
pnpm check
pnpm typecheck
pnpm lint
pnpm i18n:extract
pnpm i18n:compile
pnpm build
```

Convex env vars (set with `npx convex env set NAME value`):

- `CONVEX_CF_IMAGE_WORKER_URL` (required)
- `CONVEX_CF_IMAGE_WORKER_SECRET` (required)
- `CONVEX_CF_STYLIST_MODEL` (optional)
- `CONVEX_CF_IMAGE_MODEL` (optional)

## 10) Required Final Response Format (For AI Agents)

When finishing a coding task, include all of these sections:

1. What changed
2. Files touched
3. Validation run
4. Remaining risks or follow-ups

Keep it concise and factual. Do not include hidden reasoning.

## 11) Definition Of Done

A task is complete only when all are true:

1. Requested behavior is implemented.
2. `pnpm check` passes, or blocker is explicitly reported.
3. Affected user flow is manually exercised when relevant.
4. i18n artifacts are updated when strings changed.
5. No generated files were manually edited.
6. Storage lifecycle remains safe (no new orphaned blobs).

## 12) Anti-Patterns For Agents

1. Broad cleanup refactors during feature work.
2. Silent changes to status machine semantics.
3. Trusting client-side auth gating without server enforcement.
4. Duplicating storage bytes where reuse is intended.
5. Claiming commands/tests were run when they were not.
6. Adding Codex attribution trailers to commits.
