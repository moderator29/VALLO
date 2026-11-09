"use client";

import { useEffect } from "react";

/**
 * A SCREEN'S OWN STATUS BAR (Platform Grade 1, N2). The bar follows the theme
 * (`status-bar.ts`), but a screen that paints its own dark surface edge to
 * edge (the photo viewer, a live camera, a call) needs light glyphs over it
 * even in the light theme, or the clock and battery vanish into the photo.
 *
 * A screen HOLDS the glyphs it needs while it is open; the newest hold wins
 * and releasing it hands the bar back to the theme. No plugin is imported
 * here, so a web page pays nothing: the native runtime listens for the event
 * and repaints, and on the web the event simply has no listener.
 */
export type StatusGlyphs = "light" | "dark";

export const STATUS_BAR_HOLD_EVENT = "vallo:status-bar-hold";

let next = 0;
const holds = new Map<number, StatusGlyphs>();

/** The glyphs the newest open hold asks for, or null to follow the theme. */
export function heldGlyphs(): StatusGlyphs | null {
  let newest: StatusGlyphs | null = null;
  for (const glyphs of holds.values()) newest = glyphs;
  return newest;
}

function announce(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(STATUS_BAR_HOLD_EVENT));
}

/** Hold the glyphs until the returned release is called. */
export function holdStatusBar(glyphs: StatusGlyphs): () => void {
  const id = (next += 1);
  holds.set(id, glyphs);
  announce();
  return () => {
    if (holds.delete(id)) announce();
  };
}

/** Hold `glyphs` while `active` is true. */
export function useStatusBarHold(active: boolean, glyphs: StatusGlyphs = "light"): void {
  useEffect(() => {
    if (!active) return;
    return holdStatusBar(glyphs);
  }, [active, glyphs]);
}
