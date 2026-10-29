"use client";

import { InnerNav, type InnerNavItem } from "@/components/ui/InnerNav";

/**
 * THE HOST DESK'S INNER PAGES, ONE PULL AWAY (D25, COMPONENT_LIBRARY "Glass
 * navigation": "the host and agent workspaces, inside calendar, decide,
 * rooms, earnings").
 *
 * The overview at `/host` answers "what needs me and how am I doing"; each of
 * these answers one question completely, on its own page. A host working the
 * day moves between them (answer a request, open the nights it asked for,
 * see what it paid) and this lets them do it from inside the inner page,
 * without walking back through the overview or scrolling the desk's full
 * chip row. It never replaces the dock, the sidebar or the chip row (D28):
 * it is the second level, drawn only on these five pages.
 *
 * A thin client wrapper so the server pages pass plain words; the pull, the
 * spring, the haptic and the keyboard are `InnerNav`'s.
 */
export type HostInnerPage = "decide" | "calendar" | "rooms" | "earnings" | "statements";

export const HOST_INNER_PAGES: readonly { id: HostInnerPage; href: string; icon: InnerNavItem["icon"] }[] = [
  { id: "decide", href: "/host/decide", icon: "hourglass" },
  { id: "calendar", href: "/host/calendar", icon: "calendar-clock" },
  { id: "rooms", href: "/host/rooms", icon: "bed" },
  { id: "earnings", href: "/host/earnings", icon: "wallet" },
  { id: "statements", href: "/host/earnings/statement", icon: "file-text" },
];

export function HostInnerNav({
  active,
  labels,
  label,
  toggleLabel,
}: {
  active: HostInnerPage;
  labels: Record<HostInnerPage, string>;
  label: string;
  toggleLabel: string;
}) {
  const items: InnerNavItem[] = HOST_INNER_PAGES.map((page) => ({
    id: page.id,
    label: labels[page.id],
    href: page.href,
    ...(page.icon ? { icon: page.icon } : {}),
  }));
  return (
    /* The pull toggle on its own line above the page's own title, at the
       leading edge where its panel opens, so the title stays the subject; it
       names no page itself. */
    <div className="mb-xs lg:hidden" data-testid="host-inner-nav">
      <InnerNav label={label} toggleLabel={toggleLabel} items={items} activeId={active} />
    </div>
  );
}
