import type { Id } from '@convex/_generated/dataModel';

/**
 * Posts `blob` to a Convex signed upload URL and returns the resulting
 * `_storage` id. Centralizes the fetch + JSON decoding so every uploader
 * (avatar source photos, uploaded items, studio canvas snapshots) stays in
 * sync.
 *
 * `uploadFailedMessage` is the localized fallback shown when the POST fails
 * with a non-2xx status — passing it in (rather than inlining English) keeps
 * the helper i18n-agnostic.
 */
export async function uploadBlobToConvex(
  uploadUrl: string,
  blob: Blob,
  uploadFailedMessage: string,
): Promise<Id<'_storage'>> {
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': blob.type },
    body: blob,
  });
  if (!response.ok) {
    throw new Error(uploadFailedMessage);
  }
  const json = (await response.json()) as { storageId: Id<'_storage'> };
  return json.storageId;
}
