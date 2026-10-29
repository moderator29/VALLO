"use client";

import { InnerNav, type InnerNavItem } from "@/components/ui/InnerNav";
import type { AgentInnerPage } from "./agent-inner-nav";

/**
 * THE AGENT DESK'S PAGES, ONE PULL AWAY (R3-08; D25; COMPONENT_LIBRARY "Glass
 * navigation": "the host and agent workspaces").
 *
 * The same second level the host desk has (`HostInnerNav`), drawn by
 * `AgentShell` above every agent page that is not an open conversation, so an
 * agent moves between the desk's queues (listings, inspections, bookings,
 * messages, reviews) and its money pages without walking back through the
 * dashboard or opening the drawer. It never replaces the rail, the drawer or
 * the dock (D28): it is the second level, and it carries the desk's queues
 * only, not the account rows the rail also holds.
 *
 * A thin client wrapper so the server shell passes plain words; the pull, the
 * spring, the haptic and the keyboard are `InnerNav`'s.
 */
export function AgentInnerNav({
  pages,
  active,
  label,
  toggleLabel,
}: {
  pages: readonly { id: AgentInnerPage; label: string; href: string; icon: InnerNavItem["icon"] }[];
  active: AgentInnerPage | null;
  label: string;
  toggleLabel: string;
}) {
  const items: InnerNavItem[] = pages.map((page) => ({
    id: page.id,
    label: page.label,
    href: page.href,
    ...(page.icon ? { icon: page.icon } : {}),
  }));
  return (
    /* On its own line above the page's title, at the leading edge where the
       panel opens, so the title stays the subject (as on the host desk). */
    <div className="mb-xs lg:hidden" data-testid="agent-inner-nav">
      <InnerNav label={label} toggleLabel={toggleLabel} items={items} {...(active ? { activeId: active } : {})} />
    </div>
  );
}
