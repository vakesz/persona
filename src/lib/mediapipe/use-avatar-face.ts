import { useMutation } from 'convex/react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

import { type FaceLandmarksResult, runFaceLandmarker } from './face';
import { runImageSegmenter, type SegmentationResult } from './segmentation';

interface PreparedFace {
  landmarks: FaceLandmarksResult;
  masks: SegmentationResult;
}

type FaceStatus = 'waiting-image' | 'computing' | 'ready' | 'failed';

export interface UseAvatarFaceResult {
  face: PreparedFace | null;
  status: FaceStatus;
  error: string | null;
}

/**
 * Computes (or returns) the face landmarks + segmentation masks for an avatar's
 * canonical baseline. If `landmarksJson` / `masksJson` are already populated
 * the function never runs MediaPipe — Convex is the cache. Otherwise it runs
 * both MediaPipe tasks against the supplied baseline image, then persists the
 * result via `saveAvatarLandmarks` so the next visit is free.
 */
export function useAvatarFace(
  avatarId: Id<'avatars'>,
  image: HTMLImageElement | null,
  landmarksJson: string | undefined,
  masksJson: string | undefined,
): UseAvatarFaceResult {
  const save = useMutation(api.avatars.saveAvatarLandmarks);
  const [error, setError] = useState<string | null>(null);
  const inflightForAvatar = useRef<Id<'avatars'> | null>(null);

  const cached = useMemo<PreparedFace | null>(() => {
    if (landmarksJson === undefined || masksJson === undefined) return null;
    try {
      const landmarks = JSON.parse(landmarksJson) as FaceLandmarksResult;
      const masks = JSON.parse(masksJson) as SegmentationResult;
      return { landmarks, masks };
    } catch {
      return null;
    }
  }, [landmarksJson, masksJson]);

  useEffect(() => {
    setError(null);
    inflightForAvatar.current = null;
  }, [avatarId]);

  useEffect(() => {
    if (cached !== null) return;
    if (image === null) return;
    if (inflightForAvatar.current === avatarId) return;
    inflightForAvatar.current = avatarId;

    const cancellation = { cancelled: false };
    void (async () => {
      try {
        const [face, masks] = await Promise.all([
          runFaceLandmarker(image),
          runImageSegmenter(image),
        ]);
        if (cancellation.cancelled) return;
        if (face === null) {
          throw new Error('No face detected in the baseline portrait.');
        }
        await save({
          id: avatarId,
          landmarksJson: JSON.stringify(face),
          masksJson: JSON.stringify(masks),
        });
      } catch (caught) {
        if (cancellation.cancelled) return;
        console.error('Face preparation failed:', caught);
        setError(caught instanceof Error ? caught.message : 'Face preparation failed.');
        inflightForAvatar.current = null;
      }
    })();

    return () => {
      cancellation.cancelled = true;
    };
  }, [avatarId, image, cached, save]);

  if (cached !== null) {
    return { face: cached, status: 'ready', error: null };
  }
  if (error !== null) {
    return { face: null, status: 'failed', error };
  }
  if (image === null) {
    return { face: null, status: 'waiting-image', error: null };
  }
  return { face: null, status: 'computing', error: null };
}
