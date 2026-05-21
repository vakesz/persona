import Konva from 'konva';
import { type Ref, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Group, Image as KonvaImage, Layer, Path, Stage } from 'react-konva';

import type { FaceLandmarksResult } from '@/lib/mediapipe/face';
import {
  CHEEK_ANCHORS,
  FACE_POLYGON_INDICES,
  landmarkAt,
  polygonPoints,
  polygonsToPathData,
} from '@/lib/studio/face-polygons';
import type { ColorTint, StudioState } from '@/lib/studio/studio-state';

export interface StudioCanvasHandle {
  /**
   * Exports the canonical tinted composition (baseline + tints, no
   * before/after slider clip, no display pan/zoom) as a native-resolution
   * PNG blob. The renderer can then stack geometry edits on top of the
   * makeup without having to redraw it.
   */
  exportPng: () => Promise<Blob | null>;
}

export interface StudioCanvasProps {
  baseImage: HTMLImageElement | null;
  altText: string;
  face: FaceLandmarksResult | null;
  state: StudioState;
  /**
   * Before/after wipe position, 0..1 in image-x. Pixels to the LEFT of this
   * line show the baseline only (no tints). 0 = no wipe (fully tinted),
   * 1 = full baseline (no tints visible).
   */
  compareSliderX: number;
  ref?: Ref<StudioCanvasHandle>;
}

const MIN_SCALE = 0.25;
const MAX_SCALE = 6;
const WHEEL_ZOOM_STEP = 1.1;

interface ContainerSize {
  width: number;
  height: number;
}

interface PinchState {
  distance: number;
}

export function StudioCanvas({
  baseImage,
  altText,
  face,
  state,
  compareSliderX,
  ref,
}: StudioCanvasProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const exportGroupRef = useRef<Konva.Group>(null);
  const pinchRef = useRef<PinchState | null>(null);

  const [size, setSize] = useState<ContainerSize | null>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (wrapper === null) return undefined;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry === undefined) return;
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(wrapper);
    return () => {
      observer.disconnect();
    };
  }, []);

  const initialFit = useMemo(() => {
    if (size === null || baseImage === null) return null;
    const scale = Math.min(
      size.width / baseImage.naturalWidth,
      size.height / baseImage.naturalHeight,
    );
    return {
      scale,
      x: (size.width - baseImage.naturalWidth * scale) / 2,
      y: (size.height - baseImage.naturalHeight * scale) / 2,
    };
  }, [size, baseImage]);

  // Expose the export-to-PNG handle. The implementation clones the export
  // group into an offscreen Konva stage of the baseline's native resolution
  // — that way the snapshot is independent of (a) the user's pan/zoom on
  // the visible stage and (b) the display scale-to-fit transform.
  useEffect(() => {
    if (ref === undefined || ref === null) return undefined;
    const handle: StudioCanvasHandle = {
      exportPng: async () => {
        const source = exportGroupRef.current;
        if (source === null || baseImage === null) return null;

        const container = document.createElement('div');
        container.style.cssText = 'position:absolute;left:-99999px;top:0;width:1px;height:1px';
        document.body.appendChild(container);
        try {
          const offscreen = new Konva.Stage({
            container,
            width: baseImage.naturalWidth,
            height: baseImage.naturalHeight,
          });
          const layer = new Konva.Layer();
          const cloned = source.clone();
          cloned.position({ x: 0, y: 0 });
          cloned.scale({ x: 1, y: 1 });
          layer.add(cloned);
          offscreen.add(layer);
          offscreen.draw();
          const dataUrl = offscreen.toDataURL({ pixelRatio: 1, mimeType: 'image/png' });
          offscreen.destroy();
          const response = await fetch(dataUrl);
          return await response.blob();
        } finally {
          container.remove();
        }
      },
    };
    if (typeof ref === 'function') {
      const cleanup = ref(handle);
      return typeof cleanup === 'function' ? cleanup : undefined;
    }
    ref.current = handle;
    return () => {
      ref.current = null;
    };
  }, [ref, baseImage]);

  const zoomAroundPoint = useCallback((clientX: number, clientY: number, factor: number) => {
    const stage = stageRef.current;
    if (stage === null) return;
    const box = stage.container().getBoundingClientRect();
    const oldScale = stage.scaleX();
    const newScale = clamp(oldScale * factor, MIN_SCALE, MAX_SCALE);
    const pointer = { x: clientX - box.left, y: clientY - box.top };
    const worldPoint = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };
    stage.scale({ x: newScale, y: newScale });
    stage.position({
      x: pointer.x - worldPoint.x * newScale,
      y: pointer.y - worldPoint.y * newScale,
    });
    stage.batchDraw();
  }, []);

  const handleWheel = (event: Konva.KonvaEventObject<WheelEvent>) => {
    event.evt.preventDefault();
    const factor = event.evt.deltaY > 0 ? 1 / WHEEL_ZOOM_STEP : WHEEL_ZOOM_STEP;
    zoomAroundPoint(event.evt.clientX, event.evt.clientY, factor);
  };

  const handleTouchMove = (event: Konva.KonvaEventObject<TouchEvent>) => {
    const touches = event.evt.touches;
    if (touches.length < 2) return;
    event.evt.preventDefault();
    const stage = stageRef.current;
    if (stage === null) return;
    if (stage.isDragging()) stage.stopDrag();

    const t1 = touches[0];
    const t2 = touches[1];
    if (t1 === undefined || t2 === undefined) return;

    const distance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    const centerClient = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
    const previous = pinchRef.current;
    if (previous === null) {
      pinchRef.current = { distance };
      return;
    }
    zoomAroundPoint(centerClient.x, centerClient.y, distance / previous.distance);
    pinchRef.current = { distance };
  };

  // The pinch ref tracks two-finger spread. Reset only when no fingers
  // remain on the screen, so lifting one finger of a three-finger gesture
  // doesn't mid-stream the pinch state.
  const handleTouchEnd = (event: Konva.KonvaEventObject<TouchEvent>) => {
    if (event.evt.touches.length === 0) {
      pinchRef.current = null;
    }
  };

  const sliderActive = compareSliderX > 0 && compareSliderX < 1;

  return (
    <div
      ref={wrapperRef}
      className="bg-muted relative aspect-[4/5] w-full touch-none overflow-hidden rounded-lg"
    >
      {size !== null && baseImage !== null && initialFit !== null && (
        <Stage
          ref={stageRef}
          width={size.width}
          height={size.height}
          draggable
          onWheel={handleWheel}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <Layer>
            <Group
              x={initialFit.x}
              y={initialFit.y}
              scaleX={initialFit.scale}
              scaleY={initialFit.scale}
            >
              {/*
                The export group is the canonical composition: baseline +
                tints, in native image-space coords, at identity transform.
                `exportPng` clones it into an offscreen native-res stage so
                pan/zoom/display-scale never bleed into the snapshot.
              */}
              <Group ref={exportGroupRef}>
                <KonvaImage
                  image={baseImage}
                  x={0}
                  y={0}
                  width={baseImage.naturalWidth}
                  height={baseImage.naturalHeight}
                  alt={altText}
                  listening={false}
                />
                {face !== null && (
                  <TintLayer
                    face={face}
                    state={state}
                    imageWidth={baseImage.naturalWidth}
                    imageHeight={baseImage.naturalHeight}
                  />
                )}
              </Group>
              {/*
                Before/after wipe overlay: re-draws the bare baseline on top
                of the export group, clipped to the LEFT of the slider line.
                Putting the clip on the *overlay* (not on the tints) keeps
                the export group untouched by the slider state — the user
                can drag the slider and the render still uses the full
                tinted composition.
              */}
              {compareSliderX > 0 && (
                <Group
                  clipX={0}
                  clipY={0}
                  clipWidth={compareSliderX * baseImage.naturalWidth}
                  clipHeight={baseImage.naturalHeight}
                  listening={false}
                >
                  <KonvaImage
                    image={baseImage}
                    x={0}
                    y={0}
                    width={baseImage.naturalWidth}
                    height={baseImage.naturalHeight}
                    listening={false}
                  />
                </Group>
              )}
              {sliderActive && (
                <Path
                  data={`M ${(compareSliderX * baseImage.naturalWidth).toString()} 0 L ${(compareSliderX * baseImage.naturalWidth).toString()} ${baseImage.naturalHeight.toString()}`}
                  stroke="#ffffff"
                  strokeWidth={Math.max(2, baseImage.naturalWidth * 0.003)}
                  opacity={0.85}
                  listening={false}
                />
              )}
            </Group>
          </Layer>
        </Stage>
      )}
    </div>
  );
}

interface TintLayerProps {
  face: FaceLandmarksResult;
  state: StudioState;
  imageWidth: number;
  imageHeight: number;
}

function TintLayer({ face, state, imageWidth, imageHeight }: TintLayerProps) {
  const lipData = useMemo(() => {
    if (!state.lip.enabled) return null;
    const outer = polygonPoints(face, FACE_POLYGON_INDICES.lipsOuter, imageWidth, imageHeight);
    const inner = polygonPoints(face, FACE_POLYGON_INDICES.lipsInner, imageWidth, imageHeight);
    return polygonsToPathData([outer, inner]);
  }, [face, state.lip.enabled, imageWidth, imageHeight]);

  const eyeshadowData = useMemo(() => {
    if (!state.eyeshadow.enabled) return null;
    const left = polygonPoints(face, FACE_POLYGON_INDICES.leftEyeshadow, imageWidth, imageHeight);
    const right = polygonPoints(face, FACE_POLYGON_INDICES.rightEyeshadow, imageWidth, imageHeight);
    return polygonsToPathData([left, right]);
  }, [face, state.eyeshadow.enabled, imageWidth, imageHeight]);

  const browData = useMemo(() => {
    if (!state.browTint.enabled) return null;
    const left = polygonPoints(face, FACE_POLYGON_INDICES.leftBrow, imageWidth, imageHeight);
    const right = polygonPoints(face, FACE_POLYGON_INDICES.rightBrow, imageWidth, imageHeight);
    return polygonsToPathData([left, right]);
  }, [face, state.browTint.enabled, imageWidth, imageHeight]);

  const blushAnchors = useMemo(() => {
    if (!state.blush.enabled) return null;
    const left = landmarkAt(face, CHEEK_ANCHORS.left, imageWidth, imageHeight);
    const right = landmarkAt(face, CHEEK_ANCHORS.right, imageWidth, imageHeight);
    return { left, right };
  }, [face, state.blush.enabled, imageWidth, imageHeight]);

  return (
    <>
      {lipData !== null && (
        <Path
          data={lipData}
          fill={state.lip.color}
          opacity={state.lip.intensity}
          fillRule="evenodd"
          globalCompositeOperation="multiply"
          listening={false}
        />
      )}
      {state.lip.enabled && state.lip.finish !== 'matte' && lipData !== null && (
        <Path
          data={lipData}
          fill="#ffffff"
          opacity={state.lip.finish === 'gloss' ? 0.18 : 0.08}
          fillRule="evenodd"
          globalCompositeOperation="overlay"
          listening={false}
        />
      )}
      {eyeshadowData !== null && (
        <Path
          data={eyeshadowData}
          fill={state.eyeshadow.color}
          opacity={state.eyeshadow.intensity}
          globalCompositeOperation="multiply"
          listening={false}
        />
      )}
      {browData !== null && (
        <Path
          data={browData}
          fill={state.browTint.color}
          opacity={state.browTint.intensity}
          globalCompositeOperation="multiply"
          listening={false}
        />
      )}
      {blushAnchors !== null && (
        <BlushSpots
          anchors={blushAnchors}
          tint={state.blush}
          radius={Math.min(imageWidth, imageHeight) * 0.08}
        />
      )}
    </>
  );
}

interface BlushSpotsProps {
  anchors: {
    left: { x: number; y: number } | null;
    right: { x: number; y: number } | null;
  };
  tint: ColorTint;
  radius: number;
}

function BlushSpots({ anchors, tint, radius }: BlushSpotsProps) {
  const spots: { id: 'left' | 'right'; anchor: { x: number; y: number } }[] = [];
  if (anchors.left !== null) spots.push({ id: 'left', anchor: anchors.left });
  if (anchors.right !== null) spots.push({ id: 'right', anchor: anchors.right });
  return (
    <>
      {spots.map(({ id, anchor }) => (
        <Path
          key={id}
          data={ellipsePathData(anchor.x, anchor.y, radius, radius * 0.7)}
          fill={tint.color}
          opacity={tint.intensity}
          globalCompositeOperation="multiply"
          shadowColor={tint.color}
          shadowBlur={radius * 0.4}
          shadowOpacity={0.4}
          listening={false}
        />
      ))}
    </>
  );
}

function ellipsePathData(cx: number, cy: number, rx: number, ry: number): string {
  // SVG arc path for an ellipse: M (cx-rx) cy a rx ry 0 1 0 (2rx) 0 a rx ry 0 1 0 (-2rx) 0
  return `M ${(cx - rx).toString()} ${cy.toString()} a ${rx.toString()} ${ry.toString()} 0 1 0 ${(rx * 2).toString()} 0 a ${rx.toString()} ${ry.toString()} 0 1 0 ${(-rx * 2).toString()} 0 Z`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
