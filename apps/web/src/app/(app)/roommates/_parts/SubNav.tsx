"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { activeRoommatesTab, isRoommatesTabRoot, ROOMMATES_TABS } from "@/lib/features/roommates/home-dashboard";
import { useScopedCopy } from "@/lib/i18n/copy-scope";

/**
 * VALLO ROOMMATES' OWN SUB-NAVIGATION: one bar on every /roommates page.
 * It scrolls sideways on a phone and keeps the active tab in view; the tab for
 * the page you are on carries `aria-current`.
 */
/**
 * TWO PLACES, ONE NAV (13 November 2026; the founder: title first, tabs under
 * it, as on every other area). On a tab's own root page (Home, Discover,
 * Groups, Schools, Corps members, My roommates, Safety) the page draws this
 * under its title, through `PageFrame`'s tabs slot (`slot="page"`). The
 * layout's copy (`slot="layout"`, above every page) stands down on exactly
 * those paths, so the row is never drawn twice, and stays as the bar above
 * the inner pages (a room, a person, a form), which have their own back.
 */
export function RoommatesSubNav({ slot = "layout" }: { slot?: "layout" | "page" }) {
  const copy = useScopedCopy("roommates");
  const pathname = usePathname() ?? "/roommates";
  const active = activeRoommatesTab(pathname);
  const onTabRoot = isRoommatesTabRoot(pathname);
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const on = list.current?.querySelector<HTMLElement>('[aria-current="page"]');
    on?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [active]);

  if (slot === "layout" && onTabRoot) return null;

  return (
    <nav className={slot === "page" ? "nf-rmnav nf-rmnav--page" : "nf-rmnav"} aria-label={copy.area.navLabel} data-testid="roommates-subnav" data-slot={slot}>
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
