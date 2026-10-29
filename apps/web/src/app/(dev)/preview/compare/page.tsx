import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { CompareView } from "@/app/(app)/compare/CompareView";
import { CompareTray } from "@/components/app/compare/CompareTray";
import { compareTable } from "@/lib/saved/compare";
import type { Listing } from "@/lib/listings/types";

/**
 * THE PROOF HARNESS FOR /compare: the real compare view over invented
 * listings, no database. Three places so the picker is exercised.
 */
export const dynamic = "force-dynamic";

function listing(over: Partial<Listing>): Listing {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    slug: "a",
    title: "Two bedroom flat",
    kind: "apartment",
    area: "Yaba",
    city: "Lagos",
    state: "Lagos",
    priceMinor: 200_000_000,
    pricePeriod: "year",
    intent: "rent",
    currency: "NGN",
    bedrooms: 2,
    bathrooms: 2,
    rating: 0,
    reviewCount: 0,
    verified: false,
    isDemo: false,
    instantBook: false,
    amenities: [],
    photos: [],
    hue: 0,
    ...over,
  };
}

export default async function Page() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const cc = t.catalogue.compare;
  const table = compareTable(
    [
      listing({ id: "00000000-0000-4000-8000-000000000001", title: "Bright two bedroom flat in Yaba", verified: true, moveInCostMinor: 330_000_000, agencyFeeMinor: 20_000_000, sizeSqm: 120, parkingSpaces: 2 }),
      listing({ id: "00000000-0000-4000-8000-000000000002", title: "Three bedroom duplex, Lekki Phase 1", area: "Lekki Phase 1", priceMinor: 180_000_000, bedrooms: 3, bathrooms: 3, moveInCostMinor: 290_000_000, moveInCostStated: false }),
      listing({ id: "00000000-0000-4000-8000-000000000003", title: "Self contained room, Surulere", area: "Surulere", priceMinor: 90_000_000, bedrooms: 1, bathrooms: 1 }),
    ],
    locale,
    {
      moveIn: cc.moveIn,
      rent: cc.rent,
      beds: cc.beds,
      baths: cc.baths,
      size: cc.size,
      parking: cc.parking,
      type: cc.type,
      power: cc.power,
      availableFrom: cc.availableFrom,
      from: cc.from,
    },
    t.moveIn,
  );
  return (
    <div className="nf-cat-surface mx-auto max-w-5xl px-gutter py-md" data-testid="compare-preview">
      <h1 className="nf-h2">{cc.page.title}</h1>
      <p className="nf-body-sm text-[var(--nf-content-secondary)]">{cc.page.lede}</p>
      <div className="mt-md">
        <CompareView
          table={table}
          initial={table.columns.slice(0, 2).map((c) => c.id)}
          copy={{
            open: cc.open,
            openLabel: cc.openLabel,
            title: cc.title,
            pick: cc.page.pick,
            pickLimit: t.experienceDiscover.saved.pickSwap,
            tooFew: cc.tooFew,
            notStated: cc.notStated,
            view: cc.view,
            close: cc.close,
            verified: t.common.verified,
            lower: t.experienceDiscover.saved.lower,
          }}
        />
      </div>
      {/* ?tray=1 seeds the device tray so its bar can be seen over the page. */}
      <CompareTray />
    </div>
  );
}
