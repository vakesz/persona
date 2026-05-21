import { useMutation } from 'convex/react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

import { isFaceLandmarksResult, type FaceLandmarksResult, runFaceLandmarker } from './face';
import { isSegmentationResult, runImageSegmenter, type SegmentationResult } from './segmentation';

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

function parseCached(
  landmarksJson: string | undefined,
  masksJson: string | undefined,
): PreparedFace | null {
  if (landmarksJson === undefined || masksJson === undefined) return null;
  try {
    const landmarks: unknown = JSON.parse(landmarksJson);
    const masks: unknown = JSON.parse(masksJson);
    if (!isFaceLandmarksResult(landmarks) || !isSegmentationResult(masks)) {
      // Persisted blob doesn't match the current shape — treat as cache
      // miss and re-detect, so a schema drift doesn't break the studio.
      console.warn('Cached face data failed shape validation; re-detecting.');
      return null;
    }
    return { landmarks, masks };
  } catch {
    return null;
  }
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
  // Avatars that already failed face preparation once in this session — we
  // don't retry them on every re-render, which would burn CPU on browsers
  // that lack WebGL or on baselines without a detectable face.
  const failedForAvatar = useRef<Id<'avatars'> | null>(null);

  const cached = useMemo<PreparedFace | null>(
    () => parseCached(landmarksJson, masksJson),
    [landmarksJson, masksJson],
  );

  useEffect(() => {
    setError(null);
    inflightForAvatar.current = null;
    failedForAvatar.current = null;
  }, [avatarId]);

  useEffect(() => {
    if (cached !== null) return;
    if (image === null) return;
    if (inflightForAvatar.current === avatarId) return;
    if (failedForAvatar.current === avatarId) return;
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
        // Persist the failure for this avatar so the next render doesn't
        // immediately retry. The user can reload the page (or switch avatars
        // and back) to retry.
        failedForAvatar.current = avatarId;
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
