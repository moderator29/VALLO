import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { forLanguage } from "@/components/app/account/settings-copy";
import { PageFrame } from "@/components/app/PageFrame";
import { LanguageRow } from "@/components/app/account/SettingsGroups";
import { RowValue, SettingsGroup } from "@/components/app/account/rows";
import { formatMoneyDate } from "@/lib/money/dates";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLocale()).experienceSettings.region.title };
}
/* Today's date is printed, so the page is rendered per request. */
export const dynamic = "force-dynamic";

/**
 * /settings/region (R3-16): the language, and how money and dates are
 * displayed, instead of a read-only "₦ NGN" with no explanation.
 *
 * The currency is a fact, not a preference: every price is set and paid in
 * naira, and a converted view needs a real, timestamped rate (FL section 4.10,
 * Session 2's multi-currency model; C2 REQUEST 12). So it is stated, with the
 * reason, and there is no control that would pretend otherwise. The date line
 * prints today in the member's language and Lagos time, which is the format
 * every money screen uses.
 */
export default async function RegionSettingsPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const today = formatMoneyDate(new Date(), locale) ?? "";
  const copy = t.experienceSettings.region;
  return (
    <PageFrame title={copy.title} subtitle={copy.sub} fallback="/settings" width="narrow">
      <section id="settings-language" className="scroll-mt-28">
        <SettingsGroup label={copy.language}>
          <LanguageRow t={forLanguage(t)} current={locale} />
        </SettingsGroup>
      </section>
      <section id="settings-money-display" className="scroll-mt-28">
        <SettingsGroup label={copy.money}>
          <RowValue icon="banknote" label={copy.currency} sub={copy.currencySub} value={copy.currencyValue} testId="region-currency" />
          <RowValue icon="calendar-check" label={copy.dates} sub={copy.datesSub.replace("{date}", today)} testId="region-dates" />
          <RowValue icon="coins" label={copy.numbers} sub={copy.numbersSub} />
        </SettingsGroup>
      </section>
    </PageFrame>
  );
}
