import type { Id } from '@convex/_generated/dataModel';

import type { SampleOverlay } from './sample-overlays';

type CanvasLayerOrigin =
  | { kind: 'sample'; sampleOverlayId: string }
  | { kind: 'upload'; uploadedItemId: Id<'uploadedItems'> };

export interface CanvasLayer {
  id: string;
  origin: CanvasLayerOrigin;
  category: string;
  imageUrl: string;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  opacity: number;
}

export interface LayerTransform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  opacity: number;
}

/**
 * Default placement for a sample overlay: fits to a third of the stage's
 * shorter side and centers it.
 */
export function buildLayerFromSample(
  overlay: SampleOverlay,
  stage: { width: number; height: number },
  transform?: LayerTransform,
): CanvasLayer {
  const origin: CanvasLayerOrigin = { kind: 'sample', sampleOverlayId: overlay.id };
  if (transform !== undefined) {
    return {
      id: crypto.randomUUID(),
      origin,
      category: overlay.category,
      imageUrl: overlay.imageUrl,
      ...transform,
    };
  }
  const targetSide = Math.min(stage.width, stage.height) / 3;
  const longestEdge = Math.max(overlay.width, overlay.height);
  const scale = targetSide / longestEdge;
  return {
    id: crypto.randomUUID(),
    origin,
    category: overlay.category,
    imageUrl: overlay.imageUrl,
    x: (stage.width - overlay.width * scale) / 2,
    y: (stage.height - overlay.height * scale) / 2,
    scaleX: scale,
    scaleY: scale,
    rotation: 0,
    opacity: 1,
  };
}

export interface UploadedItemForLayer {
  _id: Id<'uploadedItems'>;
  type: 'dress' | 'top' | 'shoes' | 'nails_reference' | 'hair_reference';
  imageUrl: string;
}

/**
 * Default placement for an uploaded item: a third of the stage's shorter side
 * (square baseline since we don't know the source dimensions until the image
 * loads — Konva renders at natural aspect once the bitmap arrives).
 */
export function buildLayerFromUpload(
  item: UploadedItemForLayer,
  stage: { width: number; height: number },
): CanvasLayer {
  const side = Math.min(stage.width, stage.height) / 3;
  return {
    id: crypto.randomUUID(),
    origin: { kind: 'upload', uploadedItemId: item._id },
    category: item.type,
    imageUrl: item.imageUrl,
    x: (stage.width - side) / 2,
    y: (stage.height - side) / 2,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    opacity: 1,
  };
}

export function serializeSampleLayerSettings(layer: CanvasLayer): string | null {
  if (layer.origin.kind !== 'sample') return null;
  return JSON.stringify({
    sampleOverlayId: layer.origin.sampleOverlayId,
    x: layer.x,
    y: layer.y,
    scaleX: layer.scaleX,
    scaleY: layer.scaleY,
    rotation: layer.rotation,
    opacity: layer.opacity,
  } satisfies SerializedSampleLayerSettings);
}

interface SerializedSampleLayerSettings {
  sampleOverlayId: string;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  opacity: number;
}

export function parseSampleLayerSettings(
  json: string | undefined,
): SerializedSampleLayerSettings | null {
  if (json === undefined) return null;
  try {
    const parsed: unknown = JSON.parse(json);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'sampleOverlayId' in parsed &&
      typeof parsed.sampleOverlayId === 'string'
    ) {
      return parsed as SerializedSampleLayerSettings;
    }
    return null;
  } catch {
    return null;
  }
}
