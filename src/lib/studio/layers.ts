import type { OverlayCategory, SampleOverlay } from './sample-overlays';

export interface CanvasLayer {
  id: string;
  sampleOverlayId: string;
  category: OverlayCategory;
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
 * Default placement: fits the overlay to a third of the stage's shorter side
 * and centers it in the visible area.
 */
export function buildInitialLayer(
  overlay: SampleOverlay,
  stage: { width: number; height: number },
  transform?: LayerTransform,
): CanvasLayer {
  if (transform !== undefined) {
    return {
      id: crypto.randomUUID(),
      sampleOverlayId: overlay.id,
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
    sampleOverlayId: overlay.id,
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

export function serializeLayerSettings(layer: CanvasLayer): string {
  return JSON.stringify({
    sampleOverlayId: layer.sampleOverlayId,
    x: layer.x,
    y: layer.y,
    scaleX: layer.scaleX,
    scaleY: layer.scaleY,
    rotation: layer.rotation,
    opacity: layer.opacity,
  } satisfies SerializedLayerSettings);
}

interface SerializedLayerSettings {
  sampleOverlayId: string;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  opacity: number;
}

export function parseLayerSettings(json: string | undefined): SerializedLayerSettings | null {
  if (json === undefined) return null;
  try {
    const parsed: unknown = JSON.parse(json);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'sampleOverlayId' in parsed &&
      typeof parsed.sampleOverlayId === 'string'
    ) {
      return parsed as SerializedLayerSettings;
    }
    return null;
  } catch {
    return null;
  }
}
