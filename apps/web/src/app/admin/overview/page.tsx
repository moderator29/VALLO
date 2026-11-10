import type { Metadata } from "next";
import { requireCoo, cooRefusal } from "@/lib/admin/overview/guard";
import { readCooBacklog, listEscalations, listStaffAccessRecommendations } from "@/lib/admin/overview/reads";
import { PageHead, Panel } from "../_components/panels";
import { AdminCopilot } from "@/components/admin/copilot/AdminCopilot";
import { BacklogCards } from "./BacklogCards";
import { EscalationBoard } from "./EscalationBoard";
import { StaffAccessRecommendations } from "./StaffAccessRecommendations";

export const metadata: Metadata = { title: "Overview", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

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

  const [backlog, escalationsRead, recommendationsRead] = await Promise.all([
    readCooBacklog(access.supabase),
    listEscalations(),
    listStaffAccessRecommendations(),
  ]);

  const openAlerts =
    backlog.operations.state === "ok" ? backlog.operations.count : null;
  const openListings = backlog.listings.state === "ok" ? backlog.listings.count : null;
  const openEscalations = escalationsRead.state === "ok" ? escalationsRead.data.filter((e) => e.status !== "resolved").length : null;

  const contextParts: string[] = [];
  if (openListings !== null) contextParts.push(`${openListings} listing${openListings === 1 ? "" : "s"} awaiting review`);
  if (openAlerts !== null) contextParts.push(`${openAlerts} open operations alert${openAlerts === 1 ? "" : "s"}`);
  if (openEscalations !== null) contextParts.push(`${openEscalations} open escalation${openEscalations === 1 ? "" : "s"} waiting on you`);
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
