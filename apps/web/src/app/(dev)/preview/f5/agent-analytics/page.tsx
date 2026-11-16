import { getDictionary, type Locale } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { AgentShell } from "@/components/agent/AgentShell";
import { PageFrame } from "@/components/app/PageFrame";
import { AnalyticsWorkspace } from "@/app/agent/analytics/AnalyticsWorkspace";
import { AGENT_ANALYTICS, AGENT_PROFILE } from "../ops-fixtures";

/** The agent's analytics workspace, from fixture aggregates. */
export const dynamic = "force-dynamic";

export default async function PreviewAgentAnalytics() {
  const locale: Locale = await getLocale();
  const t = getDictionary(locale);
  return (
    <AgentShell t={t} locale={locale} active="/agent/analytics" profile={AGENT_PROFILE} chromeBack={false}>
      <PageFrame title={t.agentAnalytics.title} subtitle={t.agentAnalytics.lede} fallback="/agent/dashboard" width="wide">
      <AnalyticsWorkspace
        t={t.agentAnalytics}
        hours={{ one: t.agentBookings.card.hoursOne, other: t.agentBookings.card.hours }}
        statusLabels={t.agentListings.workspace.status}
        analytics={AGENT_ANALYTICS}
        locale={locale}
      />
      </PageFrame>
    </AgentShell>
  );
}
