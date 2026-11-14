import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * NAIRA IS THE PRICE OF RECORD, AND THIS KEEPS THE GUIDE OFF MONEY SCREENS.
 *
 * A converted figure may appear on a browsing surface beside a naira price,
 * never on a money surface (checkout, payment, wallet, receipts, refunds,
 * payouts, offers, agreements, the move-in ledger, the lister's pricing
 * screens, admin). See `lib/currency/currencies.ts` for why.
 *
 * Two mechanical rules:
 *   1. Only the files on ADOPTERS import the guide (`components/currency` or
 *      `lib/currency`). Phase 2 adds each browsing surface here by name, so a
 *      reviewer reads every adoption line by line.
 *   2. No file under a money path ever imports it, whatever the list says.
 */

const SRC = join(__dirname, "..", "..");

/** Files outside lib/currency and components/currency that may import the guide. */
const ADOPTERS: ReadonlySet<string> = new Set([
  /* The rates job's route: it fetches rates, it shows no price. */
  "app/api/cron/display-rates/route.ts",
  /* Settings, Language and currency: the chooser and its worked example. */
  "app/(app)/settings/region/page.tsx",
  /* Settings: the Search card names the chosen currency; the search index finds it. */
  "app/(app)/settings/account/page.tsx",
  "components/app/account/settings-search.ts",
  /* The Search card's distance row saves through the display preferences. */
  "components/app/account/SettingsGroups.tsx",
  /* PHASE 2 (13 November 2026): the browsing pages that resolve the guide
     once (GuideScope), and the browsing surfaces that draw it beside an
     ASKING price. Move-in totals, dated stay totals, booking choices and the
     table deposit foot on these same files stay naira only. */
  "app/(app)/search/page.tsx",
  "app/(app)/home/page.tsx",
  "app/(app)/stays/page.tsx",
  "app/(app)/stay/[id]/page.tsx",
  "app/(app)/stay/[id]/StayDetailView.tsx",
  "app/(app)/restaurant/[id]/page.tsx",
  "app/(app)/restaurant/[id]/RestaurantFace.tsx",
  "app/(app)/saved/page.tsx",
  "app/(app)/saved/shelf-rows.tsx",
  "components/app/ListingCard.tsx",
  "components/app/home/HomeListingCard.tsx",
  "components/app/home/FeaturedStack.tsx",
  "components/app/stays/StayCard.tsx",
  "components/app/stays/StayStackCard.tsx",
  "components/app/search/MapCanvas.tsx",
  "components/app/search/MapDock.tsx",
  /* Currency tool 2 (14 November 2026): the filter sheet's budget, typed in
     the reader's currency and turned into the naira the search filters on.
     A reader's own budget, never a price; see lib/currency/budget.ts. */
  "components/app/filters/FilterDrawerPanel.tsx",
  /* The harness page that draws that sheet with a fixture rate. No price on it. */
  "app/(dev)/preview/fixes/filters-budget/page.tsx",
]);

/** Paths that are money surfaces. A match here can never import the guide. */
const MONEY_PATHS: readonly RegExp[] = [
  /(^|\/)wallet(\/|$)/,
  /(^|\/)payments?(\/|$)/,
  /(^|\/)checkout(\/|$)/,
  /(^|\/)receipts?(\/|$)/,
  /(^|\/)refunds?(\/|$)/,
  /(^|\/)payouts?(\/|$)/,
  /(^|\/)offers?(\/|$)/,
  /(^|\/)agreements?(\/|$)/,
  /(^|\/)rent\/move-in(\/|$)/,
  /(^|\/)components\/money(\/|$)/,
  /(^|\/)lib\/money(\/|$)/,
  /^app\/admin(\/|$)/,
  /^app\/host(\/|$)/,
  /^app\/agent(\/|$)/,
  /^components\/host(\/|$)/,
  /^components\/workspace(\/|$)/,
  /(^|\/)ListingStickyBar\.tsx$/,
  /(^|\/)ListingMoveIn(Block)?\.tsx$/,
  /(^|\/)LastLetLine\.tsx$/,
  /(^|\/)ReservePanel\.tsx$/,
  /(^|\/)RentalPanel\.tsx$/,
  /(^|\/)ListingPurchase\.tsx$/,
  /(^|\/)StayFoot\.tsx$/,
  /(^|\/)StayCost\.tsx$/,
  /(^|\/)DoorTotal\.tsx$/,
  /(^|\/)ArrivalChargesLine\.tsx$/,
];

const IMPORTS_GUIDE = /from\s+["'](@\/(components|lib)\/currency\/[^"']+|\.\.?\/[^"']*currency\/[^"']+)["']/;

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

describe("the currency guide stays off money surfaces", () => {
  const files = sourceFiles(SRC).map((full) => ({ rel: relative(SRC, full).split("\\").join("/"), full }));
  const importers = files
    .filter(({ rel }) => !rel.startsWith("lib/currency/") && !rel.startsWith("components/currency/"))
    .filter(({ full }) => IMPORTS_GUIDE.test(readFileSync(full, "utf8")))
    .map(({ rel }) => rel);

  it("walks the real tree", () => {
    expect(files.length).toBeGreaterThan(1_000);
    expect(files.some(({ rel }) => rel === "components/currency/Price.tsx")).toBe(true);
  });

  it("is imported only by the surfaces listed here", () => {
    expect(importers.filter((rel) => !ADOPTERS.has(rel)), "a new surface shows a converted figure; add it to ADOPTERS on purpose").toEqual([]);
  });

  it("is never imported by a money surface, whatever the list says", () => {
    expect(importers.filter((rel) => MONEY_PATHS.some((re) => re.test(rel)))).toEqual([]);
    for (const adopter of ADOPTERS) {
      expect(MONEY_PATHS.some((re) => re.test(adopter)), `${adopter} is a money surface`).toBe(false);
    }
  });

  it("knows the lister's side and the pay flow are money surfaces", () => {
    for (const path of [
      "app/(app)/wallet/page.tsx",
      "app/(app)/rent/move-in/[listingId]/MoveInLedger.tsx",
      "app/(app)/listing/[id]/ReservePanel.tsx",
      "components/app/listing/ListingStickyBar.tsx",
      "components/host/stays/RatesStep.tsx",
      "app/agent/list/ListingWizard.tsx",
      "app/admin/listings/ListingCard.tsx",
    ]) {
      expect(MONEY_PATHS.some((re) => re.test(path)), path).toBe(true);
    }
    for (const path of ["components/app/ListingCard.tsx", "components/app/stays/StayCard.tsx", "app/(app)/search/page.tsx"]) {
      expect(MONEY_PATHS.some((re) => re.test(path)), path).toBe(false);
    }
  });
});
