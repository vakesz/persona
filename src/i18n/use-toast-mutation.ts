import { useMutation } from 'convex/react';
import type { FunctionReference, FunctionReturnType } from 'convex/server';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { translateServerError } from './server-errors';

export interface UseToastMutationOptions {
  /** Shown via `toast.success` after a successful call. */
  successMessage?: string;
}

export interface UseToastMutationResult<M extends FunctionReference<'mutation', 'public'>> {
  /**
   * Runs the mutation. Resolves to the mutation's return value on success, or
   * `undefined` if the call threw — the failure is already surfaced via
   * `toast.error` so the caller usually just checks the return for branching.
   */
  run: (args: M['_args']) => Promise<FunctionReturnType<M> | undefined>;
  /** True while a call is in flight; bind to button `disabled` states. */
  pending: boolean;
}

/**
 * Wraps `useMutation` with the project's standard error UX:
 * `console.error` + `toast.error(translateServerError(error))` on failure,
 * plus optional `toast.success` on success, plus a `pending` flag.
 *
 * Replaces the 9+ hand-coded `.then/.catch/.finally` chains across the
 * codebase. Callers that need to react to success usually chain on the
 * returned promise (e.g. `.then((result) => { if (result !== undefined) … })`).
 */
export function useToastMutation<M extends FunctionReference<'mutation', 'public'>>(
  mutation: M,
  options: UseToastMutationOptions = {},
): UseToastMutationResult<M> {
  const mutate = useMutation(mutation);
  const [pending, setPending] = useState(false);
  const { successMessage } = options;

  const run = useCallback(
    async (args: M['_args']): Promise<FunctionReturnType<M> | undefined> => {
      setPending(true);
      try {
        const result = await mutate(args);
        if (successMessage !== undefined) {
          toast.success(successMessage);
        }
        return result as FunctionReturnType<M>;
      } catch (error: unknown) {
        console.error(error);
        toast.error(translateServerError(error));
        return undefined;
      } finally {
        setPending(false);
      }
    },
    [mutate, successMessage],
  );

  return { run, pending };
}
