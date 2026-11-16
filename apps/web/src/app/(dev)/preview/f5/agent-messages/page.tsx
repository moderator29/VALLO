import { getDictionary, type Locale } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { AgentShell } from "@/components/agent/AgentShell";
import { PageFrame } from "@/components/app/PageFrame";
import { AgentInbox } from "@/app/agent/messages/AgentInbox";
import { AGENT_INBOX, AGENT_PROFILE } from "../ops-fixtures";

/** The agent's enquiry inbox, from fixture threads. */
export const dynamic = "force-dynamic";

export default async function PreviewAgentMessages() {
  const locale: Locale = await getLocale();
  const t = getDictionary(locale);
  return (
    <AgentShell t={t} locale={locale} active="/agent/messages" profile={AGENT_PROFILE} chromeBack={false}>
      <PageFrame title={t.agent.nav.messages} subtitle="1 enquiry is waiting on you." fallback="/agent/dashboard" width="wide">
      <AgentInbox inbox={AGENT_INBOX} filter="waiting" />
      </PageFrame>
    </AgentShell>
  );
}
