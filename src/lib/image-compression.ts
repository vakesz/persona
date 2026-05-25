import imageCompression from 'browser-image-compression';

export interface ProcessedAvatarImages {
  base: File;
  /**
   * Smaller preview re-encoding for the avatar thumbnail. Skipped (set to
   * the same `File` as `base`) when callers pass `{ thumbnail: false }`,
   * which avoids a wasted second `imageCompression` pass on photos whose
   * thumbnails aren't used downstream (e.g. clothing uploads, source
   * photos 2..N).
   */
  thumbnail: File;
}

export interface ProcessAvatarImageOptions {
  /**
   * When `false` we skip the thumbnail compression pass. Defaults to `true`.
   * The returned `thumbnail` field aliases `base` in that case so existing
   * destructuring (`const { base } = await processAvatarImage(...)`) still
   * works without callers reaching for an `undefined` field.
   */
  thumbnail?: boolean;
}

const BASE_OPTIONS = {
  maxSizeMB: 0.75,
  maxWidthOrHeight: 512,
  useWebWorker: true,
  fileType: 'image/jpeg',
  initialQuality: 0.85,
};

const THUMBNAIL_OPTIONS = {
  maxSizeMB: 0.3,
  maxWidthOrHeight: 512,
  useWebWorker: true,
  fileType: 'image/jpeg',
  initialQuality: 0.8,
};

/**
 * Re-encodes the picked photo via canvas, which strips EXIF (orientation, GPS,
 * device info) — required by the privacy spec — and caps the longest edge so a
 * 12 MP phone photo doesn't push oversized references to Convex or FLUX.2.
 * FLUX.2's multi-reference endpoint is capped at 512px inputs, so the stored
 * source images intentionally match that limit.
 */
export async function processAvatarImage(
  file: File,
  options: ProcessAvatarImageOptions = {},
): Promise<ProcessedAvatarImages> {
  const withThumbnail = options.thumbnail ?? true;
  if (!withThumbnail) {
    const base = await imageCompression(file, BASE_OPTIONS);
    return { base, thumbnail: base };
  }
  const [base, thumbnail] = await Promise.all([
    imageCompression(file, BASE_OPTIONS),
    imageCompression(file, THUMBNAIL_OPTIONS),
  ]);
  return { base, thumbnail };
}
