import type { ImageSegmenter } from '@mediapipe/tasks-vision';

import { FacePreparationError } from './errors';

const VISION_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const SELFIE_MULTICLASS_MODEL =
  'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/1/selfie_multiclass_256x256.tflite';

export interface SegmentationResult {
  width: number;
  height: number;
  /**
   * Run-length encoded category mask: alternating `[category, runLength]`
   * pairs in scanline order. A 1024×1024 raw uint8 mask is 1 MB; RLE keeps
   * the JSON Convex stores well under 100 KB for portrait-shaped subjects.
   */
  rle: number[];
}

let segmenterPromise: Promise<ImageSegmenter> | null = null;

async function getSegmenter(): Promise<ImageSegmenter> {
  if (segmenterPromise !== null) return segmenterPromise;
  // Clear the cache slot if the underlying build rejects — see the matching
  // comment in `face.ts`.
  const pending = (async () => {
    const { ImageSegmenter: Seg, FilesetResolver } = await import('@mediapipe/tasks-vision');
    const filesetResolver = await FilesetResolver.forVisionTasks(VISION_WASM);
    return Seg.createFromOptions(filesetResolver, {
      baseOptions: { modelAssetPath: SELFIE_MULTICLASS_MODEL, delegate: 'GPU' },
      outputCategoryMask: true,
      outputConfidenceMasks: false,
      runningMode: 'IMAGE',
    });
  })();
  segmenterPromise = pending;
  pending.catch(() => {
    if (segmenterPromise === pending) {
      segmenterPromise = null;
    }
  });
  return pending;
}

// Serializes `segment()` against the singleton ImageSegmenter — same
// rationale as the face landmark detect queue.
let segmentQueue: Promise<unknown> = Promise.resolve();

export async function runImageSegmenter(
  image: HTMLImageElement | ImageBitmap | HTMLCanvasElement,
): Promise<SegmentationResult> {
  const segmenter = await getSegmenter();
  const segmentCall = segmentQueue.then(() => segmenter.segment(image));
  segmentQueue = segmentCall.then(
    () => undefined,
    () => undefined,
  );
  const result = await segmentCall;
  const mask = result.categoryMask;
  if (mask === undefined) {
    result.close();
    throw new FacePreparationError('segmentation_failed');
  }
  const width = mask.width;
  const height = mask.height;
  const data = mask.getAsUint8Array();
  const rle = encodeRunLength(data);
  mask.close();
  result.close();
  return { width, height, rle };
}

/**
 * Runtime guard for cached segmentation JSON loaded from Convex. Without it,
 * a silent schema drift on the persisted blob would crash the studio at
 * mask-decode time rather than fall back to a clean re-segmentation.
 */
export function isSegmentationResult(value: unknown): value is SegmentationResult {
  if (typeof value !== 'object' || value === null) return false;
  if (!('width' in value) || typeof value.width !== 'number') return false;
  if (!('height' in value) || typeof value.height !== 'number') return false;
  if (!('rle' in value) || !Array.isArray(value.rle)) return false;
  return value.rle.every((n) => typeof n === 'number');
}

function encodeRunLength(data: Uint8Array): number[] {
  const out: number[] = [];
  if (data.length === 0) return out;
  let current = data[0];
  let runLength = 1;
  for (let i = 1; i < data.length; i++) {
    const val = data[i];
    if (val === current) {
      runLength++;
    } else {
      out.push(current ?? 0, runLength);
      current = val;
      runLength = 1;
    }
  }
  out.push(current ?? 0, runLength);
  return out;
}
