import type Konva from 'konva';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image as KonvaImage, Layer, Stage, Transformer } from 'react-konva';

import type { CanvasLayer } from '@/lib/studio/layers';
import { useImage } from '@/lib/studio/use-image';

export interface StudioCanvasProps {
  baseImageUrl: string;
  altText: string;
  layers: CanvasLayer[];
  selectedLayerId: string | null;
  onSelectLayer: (id: string | null) => void;
  onLayerChange: (id: string, patch: Partial<CanvasLayer>) => void;
  onStageReady: (size: { width: number; height: number }) => void;
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
  baseImageUrl,
  altText,
  layers,
  selectedLayerId,
  onSelectLayer,
  onLayerChange,
  onStageReady,
}: StudioCanvasProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const layerNodes = useRef(new Map<string, Konva.Image>());
  const pinchRef = useRef<PinchState | null>(null);

  const [size, setSize] = useState<ContainerSize | null>(null);
  const baseImage = useImage(baseImageUrl);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (wrapper === null) return undefined;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry === undefined) return;
      const next = { width: entry.contentRect.width, height: entry.contentRect.height };
      setSize(next);
      onStageReady(next);
    });
    observer.observe(wrapper);
    return () => {
      observer.disconnect();
    };
  }, [onStageReady]);

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

  useEffect(() => {
    const transformer = transformerRef.current;
    if (transformer === null) return;
    if (selectedLayerId === null) {
      transformer.nodes([]);
    } else {
      const node = layerNodes.current.get(selectedLayerId);
      transformer.nodes(node === undefined ? [] : [node]);
    }
    transformer.getLayer()?.batchDraw();
  }, [selectedLayerId, layers]);

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
    const centerClient = {
      x: (t1.clientX + t2.clientX) / 2,
      y: (t1.clientY + t2.clientY) / 2,
    };

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

  const handleBackgroundClick = (event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (event.target === event.target.getStage()) {
      onSelectLayer(null);
    }
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
          onMouseDown={handleBackgroundClick}
          onTouchStart={handleBackgroundClick}
        >
          <Layer>
            <KonvaImage
              image={baseImage}
              x={initialFit.x}
              y={initialFit.y}
              scaleX={initialFit.scale}
              scaleY={initialFit.scale}
              alt={altText}
              listening={false}
            />
            {layers.map((layer) => (
              <LayerImage
                key={layer.id}
                layer={layer}
                isSelected={selectedLayerId === layer.id}
                onSelect={() => {
                  onSelectLayer(layer.id);
                }}
                onChange={(patch) => {
                  onLayerChange(layer.id, patch);
                }}
                registerNode={(node) => {
                  if (node === null) {
                    layerNodes.current.delete(layer.id);
                  } else {
                    layerNodes.current.set(layer.id, node);
                  }
                }}
              />
            ))}
            <Transformer
              ref={transformerRef}
              rotateEnabled
              keepRatio
              boundBoxFunc={(_oldBox, newBox) => {
                if (newBox.width < 10 || newBox.height < 10) return _oldBox;
                return newBox;
              }}
            />
          </Layer>
        </Stage>
      )}
    </div>
  );
}

interface LayerImageProps {
  layer: CanvasLayer;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<CanvasLayer>) => void;
  registerNode: (node: Konva.Image | null) => void;
}

function LayerImage({ layer, isSelected, onSelect, onChange, registerNode }: LayerImageProps) {
  const image = useImage(layer.imageUrl);
  if (image === null) return null;
  return (
    <KonvaImage
      ref={registerNode}
      image={image}
      x={layer.x}
      y={layer.y}
      scaleX={layer.scaleX}
      scaleY={layer.scaleY}
      rotation={layer.rotation}
      opacity={layer.opacity}
      draggable
      onMouseDown={onSelect}
      onTouchStart={onSelect}
      onDragEnd={(event) => {
        onChange({ x: event.target.x(), y: event.target.y() });
      }}
      onTransformEnd={(event) => {
        const node = event.target;
        onChange({
          x: node.x(),
          y: node.y(),
          scaleX: node.scaleX(),
          scaleY: node.scaleY(),
          rotation: node.rotation(),
        });
      }}
      {...(isSelected && { shadowColor: '#3b82f6', shadowBlur: 4, shadowOpacity: 0.6 })}
    />
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
