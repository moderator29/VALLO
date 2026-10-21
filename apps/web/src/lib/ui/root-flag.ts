"use client";

import { useEffect } from "react";

/**
 * Reference-counted `data-*` flags on <html>, raised by the component that
 * owns the state and lowered when it unmounts.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS INSTEAD OF `:root:has(...)`.
 *
 * Stylesheets used to ask the root about its descendants (`:root:has(.nf-toast)
 * .nf-to-top`, `:root:has(.nf-main--docked) .nf-toast-host`, and so on). In
 * Chrome every DOM insertion that might touch a `:has()` argument re-checks
 * the anchor, and an anchor on the root invalidates the whole document: a trace
 * of the live landing page on a 4x throttled phone (17 October 2026) showed
 * eight full-document style recalculations in the first five seconds, about
 * 110 to 340ms each, every one preceded by a `:has` invalidation on <html>.
 * With the root `:has()` rules neutralised the same page did three, and style
 * time fell by about 45 percent. A root attribute with a descendant rule
 * (`:root[data-toast-up] .nf-to-top`) is invalidated by class: only the
 * matching elements restyle.
 *
 * `app/root-has.test.ts` keeps `:root:has(`, `html:has(` and `body:has(` out
 * of screen stylesheets.
 *
 * Counted, because two owners can hold the same flag at once (two docked
 * shells across a route transition, two toasts).
 */
const counts = new Map<string, number>();

function attr(name: string): string {
  return `data-${name}`;
}

/** Raises the flag and returns the function that lowers it once. */
export function raiseRootFlag(name: string, value = ""): () => void {
  if (typeof document === "undefined") return () => {};
  const next = (counts.get(name) ?? 0) + 1;
  counts.set(name, next);
  document.documentElement.setAttribute(attr(name), value);
  let lowered = false;
  return () => {
    if (lowered) return;
    lowered = true;
    const left = (counts.get(name) ?? 1) - 1;
    if (left <= 0) {
      counts.delete(name);
      document.documentElement.removeAttribute(attr(name));
    } else {
      counts.set(name, left);
    }
  };
}

/** Holds `data-<name>` on <html> while `on` is true and the caller is mounted. */
export function useRootFlag(name: string, on = true, value = ""): void {
  useEffect(() => {
    if (!on) return;
    return raiseRootFlag(name, value);
  }, [name, on, value]);
}
