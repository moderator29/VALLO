"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { WholePrefetchLink } from "@/components/app/WholePrefetchLink";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { motionQuiet } from "@/lib/motion/gate";
import { isCurrent, type NavLeaf, type NavSection } from "./nav-model";

/**
 * The navigation list, for both modes.
 *
 * Personal Mode and Agent Mode used to have two navigations that looked like
 * two products: one stroked glyph list with a brand-blue pill, one column of
 * 26px 3D tiles with an agent-green one. An agent switching between them was
 * learning a second interface for the same job. This renders both from the same
 * `NavSection[]`, with one prop deciding the accent.
 *
 * ---------------------------------------------------------------------------
 * IT IS NO LONGER A TREE, AND THAT IS THE CHANGE.
 *
 * This file used to render parents with children: a disclosure arrow, an open
 * set persisted per mode in localStorage, a seeded set so the group containing
 * the current page opened on arrival, a tree line down the children, and a rule
 * that the parent's label navigated while only the arrow expanded. Roughly a
 * third of the code and every hard part of it.
 *
 * All of it is gone, because the sub-navigation it served is gone. The rule
 * now, stated by the owner and applied everywhere: IF SOMETHING NEEDS CHILDREN
 * IT IS EITHER ITS OWN SCREEN OR IT DOES NOT BELONG IN NAVIGATION.
 *
 * What that removed, concretely. Five `/search?type=` rows that were one screen
 * with a query parameter changed. Three feed rows, the first of which pointed
 * at its own parent's href. Three profile rows for a destination that is
 * already a row at the top of the rail. An agent listings parent whose two
 * children were the list and the button on the list. An earnings parent whose
 * child was the chart on the earnings page.
 *
 * A person should not have to open a thing to find out whether what they want
 * is inside it. Every row here goes somewhere, immediately, and there is
 * nothing to discover.
 *
 * `NavNode` is still exported by `nav-model` and `children` is still on the
 * type. This file ignores it. Left in place rather than deleted because
 * removing a field from a shared type mid-wave changes two other files that are
 * not this one's to change; nothing constructs it any more.
 */

export function NavTree({
  sections,
  active,
  activeType = null,
  label,
  accent = "brand",
  onNavigate,
  whole = false,
  collapsed = false,
}: {
  sections: NavSection[];
  active: string;
  activeType?: string | null;
  label: string;
  /** `agent` swaps the active pill and glyph colour for the mode's own. */
  accent?: "brand" | "agent";
  onNavigate?: () => void;
  /**
   * Fetch each row's page whole before the tap (`WholePrefetchLink`). The
   * drawer sets it: its rows mount when it opens, which is when a reader is
   * choosing where to go. The desktop rail does not, because it is always on
   * screen and would fetch every page on every load.
   */
  whole?: boolean;
  /**
   * The desktop rail's 72px icon-only mode (AppRail). The labels stay in the
   * markup, visually hidden, so every row keeps its accessible name, and each
   * row carries its label as a `title`, the tooltip a pointer gets.
   */
  collapsed?: boolean;
}) {
  const Row = whole ? WholePrefetchLink : Link;

  /*
   * THE CURRENT ROW IS ON SCREEN. The list scrolls with its scrollbar hidden,
   * so a current row below the fold (Settings on a 900px-tall laptop) was a
   * page you were on that the navigation did not show. On mount, and when the
   * current page changes, the list scrolls just far enough to show it: the
   * `block: "nearest"` rule, applied to this list alone rather than through
   * `scrollIntoView`, which would also scroll the page and the drawer around
   * it. Arriving is instant; a later change glides unless motion is quiet.
   */
  const navRef = useRef<HTMLElement | null>(null);
  const mountedRef = useRef(false);
  useEffect(() => {
    const list = navRef.current;
    const first = !mountedRef.current;
    mountedRef.current = true;
    const row = list?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!list || !row || list.scrollHeight <= list.clientHeight) return;
    const box = list.getBoundingClientRect();
    const at = row.getBoundingClientRect();
    const delta = at.top < box.top ? at.top - box.top : at.bottom > box.bottom ? at.bottom - box.bottom : 0;
    if (delta === 0) return;
    list.scrollBy({ top: delta, behavior: first || motionQuiet() ? "auto" : "smooth" });
  }, [active, activeType]);
  const row = (item: NavLeaf) => {
    const current = isCurrent(item.href, active, activeType);
    return (
      <li key={`${item.href}-${item.label}`}>
        <Row
          href={item.href}
          onClick={onNavigate}
          aria-current={current ? "page" : undefined}
          title={collapsed ? item.label : undefined}
          className={`nf-nav__row${current ? " nf-nav__row--on" : ""}`}
        >
          <span className="nf-nav__glyph" aria-hidden="true">
            {/* Line glyphs only, 29 September 2026, and final: the founder
                ruled the side navigation keeps its blue line icons. The rows
                once drew glass objects at 30px, below the 32px where the glass
                set reads (docs/ICON_SYSTEM.md), and they blurred. The stroked
                set at `md` (24) is crisp beside 16px type, and the current
                row takes its drawn filled twin. The dock's More tray draws the
                same line set. */}
            <UiIcon name={item.icon} size="md" filled={current} />
          </span>
          <span className="nf-nav__label">{item.label}</span>
          {/*
            THE BETA MARK (the founder, 27 November 2026), on Roommates, VALLO
            Intelligence and the AI Assistant.

            Beside the label rather than after the count, because it qualifies
            the destination and an unread count qualifies what is waiting in
            it; and quiet rather than bright, because three lit pills down one
            rail would read as three alerts. It is a statement of where the
            product is, not an alarm.

            Hidden with the label when the rail is collapsed to glyphs: the
            row is a 24px icon there and a word beside it has nowhere to go.
          */}
          {item.betaLabel ? <span className="nf-nav__beta">{item.betaLabel}</span> : null}
          {item.badge ? <span className="nf-count-badge nf-nav__badge nf-numeric">{item.badge}</span> : null}
        </Row>
      </li>
    );
  };

  /*
   * HIDING A SECTION BECAUSE THE DOCK REPEATS IT ONLY MAKES SENSE IF SOMETHING
   * ELSE IS LEFT TO SHOW.
   *
   * `hideWhenDocked` drops Home, Explore and Around below 64rem, because the
   * bottom dock already carries those three and a drawer that repeats them is
   * a drawer of things you can already reach. Sound, with one case nobody
   * checked: a SIGNED-OUT visitor has no account block, so that section is the
   * only one there is, and hiding it left the phone drawer completely empty -
   * a full-height panel holding a wordmark, a close button and the theme
   * switch, and not one place to go.
   *
   * So the flag is only honoured while another section survives it. Nothing
   * changes for a signed-in reader, and nothing changes on desktop, where the
   * rule was already inert.
   */
  const suppressDocking = sections.filter((section) => !section.hideWhenDocked).length === 0;

  return (
    <nav
      ref={navRef}
      aria-label={label}
      className={`nf-nav__scroll${accent === "agent" ? " nf-nav__scroll--agent" : ""}`}
    >
      {sections.map((section, index) => (
        <div
          key={section.heading ?? `section-${index}`}
          className={`nf-nav__section${
            section.hideWhenDocked && !suppressDocking ? " nf-nav__section--docked" : ""
          }`}
        >
          {section.heading && <h2 className="nf-nav__heading">{section.heading}</h2>}
          <ul>{section.items.map(row)}</ul>
        </div>
      ))}
    </nav>
  );
}
