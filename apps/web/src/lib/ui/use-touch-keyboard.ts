"use client";

import { useSyncExternalStore } from "react";

import { TOUCH_KEYBOARD_QUERY } from "./field-keyboard";

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => undefined;
  const query = window.matchMedia(TOUCH_KEYBOARD_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Read at the moment of a key press, where a hook's value could be a render old. */
export function isTouchKeyboard(): boolean {
  return typeof window !== "undefined" && Boolean(window.matchMedia?.(TOUCH_KEYBOARD_QUERY).matches);
}

/**
 * True where typing is done on an on-screen keyboard (a phone). False on the
 * server and on a computer, so the first paint is the computer's ("send") and
 * a phone corrects it before anybody can focus the field.
 */
export function useTouchKeyboard(): boolean {
  return useSyncExternalStore(subscribe, isTouchKeyboard, () => false);
}
