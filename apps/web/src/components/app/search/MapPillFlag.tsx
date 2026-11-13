"use client";

import { useEffect } from "react";

/**
 * Marks the document while the "Map" pill is on screen, so the dock's fade in
 * chrome.css can stop at the pill's foot. A root flag rather than
 * `:root:has(.nf-maplist-pill)`, which restyles the whole page on every DOM
 * insertion (root-has.test.ts, the same rule as the page-back flag).
 */
export function MapPillFlag() {
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-map-pill", "");
    return () => root.removeAttribute("data-map-pill");
  }, []);
  return null;
}
