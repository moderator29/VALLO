import type { Metadata } from "next";
import { forAiConsent } from "@/components/app/account/settings-copy";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { PageFrame } from "@/components/app/PageFrame";
import { SettingsLede } from "@/components/app/account/SettingsLede";
import { aiConsentForViewer } from "@/lib/ai/consent-server";
import { AiConsentCard } from "../../AiConsentCard";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLocale()).settings.aiConsent.label, robots: { index: false, follow: false } };
}

export const dynamic = "force-dynamic";

/**
 * The assistant agreement: the disclosure a person agreed to in the assistant
 * and the way to take it back (STORE-07), as a page of its own with its
 * explanation (D25). The card is unchanged.
 */
export default async function AiConsentPage() {
  const t = getDictionary(await getLocale());
  const lede = t.experienceAccount.settings.lede;
  const consented = await aiConsentForViewer().catch(() => false);
  return (
    <PageFrame title={t.settings.aiConsent.label} fallback="/settings/privacy" width="narrow">
      <div>
        <SettingsLede label={lede.what} what={lede.ai.what} who={lede.ai.who} />
        <AiConsentCard t={forAiConsent(t)} consented={consented} />
      </div>
    </PageFrame>
  );
}
