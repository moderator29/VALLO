"use client";

import { useRef } from "react";
import { Chip, ChipRow } from "@/components/ui/Chip";
import type { UiIconName } from "@/design-system/icons/UiIcon";
import { useActiveChipInView } from "@/components/workspace/use-active-chip-in-view";
import type { AgentInnerPage } from "./agent-inner-nav";

/**
 * THE AGENT DESK'S PAGES, ONE TAP AWAY (R3-08; workspace phone pass, 16
 * November 2026).
 *
 * One scrolling row of link chips under the workspace bar, the same row the
 * host console draws (`HostNav`), so the two consoles move the same way: the
 * desk's queues (listings, inspections, bookings, messages, reviews) and its
 * money pages, without walking back through the dashboard or opening the
 * drawer. `AgentShell` hands it to `WorkspaceHeader` as the bar's second row,
 * so it is sticky with the bar and never scrolls out of reach.
 *
 * WHY NOT THE PULL MENU ANY MORE. It was a hamburger on its own line above
 * every page title, a second menu button a thumb-width under the bar's own
 * drawer toggle, and it hid the very destinations a phone needs to see. The
 * founder's ask for the consoles (16 November 2026) was one calm product, not
 * pieces scattered round the page; a visible row of the pages, with the
 * current one lit and scrolled into view, is that. It never replaces the rail,
 * the drawer or the dock (D28): it is the second level, and it carries the
 * desk's pages only, not the account rows the rail also holds.
 */
export function AgentInnerNav({
  pages,
  active,
  label,
}: {
  pages: readonly { id: AgentInnerPage; label: string; href: string; icon: UiIconName | undefined }[];
  active: AgentInnerPage | null;
  label: string;
  /** Still handed over by `agentInnerNavCopy`; a row of links has no toggle to name. */
  toggleLabel?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);
  useActiveChipInView(ref, active);
  return (
    <nav
      ref={ref}
      aria-label={label}
      className="px-gutter pb-xs lg:hidden"
      data-testid="agent-inner-nav"
      /* The rail bleeds by the same gutter this nav is padded with. */
      style={{ "--nf-chiprow-bleed": "var(--nf-pad-shell)" } as React.CSSProperties}
    >
      <ChipRow label={label}>
        {pages.map((page) => (
          <Chip
            key={page.id}
            behaviour="link"
            href={page.href}
            {...(page.icon ? { icon: page.icon } : {})}
            size="sm"
            selected={page.id === active}
          >
            {page.label}
          </Chip>
        ))}
      </ChipRow>
    </nav>
  );
}
