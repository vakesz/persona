import { getAuthUserId } from '@convex-dev/auth/server';

import type { Id } from '../_generated/dataModel';
import type { ActionCtx, MutationCtx, QueryCtx } from '../_generated/server';
import { errors } from './errors';

/**
 * Resolves the signed-in user, or throws `notAuthenticated`. Use at the top
 * of every public mutation/action. Public queries should call `getAuthUserId`
 * directly and return an empty result for `null` (queries silently produce
 * empty state when signed out; mutations are loud).
 */
export async function requireAuth(ctx: QueryCtx | MutationCtx | ActionCtx): Promise<Id<'users'>> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw errors.notAuthenticated();
  }
  return userId;
}

/**
 * Verifies that `row` exists and belongs to `userId`. Returns the row, or
 * throws via `onMissing` (typically `errors.avatarNotFound`, `errors.renderNotFound`,
 * etc. — using the same error for "not found" and "not owned" prevents
 * existence enumeration).
 */
export function ensureOwned<T extends { userId: Id<'users'> }>(
  row: T | null,
  userId: Id<'users'>,
  onMissing: () => Error,
): T {
  if (row?.userId !== userId) throw onMissing();
  return row;
}

/**
 * Idempotent variant of `ensureOwned` for delete-style mutations: returns the
 * row when owned, or `null` for the caller to short-circuit without throwing.
 * Keeps "delete something that's already gone" from being a user-visible error.
 */
export function ownedOrNull<T extends { userId: Id<'users'> }>(
  row: T | null,
  userId: Id<'users'>,
): T | null {
  if (row?.userId !== userId) return null;
  return row;
}
