"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isDataSaver } from "@/lib/ui/data-saver";
import { intentPrefetchHref } from "@/lib/nav/intent-prefetch";

/**
 * THE WHOLE PAGE, ASKED FOR AS THE FINGER LANDS (platform speed, 13 November
 * 2026). Renders nothing.
 *
 * A card's link is prefetched as it scrolls into view, but only down to the
 * page's loading skeleton: the listing itself is fetched when the tap is
 * complete. On a phone the finger rests on the glass for 80 to 150 ms before
 * the click fires, which is about one Lagos to Dublin round trip. Asking for
 * the whole page (`kind: "full"`) on `pointerdown` spends that time fetching
 * it, and the navigation joins the request already on its way, so the page
 * paints that much sooner. Only the catalogue's detail pages
 * (`intentPrefetchHref`), whose public part now comes from the shared cache
 * and costs the server little to draw.
 *
 * Never under data saving, the same rule as every other fetch ahead here, and
 * never for a mouse (hover already prefetches, and a click follows at once).
 */

type PrefetchOptions = NonNullable<Parameters<ReturnType<typeof useRouter>["prefetch"]>[1]>;
const WHOLE = { kind: "full" } as unknown as PrefetchOptions;

export function IntentPrefetch() {
  const router = useRouter();
  useEffect(() => {
    const asked = new Map<string, number>();
    const onDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse" || event.button !== 0) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const href = intentPrefetchHref(anchor.href, window.location.origin);
      if (!href) return;
      /* One whole-page fetch per address per thirty seconds is plenty. */
      const now = Date.now();
      if ((asked.get(href) ?? 0) > now - 30_000) return;
      if (isDataSaver()) return;
      asked.set(href, now);
      try {
        router.prefetch(href, WHOLE);
      } catch {
        /* A prefetch is a hint; the tap still navigates. */
      }
    };
    document.addEventListener("pointerdown", onDown, { capture: true, passive: true });
    return () => document.removeEventListener("pointerdown", onDown, { capture: true });
  }, [router]);
  return null;
}
