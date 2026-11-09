"use client";

import { useEffect, useState } from "react";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { KEPT_MARK_ATTRIBUTE, keptCopyKind, onFreshCopy } from "@/lib/offline/page-cache";

/**
 * SAVED-COPY HONESTY (Grade 1, survey SW15; UX_SYSTEM section 11).
 *
 * `ConnectionLine` says when a page is the phone's kept copy and how old it
 * is, but it says it once, at the top, and then goes. A price and an
 * availability read off a kept copy look exactly like live ones, so the
 * figure itself carries the caveat, in one small info line beside it.
 *
 * WHEN IT SHOWS. Only when the page on screen really is the phone's copy and
 * nothing fresher has arrived:
 *   - the worker answered with the kept copy because the network failed or
 *     was too slow ("kept"), or
 *   - it answered at once from the phone ("instant", "instant-light") and the
 *     phone is offline, so the refresh behind it cannot happen.
 * The navigation entry describes the document that was first loaded, so the
 * line is said only on that document's own path: a page reached by a later
 * in-app navigation came from the network and says nothing. A fresh copy kept
 * by the worker, or the signal coming back (when `ConnectionLine` refreshes
 * the page), takes it away.
 *
 * Client only, and read after mount, so the server's HTML never carries it.
 */
export const KEPT_PRICE_WORDS = "Saved on your device. Price and availability may have changed.";

function firstDocumentPath(): string | null {
  try {
    const [entry] = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
    if (entry?.name) return new URL(entry.name).pathname;
  } catch {
    /* No timing: fall back to the mark below. */
  }
  return null;
}

function readStale(): boolean {
  const kind = keptCopyKind();
  if (kind === null) return false;
  const first = firstDocumentPath();
  if (first !== null && first !== window.location.pathname) return false;
  if (first === null && !document.documentElement.hasAttribute(KEPT_MARK_ATTRIBUTE)) return false;
  if (kind === "kept") return true;
  return navigator.onLine === false;
}

/** Whether the page on screen is the phone's kept copy, with nothing fresher yet. */
export function useKeptCopy(): boolean {
  const [stale, setStale] = useState(false);
  useEffect(() => {
    let live = true;
    const check = () => {
      if (!live) return;
      try {
        setStale(readStale());
      } catch {
        setStale(false);
      }
    };
    const fresh = () => {
      if (live) setStale(false);
    };
    check();
    const stop = onFreshCopy(fresh);
    window.addEventListener("online", fresh);
    window.addEventListener("offline", check);
    return () => {
      live = false;
      stop();
      window.removeEventListener("online", fresh);
      window.removeEventListener("offline", check);
    };
  }, []);
  return stale;
}

/**
 * The one small line, near a price. `inline` draws it as a span for a place
 * that only takes phrasing content (inside a `<p>`).
 */
export function KeptPriceNote({ inline, className }: { inline?: boolean; className?: string }) {
  const stale = useKeptCopy();
  if (!stale) return null;
  const Tag = inline ? "span" : "p";
  return (
    <Tag
      className={`flex items-start gap-2xs nf-caption text-[var(--nf-content-secondary)] ${className ?? ""}`}
      data-testid="kept-price-note"
    >
      <UiIcon name="info" size={16} className="mt-3xs shrink-0" />
      <span>{KEPT_PRICE_WORDS}</span>
    </Tag>
  );
}
