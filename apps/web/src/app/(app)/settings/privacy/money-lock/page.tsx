import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { PageFrame } from "@/components/app/PageFrame";
import { SettingsLede } from "@/components/app/account/SettingsLede";
import { loadMoneyCredentials } from "@/lib/security/money-step-up";
import { MoneyLockGroup } from "../../MoneyLockGroup";
import { MONEY_LOCK_WHAT } from "@/lib/money/copy";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLocale()).platform.moneyLock.settingsTitle, robots: { index: false, follow: false } };
}

export const dynamic = "force-dynamic";

/**
 * Money lock: the group that used to be the fifth of eight on the Privacy
 * screen, as a page of its own with its explanation (D25). The enrolment and
 * the removal are `MoneyLockGroup`'s, unchanged (V-81).
 */
export default async function MoneyLockPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const lede = t.experienceAccount.settings.lede;
  const list = await loadMoneyCredentials().catch(() => ({ state: "unreadable" as const }));
  return (
    <PageFrame title={t.platform.moneyLock.settingsTitle} fallback="/settings/privacy" width="narrow">
      <div>
        <SettingsLede label={lede.what} what={MONEY_LOCK_WHAT} who={lede.moneyLock.who} />
        <MoneyLockGroup list={list} locale={locale} />
      </div>
    </PageFrame>
  );
}
