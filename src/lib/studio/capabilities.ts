export type AvatarGender = 'male' | 'female' | 'unspecified';

export type TabId =
  | 'lips'
  | 'eyes'
  | 'brows'
  | 'cheeks'
  | 'beard'
  | 'mustache'
  | 'hair'
  | 'extras'
  | 'vibe'
  | 'uploads'
  | 'ask';

export type GeometryPlanKey =
  | 'lipShape'
  | 'browShape'
  | 'beard'
  | 'mustache'
  | 'hairstyle'
  | 'eyewear'
  | 'headwear'
  | 'jewelry'
  | 'vibe';

const CAPABILITIES_BY_GENDER = {
  male: {
    tabs: ['brows', 'beard', 'mustache', 'hair', 'extras', 'vibe', 'uploads', 'ask'],
    plans: [
      'browShape',
      'beard',
      'mustache',
      'hairstyle',
      'eyewear',
      'headwear',
      'jewelry',
      'vibe',
    ],
  },
  female: {
    tabs: ['lips', 'eyes', 'brows', 'cheeks', 'hair', 'extras', 'vibe', 'uploads', 'ask'],
    plans: ['lipShape', 'browShape', 'hairstyle', 'eyewear', 'headwear', 'jewelry', 'vibe'],
  },
  unspecified: {
    tabs: [
      'lips',
      'eyes',
      'brows',
      'cheeks',
      'beard',
      'mustache',
      'hair',
      'extras',
      'vibe',
      'uploads',
      'ask',
    ],
    plans: [
      'lipShape',
      'browShape',
      'beard',
      'mustache',
      'hairstyle',
      'eyewear',
      'headwear',
      'jewelry',
      'vibe',
    ],
  },
} satisfies Record<
  AvatarGender,
  {
    tabs: readonly TabId[];
    plans: readonly GeometryPlanKey[];
  }
>;

/** Visible studio tabs for each avatar persona. */
export const TABS_BY_GENDER: Record<AvatarGender, TabId[]> = {
  male: [...CAPABILITIES_BY_GENDER.male.tabs],
  female: [...CAPABILITIES_BY_GENDER.female.tabs],
  unspecified: [...CAPABILITIES_BY_GENDER.unspecified.tabs],
};

/** Geometry prompt fields that may affect renders for each avatar persona. */
export const ALLOWED_PLANS_BY_GENDER: Record<AvatarGender, ReadonlySet<GeometryPlanKey>> = {
  male: new Set(CAPABILITIES_BY_GENDER.male.plans),
  female: new Set(CAPABILITIES_BY_GENDER.female.plans),
  unspecified: new Set(CAPABILITIES_BY_GENDER.unspecified.plans),
};
