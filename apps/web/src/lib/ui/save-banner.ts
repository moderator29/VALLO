import { bannerWithUndo, type UndoResult } from "@/lib/ui/undo-banner";
import { banner } from "@/lib/ui/toast";

/**
 * THE BANNER FOR A SAVE (founder, 10 November 2026: "even if I bookmark
 * something it should show the banner of the action").
 *
 * Every save, bookmark and shortlist on the platform says the same thing the
 * same way: what happened, where it went, and Undo, which runs the real
 * inverse. The banner helper offers one action (Undo), so the destination is
 * in the words ("It is in Saved."). The banner host is mounted in the root
 * layout, so it shows on a deep-linked page too.
 *
 * Removing a save is also undoable: Undo puts it back.
 */
export const SAVE_WORDS = {
  saved: "Saved. It is in Saved.",
  savedDevice: "Saved on this device. It is in Saved.",
  removed: "Removed from Saved.",
  undoneSave: "Save removed.",
  undoneRemove: "Saved again. It is in Saved.",
  searchSaved: "Search saved. It is in Saved, under Searches.",
  collectionMade: "Collection made. It is in Saved, under Collections.",
  addedToCollection: "Added. It is in that collection in Saved.",
  failed: "That did not go through. Nothing was changed.",
} as const;

export function saveDoneBanner(options: {
  /** True when the thing is now saved; false when it was just removed. */
  saved: boolean;
  /** Saved on this phone only (a signed-out or catalogue save). */
  device?: boolean;
  /** The real inverse of what was just done. */
  undo: () => Promise<UndoResult>;
  /** Runs after the inverse worked, e.g. to put the heart back. */
  onUndone?: () => void;
  /** Overrides the words, e.g. for a saved search. */
  message?: string;
}): number {
  const message = options.message ?? (options.saved ? (options.device ? SAVE_WORDS.savedDevice : SAVE_WORDS.saved) : SAVE_WORDS.removed);
  return bannerWithUndo(message, {
    undo: options.undo,
    undone: options.saved ? SAVE_WORDS.undoneSave : SAVE_WORDS.undoneRemove,
    ...(options.onUndone ? { onUndone: options.onUndone } : {}),
  });
}

/** An outcome with no inverse worth offering (a failure, or a save kept for later). */
export function saveInfoBanner(message: string): number {
  return banner(message, { tone: "info" });
}
