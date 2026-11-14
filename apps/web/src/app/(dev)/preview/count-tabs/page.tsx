"use client";

import { useState } from "react";
import { CountTabs } from "@/components/ui/CountTabs";

/**
 * The count tab row (handoff section 6.3 part 1), with fixture rows only:
 * the inbox's views, the notifications families and Saved's kinds, plus a
 * narrow box that forces the row to scroll. Never real data.
 */
export default function CountTabsDeck() {
  const [view, setView] = useState("recent");
  const [family, setFamily] = useState("all");
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-xl p-gutter">
      <h1 className="nf-h2">Count tabs</h1>

      <section className="flex flex-col gap-sm">
        <h2 className="nf-h4">Filters (the inbox&apos;s views)</h2>
        <CountTabs
          label="Filter conversations"
          active={view}
          onChange={setView}
          data-testid="deck-filters"
          items={[
            { key: "recent", label: "All" },
            { key: "unread", label: "Unread", count: 12 },
            { key: "requests", label: "Requests", count: 3 },
            { key: "support", label: "Support", count: 1 },
            { key: "archived", label: "Archived" },
          ]}
        />
      </section>

      <section className="flex flex-col gap-sm">
        <h2 className="nf-h4">In a 320px box (it scrolls, tabs never shrink)</h2>
        <div style={{ width: 320 }} className="rounded-container border border-[var(--nf-border-subtle)] p-sm">
          <CountTabs
            label="Filter notifications by kind"
            active={family}
            onChange={setFamily}
            data-testid="deck-narrow"
            items={[
              { key: "all", label: "All" },
              { key: "unread", label: "Unread", count: 23 },
              { key: "messages", label: "Messages", count: 9 },
              { key: "bookings", label: "Bookings", count: 2 },
              { key: "money", label: "Money" },
              { key: "activity", label: "Activity" },
              { key: "offers", label: "Offers", count: 1 },
            ]}
          />
        </div>
      </section>

      <section className="flex flex-col gap-sm">
        <h2 className="nf-h4">Links (Saved&apos;s kinds)</h2>
        <CountTabs
          semantics="links"
          label="Filter saved by kind"
          active="stays"
          countCap={99}
          data-testid="deck-links"
          items={[
            { key: "all", label: "All", href: "#all" },
            { key: "homes", label: "Homes", href: "#homes", count: 64 },
            { key: "stays", label: "Stays", href: "#stays", count: 120 },
            { key: "restaurants", label: "Restaurants", href: "#restaurants", count: 4 },
            { key: "searches", label: "Saved searches", href: "#searches" },
          ]}
        />
      </section>
    </main>
  );
}
