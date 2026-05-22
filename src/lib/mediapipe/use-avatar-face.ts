import { useMutation } from 'convex/react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

import {
  FacePreparationError,
  isFacePreparationError,
  type FacePreparationErrorCode,
} from './errors';
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
  /**
   * Discriminated error code. The studio's `FaceStatusBanner` translates
   * this — keep new codes in sync with the banner's switch statement.
   */
  errorCode: FacePreparationErrorCode | null;
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
 *
 * Caches the parsed shape across renders so an unrelated Convex query update
 * doesn't trigger a fresh megabyte-scale `JSON.parse` — Convex returns new
 * string identities on every patch even when the content is unchanged.
 */
export function useAvatarFace(
  avatarId: Id<'avatars'>,
  image: HTMLImageElement | null,
  landmarksJson: string | undefined,
  masksJson: string | undefined,
): UseAvatarFaceResult {
  const save = useMutation(api.avatars.saveAvatarLandmarks);
  const [errorCode, setErrorCode] = useState<FacePreparationErrorCode | null>(null);
  const inflightForAvatar = useRef<Id<'avatars'> | null>(null);
  // Avatars that already failed face preparation once in this session — we
  // don't retry them on every re-render, which would burn CPU on browsers
  // that lack WebGL or on baselines without a detectable face.
  const failedForAvatar = useRef<Id<'avatars'> | null>(null);
  // Memoised parse result keyed by string contents — keeps useMemo's
  // identity-based comparison from re-parsing megabyte JSON blobs whenever
  // Convex's reactivity gives the same JSON a new string identity.
  const parseCacheRef = useRef<{
    landmarksJson: string | undefined;
    masksJson: string | undefined;
    result: PreparedFace | null;
  } | null>(null);

  const cached = useMemo<PreparedFace | null>(() => {
    const cache = parseCacheRef.current;
    if (cache !== null && cache.landmarksJson === landmarksJson && cache.masksJson === masksJson) {
      return cache.result;
    }
    const result = parseCached(landmarksJson, masksJson);
    parseCacheRef.current = { landmarksJson, masksJson, result };
    return result;
  }, [landmarksJson, masksJson]);

  useEffect(() => {
    setErrorCode(null);
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
          throw new FacePreparationError('no_face');
        }
        await save({
          id: avatarId,
          landmarksJson: JSON.stringify(face),
          masksJson: JSON.stringify(masks),
        });
        // Convex's realtime push will flip `landmarksJson`/`masksJson` from
        // undefined to populated on the next render, which makes `cached`
        // non-null and the hook returns `ready`. Release the inflight gate
        // here too so a stalled push doesn't lock the avatar in `computing`
        // forever — the `cancelled` early-return above means we only reach
        // this line in the not-cancelled branch.
        inflightForAvatar.current = null;
      } catch (caught) {
        if (cancellation.cancelled) return;
        console.error('Face preparation failed:', caught);
        setErrorCode(isFacePreparationError(caught) ? caught.code : 'unknown');
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
    return { face: cached, status: 'ready', errorCode: null };
  }
  if (errorCode !== null) {
    return { face: null, status: 'failed', errorCode };
  }
  if (image === null) {
    return { face: null, status: 'waiting-image', errorCode: null };
  }
  return { face: null, status: 'computing', errorCode: null };
}
