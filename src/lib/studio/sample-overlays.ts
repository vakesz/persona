/**
 * Built-in sample overlays for Phase 4 manual styling. Inline SVGs so we
 * don't ship binary assets — Phase 5 (AI stylist) replaces these with
 * generated PNGs. The SVGs declare explicit width/height so Konva can read
 * `naturalWidth`/`naturalHeight` reliably.
 */

export type OverlayCategory = 'hair' | 'makeup' | 'nails';

export interface SampleOverlay {
  id: string;
  category: OverlayCategory;
  label: string;
  imageUrl: string;
  width: number;
  height: number;
}

const SAMPLES: { id: string; category: OverlayCategory; label: string; svg: string }[] = [
  {
    id: 'hair-bob-brown',
    category: 'hair',
    label: 'Brown bob',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="160" viewBox="0 0 200 160"><path d="M30 80Q30 20 100 20Q170 20 170 80L170 140Q170 150 160 150L150 150Q150 100 100 90Q50 100 50 150L40 150Q30 150 30 140Z" fill="#3a2a1a"/></svg>`,
  },
  {
    id: 'hair-long-blonde',
    category: 'hair',
    label: 'Long blonde',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300" viewBox="0 0 200 300"><path d="M30 100Q30 20 100 20Q170 20 170 100L175 280Q175 290 165 290L145 290L130 100Q100 110 70 100L55 290L35 290Q25 290 25 280Z" fill="#d4b48c"/></svg>`,
  },
  {
    id: 'makeup-lipstick-red',
    category: 'makeup',
    label: 'Red lipstick',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="40" viewBox="0 0 140 40"><path d="M10 20Q30 5 50 18Q70 6 90 18Q110 5 130 20Q110 35 90 24Q70 36 50 24Q30 35 10 20Z" fill="#c41e3a"/></svg>`,
  },
  {
    id: 'makeup-blush-pink',
    category: 'makeup',
    label: 'Pink blush',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60" viewBox="0 0 200 60"><ellipse cx="40" cy="30" rx="30" ry="20" fill="#ff8db5" opacity="0.55"/><ellipse cx="160" cy="30" rx="30" ry="20" fill="#ff8db5" opacity="0.55"/></svg>`,
  },
  {
    id: 'nails-pink',
    category: 'nails',
    label: 'Pink polish',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="40" viewBox="0 0 140 40"><rect x="5" y="10" width="18" height="22" rx="6" fill="#ff7ba8"/><rect x="30" y="6" width="18" height="26" rx="6" fill="#ff7ba8"/><rect x="55" y="4" width="18" height="28" rx="6" fill="#ff7ba8"/><rect x="80" y="6" width="18" height="26" rx="6" fill="#ff7ba8"/><rect x="105" y="10" width="18" height="22" rx="6" fill="#ff7ba8"/></svg>`,
  },
];

export const SAMPLE_OVERLAYS: SampleOverlay[] = SAMPLES.map(({ id, category, label, svg }) => {
  const widthMatch = /width="(\d+)"/.exec(svg);
  const heightMatch = /height="(\d+)"/.exec(svg);
  if (widthMatch === null || heightMatch === null) {
    throw new Error(`Sample overlay ${id} is missing width/height.`);
  }
  return {
    id,
    category,
    label,
    width: Number(widthMatch[1]),
    height: Number(heightMatch[1]),
    imageUrl: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
  };
});

const SAMPLE_BY_ID = new Map(SAMPLE_OVERLAYS.map((overlay) => [overlay.id, overlay]));

export function findSampleOverlay(id: string): SampleOverlay | undefined {
  return SAMPLE_BY_ID.get(id);
}
