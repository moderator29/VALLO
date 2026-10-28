"use client";

import { useEffect } from "react";

/**
 * NO PICTURE EVER SHOWS THE BROWSER'S BROKEN-IMAGE GLYPH (28 October 2026).
 *
 * On a weak connection a photograph can fail, and the browser then draws its
 * own broken-image icon in the box (the founder's screenshot of the home
 * page). One guard for the whole platform instead of a fallback at each of the
 * hundreds of image call sites: an `error` on any `<img>` (captured, because
 * the event does not bubble) swaps in a quiet branded tile once, keeping the
 * element's size, its alt text and its shape, and marks it `data-broken` so
 * CSS and tests can see it. Pictures that failed before the page woke up are
 * found by a scan on arrival (`complete` with no width).
 *
 * It never loops (one swap per element), never touches a picture that is
 * still loading, and leaves an image that already shows the tile alone.
 * The tile is an inline SVG data URI (no request on a bad connection), in
 * neutral blue-grey that reads on both themes.
 */
const TILE =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" preserveAspectRatio="xMidYMid slice">' +
      '<rect width="64" height="64" fill="slategray" fill-opacity="0.16"/>' +
      '<path d="M20 34l12-10 12 10v10a2 2 0 0 1-2 2H22a2 2 0 0 1-2-2z" fill="none" stroke="slategray" stroke-opacity="0.55" stroke-width="2" stroke-linejoin="round"/>' +
      "</svg>",
  );

function swap(img: HTMLImageElement): void {
  if (img.dataset.broken === "1" || img.src === TILE) return;
  img.dataset.broken = "1";
  img.removeAttribute("srcset");
  img.removeAttribute("sizes");
  img.src = TILE;
}

export function ImageFallbackGuard() {
  useEffect(() => {
    const onError = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLImageElement) swap(target);
    };
    document.addEventListener("error", onError, true);
    /* What failed before this ran. */
    for (const img of Array.from(document.images)) {
      if (img.complete && img.naturalWidth === 0 && img.currentSrc) swap(img);
    }
    return () => document.removeEventListener("error", onError, true);
  }, []);
  return null;
}
