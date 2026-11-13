import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";
import { formatMoney } from "@vallo/i18n/core";
import { getLocale } from "@/lib/locale";
import { forLanguage } from "@/components/app/account/settings-copy";
import { PageFrame } from "@/components/app/PageFrame";
import { LanguageRow } from "@/components/app/account/SettingsGroups";
import { RowValue, SettingsGroup } from "@/components/app/account/rows";
import { formatMoneyDate } from "@/lib/money/dates";
import { getDisplayMoney } from "@/lib/currency/server";
import { parseRate, RATE_SCALE } from "@/lib/currency/convert";
import { AreaRow, CurrencyRows, EXAMPLE_NIGHT_MINOR } from "@/components/currency/DisplayPreferences";
import { RatesAttribution } from "@/components/currency/RatesAttribution";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getDictionary(await getLocale()).experienceSettings.region.title };
}
/* Today's date is printed, so the page is rendered per request. */
export const dynamic = "force-dynamic";

/**
 * /settings/region (R3-16): the language, and how money, dates and floor
 * area are shown.
 *
 * CURRENCY (13 November 2026, the founder: "add a currency setting"). Naira is
 * still the price of record: every price is set and paid in naira. What the
 * reader chooses here is a GUIDE currency: browsing pages add an approximate
 * figure beside the naira price ("about £2,516"), worked out from a daily
 * rate the platform stores (lib/currency). The sheet says so before anybody
 * chooses, the example row shows exactly how a price will read, and with no
 * fresh rate the page says plainly that prices show in naira only. Money
 * screens (checkout, wallet, receipts, offers) never convert.
 *
 * This page is the first surface wired end to end: the choice is read on the
 * server (account, then cookie, then the request's country and language), so
 * the example renders in the chosen currency on its first paint.
 */
export default async function RegionSettingsPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const today = formatMoneyDate(new Date(), locale) ?? "";
  const copy = t.experienceSettings.region;
  const prefs = t.experienceSettings.preferences;
  const display = await getDisplayMoney();

  const rate = display.rate ? parseRate(display.rate.ngnPerUnit) : null;
  /* Naira per unit to kobo, rounded to the kobo, for the rate line only. */
  const rateKobo = rate !== null ? Number((rate * 100n + RATE_SCALE / 2n) / RATE_SCALE) : null;
  const rateNote =
    display.currency === "NGN" ? null : display.rate && rateKobo !== null ? (
      <>
        {prefs.rateLine
          .replace("{code}", display.currency)
          .replace("{rate}", formatMoney(rateKobo, locale))
          .replace("{date}", formatMoneyDate(new Date(display.rate.sourceUpdatedAt), locale) ?? "")}{" "}
        <RatesAttribution display={display} label={prefs.attribution} />
      </>
    ) : (
      <span data-testid="currency-no-rate">{prefs.noRate}</span>
    );

  return (
    <PageFrame title={copy.title} subtitle={copy.sub} fallback="/settings" width="narrow">
      <section id="settings-language" className="scroll-mt-28">
        <SettingsGroup label={copy.language}>
          <LanguageRow t={forLanguage(t)} current={locale} />
        </SettingsGroup>
      </section>
      <section id="settings-money-display" className="scroll-mt-28">
        <SettingsGroup label={copy.money} note={rateNote}>
          <CurrencyRows
            display={display}
            copy={prefs}
            locale={locale}
            exampleNaira={formatMoney(EXAMPLE_NIGHT_MINOR, locale)}
          />
          <RowValue icon="calendar-check" label={copy.dates} sub={copy.datesSub.replace("{date}", today)} testId="region-dates" />
          <RowValue icon="coins" label={copy.numbers} sub={copy.numbersSub} />
        </SettingsGroup>
      </section>
      <section id="settings-floor-area" className="scroll-mt-28">
        <SettingsGroup label={prefs.area}>
          <AreaRow display={display} copy={prefs} />
        </SettingsGroup>
      </section>
    </PageFrame>
  );
}
