/**
 * THE ART SLOTS (8 November 2026). One place that says which picture a
 * hero or a promo card draws, so the founder's commissioned people art can
 * replace a slot without anybody touching a component. Every path is under
 * `public/` and is Vallo's own; nothing here is a sample person or a stock
 * face. Pure, client-safe.
 */
export type ArtSlot = { src: string; alt: string; width: number; height: number };

export const ART = {
  /** The Vallo Circle hero: a home at dusk, the community's front door. */
  circleHero: { src: "/brand/photos/skyline-waterfront-dusk.webp", alt: "", width: 1600, height: 1000 },
  /** The Circle promo card (the door to Circle from elsewhere). */
  circlePromo: { src: "/brand/photos/living-room-dusk.webp", alt: "", width: 1200, height: 800 },
} as const satisfies Record<string, ArtSlot>;

export type ArtKey = keyof typeof ART;
