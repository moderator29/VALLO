import { getDictionary, type Locale } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { AgentShell } from "@/components/agent/AgentShell";
import { RealDashboard } from "@/app/agent/dashboard/RealDashboard";
import { PageFrame } from "@/components/app/PageFrame";
import { SwitchToPersonal } from "@/components/agent/SwitchToPersonal";
import "@/app/css/agent.css";
import type { AgentNumbers } from "@/lib/agent/listings-queries";
import { COUNTERPART } from "../_fixtures/people";
import { agentFixture, ownerFixture } from "./fixtures";

/**
 * Both workspace dashboards from fixture reads, for the register and the
 * screenshots: `?side=owner` or `?side=agent`, and `&empty=1` for the account
 * with nothing yet. The route itself needs an approved account's session; this
 * renders the same component on the same shell with the real parsers.
 */
export const dynamic = "force-dynamic";

const NUMBERS: AgentNumbers = {
  byStatus: { DRAFT: 1, SUBMITTED: 0, UNDER_REVIEW: 0, MORE_INFO_REQUIRED: 0, APPROVED: 0, PUBLISHED: 6, REJECTED: 0, SUSPENDED: 0 },
  totalListings: 7,
  liveListings: 6,
  inReview: 0,
  drafts: 1,
  upcomingBookings: [],
  upcomingBookingCount: 0,
  unreadMessages: 3,
};

const EMPTY_NUMBERS: AgentNumbers = {
  byStatus: { DRAFT: 0, SUBMITTED: 0, UNDER_REVIEW: 0, MORE_INFO_REQUIRED: 0, APPROVED: 0, PUBLISHED: 0, REJECTED: 0, SUSPENDED: 0 },
  totalListings: 0,
  liveListings: 0,
  inReview: 0,
  drafts: 0,
  upcomingBookings: [],
  upcomingBookingCount: 0,
  unreadMessages: 0,
};

export default async function PreviewWorkspaceDash({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const side = params.side === "owner" ? "owner" : "agent";
  const empty = params.empty === "1";
  const now = new Date();
  const locale: Locale = await getLocale();
  const t = getDictionary(locale);
  const owner = ownerFixture(now, empty);
  return (
    <AgentShell
      t={t}
      locale={locale}
      active="/agent/dashboard"
      profile={{ id: COUNTERPART.id, displayName: COUNTERPART.name, status: "APPROVED", type: "individual",
  role: "agent" as const, verified: true }}
    >
      {/* The live page's own frame and title, with the switch beside it. */}
      <PageFrame
        title={t.agent.nav.dashboard}
        back={false}
        width="wide"
        actions={
          <SwitchToPersonal
            lead={t.agent.mode.switchToPersonalLead}
            main={t.agent.mode.switchToPersonalMain}
            aria={t.agent.mode.switchToPersonalAria}
          />
        }
      >
        <RealDashboard
          t={t}
          locale={locale}
          displayName={COUNTERPART.name}
          numbers={empty ? EMPTY_NUMBERS : NUMBERS}
          inspections={{ inspections: [], openCount: 0, readFailed: false }}
          workspace={side === "owner" ? { role: "owner", view: owner.view, places: owner.places } : { role: "agent", dash: agentFixture(now, empty) }}
          now={now}
        />
      </PageFrame>
    </AgentShell>
  );
}
