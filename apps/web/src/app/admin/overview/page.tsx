import { countOf } from "@vallo/i18n/core";
import type { Metadata } from "next";
import { requireCoo, cooRefusal } from "@/lib/admin/overview/guard";
import { readCooBacklog, listEscalations as listCooBoard, listStaffAccessRecommendations } from "@/lib/admin/overview/reads";
import { PageHead, Panel } from "../_components/panels";
import { AdminCopilot } from "@/components/admin/copilot/AdminCopilot";
import { BacklogCards } from "./BacklogCards";
import { EscalationBoard } from "./EscalationBoard";
import { StaffAccessRecommendations } from "./StaffAccessRecommendations";
import { getLocale } from "@/lib/locale";
import { listEscalations, type EscalationListData, type EscalationRead } from "@/lib/admin/escalations/read";
import { isClosed } from "@/lib/admin/escalations/types";
import { WaitingOnYou } from "../escalations/WaitingOnYou";

export const metadata: Metadata = { title: "Overview", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** The request's clock, read once so every "due in" on the page agrees. */
function requestTime(): number {
  return Date.now();
}

/**
 * The escalations that are with the COO now, from the Escalate button on
 * every desk (`staff_escalations`): raised to the COO, or moved up to the COO
 * when a team did not answer in time. Read as "all" (this desk is the COO's
 * and the super admin's) and narrowed to the COO's level, so a super admin
 * looking at this desk sees the COO's work and not their own.
 */
function withTheCoo(read: EscalationRead<EscalationListData>): EscalationRead<EscalationListData> {
  if (read.state !== "ok") return read;
  return { state: "ok", data: { ...read.data, rows: read.data.rows.filter((row) => row.level === 1 && !isClosed(row.status)) } };
}

/**
 * THE COO DESK: cross-desk escalations, staff access recommendations, and
 * the real backlog across listings, moderation, support, agreements and
 * operations, each read from that desk's own function and linking straight
 * to it. Nothing here is rebuilt from that desk: this page links to and
 * summarizes it.
 *
 * THE DOOR. There is no `coo` scope: the position holds every one of
 * listing_approval, moderation, support, agreements and operations at once
 * (`JOB_DESCRIPTIONS.coo.scopes`). `requireCoo()` admits a super admin, or a
 * staff member holding every one of those five; anybody else gets the same
 * honest refusal every other desk gives.
 */
export default async function OverviewPage() {
  const access = await requireCoo();
  if (access.state !== "coo") {
    return (
      <div className="nf-console">
        <PageHead title="Overview" lede={cooRefusal(access)} />
      </div>
    );
  }

  const [backlog, escalationsRead, recommendationsRead, locale, routedRead] = await Promise.all([
    readCooBacklog(access.supabase),
    listCooBoard(),
    listStaffAccessRecommendations(),
    getLocale(),
    listEscalations("all"),
  ]);

  const openAlerts =
    backlog.operations.state === "ok" ? backlog.operations.count : null;
  const openListings = backlog.listings.state === "ok" ? backlog.listings.count : null;
  const openEscalations = escalationsRead.state === "ok" ? escalationsRead.data.filter((e) => e.status !== "resolved").length : null;

  const contextParts: string[] = [];
  if (openListings !== null) contextParts.push(`${countOf(openListings, "listings")} awaiting review`);
  if (openAlerts !== null) contextParts.push(`${countOf(openAlerts, "alerts")} open in operations`);
  if (openEscalations !== null) contextParts.push(`${countOf(openEscalations, "escalations")} open and waiting on you`);
  const context = contextParts.length > 0 ? `${contextParts.join(", ")}.` : null;

  return (
    <div className="nf-console nf-admin-stack" data-testid="overview-desk">
      <PageHead
        title="Overview"
        lede="Runs the operation: trust and safety, support, listings, agreements and the day-to-day platform. Watch the backlog, decide what a team lead cannot, and recommend staff access changes to the founder."
      />

      <Panel title="Backlog across every desk">
        <BacklogCards backlog={backlog} />
      </Panel>

      {/* The escalations raised from every desk's Escalate button that are
          with the COO now (15 November 2026). The board below is the older
          one (10 November) and is left as it is. */}
      <WaitingOnYou
        read={withTheCoo(routedRead)}
        now={requestTime()}
        locale={locale}
        title="Escalations with the COO"
        who="the COO"
        note="These come from the Escalate button on every desk."
      />

      <Panel title="Escalations">
        {escalationsRead.state === "not_set_up" ? (
          <p className="nf-body">
            Escalations are not set up on this server yet
            (<code>supabase/migrations/pending/coo_overview_2026-11-10.sql</code>).
          </p>
        ) : escalationsRead.state === "unavailable" ? (
          <p className="nf-body">Could not be read just now. Refresh to try again.</p>
        ) : (
          <EscalationBoard escalations={escalationsRead.data} canResolve />
        )}
      </Panel>

      <Panel title="Staff access recommendations">
        {recommendationsRead.state === "not_set_up" ? (
          <p className="nf-body">
            Not set up on this server yet
            (<code>supabase/migrations/pending/coo_overview_2026-11-10.sql</code>). Access is still granted only by the
            founder&apos;s super admin account from the Staff desk.
          </p>
        ) : recommendationsRead.state === "unavailable" ? (
          <p className="nf-body">Could not be read just now. Refresh to try again.</p>
        ) : (
          <StaffAccessRecommendations recommendations={recommendationsRead.data} />
        )}
      </Panel>

      <AdminCopilot scope="operations" position="coo" deskName="Overview" context={context} />
    </div>
  );
}
