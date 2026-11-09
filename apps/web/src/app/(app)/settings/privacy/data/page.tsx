import type { Metadata } from "next";
import { forDataCard } from "@/components/app/account/settings-copy";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { PageFrame } from "@/components/app/PageFrame";
import { SettingsLede } from "@/components/app/account/SettingsLede";
import { DataCard } from "@/components/app/account/SettingsGroups";
import { loadSettingsState } from "@/lib/profile/queries";
import { DataExportCard } from "../../DataExportCard";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLocale()).settings.data.label, robots: { index: false, follow: false } };
}

export const dynamic = "force-dynamic";

/**
 * Your data: the copy Vallo can make of your account and the control that
 * clears what this device saved, two groups that were the last two of eight on
 * the Privacy screen, as a page of their own with its explanation (D25). Both
 * groups are unchanged.
 */
export default async function DataSettingsPage() {
  const t = getDictionary(await getLocale());
  const lede = t.experienceAccount.settings.lede;
  const account = await loadSettingsState();
  return (
    <PageFrame title={t.settings.data.label} fallback="/settings/privacy" width="narrow">
      <div>
      <SettingsLede label={lede.what} what={lede.data.what} who={lede.data.who} />
      <div className="space-y-block">
        <section id="settings-data" className="scroll-mt-28">
          <DataExportCard t={t} signedIn={account.state === "signed-in"} />
        </section>
        <section id="settings-data-clear" className="scroll-mt-28">
          <DataCard t={forDataCard(t)} />
        </section>
      </div>
      </div>
    </PageFrame>
  );
}
