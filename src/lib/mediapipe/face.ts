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
  landmarkerPromise = (async () => {
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
  return landmarkerPromise;
}

/** Runs FaceLandmarker on the supplied image. Returns `null` if no face was detected. */
export async function runFaceLandmarker(
  image: HTMLImageElement | ImageBitmap | HTMLCanvasElement,
): Promise<FaceLandmarksResult | null> {
  const landmarker = await getLandmarker();
  const result = landmarker.detect(image);
  const face = result.faceLandmarks[0];
  if (face === undefined) return null;
  return {
    points: face.map((p: NormalizedLandmark) => ({ x: p.x, y: p.y, z: p.z })),
  };
}
