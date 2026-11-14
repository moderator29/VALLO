import { getDictionary } from "@vallo/i18n";
import { FilterDrawer } from "@/components/app/filters/FilterDrawer";
import { parseShelfQuery } from "@/components/app/search/shelf-query";
import { DisplayMoneyProvider } from "@/components/currency/DisplayMoneyProvider";
import { guideCopyOf } from "@/components/currency/guide-copy";
import type { DisplayMoney } from "@/lib/currency/display";
import { isDisplayCurrency } from "@/lib/currency/currencies";
import type { ListingFacts } from "@/lib/listings/filter";
import "@/components/app/search/search-v2.css";

/**
 * The Filters sheet, open, as a reader who chose another currency sees it:
 * the budget row in their currency under the naira fields (currency tool 2).
 * A fixture rate, stamped now so it is fresh; no database, no live rate.
 *
 *   /preview/fixes/filters-budget              British pounds
 *   /preview/fixes/filters-budget?currency=XOF any listed currency
 *   /preview/fixes/filters-budget?stale=1      no fresh rate: naira fields only
 *   /preview/fixes/filters-budget?min=2000000&max=5000000
 */
export const dynamic = "force-dynamic";

/* Naira per one unit, fixtures only. */
const RATES: Record<string, string> = {
  USD: "1415.5",
  GBP: "1788.334597543",
  EUR: "1532.1",
  CAD: "1011.2",
  GHS: "121.4",
  ZAR: "81.6",
  KES: "10.96",
  AED: "385.4",
  XOF: "2.335",
  AUD: "927.3",
};

const FACTS = [180_000_000, 250_000_000, 320_000_000, 450_000_000, 900_000_000].map(
  (priceMinor) =>
    ({
      kind: "rental",
      priceMinor,
      bedrooms: 2,
      bathrooms: 2,
      amenities: [],
      instantBook: false,
      verified: false,
      isDemo: false,
      source: "first-party",
    }) as unknown as ListingFacts,
);

export default async function PreviewFiltersBudget({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : undefined);
  const asked = one("currency");
  const currency = isDisplayCurrency(asked) && asked !== "NGN" ? asked : "GBP";
  const now = new Date().toISOString();
  const display: DisplayMoney = {
    choice: currency,
    currency,
    automatic: "NGN",
    areaUnit: "sqm",
    distanceUnit: "km",
    rate: one("stale")
      ? null
      : { currency, ngnPerUnit: RATES[currency] ?? "1788.334597543", source: "exchangerate-api", sourceUpdatedAt: now, fetchedAt: now },
  };
  const t = getDictionary("en");
  const query = parseShelfQuery({
    ...(one("min") ? { min: one("min") } : {}),
    ...(one("max") ? { max: one("max") } : {}),
  });
  return (
    <main className="min-h-dvh bg-[var(--nf-surface-canvas)] px-md pt-md">
      <DisplayMoneyProvider value={{ display, copy: guideCopyOf(t.experienceSettings.preferences) }}>
        <FilterDrawer
          openOnMount
          query={query}
          facts={FACTS}
          locale="en"
          copy={t.catalogue.filters}
          costCopy={t.moveIn}
          compoundCopy={t.shape.compound}
          sortCopy={t.shape.sorts}
          serviceCopy={t.shape.service}
          cashCopy={t.shape.cash}
          unitCopy={t.shape.unit}
          commuteCopy={t.shape.commute}
          kindCopy={t.experienceLabels}
          searchCopy={t.searchV2.filters}
        />
      </DisplayMoneyProvider>
    </main>
  );
}
