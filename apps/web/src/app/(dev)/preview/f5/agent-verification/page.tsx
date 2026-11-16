import { getDictionary, type Locale } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { AgentShell } from "@/components/agent/AgentShell";
import { PageFrame } from "@/components/app/PageFrame";
import { Ladder, Standing } from "@/app/agent/verification/VerificationLadder";
import { AGENT_LADDER, AGENT_PROFILE } from "../ops-fixtures";

/** Where an agent stands on the four-rung ladder, from a fixture ladder. */
export const dynamic = "force-dynamic";

export default async function PreviewAgentVerification() {
  const locale: Locale = await getLocale();
  const t = getDictionary(locale);
  return (
    <AgentShell t={t} locale={locale} active="/agent/verification" profile={AGENT_PROFILE} chromeBack={false}>
      <PageFrame title={t.agent.nav.verification} subtitle="Four checks, in order. Each one you pass is shown to guests on every listing you have, and none of them is a fee." fallback="/agent/dashboard" width="wide">
      <div className="grid gap-lg lg:grid-cols-[1fr_20rem]">
        <div className="lg:order-2">
          <Standing tier={AGENT_LADDER.tier} />
        </div>
        <div className="lg:order-1">
          <Ladder ladder={AGENT_LADDER} />
        </div>
      </div>
      </PageFrame>
    </AgentShell>
  );
}
