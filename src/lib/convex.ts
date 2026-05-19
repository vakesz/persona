import { ConvexReactClient } from 'convex/react';

const convexUrl = import.meta.env.VITE_CONVEX_URL;

if (!convexUrl) {
  throw new Error('Missing VITE_CONVEX_URL. Run `npx convex dev` to provision the deployment.');
}

/** Shared Convex client used by the auth provider and all React queries. */
export const convex = new ConvexReactClient(convexUrl);
