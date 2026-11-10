import captured from "./shots.json";

/**
 * Which example screens exist on disk, written by `scripts/capture-docs.mjs`
 * (one `guide/step` key per pair of captures). A guide step names its
 * screenshot by that key; if it is not in this list the step shows a plain
 * "capture pending" frame, never a broken image.
 */
const CAPTURED = new Set<string>(captured as string[]);

export function hasShot(key: string): boolean {
  return CAPTURED.has(key);
}

/** The public address of one theme's capture. */
export function shotSrc(key: string, theme: "dark" | "light"): string {
  return `/docs/${key}-${theme}.webp`;
}
