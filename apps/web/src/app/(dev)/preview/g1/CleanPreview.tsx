"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { MetaStrip } from "@/components/ui/MetaStrip";
import { InitialsTile } from "@/components/ui/InitialsTile";
import { KpiTile } from "@/components/ui/KpiTile";
import { HeroBand } from "@/components/ui/HeroBand";
import { IconPlate } from "@/components/ui/IconPlate";
import { Switch } from "@/components/ui/Switch";
import { Gauge } from "@/components/ui/charts/Gauge";
import { TimeSeries } from "@/components/ui/charts/TimeSeries";
import { Disclosure } from "@/components/app/Disclosure";
import { UiIcon } from "@/design-system/icons/UiIcon";

/*
 * THE CLEAN UNIFIED PRIMITIVES, ON ONE SHEET (plan item 5, rule R-G): every
 * primitive of `docs/design/CLEAN_UNIFIED_DIRECTION.md` in the root theme,
 * then again inside a night island, so one screenshot in light shows both
 * themes and one in dark shows the night twice. Every figure here is fixture
 * data for the harness and is labelled "Example" where it reads as a record.
 */
const TREND = Array.from({ length: 28 }, (_, i) => ({
  day: `2026-09-${String(i + 1).padStart(2, "0")}`,
  count: [3, 4, 2, 5, 6, 4, 7, 5, 6, 8, 7, 6, 9, 8, 7, 10, 9, 8, 11, 9, 10, 12, 10, 9, 11, 13, 12, 11][i]!,
}));

function Sheet({ id }: { id: string }) {
  const [view, setView] = useState<"property" | "stays">("property");
  const [mode, setMode] = useState<"setup" | "configure" | "test">("configure");
  const [market, setMarket] = useState<"buy" | "rent" | "stay">("rent");
  const [on, setOn] = useState(true);

  return (
    <div className="grid gap-lg">
      {/* Large title, the phone's page head (spec 8.1). */}
      <div className="flex items-start justify-between gap-sm">
        <div>
          <h2 className="nf-title-lg">Today</h2>
          <p className="text-[length:var(--nf-text-row)] text-[var(--nf-content-muted)]">Tuesday 29 September</p>
        </div>
        <div className="flex gap-xs">
          <Button variant="icon" round aria-label="Search">
            <UiIcon name="search" size={20} />
          </Button>
          <Button variant="icon" round aria-label="Notifications">
            <UiIcon name="bell" size={20} />
          </Button>
        </div>
      </div>

      <HeroBand
        label="Example"
        title="Your listings this week"
        sub="Three enquiries waiting on a reply, the oldest from this morning."
        action={<Button variant="primary" size="sm">New listing</Button>}
      >
        <div className="grid grid-cols-2 gap-sm lg:grid-cols-4">
          <KpiTile label="Live listings" icon="home" value={7} unit="live" href="#" previous={6} periodLabel="vs last 30 days" />
          <KpiTile label="Requests" icon="calendar-clock" value={3} unit="waiting" href="#" />
        </div>
      </HeroBand>

      <SummaryCard
        label="Move-in total"
        badge={<StatusBadge tone="example">Example</StatusBadge>}
        figure={3_450_000}
        prefix="₦"
        sentence="Rent plus every fee the agent named, added up."
        barLabel="Move-in total by line"
        segments={[
          { key: "rent", tone: "brand", label: "rent", count: 2_500_000, display: "₦2.5m" },
          { key: "caution", tone: "info", label: "caution", count: 500_000, display: "₦500k" },
          { key: "agency", tone: "warning", label: "agency", count: 250_000, display: "₦250k" },
          { key: "legal", tone: "neutral", label: "legal", count: 200_000, display: "₦200k" },
        ]}
        footer={<Button variant="quiet" size="sm">Breakdown</Button>}
      />

      <ListGroup label="Chase first" action={<a href="#">See all 8</a>}>
        <ListRow
          leading={<InitialsTile name="Acme Realty" />}
          title="Acme Realty"
          sub="18 days overdue · Example"
          value="₦42,800"
          status={<StatusBadge kind="status" tone="error">High</StatusBadge>}
          href="#"
        />
        <ListRow
          leading={<InitialsTile name="Harbour and Lane" />}
          title="Harbour and Lane"
          sub="Confirm the agreement landed"
          value="₦48,600"
          status={<StatusBadge kind="status" tone="warning">Medium</StatusBadge>}
          href="#"
        />
        <ListRow
          leading={
            <IconPlate size="sm">
              <UiIcon name="bell" size={20} />
            </IconPlate>
          }
          title="Notifications"
          sub="Push, email, in-app"
          trailing={<Switch checked={on} onCheckedChange={setOn} aria-label="Notifications" />}
        />
        <ListRow
          leading={
            <IconPlate size="sm" tone="brand">
              <UiIcon name="home" size={20} />
            </IconPlate>
          }
          title="Your workspace"
          chevron
          href="#"
        />
      </ListGroup>

      <div className="grid gap-sm">
        <p className="nf-section-label">Badges</p>
        <div className="flex flex-wrap items-center gap-xs">
          <StatusBadge tone="success">Live</StatusBadge>
          <StatusBadge tone="neutral">Draft</StatusBadge>
          <StatusBadge tone="info">To rent</StatusBadge>
          <StatusBadge tone="example">Example</StatusBadge>
          <StatusBadge tone="warning" kind="dot">Unpublished changes</StatusBadge>
          <StatusBadge tone="error" kind="dot">Needs more from you</StatusBadge>
          <StatusBadge kind="count">2</StatusBadge>
          <StatusBadge tone="success" kind="status">Paid</StatusBadge>
        </div>
        <MetaStrip leading={<UiIcon name="home" size={16} />}>
          <span>7 properties</span>
          <span>Recommended</span>
          <span>Edited 2 min ago</span>
        </MetaStrip>
      </div>

      <div className="grid gap-sm">
        <p className="nf-section-label">Buttons</p>
        <div className="flex flex-wrap items-center gap-xs">
          <Button variant="primary">Publish</Button>
          <Button variant="secondary">Save</Button>
          <Button variant="quiet" size="sm">See all 8</Button>
          <Button variant="icon" aria-label="Back">
            <UiIcon name="arrow-left" size={20} />
          </Button>
          <Button variant="danger" size="sm">Delete</Button>
        </div>
      </div>

      <div className="grid gap-sm">
        <p className="nf-section-label">Segmented</p>
        <Segmented
          label="Side"
          options={[
            { value: "property", label: "Property" },
            { value: "stays", label: "Stays", count: 3 },
          ]}
          value={view}
          onChange={setView}
        />
        <Segmented
          label="Market"
          full
          options={[
            { value: "buy", label: "Buy" },
            { value: "rent", label: "Rent" },
            { value: "stay", label: "Stay" },
          ]}
          value={market}
          onChange={setMarket}
        />
        <Segmented
          label="Mode"
          variant="solid"
          options={[
            { value: "setup", label: "Setup" },
            { value: "configure", label: "Configure" },
            { value: "test", label: "Test" },
          ]}
          value={mode}
          onChange={setMode}
        />
      </div>

      <section className="nf-summary">
        <p className="nf-section-label">Reservations by status · Example</p>
        <Gauge
          label="Reservations by status"
          totalLabel="reservations"
          stages={[
            { key: "requested", label: "Requested", count: 5, tone: "warning", sub: "Oldest 3 h ago" },
            { key: "confirmed", label: "Confirmed", count: 9, tone: "brand" },
            { key: "in", label: "Checked in", count: 4, tone: "info" },
            { key: "done", label: "Completed", count: 12, tone: "success" },
          ]}
        />
      </section>

      <section className="nf-summary">
        <p className="nf-section-label">Enquiries per day · Example</p>
        <TimeSeries points={TREND} label={`Enquiries ${id}`} target={10} targetLabel="Example target" height={140} />
      </section>

      <ListGroup label="More">
        <li className="nf-list-item">
          <Disclosure inline label="How the move-in total is worked out" hint="Four lines">
            Rent, caution, agency and legal, each as the agent named it.
          </Disclosure>
        </li>
        <li className="nf-list-item">
          <Disclosure inline label="What happens after you pay" hint="Three steps">
            The agent is told at once, the agreement opens, and the keys date is set.
          </Disclosure>
        </li>
      </ListGroup>
    </div>
  );
}

export function CleanPreview() {
  return (
    <main className="bg-[var(--nf-surface-canvas)] pb-2xl pt-md">
      <div className="nf-shell grid gap-2xl lg:grid-cols-2">
        <section aria-label="Root theme" className="min-w-0">
          <p className="nf-section-label mb-sm">Root theme</p>
          <Sheet id="root" />
        </section>
        <section
          aria-label="Night"
          data-theme="dark"
          className="min-w-0 rounded-xl bg-[var(--nf-surface-canvas)] p-md"
        >
          <p className="nf-section-label mb-sm">Night</p>
          <Sheet id="night" />
        </section>
      </div>
    </main>
  );
}
