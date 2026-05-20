import imageCompression from 'browser-image-compression';

export interface ProcessedAvatarImages {
  base: File;
  thumbnail: File;
}

const BASE_OPTIONS = {
  maxSizeMB: 4,
  maxWidthOrHeight: 2048,
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
 * 12 MP phone photo doesn't push 5+ MB to Convex storage.
 */
export async function processAvatarImage(file: File): Promise<ProcessedAvatarImages> {
  const [base, thumbnail] = await Promise.all([
    imageCompression(file, BASE_OPTIONS),
    imageCompression(file, THUMBNAIL_OPTIONS),
  ]);
  return { base, thumbnail };
}
