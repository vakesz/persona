import type { Id } from '@convex/_generated/dataModel';

import { ALLOWED_PLANS_BY_GENDER, type AvatarGender } from '@/lib/studio/capabilities';

export type { AvatarGender } from '@/lib/studio/capabilities';

/**
 * Single source of truth for everything the studio knows about the in-progress
 * look. Color tints render live in the Konva canvas; geometry plans get baked
 * into the AI render prompt. No free-position layers — every change is keyed
 * to a face region or a categorical prompt.
 */

export type LipFinish = 'matte' | 'satin' | 'gloss';

export interface ColorTint {
  enabled: boolean;
  color: string; // CSS hex
  intensity: number; // 0..1 → Konva `opacity`
}

export interface LipTint extends ColorTint {
  finish: LipFinish;
}

export interface GeometryPlan {
  preset: string | null;
  custom: string;
}

export interface StudioState {
  lip: LipTint;
  lipShape: GeometryPlan;
  eyeshadow: ColorTint;
  blush: ColorTint;
  browTint: ColorTint;
  browShape: GeometryPlan;
  beard: GeometryPlan;
  mustache: GeometryPlan;
  hairstyle: GeometryPlan;
  eyewear: GeometryPlan;
  headwear: GeometryPlan;
  jewelry: GeometryPlan;
  vibe: GeometryPlan;
  /** When set, the AI render uses Phase 7's two-image try-on path. */
  selectedUploadId: Id<'uploadedItems'> | null;
}

export const DEFAULT_STUDIO_STATE: StudioState = {
  lip: { enabled: false, color: '#c41e3a', intensity: 0.55, finish: 'satin' },
  lipShape: { preset: null, custom: '' },
  eyeshadow: { enabled: false, color: '#7a5230', intensity: 0.45 },
  blush: { enabled: false, color: '#ff8db5', intensity: 0.35 },
  browTint: { enabled: false, color: '#3a2a1a', intensity: 0.6 },
  browShape: { preset: null, custom: '' },
  beard: { preset: null, custom: '' },
  mustache: { preset: null, custom: '' },
  hairstyle: { preset: null, custom: '' },
  eyewear: { preset: null, custom: '' },
  headwear: { preset: null, custom: '' },
  jewelry: { preset: null, custom: '' },
  vibe: { preset: null, custom: '' },
  selectedUploadId: null,
};

function tintApplied(tint: ColorTint): boolean {
  // An enabled-but-intensity-0 tint produces no visible pixels — skipping
  // the flatten-and-upload path keeps us from telling the model to "preserve
  // makeup" that isn't actually visible in the input snapshot.
  return tint.enabled && tint.intensity > 0;
}

/** Returns true when any visible color tint should be baked into the canvas snapshot. */
export function hasAnyTint(state: StudioState): boolean {
  return (
    tintApplied(state.lip) ||
    tintApplied(state.eyeshadow) ||
    tintApplied(state.blush) ||
    tintApplied(state.browTint)
  );
}

function planActive(plan: GeometryPlan): boolean {
  return plan.preset !== null || plan.custom.trim().length > 0;
}

function hasAnyGeometry(state: StudioState): boolean {
  return (
    planActive(state.lipShape) ||
    planActive(state.browShape) ||
    planActive(state.beard) ||
    planActive(state.mustache) ||
    planActive(state.hairstyle) ||
    planActive(state.eyewear) ||
    planActive(state.headwear) ||
    planActive(state.jewelry) ||
    planActive(state.vibe)
  );
}

/** Returns true when the studio has any tint, geometry, vibe, or try-on change selected. */
export function hasAnyChange(state: StudioState): boolean {
  return hasAnyTint(state) || hasAnyGeometry(state) || state.selectedUploadId !== null;
}

/**
 * Builds the natural-language prompt for the AI render. The flattened canvas
 * we send already shows the makeup tints, so the prompt only needs to:
 *  - tell the model to preserve the look (so it doesn't "clean" the makeup);
 *  - describe the geometry-changing additions (shape, beard, hair, accessories);
 *  - mention the try-on item if one is queued.
 *
 * The flattening guarantee is enforced by `handleRender` in the studio route
 * — if any tint is enabled, the canvas is exported to PNG and uploaded as
 * the render input; otherwise we pass through the canonical baseline.
 *
 * `gender` filters geometry plans to the visible tab set for the avatar's
 * persona. Without it, e.g. a beard preset set while the avatar was
 * `unspecified` could leak into the prompt after the persona is narrowed.
 *
 * Wording note: image-edit models work best when an edit is described
 * as a specific local change with the untouched areas named explicitly. Custom
 * user-supplied descriptions may be in any language — that hint is set
 * server-side via IMAGE_SYSTEM_INSTRUCTION.
 */
export function composeRenderPrompt(state: StudioState, gender: AvatarGender): string {
  const allowed = ALLOWED_PLANS_BY_GENDER[gender];
  const parts: string[] = [
    'Keep the original crop, aspect ratio, background, lighting, pose, expression, face shape, eyes, nose, mouth, skin texture, moles, neck, shoulders, clothing, and accessories unchanged unless a later sentence explicitly changes that area.',
  ];

  if (hasAnyTint(state)) {
    const tints: string[] = [];
    if (tintApplied(state.lip)) {
      tints.push(`${state.lip.finish} lipstick (${state.lip.color})`);
    }
    if (tintApplied(state.eyeshadow)) {
      tints.push(`eyeshadow (${state.eyeshadow.color})`);
    }
    if (tintApplied(state.blush)) {
      tints.push(`blush (${state.blush.color})`);
    }
    if (tintApplied(state.browTint)) {
      tints.push(`brow tint (${state.browTint.color})`);
    }
    parts.push(
      `Preserve the makeup already visible in the photo - ${tints.join(', ')} - exactly as shown; do not clean, soften, retouch, recolor, or remove it.`,
    );
  } else {
    parts.push('Preserve the existing makeup and skin finish exactly.');
  }

  if (allowed.has('lipShape') && planActive(state.lipShape)) {
    parts.push(
      `Edit only my lips: reshape the lip contour to ${describePlan(state.lipShape)}. Keep my mouth position, expression, teeth if visible, surrounding skin, nose, chin, and the rest of the face unchanged.`,
    );
  }
  if (allowed.has('browShape') && planActive(state.browShape)) {
    parts.push(
      `Edit only my eyebrows: reshape them to ${describePlan(state.browShape)}. Keep brow placement natural on my brow bone and preserve my eyes, eyelids, forehead, glasses if present, and facial expression unchanged.`,
    );
  }
  if (allowed.has('beard') && planActive(state.beard)) {
    parts.push(
      `Edit only the beard area: render this beard, ${describePlan(state.beard)}. If facial hair is already present, replace it cleanly with the described beard; otherwise add it naturally. Preserve my jaw shape, lips, skin marks, expression, hair, clothing, and background.`,
    );
  }
  if (allowed.has('mustache') && planActive(state.mustache)) {
    parts.push(
      `Edit only the upper-lip facial-hair area: render this mustache, ${describePlan(state.mustache)}. If a mustache is already present, replace it cleanly; otherwise add it naturally. Preserve my lips, nose, skin marks, expression, beard if not requested, hair, clothing, and background.`,
    );
  }
  if (allowed.has('hairstyle') && planActive(state.hairstyle)) {
    parts.push(
      `Edit only the hair pixels on my head: restyle them into ${describePlan(state.hairstyle)}. Replace the visible hairstyle with a coherent, realistic version of that exact cut, length, silhouette, texture, and fringe/bangs if specified. Preserve my natural hair color unless the hairstyle description explicitly asks for another color. Treat my face as locked identity reference: do not redraw, beautify, symmetrize, slim, widen, de-age, smooth, or otherwise change my eyes, eyebrows, glasses, nose, cheeks, mouth, lips, chin, jawline, skin texture, expression, forehead size, ears, neck, shoulders, clothing, background, lighting, crop, head size, or image aspect ratio. Keep the hairline natural and attached to my head; only cover or reveal the forehead where the requested hairstyle naturally does so.`,
    );
  }
  if (allowed.has('eyewear') && planActive(state.eyewear)) {
    parts.push(
      `Edit only the eyewear: render me wearing ${describePlan(state.eyewear)}. If I am already wearing glasses or similar, replace them with the described item rather than layering. Preserve my eyes, brows, face, hair, lighting, and background.`,
    );
  }
  if (allowed.has('headwear') && planActive(state.headwear)) {
    parts.push(
      `Edit only the headwear area: render me wearing ${describePlan(state.headwear)}. If I am already wearing a hat or similar, replace it with the described item. Preserve my face, hair that remains visible, clothing, lighting, crop, and background.`,
    );
  }
  if (allowed.has('jewelry') && planActive(state.jewelry)) {
    parts.push(
      `Edit only the jewelry area: render me wearing ${describePlan(state.jewelry)}. If similar jewelry is already visible in the same position, replace it with the described item. Preserve my face, hair, clothing, pose, lighting, and background.`,
    );
  }
  if (allowed.has('vibe') && planActive(state.vibe)) {
    parts.push(
      `Apply this styling finish subtly and photorealistically: ${describePlan(state.vibe)}. Do not retouch away skin texture, moles, freckles, scars, or identity details.`,
    );
  }

  if (state.selectedUploadId !== null) {
    parts.push(
      'Use the second attached image as the clothing or accessory to wear naturally; if I am already wearing a similar item, replace it rather than layering. Preserve my face, hair, pose, lighting, background, crop, and aspect ratio.',
    );
  }

  if (parts.length === 2) {
    parts.push('No structural changes requested.');
  }

  return parts.join(' ');
}

function describePlan(plan: GeometryPlan): string {
  if (plan.preset === null) return plan.custom.trim();
  const custom = plan.custom.trim();
  return custom.length === 0 ? plan.preset : `${plan.preset} (${custom})`;
}

/**
 * Builds the saved-look title from selected preset values.
 *
 * Titles are stored verbatim and are not re-translated on locale changes.
 */
export function composeRenderTitle(state: StudioState, gender: AvatarGender): string {
  const allowed = ALLOWED_PLANS_BY_GENDER[gender];
  const bits: string[] = [];
  if (allowed.has('hairstyle') && state.hairstyle.preset !== null)
    bits.push(state.hairstyle.preset);
  if (allowed.has('beard') && state.beard.preset !== null) bits.push(`${state.beard.preset} beard`);
  if (allowed.has('mustache') && state.mustache.preset !== null) {
    bits.push(`${state.mustache.preset} mustache`);
  }
  if (tintApplied(state.lip)) bits.push('lipstick');
  if (allowed.has('lipShape') && state.lipShape.preset !== null) {
    bits.push(`${state.lipShape.preset} lips`);
  }
  if (allowed.has('browShape') && state.browShape.preset !== null) {
    bits.push(`${state.browShape.preset} brows`);
  }
  if (allowed.has('eyewear') && state.eyewear.preset !== null) bits.push(state.eyewear.preset);
  if (allowed.has('headwear') && state.headwear.preset !== null) bits.push(state.headwear.preset);
  if (allowed.has('jewelry') && state.jewelry.preset !== null) bits.push(state.jewelry.preset);
  if (allowed.has('vibe') && state.vibe.preset !== null) bits.push(state.vibe.preset);
  if (state.selectedUploadId !== null) bits.push('try-on');
  if (bits.length === 0) return 'Studio render';
  return bits.join(' • ');
}
