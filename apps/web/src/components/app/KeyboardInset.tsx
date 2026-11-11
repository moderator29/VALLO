"use client";

import { useEffect } from "react";
import { startKeyboardInset } from "@/lib/viewport/keyboard-inset";

/**
 * Mounts the browser's half of the keyboard contract. Renders nothing.
 *
 * Beside `NativeRuntime` in the root layout and the mirror image of it: that
 * one starts inside the shell and returns at once on the website, this one
 * starts on the website and returns at once inside the shell
 * (`lib/viewport/keyboard-inset.ts` says why both halves are needed and why
 * they must never both run).
 *
 * It costs one listener on `visualViewport` and nothing else: no import that
 * a browser would not already have, no state, no render.
 */
export function KeyboardInset() {
  useEffect(() => startKeyboardInset(), []);
  return null;
}
