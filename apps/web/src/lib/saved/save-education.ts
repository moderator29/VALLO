/**
 * THE FIRST-SAVE EDUCATION (founder, 14 November 2026).
 *
 * One bottom sheet, once per device, the first time a person taps a heart.
 * The sheet says "Save your favourites" with the saved-heart icon and one
 * line, and a "Got it" button. After that the device remembers and the sheet
 * is never shown again.
 *
 * This module is the reactive trigger: `triggerSaveEducation` is called from
 * the save flow after the first heart tap, and the `SaveEducation` component
 * subscribes via `useSyncExternalStore`.
 */

const STORAGE_KEY = "vallo.saved.education.v1";

const listeners = new Set<() => void>();
let pending = false;

export function subscribeSaveEducation(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function saveEducationPending(): boolean {
  return pending;
}

export function triggerSaveEducation(): void {
  if (pending) return;
  try {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(STORAGE_KEY) === "seen") return;
  } catch {
    return;
  }
  pending = true;
  for (const cb of listeners) cb();
}

export function dismissSaveEducation(): void {
  pending = false;
  try {
    window.localStorage.setItem(STORAGE_KEY, "seen");
  } catch {
    /* Not remembered; it may show again next time. */
  }
  for (const cb of listeners) cb();
}
