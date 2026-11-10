import { getLocale } from "@/lib/locale";
import { getAuditActivity, getAuditLog } from "@/lib/admin/audit-queries";
import { getRiskAlerts } from "@/lib/admin/queries";
import { getPersonTiers } from "@/lib/admin/reads/shared";
import { getOpsReads } from "@/lib/admin/reads/ops-panels";
import { getAlertTrend, getInspectionActivity, getJobHealth, getPushActivity, getRunDays } from "@/lib/admin/reads/operations";
import { LiveRefresh } from "../_components/LiveRefresh";
import { getDictionary } from "@vallo/i18n";
import { adminReader } from "@/lib/admin/reads/shared";
import { authOrigin } from "@/lib/site";
import { runStoreChecks } from "@/lib/store/run";
import { OperationsView, type OpsTab } from "./OperationsView";
import { DeskCopilot } from "@/lib/admin/copilot/contexts/DeskCopilot";
import { operationsContext } from "@/lib/admin/copilot/contexts/operations";

export const dynamic = "force-dynamic";

const TABS: readonly OpsTab[] = ["jobs", "alerts", "audit", "notifications", "inflight", "store"];

function requestTime(): number {
  return Date.now();
}

/**
 * Operations: scheduled jobs, alerts, the audit log and notifications.
 *
 * Reads, all under the admin gate: `getJobHealth` and `getRunDays` (the
 * audit rows every scheduled run writes), `getAlertTrend` (exact counts from
 * the alerts' own dates), `getRiskAlerts`, `getAuditLog` and
 * `getAuditActivity`, and on the Notifications tab `getPushActivity` (push
 * queue and device attempts, under their staff read policies). In-app
 * notification volumes are not readable by an admin today (the
 * notifications table's only SELECT policy is the recipient's own, Request
 * A6), nor is the email outbox (Request A14); both panels say so until the
 * staff reads of op01_operations_reads.sql are applied, after which
 * `getOpsReads` draws them (and the account deletions, business transfers,
 * database jobs, reconciliation watch and held events panels on In flight).
 */
export default async function AdminOperationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const locale = await getLocale();
  const params = await searchParams;
  const tab = TABS.find((t) => t === params.tab) ?? "jobs";
  const now = requestTime();

  /* V-52: the store checks run only when their tab is open, because they
     fetch our own public pages and sign the reviewer account in. */
  const storeRun = async () => {
    if (tab !== "store") return null;
    const db = await adminReader();
    if (!db) return null;
    try {
      return await runStoreChecks(db, await authOrigin(), getDictionary(locale).frontDoor.store);
    } catch {
      return null;
    }
  };

  const [jobs, runDays, trend, alerts, audit, activity, inspections, push, store, ops] = await Promise.all([
    getJobHealth(now),
    getRunDays(now),
    getAlertTrend(now),
    getRiskAlerts(),
    getAuditLog(),
    tab === "audit" ? getAuditActivity() : Promise.resolve(null),
    tab === "inflight" ? getInspectionActivity() : Promise.resolve(null),
    tab === "notifications" ? getPushActivity(now) : Promise.resolve(null),
    storeRun(),
    getOpsReads(),
  ]);

  // B-BADGE: the published tier of every person the audit rows name.
  const tiers = await getPersonTiers(audit.state === "ok" ? audit.data.rows.map((r) => r.actorId) : []);

  return (
    <>
      {/* Not on the Store tab: its checks sign the reviewer in and fetch our
          own pages, which is an operator's deliberate act, not a timer's. */}
      {tab !== "store" && <LiveRefresh />}
      <OperationsView
        locale={locale}
        now={now}
        tab={tab}
        jobs={jobs.state === "ok" ? jobs.data.health : null}
        database={jobs.state === "ok" ? jobs.data.database : null}
        runDays={runDays.state === "ok" ? runDays.data : null}
        trend={trend.state === "ok" ? trend.data : null}
        alerts={alerts.state === "ok" ? alerts.data.rows : "unavailable"}
        audit={audit.state === "ok" ? audit.data.rows : "unavailable"}
        activity={activity && activity.state === "ok" ? activity.data : null}
        notifications={null}
        push={push && push.state === "ok" ? push.data : null}
        tiers={tiers}
        inspections={inspections && inspections.state === "ok" ? inspections.data : null}
        store={store}
        ops={ops}
      />
      <DeskCopilot
        scope="operations"
        deskName="Operations"
        context={operationsContext(
          {
            tab,
            openAlertTimes:
              alerts.state === "ok" ? alerts.data.rows.filter((row) => row.status === "open").map((row) => row.createdAt) : null,
            alertsCapped: alerts.state === "ok" && alerts.data.full,
          },
          now,
        )}
      />
    </>
  );
}
