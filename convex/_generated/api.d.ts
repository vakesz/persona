/* eslint-disable */
/**
 * Generated API types.
 *
 * Bootstrapped by hand so the project type-checks before the first
 * `npx convex dev`; that command regenerates this file. Do not edit manually.
 */
import type { ApiFromModules, FilterApi, FunctionReference } from 'convex/server';

import type * as auth from '../auth.js';
import type * as http from '../http.js';
import type * as users from '../users.js';

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  http: typeof http;
  users: typeof users;
}>;

export declare const api: FilterApi<typeof fullApi, FunctionReference<any, 'public'>>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, 'internal'>
>;
