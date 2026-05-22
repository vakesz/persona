import { useEffect, useState } from 'react';

/**
 * Loads an `HTMLImageElement` from a URL for use with React-Konva.
 *
 * Returns `null` while loading or if the load fails. Awaits `img.decode()`
 * before exposing the element so Konva never paints a half-decoded texture
 * (sporadically appears as width-0 / blank in offscreen exports).
 */
export function useImage(url: string): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (url === '') {
      setImage(null);
      return undefined;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    let cancelled = false;
    img
      .decode()
      .then(() => {
        if (!cancelled) setImage(img);
      })
      .catch(() => {
        if (!cancelled) setImage(null);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return image;
}
