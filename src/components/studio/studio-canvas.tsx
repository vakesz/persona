import type Konva from 'konva';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image as KonvaImage, Layer, Stage } from 'react-konva';

export interface StudioCanvasProps {
  baseImageUrl: string;
  altText: string;
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
  centerClient: { x: number; y: number };
}

export function StudioCanvas({ baseImageUrl, altText }: StudioCanvasProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const pinchRef = useRef<PinchState | null>(null);

  const [size, setSize] = useState<ContainerSize | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);

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

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = baseImageUrl;
    const onLoad = () => {
      setImage(img);
    };
    img.addEventListener('load', onLoad);
    return () => {
      img.removeEventListener('load', onLoad);
    };
  }, [baseImageUrl]);

  const initialFit = useMemo(() => {
    if (size === null || image === null) return null;
    const scale = Math.min(size.width / image.naturalWidth, size.height / image.naturalHeight);
    return {
      scale,
      x: (size.width - image.naturalWidth * scale) / 2,
      y: (size.height - image.naturalHeight * scale) / 2,
    };
  }, [size, image]);

  const zoomAroundPoint = (clientX: number, clientY: number, factor: number) => {
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
  };

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
    const centerClient = {
      x: (t1.clientX + t2.clientX) / 2,
      y: (t1.clientY + t2.clientY) / 2,
    };

    const previous = pinchRef.current;
    if (previous === null) {
      pinchRef.current = { distance, centerClient };
      return;
    }

    zoomAroundPoint(centerClient.x, centerClient.y, distance / previous.distance);
    pinchRef.current = { distance, centerClient };
  };

  const handleTouchEnd = () => {
    pinchRef.current = null;
  };

  return (
    <div
      ref={wrapperRef}
      className="bg-muted relative aspect-[4/5] w-full touch-none overflow-hidden rounded-lg"
    >
      {size !== null && image !== null && initialFit !== null && (
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
            <KonvaImage
              image={image}
              x={initialFit.x}
              y={initialFit.y}
              scaleX={initialFit.scale}
              scaleY={initialFit.scale}
              alt={altText}
              listening={false}
            />
          </Layer>
        </Stage>
      )}
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
