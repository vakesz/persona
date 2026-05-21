import { cronJobs } from 'convex/server';

import { internal } from './_generated/api';

/**
 * Scheduled sweeps that keep the database and storage tidy. Renders the user
 * never promoted to a saved look age out after 14 days — complements the
 * per-row cascade-delete paths in `avatars.ts` / `users.ts`, which cover
 * explicit deletes. Stale `pendingRenderInputs` (uploads claimed but never
 * consumed) are freed daily.
 */
const crons = cronJobs();

crons.interval('sweep stale render jobs', { hours: 1 }, internal.renderJobs.sweepStaleRenderJobs);
crons.interval(
  'sweep stale pending render inputs',
  { hours: 1 },
  internal.renderJobs.sweepStalePendingInputs,
);

export default crons;
