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
};

export const FEATURE_ART = {
  roommatesHero: { src: "/brand/photos/living-room-dusk.webp", fit: "cover", focus: "60% 50%" },
  roommatesPromo: { src: "/brand/photos/bedroom-02.webp", fit: "cover", focus: "50% 50%" },
  roommatesOnboarding: { src: "/brand/photos/bedroom-01.webp", fit: "cover", focus: "50% 60%" },
  roommatesPublished: { src: "/brand/photos/living-room-day.webp", fit: "cover", focus: "50% 50%" },
  circleHero: { src: "/brand/photos/villa-exterior-sunset.webp", fit: "cover", focus: "50% 50%" },
  circlePromo: { src: "/brand/photos/terrace-lounge-night.webp", fit: "cover", focus: "50% 50%" },
} as const satisfies Record<string, ArtSlot>;

export type FeatureArtName = keyof typeof FEATURE_ART;
