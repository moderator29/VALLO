"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * ONE BAR ON A PHONE (founder, 13 November 2026: "like X, Instagram and
 * Facebook"). A page header hands its back control and its title to the app
 * bar's lead slot (`.nf-app-header__lead` in AppShell), so a phone shows one
 * row: back, title, then the bell and the menu at the end. chrome.css does the
 * rest below 64rem: the menu moves to the row's end, and the page's own back
 * and heading step aside (the heading stays the page's h1 for a screen
 * reader; the bar's copy of the title is hidden from it). From 64rem the slot
 * is hidden and the page header draws its own back, as before.
 *
 * Renders nothing where there is no app bar (the workspace shell, a preview
 * without one), so the page header's own back is then the only one.
 */
export function BarBack({ back, title }: { back: ReactNode; title: string }) {
  const [lead, setLead] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const appHeader = document.querySelector<HTMLElement>(".nf-app-header");
    const slot = appHeader?.querySelector<HTMLElement>(".nf-app-header__lead") ?? null;
    if (!appHeader || !slot) return;
    setLead(slot);
    /* The flag sits on <html>, not found by a root :has(), which restyles the
       whole page on every insertion (root-has.test.ts). */
    const root = document.documentElement;
    appHeader.setAttribute("data-page-back", "");
    root.setAttribute("data-page-back", "");
    return () => {
      appHeader.removeAttribute("data-page-back");
      root.removeAttribute("data-page-back");
      setLead(null);
    };
  }, []);

  if (!lead) return null;
  return createPortal(
    <>
      {back}
      <span className="nf-app-header__title" aria-hidden="true">
        {title}
      </span>
    </>,
    lead,
  );
}
