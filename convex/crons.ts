import { cronJobs } from 'convex/server';

import { internal } from './_generated/api';

/**
 * Scheduled sweeps that keep the database and storage tidy.
 *
 * - Hourly: prune renderJobs older than 14 days, plus pending render-input
 *   claims that nobody consumed within a day.
 * - Every 5 minutes: rescue rows stuck in `processing` (action killed
 *   mid-flight) so users don't see an indefinite spinner. The 15-minute
 *   threshold is enforced inside the mutations themselves.
 */
const crons = cronJobs();

crons.interval('sweep stale render jobs', { hours: 1 }, internal.renderJobs.sweepStaleRenderJobs);
crons.interval(
  'sweep stale pending render inputs',
  { hours: 1 },
  internal.renderJobs.sweepStalePendingInputs,
);
crons.interval(
  'rescue stuck processing render jobs',
  { minutes: 5 },
  internal.renderJobs.rescueStaleProcessingJobs,
);
crons.interval(
  'rescue stuck processing baselines',
  { minutes: 5 },
  internal.avatars.rescueStaleProcessingBaselines,
);

export default crons;
