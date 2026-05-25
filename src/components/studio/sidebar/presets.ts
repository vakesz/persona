import { type MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';

import type { TabId } from '@/lib/studio/capabilities';
import type { LipFinish } from '@/lib/studio/studio-state';

export { TABS_BY_GENDER } from '@/lib/studio/capabilities';
export type { AvatarGender, TabId } from '@/lib/studio/capabilities';

type StylistStyleType = 'hair' | 'makeup' | 'nails' | 'clothes';

export interface StylistRecommendation {
  title: string;
  description: string;
  styleType: StylistStyleType;
  renderPrompt: string;
}

/**
 * A preset's `value` is the literal English phrase sent to the AI model in the
 * render prompt — that keeps prompt quality stable across locales. `label`
 * is the user-visible chip text; translators can render it idiomatically.
 */
export interface PresetEntry {
  value: string;
  label: MessageDescriptor;
}

export interface HairGroup {
  label: MessageDescriptor;
  presets: PresetEntry[];
}

/** Full tab registry; persona-specific visibility is controlled by `TABS_BY_GENDER`. */
export const ALL_TABS: { id: TabId; label: MessageDescriptor }[] = [
  { id: 'lips', label: msg`Lips` },
  { id: 'eyes', label: msg`Eyes` },
  { id: 'brows', label: msg`Brows` },
  { id: 'cheeks', label: msg`Cheeks` },
  { id: 'beard', label: msg`Beard` },
  { id: 'mustache', label: msg`Mustache` },
  { id: 'hair', label: msg`Hair` },
  { id: 'extras', label: msg`Extras` },
  { id: 'vibe', label: msg`Vibe` },
  { id: 'uploads', label: msg`Uploads` },
  { id: 'ask', label: msg`Ask AI` },
];

/** Returns true for tabs that render live canvas tint controls. */
export function isColorTab(tab: TabId): boolean {
  return tab === 'lips' || tab === 'eyes' || tab === 'brows' || tab === 'cheeks';
}

export const LIP_COLORS = ['#c41e3a', '#a4361e', '#cf6e6c', '#7a3a44', '#d68a8a', '#5a1a3e'];
export const EYE_COLORS = ['#7a5230', '#5a3a20', '#9a7a5a', '#3a2a1a', '#4a3a55', '#234b6e'];
export const BLUSH_COLORS = ['#ff8db5', '#ff7ba8', '#e89bb5', '#d97070', '#f2a07a'];
export const BROW_COLORS = ['#3a2a1a', '#5a3e28', '#7a5a3a', '#2a1a10', '#1a1108'];

export const LIP_SHAPE_PRESETS: PresetEntry[] = [
  { value: 'fuller, plumper lips', label: msg`fuller, plumper lips` },
  { value: 'softer, more natural lips', label: msg`softer, more natural lips` },
  { value: 'sharper, defined outline', label: msg`sharper, defined outline` },
  { value: 'cupid-bow accent', label: msg`cupid-bow accent` },
];

export const BROW_SHAPE_PRESETS: PresetEntry[] = [
  { value: 'thin, refined brows', label: msg`thin, refined brows` },
  { value: 'arched brows', label: msg`arched brows` },
  { value: 'straight brows', label: msg`straight brows` },
  { value: 'soft natural brows', label: msg`soft natural brows` },
  { value: 'bold thick brows', label: msg`bold thick brows` },
  { value: 'feathered brows', label: msg`feathered brows` },
];

export const BEARD_PRESETS: PresetEntry[] = [
  { value: 'full beard', label: msg`full beard` },
  { value: 'goatee', label: msg`goatee` },
  { value: 'stubble', label: msg`stubble` },
  { value: 'soul patch', label: msg`soul patch` },
  { value: 'short boxed beard', label: msg`short boxed beard` },
];

export const MUSTACHE_PRESETS: PresetEntry[] = [
  { value: 'pencil mustache', label: msg`pencil mustache` },
  { value: 'thick mustache', label: msg`thick mustache` },
  { value: 'handlebar mustache', label: msg`handlebar mustache` },
  { value: 'chevron', label: msg`chevron` },
];

const HAIR_SHORT_FEMALE: PresetEntry[] = [
  { value: 'pixie cut', label: msg`pixie cut` },
  { value: 'pixie with bangs', label: msg`pixie with bangs` },
  { value: 'short crop', label: msg`short crop` },
  { value: 'chin-length bob', label: msg`chin-length bob` },
  { value: 'lob', label: msg`lob` },
];

const HAIR_MEDIUM_FEMALE: PresetEntry[] = [
  { value: 'shoulder-length waves', label: msg`shoulder-length waves` },
  { value: 'shaggy layers', label: msg`shaggy layers` },
  { value: 'curtain bangs', label: msg`curtain bangs` },
  { value: 'messy bun', label: msg`messy bun` },
  { value: 'half-up half-down', label: msg`half-up half-down` },
];

const HAIR_LONG_FEMALE: PresetEntry[] = [
  { value: 'long straight', label: msg`long straight` },
  { value: 'long loose waves', label: msg`long loose waves` },
  { value: 'tight curls', label: msg`tight curls` },
  { value: 'box braids', label: msg`box braids` },
  { value: 'sleek high ponytail', label: msg`sleek high ponytail` },
  { value: 'low pony', label: msg`low pony` },
];

const HAIR_UPDO_FEMALE: PresetEntry[] = [
  { value: 'french twist updo', label: msg`french twist updo` },
  { value: 'classic chignon', label: msg`classic chignon` },
  { value: 'top knot', label: msg`top knot` },
  { value: 'braided crown', label: msg`braided crown` },
];

const HAIR_SHORT_MALE: PresetEntry[] = [
  { value: 'buzz cut', label: msg`buzz cut` },
  { value: 'crew cut', label: msg`crew cut` },
  { value: 'short fade', label: msg`short fade` },
  { value: 'french crop', label: msg`french crop` },
  { value: 'textured crop', label: msg`textured crop` },
  { value: 'caesar cut', label: msg`caesar cut` },
];

const HAIR_MEDIUM_MALE: PresetEntry[] = [
  { value: 'side part', label: msg`side part` },
  { value: 'pompadour', label: msg`pompadour` },
  { value: 'quiff', label: msg`quiff` },
  { value: 'messy textured', label: msg`messy textured` },
  { value: 'undercut with slick back', label: msg`undercut with slick back` },
  { value: 'taper fade', label: msg`taper fade` },
];

const HAIR_LONG_MALE: PresetEntry[] = [
  { value: 'long flow', label: msg`long flow` },
  { value: 'man bun', label: msg`man bun` },
  { value: 'low ponytail', label: msg`low ponytail` },
  { value: 'shoulder-length waves', label: msg`shoulder-length waves` },
];

const HAIR_SHAVED_MALE: PresetEntry[] = [
  { value: 'fully shaved', label: msg`fully shaved` },
  { value: 'shaved with stubble', label: msg`shaved with stubble` },
];

const HAIR_SHORT_UNSPECIFIED: PresetEntry[] = [
  { value: 'buzz cut', label: msg`buzz cut` },
  { value: 'crew cut', label: msg`crew cut` },
  { value: 'pixie cut', label: msg`pixie cut` },
  { value: 'short crop', label: msg`short crop` },
  { value: 'short fade', label: msg`short fade` },
  { value: 'french crop', label: msg`french crop` },
  { value: 'chin-length bob', label: msg`chin-length bob` },
];

const HAIR_MEDIUM_UNSPECIFIED: PresetEntry[] = [
  { value: 'side part', label: msg`side part` },
  { value: 'pompadour', label: msg`pompadour` },
  { value: 'shoulder-length waves', label: msg`shoulder-length waves` },
  { value: 'shaggy layers', label: msg`shaggy layers` },
  { value: 'curtain bangs', label: msg`curtain bangs` },
  { value: 'messy bun', label: msg`messy bun` },
  { value: 'half-up half-down', label: msg`half-up half-down` },
];

const HAIR_LONG_UNSPECIFIED: PresetEntry[] = [
  { value: 'long straight', label: msg`long straight` },
  { value: 'long loose waves', label: msg`long loose waves` },
  { value: 'tight curls', label: msg`tight curls` },
  { value: 'box braids', label: msg`box braids` },
  { value: 'sleek high ponytail', label: msg`sleek high ponytail` },
  { value: 'low pony', label: msg`low pony` },
  { value: 'man bun', label: msg`man bun` },
];

const HAIR_STATEMENT_UNSPECIFIED: PresetEntry[] = [
  { value: 'fully shaved', label: msg`fully shaved` },
  { value: 'undercut', label: msg`undercut` },
  { value: 'french twist updo', label: msg`french twist updo` },
  { value: 'classic chignon', label: msg`classic chignon` },
  { value: 'braided crown', label: msg`braided crown` },
];

export const HAIRSTYLES_FEMALE: HairGroup[] = [
  { label: msg`Short`, presets: HAIR_SHORT_FEMALE },
  { label: msg`Medium`, presets: HAIR_MEDIUM_FEMALE },
  { label: msg`Long`, presets: HAIR_LONG_FEMALE },
  { label: msg`Updo`, presets: HAIR_UPDO_FEMALE },
];

export const HAIRSTYLES_MALE: HairGroup[] = [
  { label: msg`Short`, presets: HAIR_SHORT_MALE },
  { label: msg`Medium`, presets: HAIR_MEDIUM_MALE },
  { label: msg`Long`, presets: HAIR_LONG_MALE },
  { label: msg`Shaved`, presets: HAIR_SHAVED_MALE },
];

export const HAIRSTYLES_UNSPECIFIED: HairGroup[] = [
  { label: msg`Short`, presets: HAIR_SHORT_UNSPECIFIED },
  { label: msg`Medium`, presets: HAIR_MEDIUM_UNSPECIFIED },
  { label: msg`Long`, presets: HAIR_LONG_UNSPECIFIED },
  { label: msg`Statement`, presets: HAIR_STATEMENT_UNSPECIFIED },
];

export const EYEWEAR_PRESETS: PresetEntry[] = [
  { value: 'round wire glasses', label: msg`round wire glasses` },
  { value: 'square black-frame glasses', label: msg`square black-frame glasses` },
  { value: 'cat-eye glasses', label: msg`cat-eye glasses` },
  { value: 'reading glasses', label: msg`reading glasses` },
  { value: 'aviator sunglasses', label: msg`aviator sunglasses` },
  { value: 'oversized sunglasses', label: msg`oversized sunglasses` },
  { value: 'rectangle sunglasses', label: msg`rectangle sunglasses` },
];

export const HEADWEAR_PRESETS: PresetEntry[] = [
  { value: 'knit beanie', label: msg`knit beanie` },
  { value: 'baseball cap', label: msg`baseball cap` },
  { value: 'wide-brim sun hat', label: msg`wide-brim sun hat` },
  { value: 'fedora', label: msg`fedora` },
  { value: 'beret', label: msg`beret` },
  { value: 'headband', label: msg`headband` },
  { value: 'silk scarf', label: msg`silk scarf` },
];

export const JEWELRY_PRESETS: PresetEntry[] = [
  { value: 'small stud earrings', label: msg`small stud earrings` },
  { value: 'gold hoop earrings', label: msg`gold hoop earrings` },
  { value: 'statement chandelier earrings', label: msg`statement chandelier earrings` },
  { value: 'delicate pendant necklace', label: msg`delicate pendant necklace` },
  { value: 'gold choker', label: msg`gold choker` },
  { value: 'layered chains', label: msg`layered chains` },
];

export const VIBE_PRESETS: PresetEntry[] = [
  { value: 'soft tan', label: msg`soft tan` },
  { value: 'sun-kissed glow', label: msg`sun-kissed glow` },
  { value: 'dewy skin', label: msg`dewy skin` },
  { value: 'matte skin finish', label: msg`matte skin finish` },
  { value: 'light freckles', label: msg`light freckles` },
  { value: 'heavy freckles', label: msg`heavy freckles` },
  { value: 'soft natural smile', label: msg`soft natural smile` },
  { value: 'serene confident look', label: msg`serene confident look` },
];

export const FINISH_OPTIONS: { id: LipFinish }[] = [
  { id: 'matte' },
  { id: 'satin' },
  { id: 'gloss' },
];

export const QUICK_ASK_PROMPTS: MessageDescriptor[] = [
  msg`What hairstyle would suit me?`,
  msg`What lip colour should I try?`,
  msg`Suggest a complete look.`,
  msg`What outfit would flatter me?`,
];

export const FINISH_LABEL_MESSAGES: Record<LipFinish, MessageDescriptor> = {
  matte: msg`Matte`,
  satin: msg`Satin`,
  gloss: msg`Gloss`,
};
