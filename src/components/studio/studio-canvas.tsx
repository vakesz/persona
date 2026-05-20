import type Konva from 'konva';
import {
  type ForwardedRef,
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
  /** Exports the current visible composition (baseline + tints) as a PNG blob. */
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

export const StudioCanvas = forwardRef(StudioCanvasInner);

function StudioCanvasInner(
  { baseImage, altText, face, state, compareSliderX }: StudioCanvasProps,
  ref: ForwardedRef<StudioCanvasHandle>,
) {
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

  // Expose the export-to-PNG handle. Konva's `toBlob` renders the current
  // visible state of the stage at native resolution; we crop to the baseline
  // image so the output matches the upload (no chrome, no whitespace).
  useEffect(() => {
    if (ref === null) return;
    const handle: StudioCanvasHandle = {
      exportPng: async () => {
        const group = exportGroupRef.current;
        if (group === null || baseImage === null) return null;
        const dataUrl = group.toDataURL({
          x: group.getClientRect({ skipTransform: true }).x,
          y: group.getClientRect({ skipTransform: true }).y,
          width: baseImage.naturalWidth,
          height: baseImage.naturalHeight,
          pixelRatio: 1,
          mimeType: 'image/png',
        });
        const response = await fetch(dataUrl);
        return await response.blob();
      },
    };
    if (typeof ref === 'function') {
      ref(handle);
    } else {
      ref.current = handle;
    }
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

  const handleTouchEnd = () => {
    pinchRef.current = null;
  };

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
              ref={exportGroupRef}
              x={initialFit.x}
              y={initialFit.y}
              scaleX={initialFit.scale}
              scaleY={initialFit.scale}
            >
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
                <Group
                  clipX={compareSliderX * baseImage.naturalWidth}
                  clipY={0}
                  clipWidth={Math.max(
                    0,
                    baseImage.naturalWidth - compareSliderX * baseImage.naturalWidth,
                  )}
                  clipHeight={baseImage.naturalHeight}
                >
                  <TintLayer
                    face={face}
                    state={state}
                    imageWidth={baseImage.naturalWidth}
                    imageHeight={baseImage.naturalHeight}
                  />
                </Group>
              )}
              {compareSliderX > 0 && compareSliderX < 1 && (
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
  const spots = [anchors.left, anchors.right].filter(
    (anchor): anchor is { x: number; y: number } => anchor !== null,
  );
  return (
    <>
      {spots.map((anchor, index) => (
        <Path
          key={index}
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
