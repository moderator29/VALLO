import { getDictionary, type Locale } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { AgentShell } from "@/components/agent/AgentShell";
import { PageFrame } from "@/components/app/PageFrame";
import { EarningsWorkspace } from "@/app/agent/earnings/EarningsWorkspace";
import { AGENT_EARNINGS, AGENT_PROFILE } from "../ops-fixtures";

/** The agent's earnings workspace, from a fixture ledger. */
export const dynamic = "force-dynamic";

export default async function PreviewAgentEarnings() {
  const locale: Locale = await getLocale();
  const t = getDictionary(locale);
  return (
    <AgentShell t={t} locale={locale} active="/agent/earnings" profile={AGENT_PROFILE} chromeBack={false}>
      <PageFrame title={t.agentEarnings.title} subtitle={t.agentEarnings.lede} fallback="/agent/dashboard" width="wide">
      <EarningsWorkspace t={t.agentEarnings} earnings={AGENT_EARNINGS} locale={locale} />
      </PageFrame>
    </AgentShell>
  );
}
