import { getDictionary, type Locale } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { AgentShell } from "@/components/agent/AgentShell";
import { PageFrame } from "@/components/app/PageFrame";
import { BookingsWorkspace } from "@/app/agent/bookings/BookingsWorkspace";
import { AGENT_BOOKINGS, AGENT_PROFILE } from "../ops-fixtures";

/** The agent's bookings board, from a fixture board. */
export const dynamic = "force-dynamic";

export default async function PreviewAgentBookings() {
  const locale: Locale = await getLocale();
  const t = getDictionary(locale);
  return (
    <AgentShell t={t} locale={locale} active="/agent/bookings" profile={AGENT_PROFILE} chromeBack={false}>
      <PageFrame title={t.agentBookings.title} subtitle={t.agentBookings.lede} fallback="/agent/dashboard" width="wide">
      <BookingsWorkspace t={t.agentBookings} board={AGENT_BOOKINGS} locale={locale} />
      </PageFrame>
    </AgentShell>
  );
}
