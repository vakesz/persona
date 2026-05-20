import { useEffect, useState } from 'react';

/**
 * Loads an `HTMLImageElement` from a URL for use with React-Konva.
 *
 * Returns `null` while loading or if the load fails — callers should bail out
 * of rendering until it resolves, since Konva's `Image` shape needs a real
 * `HTMLImageElement` (or canvas) instance.
 */
export function useImage(url: string): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    let cancelled = false;
    const onLoad = () => {
      if (!cancelled) setImage(img);
    };
    const onError = () => {
      if (!cancelled) setImage(null);
    };
    img.addEventListener('load', onLoad);
    img.addEventListener('error', onError);
    img.src = url;
    return () => {
      cancelled = true;
      img.removeEventListener('load', onLoad);
      img.removeEventListener('error', onError);
    };
  }, [url]);

  return image;
}
