import type { FaceLandmarker, NormalizedLandmark } from '@mediapipe/tasks-vision';

const VISION_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const FACE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

export interface FaceLandmarksResult {
  /** All 478 landmarks, normalized to [0,1] in image coordinates. */
  points: { x: number; y: number; z: number }[];
}

let landmarkerPromise: Promise<FaceLandmarker> | null = null;

async function getLandmarker(): Promise<FaceLandmarker> {
  if (landmarkerPromise !== null) return landmarkerPromise;
  // Wrap the build promise so that a rejection (e.g. transient network blip
  // fetching the wasm/model) doesn't poison the cached promise — without
  // this, every subsequent caller would re-reject from the same cached
  // failure forever, with no recovery short of a page reload.
  const pending = (async () => {
    const { FaceLandmarker: Lm, FilesetResolver } = await import('@mediapipe/tasks-vision');
    const filesetResolver = await FilesetResolver.forVisionTasks(VISION_WASM);
    return Lm.createFromOptions(filesetResolver, {
      baseOptions: { modelAssetPath: FACE_MODEL, delegate: 'GPU' },
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false,
      runningMode: 'IMAGE',
      numFaces: 1,
    });
  })();
  landmarkerPromise = pending;
  pending.catch(() => {
    if (landmarkerPromise === pending) {
      landmarkerPromise = null;
    }
  });
  return pending;
}

// Serializes `detect()` calls against the singleton FaceLandmarker. Tasks
// Vision in IMAGE running mode isn't reentrant, so two concurrent avatar
// switches would otherwise race on the same GPU context.
let detectQueue: Promise<unknown> = Promise.resolve();

/** Runs FaceLandmarker on the supplied image. Returns `null` if no face was detected. */
export async function runFaceLandmarker(
  image: HTMLImageElement | ImageBitmap | HTMLCanvasElement,
): Promise<FaceLandmarksResult | null> {
  const landmarker = await getLandmarker();
  const detectCall = detectQueue.then(() => landmarker.detect(image));
  // Replace the queue tail with a never-rejecting promise so a failure in
  // one call doesn't poison the next caller.
  detectQueue = detectCall.then(
    () => undefined,
    () => undefined,
  );
  const result = await detectCall;
  const face = result.faceLandmarks[0];
  if (face === undefined) return null;
  return {
    points: face.map((p: NormalizedLandmark) => ({ x: p.x, y: p.y, z: p.z })),
  };
}

/**
 * Runtime guard for cached landmarks JSON loaded from Convex. Without it, a
 * silent schema drift on the persisted blob would crash the studio at
 * landmark lookup time rather than fall back to a clean re-detection.
 */
export function isFaceLandmarksResult(value: unknown): value is FaceLandmarksResult {
  if (typeof value !== 'object' || value === null) return false;
  if (!('points' in value) || !Array.isArray(value.points)) return false;
  const points = value.points as unknown[];
  const first = points[0];
  if (first === undefined) return points.length === 0;
  return (
    typeof first === 'object' &&
    first !== null &&
    'x' in first &&
    typeof first.x === 'number' &&
    'y' in first &&
    typeof first.y === 'number'
  );
}
