import type { Id } from '../_generated/dataModel';

/**
 * Parses an `inputStorageId` out of a `renderJobs.inputJson` payload without
 * trusting the rest of the JSON to be well-formed. The render action calls
 * this *before* attempting a full `JSON.parse` so that even a corrupt
 * `inputJson` doesn't strand the studio's single-use canvas blob in storage.
 */
export function parseInputStorageId(inputJson: string): Id<'_storage'> | null {
  try {
    const parsed = JSON.parse(inputJson) as { inputStorageId?: unknown };
    if (typeof parsed.inputStorageId === 'string') {
      return parsed.inputStorageId as Id<'_storage'>;
    }
  } catch (error) {
    console.warn('parseInputStorageId: malformed renderJobs.inputJson:', error);
  }
  return null;
}
