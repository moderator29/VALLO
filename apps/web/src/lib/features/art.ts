/**
 * THE FEATURE ART SLOTS (8 November 2026). Every big banner on a feature
 * screen draws its picture from a named slot here, never from a path typed
 * into a component, so new art lands by changing one line.
 *
 * Today each slot points at one of Vallo's own room or place photographs
 * (`public/brand/photos`). The founder is commissioning people art; when a
 * file arrives it goes in `public/brand/features/<slot>.webp` and the slot
 * is repointed. Every banner is designed for both kinds of picture: a full
 * photograph (`fit: "cover"`) or a cut-out of people on a transparent ground
 * (`fit: "contain"`, anchored to the banner's end edge).
 *
 * Decorative only: a slot is never shown as a listing, a member or a room.
 */
export type ArtSlot = {
  /** A public path. */
  src: string;
  /** "cover" fills the banner (a photograph); "contain" stands a cut-out at the end edge. */
  fit: "cover" | "contain";
  /** Where a cover photograph is anchored, as CSS `object-position`. */
  focus?: string;
  /** Width over height of the file, so a banner can give the picture a box of its own and never crop a face. */
  ratio?: number;
};

export const FEATURE_ART = {
  // The founder's commissioned people art (main @ 2b0aecea, 8 November 2026),
  // sliced to WebP at 1x and 2x in `public/brand/features`. The cut-outs
  // (`contain`) are people on a transparent ground, stood at the banner's end
  // edge over a Vallo gradient; the two scene plates (`cover`) carry their own
  // night-blue ground. `backdrop` is the empty blue-hour room behind a banner
  // when a cut-out needs a bed of its own.
  roommatesHero: { src: "/brand/features/roommatesHero.webp", fit: "contain", focus: "50% 50%", ratio: 1.333 },
  roommatesPromo: { src: "/brand/features/roommatesPromo.webp", fit: "contain", focus: "50% 50%", ratio: 1.312 },
  roommatesOnboarding: { src: "/brand/features/roommatesOnboarding.webp", fit: "cover", focus: "50% 45%", ratio: 1.500 },
  roommatesPublished: { src: "/brand/features/roommatesPublished.webp", fit: "contain", focus: "50% 50%", ratio: 1.200 },
  circleHero: { src: "/brand/features/circleHero.webp", fit: "cover", focus: "50% 40%", ratio: 1.499 },
  circlePromo: { src: "/brand/features/circlePromo.webp", fit: "contain", focus: "50% 50%", ratio: 0.938 },
  backdrop: { src: "/brand/features/backdrop.webp", fit: "cover", focus: "50% 50%", ratio: 1.778 },
} as const satisfies Record<string, ArtSlot>;

export type FeatureArtName = keyof typeof FEATURE_ART;
