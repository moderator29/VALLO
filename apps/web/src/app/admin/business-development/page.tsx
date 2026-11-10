import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/guard";
import { JOB_DESCRIPTIONS } from "@/lib/admin/staff-positions";
import { PageHead, Panel } from "../_components/panels";
import { AdminCopilot } from "@/components/admin/copilot/AdminCopilot";
import { listPipeline, listAllActivity, dueThisWeek, kpiCounts, weeklySummary, listingsAwaitingReview } from "@/lib/admin/business-development/reads";
import { BD_STAGE_LABEL } from "@/lib/admin/business-development/types";
import { AddProspectForm } from "./AddProspectForm";
import { ProspectBoard } from "./ProspectBoard";

export const metadata: Metadata = { title: "Business development", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

function dateLabel(iso: string | null): string {
  if (!iso) return "no date";
  try {
    return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-NG", { day: "numeric", month: "short" });
  } catch {
    return iso;
  }
}

/**
 * THE BUSINESS DEVELOPMENT DESK: a lightweight partnership pipeline
 * (CRM-lite), not a page of input fields nobody fills in, plus a straight
 * link to the real listing review queue this role already has through its
 * `listing_approval` scope. Listing review itself lives at `/admin/listings`
 * and is not rebuilt here.
 *
 * ONBOARDED AND APPROVED ARE TWO DIFFERENT FACTS, reported apart: a business
 * can be onboarded (contactable, the steps done) with no listing yet, or a
 * listing can be linked and still waiting on review. Neither count stands in
 * for the other.
 */
export default async function BusinessDevelopmentPage() {
  const access = await requireAdmin("business_development");
  if (access.state !== "admin") {
    return (
      <div className="nf-console">
        <PageHead title="Business development" lede="Your account cannot open this desk." />
      </div>
    );
  }

  const [pipeline, activityRead, listingsWaiting] = await Promise.all([
    listPipeline(),
    listAllActivity(),
    listingsAwaitingReview(),
  ]);

  if (pipeline.state === "not_set_up") {
    return (
      <div className="nf-console nf-admin-stack">
        <PageHead
          title="Business development"
          lede={`${JOB_DESCRIPTIONS.business_development_executive.title}: ${JOB_DESCRIPTIONS.business_development_executive.summary}`}
        />
        <Panel title="Pipeline">
          <p className="nf-body">
            The partnership pipeline is not set up on this server yet. Its database table is written and waiting to be
            applied (<code>supabase/migrations/pending/bd_prospects_2026-11-10.sql</code>); nothing can be added or shown
            here until then.
          </p>
        </Panel>
        {listingsWaiting !== null ? (
          <Panel title="Listings">
            <p className="nf-body">
              <Link href="/admin/listings" className="font-semibold text-[var(--nf-content-link)] hover:underline">
                {listingsWaiting} listing{listingsWaiting === 1 ? "" : "s"} waiting on a review decision
              </Link>
              .
            </p>
          </Panel>
        ) : null}
      </div>
    );
  }

  if (pipeline.state === "unavailable") {
    return (
      <div className="nf-console nf-admin-stack">
        <PageHead title="Business development" lede="The pipeline could not be read just now. Refresh to try again." />
      </div>
    );
  }

  const prospects = pipeline.data;
  const activity = activityRead.state === "ok" ? activityRead.data : [];
  const followUps = dueThisWeek(prospects);
  const kpi = kpiCounts(prospects, activity);
  const week = weeklySummary(prospects, activity, Date.now());

  const contextParts: string[] = [
    `${kpi.prospectsIdentified} prospect${kpi.prospectsIdentified === 1 ? "" : "s"} in your pipeline`,
    `${followUps.length} follow-up${followUps.length === 1 ? "" : "s"} due this week`,
  ];
  if (listingsWaiting !== null) contextParts.push(`${listingsWaiting} listing${listingsWaiting === 1 ? "" : "s"} awaiting your review`);
  const context = contextParts.join(", ") + ".";

  return (
    <div className="nf-console nf-admin-stack" data-testid="business-development-desk">
      <PageHead
        title="Business development"
        lede={JOB_DESCRIPTIONS.business_development_executive.summary}
      />

      <Panel title="This week">
        <ul className="grid gap-2xs nf-body">
          <li>{week.prospectsAdded} prospect{week.prospectsAdded === 1 ? "" : "s"} added</li>
          <li>{week.contactsLogged} contact{week.contactsLogged === 1 ? "" : "s"} logged</li>
          <li>{week.followUpsDone} follow-up{week.followUpsDone === 1 ? "" : "s"} done</li>
          <li>{week.onboardedThisWeek} onboarded</li>
        </ul>
        <p className="nf-caption mt-row text-[var(--nf-content-secondary)]">
          All-time: {kpi.prospectsIdentified} identified, {kpi.qualifiedContacted} contacted, {kpi.followUpActivity} follow-ups
          logged, {kpi.onboarded} onboarded, {kpi.listingsSubmittedFromPipeline} with a listing linked. Onboarded and
          listing-linked are reported separately: a business can be onboarded with no listing yet, or have a listing
          waiting on review.
        </p>
      </Panel>

      <Panel title="Listings awaiting review">
        <p className="nf-body">
          {listingsWaiting === null ? (
            "Could not be read just now."
          ) : (
            <Link href="/admin/listings" className="font-semibold text-[var(--nf-content-link)] hover:underline">
              {listingsWaiting} listing{listingsWaiting === 1 ? "" : "s"} waiting on a review decision
            </Link>
          )}
        </p>
      </Panel>

      <Panel title="Follow-ups due this week">
        {followUps.length === 0 ? (
          <p className="nf-body text-[var(--nf-content-secondary)]">Nothing due in the next 7 days.</p>
        ) : (
          <ul className="grid gap-2xs nf-body">
            {followUps.map((p) => (
              <li key={p.id}>
                {dateLabel(p.nextFollowUpAt)} · {p.businessName} ({BD_STAGE_LABEL[p.stage]})
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Add a prospect">
        <AddProspectForm />
      </Panel>

      <Panel title="Pipeline">
        <ProspectBoard prospects={prospects} />
      </Panel>

      <AdminCopilot
        scope="business_development"
        position={access.isStaff ? "business_development_executive" : null}
        deskName="Business Development"
        context={context}
      />
    </div>
  );
}
