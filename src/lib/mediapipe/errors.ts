/**
 * Discriminator for client-side face/segmentation failures. Kept separate
 * from the server's `ServerErrorPayload` because these errors never cross
 * the wire — MediaPipe runs in the browser. The studio's `FaceStatusBanner`
 * maps these to localized strings via `t`...``.
 */
export type FacePreparationErrorCode = 'no_face' | 'segmentation_failed' | 'unknown';

/** Error type for browser-only MediaPipe preparation failures. */
export class FacePreparationError extends Error {
  readonly code: FacePreparationErrorCode;

  constructor(code: FacePreparationErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'FacePreparationError';
    this.code = code;
  }
}

/** Runtime guard for errors thrown while preparing studio face data. */
export function isFacePreparationError(value: unknown): value is FacePreparationError {
  return value instanceof FacePreparationError;
}
