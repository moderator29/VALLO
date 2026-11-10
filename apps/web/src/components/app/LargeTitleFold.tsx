"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * THE LARGE TITLE THAT FOLDS INTO THE BAR (plan item 29, spec section 8.1).
 *
 * `PageHeader variant="large"` draws the 30px title on the page. As the page
 * scrolls the title passes under the app bar, and the bar takes the title at
 * 15/600 in its middle while the lockup steps aside, so a reader who has
 * scrolled a long list still knows which screen they are on.
 *
 * HOW IT DECIDES. An IntersectionObserver watches the title against the
 * bar's foot: the moment the title's last line is under the bar, the header
 * gets `data-folded` and the slot `AppShell` leaves in the bar
 * (`.nf-app-header__fold`) receives the title through a portal. The fade is a
 * 160ms opacity change in `chrome.css`; where scroll timelines exist the
 * large title itself fades with the scroll (range 0 to 56px) rather than on a
 * timer. Under reduced motion, Calm and Off both switch at the threshold with
 * no fade. Nothing here moves the chrome during a route change: it reads the
 * scroll position and nothing else.
 *
 * The bar's copy is `aria-hidden`: the page's own `h1` is still the heading a
 * screen reader lands on, so the name is never announced twice.
 */
export function LargeTitleFold({ title, children }: { title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const target = ref.current?.querySelector<HTMLElement>("[data-fold-anchor]");
    if (!target || typeof IntersectionObserver === "undefined") return;
    /* The app shell's bar takes the title through a portal into its fold
       slot. A workspace bar (`WorkspaceHeader`) already prints the page's
       name, so there it is only hidden while the large title is in view
       (`data-large-title` on the bar) and shown again once it is folded:
       one title on screen at a time in both shells. */
    const appHeader = document.querySelector<HTMLElement>(".nf-app-header");
    const fold = appHeader?.querySelector<HTMLElement>(".nf-app-header__fold") ?? null;
    const header = appHeader && fold ? appHeader : document.querySelector<HTMLElement>(".nf-ws-bar");
    if (!header) return;
    if (fold && header === appHeader) setSlot(fold);
    else header.setAttribute("data-large-title", "");
    const barHeight = Math.round(header.getBoundingClientRect().height) || 56;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const under = !!entry && !entry.isIntersecting && entry.boundingClientRect.top < barHeight;
        if (under) header.setAttribute("data-folded", "");
        else header.removeAttribute("data-folded");
      },
      { rootMargin: `-${barHeight}px 0px 0px 0px`, threshold: 0 },
    );
    observer.observe(target);
    return () => {
      observer.disconnect();
      header.removeAttribute("data-folded");
      header.removeAttribute("data-large-title");
      setSlot(null);
    };
  }, []);

  return (
    <div ref={ref} className="nf-ph-large" data-large-title>
      {children}
      {slot ? createPortal(<span aria-hidden="true">{title}</span>, slot) : null}
    </div>
  );
}
