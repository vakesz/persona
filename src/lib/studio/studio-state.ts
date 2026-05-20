import type { Id } from '@convex/_generated/dataModel';

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

export function hasAnyTint(state: StudioState): boolean {
  return (
    state.lip.enabled || state.eyeshadow.enabled || state.blush.enabled || state.browTint.enabled
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

export function hasAnyChange(state: StudioState): boolean {
  return hasAnyTint(state) || hasAnyGeometry(state) || state.selectedUploadId !== null;
}

/**
 * Builds the natural-language prompt for the AI render. The flattened canvas
 * we send already shows the makeup tints, so the prompt only needs to:
 *  - tell Gemini to preserve the look (so it doesn't "clean" the makeup);
 *  - describe the geometry-changing additions (shape, beard, hair, accessories);
 *  - mention the try-on item if one is queued.
 *
 * The flattening guarantee is enforced by `composeRenderInputs` in the studio
 * route — if any tint is enabled, the canvas is exported to PNG and uploaded
 * as the render input; otherwise we pass through the canonical baseline.
 */
export function composeRenderPrompt(state: StudioState): string {
  const parts: string[] = [];

  if (hasAnyTint(state)) {
    const tints: string[] = [];
    if (state.lip.enabled) {
      tints.push(`${state.lip.finish} lipstick (${state.lip.color})`);
    }
    if (state.eyeshadow.enabled) {
      tints.push(`eyeshadow (${state.eyeshadow.color})`);
    }
    if (state.blush.enabled) {
      tints.push(`blush (${state.blush.color})`);
    }
    if (state.browTint.enabled) {
      tints.push(`brow tint (${state.browTint.color})`);
    }
    parts.push(
      `Preserve the makeup already visible in the photo — ${tints.join(', ')} — exactly as shown.`,
    );
  } else {
    parts.push('Preserve the existing look exactly.');
  }

  if (planActive(state.lipShape)) {
    parts.push(`Reshape the lips to ${describePlan(state.lipShape)}.`);
  }
  if (planActive(state.browShape)) {
    parts.push(`Reshape the eyebrows to ${describePlan(state.browShape)}.`);
  }
  if (planActive(state.beard)) {
    parts.push(`Add a ${describePlan(state.beard)}.`);
  }
  if (planActive(state.mustache)) {
    parts.push(`Add a ${describePlan(state.mustache)}.`);
  }
  if (planActive(state.hairstyle)) {
    parts.push(`Change the hairstyle to ${describePlan(state.hairstyle)}.`);
  }
  if (planActive(state.eyewear)) {
    parts.push(`Add ${describePlan(state.eyewear)}.`);
  }
  if (planActive(state.headwear)) {
    parts.push(`Add ${describePlan(state.headwear)}.`);
  }
  if (planActive(state.jewelry)) {
    parts.push(`Add ${describePlan(state.jewelry)}.`);
  }
  if (planActive(state.vibe)) {
    parts.push(`Apply ${describePlan(state.vibe)}.`);
  }

  if (state.selectedUploadId !== null) {
    parts.push('Use the second attached image as the clothing or accessory to wear naturally.');
  }

  if (parts.length === 1) {
    parts.push('No structural changes requested.');
  }

  return parts.join(' ');
}

function describePlan(plan: GeometryPlan): string {
  if (plan.preset === null) return plan.custom.trim();
  const custom = plan.custom.trim();
  return custom.length === 0 ? plan.preset : `${plan.preset} (${custom})`;
}

export function composeRenderTitle(state: StudioState): string {
  const bits: string[] = [];
  if (state.hairstyle.preset !== null) bits.push(state.hairstyle.preset);
  if (state.beard.preset !== null) bits.push(`${state.beard.preset} beard`);
  if (state.mustache.preset !== null) bits.push(`${state.mustache.preset} mustache`);
  if (state.lip.enabled) bits.push('lipstick');
  if (state.lipShape.preset !== null) bits.push(`${state.lipShape.preset} lips`);
  if (state.browShape.preset !== null) bits.push(`${state.browShape.preset} brows`);
  if (state.eyewear.preset !== null) bits.push(state.eyewear.preset);
  if (state.headwear.preset !== null) bits.push(state.headwear.preset);
  if (state.jewelry.preset !== null) bits.push(state.jewelry.preset);
  if (state.vibe.preset !== null) bits.push(state.vibe.preset);
  if (state.selectedUploadId !== null) bits.push('try-on');
  if (bits.length === 0) return 'Studio render';
  return bits.join(' • ');
}
