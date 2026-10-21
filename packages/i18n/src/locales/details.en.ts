/**
 * THE SMALL THINGS, in English (details pass, 30 September 2026): the copy
 * confirmation, the connection line, pull to refresh, back to top, the
 * listing card's long-press menu and the retry.
 *
 * Its own module for the reason `price-check.en.ts` gives: `en.ts` is
 * written by several people in the same hour, and a namespace here costs that
 * file one import and one line. Other locales inherit these through
 * `withFallback` until a speaker writes them.
 *
 * Every line says what happened or what the reader can do. No em dashes.
 */
export const detailsEn = {
  copy: {
    /** The verb on a small copy control beside a reference or a code. */
    action: "Copy",
    copied: "Copied",
    linkCopied: "Link copied",
    codeCopied: "Code copied",
    failed: "Could not copy. Press and hold the text to copy it instead.",
  },
  share: {
    /** The share sheet was not available, so the link went to the clipboard. */
    linkCopied: "Link copied. Paste it anywhere to share.",
    failed: "Could not share from this browser. Copy the address instead.",
  },
  connection: {
    /* The phone has no signal: the page on screen is the one this phone
       kept, and every page opened before still opens. */
    offline: "You are offline. Showing what you saw last.",
    /* The phone reports signal but the network was too slow to wait for, so
       the kept copy is on screen while the fresh one loads. */
    kept: "Slow connection. Showing what you saw last.",
    back: "Back online",
  },
  refresh: {
    pull: "Pull to refresh",
    release: "Release to refresh",
    refreshing: "Refreshing",
  },
  top: {
    label: "Back to top",
  },
  cardMenu: {
    /** The sheet's accessible name. */
    title: "Listing options",
    save: "Save",
    unsave: "Remove from saved",
    saved: "Saved",
    removed: "Removed from saved",
    share: "Share",
    hide: "Hide from my results",
    /** Hidden on this phone only; nothing leaves the device. */
    hidden: "Hidden on this phone",
    undo: "Undo",
    /** Shown when the save needs a signed-in account. */
    signIn: "Sign in to save places",
    failed: "That did not go through. Try again.",
  },
  retry: "Try again",
};
