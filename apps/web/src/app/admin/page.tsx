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
import { listEscalations } from "@/lib/admin/escalations/read";
import { JOB_DESCRIPTIONS } from "@/lib/admin/staff-positions";
import type { StaffAccess } from "@/lib/admin/guard";
import { WaitingOnYou } from "./escalations/WaitingOnYou";
import { AdminCopilot } from "@/components/admin/copilot/AdminCopilot";
import { starterPromptsFor } from "@/lib/admin/copilot/capabilities";

export const dynamic = "force-dynamic";

const RANGES: readonly CollectedRange[] = ["30d", "90d", "12m"];

/** The request's clock, read once so every "12m ago" on the page agrees. */
function requestTime(): number {
  return Date.now();
}

/** The COO: the position, or every one of its scopes (the rule `requireCoo` uses). */
function isCoo(staff: StaffAccess | null): boolean {
  if (!staff) return false;
  return staff.position === "coo" || JOB_DESCRIPTIONS.coo.scopes.every((scope) => staff.scopes.includes(scope));
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
    if (door.state !== "console") return null;
    /* A COO who holds no admin role lands here: their escalations first. */
    if (!isCoo(door.staff) || !door.staff.handbookAcknowledged) return <StaffHome staff={door.staff} />;
    const [staffLocale, waitingOnCoo] = await Promise.all([getLocale(), listEscalations("for_me")]);
    return (
      <div className="nf-admin-stack">
        <StaffHome staff={door.staff} />
        <div className="nf-console">
          <WaitingOnYou read={waitingOnCoo} now={requestTime()} locale={staffLocale} />
        </div>
      </div>
    );
  }
  /* An operator who also holds a named position sees that position's desks first. */
  const door = await requireConsole();
  const staff = door.state === "console" ? door.staff : null;
  const locale = await getLocale();
  const params = await searchParams;
  const range = RANGES.find((r) => r === params.range) ?? "12m";
  const now = requestTime();

  /* "Waiting on you" (escalations, 15 November): for the super admin and the COO. */
  const showWaiting = operator.isSuperAdmin || isCoo(staff);
  const [pulse, collected, supply, byRole, jobs, counts, alerts, waiting] = await Promise.all([
    getConsolePulse(now),
    getCollectedSeries(range, now),
    getSupplyByType(),
    getNewListingsByRole(now),
    getJobHealth(now),
    getQueueCounts(),
    getRiskAlerts(),
    showWaiting ? listEscalations("for_me") : null,
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
      {waiting ? (
        <div className="nf-console mb-block">
          <WaitingOnYou read={waiting} now={now} locale={locale} />
        </div>
      ) : null}
      <OverviewView
        headAction={
          <AdminCopilot
            scope={null}
            deskName="Console"
            launch="inline"
            greeting="Hello. Ask me what needs you first today, or pick a question below."
            starters={starterPromptsFor(null, { isSuperAdmin: operator.isSuperAdmin })}
          />
        }
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
