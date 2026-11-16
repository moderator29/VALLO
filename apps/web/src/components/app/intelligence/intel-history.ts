import { EMPTY_STATE, INTEL_PATH, parseIntelUrl, type IntelUrlState } from "@/lib/intelligence/client";
import { isExploreTab } from "./model";

/**
 * THE SCREEN'S OWN HISTORY ENTRIES (the founder, 16 November 2026: "there is
 * no go back button in all pages areas etc in the VALLO intelligence").
 *
 * Every step this screen takes inside itself (a category opened, a search
 * run, a filter set, the suggestions opened) is a history entry stamped with
 * `nfIntel`: where it came from, and whether it is only the suggestions list.
 * The on-screen back, the browser's Back, the Android gesture and the
 * hardware button then all mean the same thing: one step back through those
 * entries, and only past the first of them does Back leave the screen.
 *
 * The stamp is merged into `history.state` without Next's own two keys, so
 * Next's patched `pushState` and `replaceState` still copy its internals in
 * and keep the router's address in step (passing them ourselves would make
 * Next skip that step: `app-router.js`, `copyNextJsInternalHistoryState`).
 */
export const INTEL_STATE_KEY = "nfIntel";

export type IntelEntry = {
  /** The address of the step before this one. */
  from: string;
  /** Only the suggestions list, opened over the same address. */
  suggest?: boolean;
};

const NEXT_KEYS = new Set(["__NA", "__PRIVATE_NEXTJS_INTERNALS_TREE"]);

export function readIntelEntry(state: unknown): IntelEntry | null {
  if (!state || typeof state !== "object") return null;
  const value = (state as Record<string, unknown>)[INTEL_STATE_KEY];
  if (!value || typeof value !== "object") return null;
  const from = (value as Record<string, unknown>).from;
  if (typeof from !== "string" || !from.startsWith(INTEL_PATH)) return null;
  return { from, ...((value as Record<string, unknown>).suggest === true ? { suggest: true } : {}) };
}

/** This entry's own keys (a sheet's marker, the app's sequence stamp), without Next's, plus `extra`. */
export function ownState(state: unknown, extra: Record<string, unknown> = {}): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (state && typeof state === "object") {
    for (const [key, value] of Object.entries(state as Record<string, unknown>)) {
      if (!NEXT_KEYS.has(key)) out[key] = value;
    }
  }
  return { ...out, ...extra };
}

/** The screen's home: no words, no category. */
export function isHome(state: IntelUrlState): boolean {
  return !state.q && !isExploreTab(state.tab);
}

/** Where a step with nothing of ours behind it goes back to: a search or a category goes to the home. */
export function parentOf(state: IntelUrlState): IntelUrlState | null {
  if (isHome(state)) return null;
  return EMPTY_STATE;
}

/** The step an address names, read the way the screen reads its own address. */
export function stateOfHref(href: string): IntelUrlState {
  const at = href.indexOf("?");
  return parseIntelUrl(new URLSearchParams(at >= 0 ? href.slice(at + 1) : ""));
}

/** What a back control would return to from here: a search, a category's page or the home. */
export type BackTarget = { kind: "search" } | { kind: "category"; tab: IntelUrlState["tab"] } | { kind: "home" };

export function backTargetOf(entry: IntelEntry | null, current: IntelUrlState): BackTarget {
  const to = entry ? stateOfHref(entry.from) : parentOf(current);
  if (!to) return { kind: "home" };
  if (to.q) return { kind: "search" };
  if (isExploreTab(to.tab)) return { kind: "category", tab: to.tab };
  return { kind: "home" };
}

