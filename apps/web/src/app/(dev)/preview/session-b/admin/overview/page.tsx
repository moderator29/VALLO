// Admin console fixture harness, behind the preview gate. Renders the real overview on fixture props.
import { getDictionary } from "@vallo/i18n";
import { AdminFrame } from "@/app/admin/_components/AdminFrame";
import { BackButton } from "@/components/site/BackButton";
import { OverviewView } from "@/app/admin/_components/OverviewView";
import { AdminCopilot } from "@/components/admin/copilot/AdminCopilot";
import { safeDesk } from "@/app/admin/_components/entry";
import { ALERTS, BY_ROLE, COLLECTED, COUNTS, LIVE_COUNTS, EMPTY_BY_ROLE, EMPTY_COLLECTED, EMPTY_PULSE, EMPTY_SUPPLY, IDENTITY, JOBS, NOW, PULSE, REAL_ALERTS, SUPPLY } from "../fixtures";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ state?: string; next?: string }> }) {
  const t = getDictionary("en");
  const params = await searchParams;
  const live = params.state === "live";
  return (
    <AdminFrame
      identity={IDENTITY}
      counts={live ? LIVE_COUNTS : COUNTS}
      unread={2}
      navLabel="Admin console"
      navLabels={t.admin.nav}
      searchLabel="Search"
      bellLabel="Notifications"
      back={<BackButton fallback="/admin" className="nf-admin-back" />}
    >
      <OverviewView
        headAction={<AdminCopilot scope={null} deskName="Console" launch="inline" starters={["What needs me first today?", "Reply to the oldest support ticket", "Resolve the newest risk alert"]} />}
        locale="en"
        now={NOW}
        range="12m"
        headingTo={safeDesk(params.next)}
        openReviews={live ? 0 : 73}
        pulse={live ? EMPTY_PULSE : PULSE}
        collected={live ? EMPTY_COLLECTED : COLLECTED}
        supply={live ? EMPTY_SUPPLY : SUPPLY}
        byRole={live ? EMPTY_BY_ROLE : BY_ROLE}
        jobs={JOBS}
        alerts={live ? REAL_ALERTS : ALERTS}
      />
    </AdminFrame>
  );
}
