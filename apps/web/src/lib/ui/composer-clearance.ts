"use client";

import { useEffect, type RefObject } from "react";
import { raiseRootFlag } from "./root-flag";

/**
 * A COMPOSER ON SCREEN TELLS THE PAGE HOW MUCH OF THE BOTTOM IT TAKES.
 *
 * The quick pill (`banner.quick`, grade1.css `.nf-quick-host`) sits at the
 * bottom of the screen, which in a thread is where the composer is. The
 * composer's height is not a constant: a reply strip, a row of attachments, a
 * pasted text chip or three lines of typing each grow it, and the keyboard
 * moves it. So the composer that is on screen raises `data-composer-up` on the
 * root and writes `--nf-composer-clearance`, the distance from the bottom of
 * the layout viewport to the composer's top edge, and the pill sits just above
 * that.
 *
 * Measured on mount, whenever the composer changes size, and whenever the
 * viewport does (the keyboard opening). Lowered and cleared on unmount.
 */
export function composerClearancePx(viewportHeight: number, composerTop: number): number {
  return Math.max(0, Math.round(viewportHeight - composerTop));
}

function measureInto(node: HTMLElement): void {
  /* The pill is `position: fixed`, so its `bottom` is counted from the bottom
     of the LAYOUT viewport, which is also what the composer's rect is read
     against. In a browser the keyboard covers the page without shrinking that
     viewport, and the pill still lands just above the composer, wherever the
     browser has brought it. */
  const view = document.documentElement.clientHeight || window.innerHeight;
  const top = node.getBoundingClientRect().top;
  document.documentElement.style.setProperty("--nf-composer-clearance", `${composerClearancePx(view, top)}px`);
}

/**
 * `ref` is the composer, or a marker at the top of everything stacked with it
 * (a reply strip, a pending photo, a pasted text chip). `signal` is anything
 * whose change moves that top edge without resizing the node itself: pass the
 * values the strips above the field are drawn from.
 */
export function useComposerClearance(
  ref: RefObject<HTMLElement | null>,
  signal?: unknown,
  /** The part that grows as the person types (the form), when `ref` is a marker above it. */
  growRef?: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof window === "undefined") return;
    const root = document.documentElement;
    const lower = raiseRootFlag("composer-up");
    const measure = () => measureInto(node);
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(node);
    if (growRef?.current && growRef.current !== node) observer?.observe(growRef.current);
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
      root.style.removeProperty("--nf-composer-clearance");
      lower();
    };
  }, [ref, growRef]);

  useEffect(() => {
    const node = ref.current;
    if (node && typeof window !== "undefined") measureInto(node);
  }, [ref, signal]);
}
