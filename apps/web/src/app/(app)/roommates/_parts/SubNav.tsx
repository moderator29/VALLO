"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { activeRoommatesTab, ROOMMATES_TABS } from "@/lib/features/roommates/home-dashboard";
import { useScopedCopy } from "@/lib/i18n/copy-scope";

/**
 * VALLO ROOMMATES' OWN SUB-NAVIGATION: one bar on every /roommates page.
 * It scrolls sideways on a phone and keeps the active tab in view; the tab for
 * the page you are on carries `aria-current`.
 */
export function RoommatesSubNav() {
  const copy = useScopedCopy("roommates");
  const pathname = usePathname() ?? "/roommates";
  const active = activeRoommatesTab(pathname);
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const on = list.current?.querySelector<HTMLElement>('[aria-current="page"]');
    on?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [active]);

  return (
    <nav className="nf-rmnav" aria-label={copy.area.navLabel} data-testid="roommates-subnav">
      <ul className="nf-rmnav__list" ref={list}>
        {ROOMMATES_TABS.map((tab) => (
          <li key={tab.id}>
            <Link href={tab.href} className={`nf-rmnav__tab${tab.id === active ? " nf-rmnav__tab--on" : ""}`} aria-current={tab.id === active ? "page" : undefined} data-testid={`roommates-tab-${tab.id}`}>
              {copy.area.tabs[tab.id]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
