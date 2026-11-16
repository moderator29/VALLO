import { getDictionary, type Locale } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { AgentShell } from "@/components/agent/AgentShell";
import { AgentSettingsBody } from "@/app/agent/settings/AgentSettingsBody";
import { AGENT_PROFILE } from "../ops-fixtures";

/** What a host controls about their own account, from a fixture account. */
export const dynamic = "force-dynamic";

export default async function PreviewAgentSettings() {
  const locale: Locale = await getLocale();
  const t = getDictionary(locale);
  return (
    <AgentShell t={t} locale={locale} active="/agent/settings" profile={AGENT_PROFILE} chromeBack={false}>
      <AgentSettingsBody
        t={t}
        agent={AGENT_PROFILE}
        accounts={[
          {
            id: "00000000-0000-4000-8000-00000000p001",
            bankName: "Sterling Bank",
            accountNumber: "0123456789",
            accountName: "Tunde Adebayo",
            isDefault: true,
          },
        ]}
        notifications={null}
      />
    </AgentShell>
  );
}
