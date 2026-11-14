import { requireAdmin, requireConsole } from "@/lib/admin/guard";
import { StaffHome } from "./_components/StaffFrame";
import { getLocale } from "@/lib/locale";
import { getQueueCounts, getRiskAlerts } from "@/lib/admin/queries";
import { getJobHealth } from "@/lib/admin/reads/operations";
import {
  getCollectedSeries,
  getConsolePulse,
  getNewListingsByRole,
  getSupplyByType,
} from "@/lib/admin/reads/overview";
import type { CollectedRange } from "@/lib/admin/reads/shapes";
import { LiveRefresh } from "./_components/LiveRefresh";
import { safeDesk } from "./_components/entry";
import { OverviewView } from "./_components/OverviewView";
import { YourDesks } from "./_components/YourDesks";

export const dynamic = "force-dynamic";

const RANGES: readonly CollectedRange[] = ["30d", "90d", "12m"];

/** The request's clock, read once so every "12m ago" on the page agrees. */
function requestTime(): number {
  return Date.now();
}

/**
 * The console's front door, and where entering the console always lands:
 * nothing under `app/admin`, the proxy or the drawer sends an operator to a
 * desk first (the drawer's Console row links `/admin`).
 *
 * Every figure is read under the admin gate the layout already applied,
 * through the operator's own session (`lib/admin/reads/`), plus the existing
 * `getQueueCounts` and `getRiskAlerts`. A read that fails is drawn as not
 * loaded on its own panel; the others still draw. The page refreshes itself
 * every minute while it is open (`LiveRefresh`).
 */
export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; next?: string }>;
}) {
  /* Track K: a staff member's front page is their own desks, not the
     operator's overview (whose reads would all refuse them). */
  const operator = await requireAdmin();
  if (operator.state !== "admin") {
    const door = await requireConsole();
    return door.state === "console" ? <StaffHome staff={door.staff} /> : null;
  }
  /* An operator who also holds a named position sees that position's desks first. */
  const door = await requireConsole();
  const staff = door.state === "console" ? door.staff : null;
  const locale = await getLocale();
  const params = await searchParams;
  const range = RANGES.find((r) => r === params.range) ?? "12m";
  const now = requestTime();

  const [pulse, collected, supply, byRole, jobs, counts, alerts] = await Promise.all([
    getConsolePulse(now),
    getCollectedSeries(range, now),
    getSupplyByType(),
    getNewListingsByRole(now),
    getJobHealth(now),
    getQueueCounts(),
    getRiskAlerts(),
  ]);
  const ok = <T,>(read: { state: "ok"; data: T } | { state: "unavailable" }): T | null =>
    read.state === "ok" ? read.data : null;

  return (
    <>
      <LiveRefresh />
      {staff && staff.scopes.length > 0 ? (
        <div className="nf-console mb-block">
          <YourDesks staff={staff} />
        </div>
      ) : null}
      <OverviewView
        locale={locale}
        now={now}
        range={range}
        headingTo={safeDesk(params.next)}
        pulse={ok(pulse)}
        openReviews={counts.state === "ok" ? counts.data.listings : null}
        queue={counts.state === "ok" ? counts.data : null}
        collected={ok(collected)}
        supply={ok(supply)}
        byRole={ok(byRole)}
        jobs={jobs.state === "ok" ? jobs.data.health : null}
        alerts={alerts.state === "ok" ? alerts.data.rows : "unavailable"}
      />
    </>
  );
}
