/**
 * THE STORY PICTURE'S SIZE, IN ONE PLACE, because two screens must ask for
 * exactly the same file (the founder, 15 November 2026: "when I click a story
 * it doesn't open the native way, it is slow even on a fast network").
 *
 *   the viewer   draws it full-bleed (`StoryViewer`);
 *   the ring     starts downloading that same file the moment a finger lands
 *                on it, before the tap has even finished (`StoryRingItem`).
 *
 * The image optimiser names a file by its width and quality, so a ring that
 * warmed a different size would warm the wrong file and save nothing.
 *
 * `THUMB` is the ring's own small picture. The viewer lays it underneath,
 * softened, the instant it opens: same props, same file, already on the phone.
 */
export const STORY_IMAGE = { width: 1200, height: 1600, sizes: "100vw", quality: 90 } as const;
export const STORY_THUMB = { width: 128, height: 128, sizes: "64px" } as const;
