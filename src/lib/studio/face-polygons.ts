import type { FaceLandmarksResult } from '@/lib/mediapipe/face';

/**
 * Hand-curated landmark index sets for the FaceLandmarker 478-point model.
 * Each entry walks the corresponding feature's boundary as a closed polygon.
 *
 * Sources: MediaPipe `face_mesh_connections.py` for the canonical groupings,
 * the `canonical_face_model.obj` for ordering. We bake them inline (instead
 * of relying on MediaPipe's `FaceLandmarker.FACE_LANDMARKS_LIPS` constants)
 * so the studio chunk doesn't import a runtime symbol just for index lists.
 */
export const FACE_POLYGON_INDICES = {
  lipsOuter: [
    61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146,
  ],
  lipsInner: [
    78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95,
  ],
  leftBrow: [70, 63, 105, 66, 107, 55, 65, 52, 53, 46],
  rightBrow: [336, 296, 334, 293, 300, 276, 283, 282, 295, 285],
  /**
   * Eyeshadow region — walks the brow outline forward, then the upper eyelid
   * landmarks backward, forming a closed strip across the lid above the eye.
   */
  leftEyeshadow: [70, 63, 105, 66, 107, 55, 65, 52, 53, 46, 246, 161, 160, 159, 158, 157, 173, 133],
  rightEyeshadow: [
    336, 296, 334, 293, 300, 276, 283, 282, 295, 285, 466, 388, 387, 386, 385, 384, 398, 362,
  ],
} as const;

/** Cheekbone anchor landmarks — the blush tool draws a feathered ellipse here. */
export const CHEEK_ANCHORS = {
  left: 234,
  right: 454,
} as const;

export interface ScaledPoint {
  x: number;
  y: number;
}

/** Maps a landmark index list to absolute pixel coordinates in image space. */
export function polygonPoints(
  face: FaceLandmarksResult,
  indices: readonly number[],
  width: number,
  height: number,
): ScaledPoint[] {
  const out: ScaledPoint[] = [];
  for (const i of indices) {
    const p = face.points[i];
    if (p === undefined) continue;
    out.push({ x: p.x * width, y: p.y * height });
  }
  return out;
}

/** Builds an SVG `data` string for a Konva.Path from one or more polygons. */
export function polygonsToPathData(polygons: ScaledPoint[][]): string {
  const subpaths: string[] = [];
  for (const ring of polygons) {
    if (ring.length === 0) continue;
    const head = ring[0];
    if (head === undefined) continue;
    const rest = ring.slice(1);
    const segments = [`M ${head.x.toString()} ${head.y.toString()}`];
    for (const point of rest) {
      segments.push(`L ${point.x.toString()} ${point.y.toString()}`);
    }
    segments.push('Z');
    subpaths.push(segments.join(' '));
  }
  return subpaths.join(' ');
}

/** Resolves a single landmark index to absolute pixel coords (returns null if missing). */
export function landmarkAt(
  face: FaceLandmarksResult,
  index: number,
  width: number,
  height: number,
): ScaledPoint | null {
  const p = face.points[index];
  if (p === undefined) return null;
  return { x: p.x * width, y: p.y * height };
}
