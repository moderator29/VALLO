import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getDictionary } from "@vallo/i18n";
import { withoutComments } from "@/lib/copy/source-scan";
import { LISTER_GAPS, countOrNoData, measurementRows, sourceSplit, type ListingMeasurement } from "./measurement";
import { PROMOTION_METRICS, type PromotionMetric } from "./tiers";

/**
 * STATEMENT 6: NO METRIC IS ESTIMATED, AND NO DATA IS NEVER ZERO
 * (`VALLO_PROMOTION.md`, "What promotion must never do").
 */
const t = getDictionary("en");

/** A measurement as the read returns it: the four readable counts, the six gaps. */
function measured(values: Partial<Record<PromotionMetric, unknown>>, extra: Partial<ListingMeasurement> = {}): ListingMeasurement {
  const all = Object.fromEntries(PROMOTION_METRICS.map((metric) => [metric, values[metric] ?? null]));
  return { windowDays: 30, values: all as ListingMeasurement["values"], gaps: { ...LISTER_GAPS }, ...extra };
}

describe("the promotion results model", () => {
  it("with no measurement, lays out all ten figures, each as no data with no reason claimed", () => {
    const rows = measurementRows(null);
    expect(rows.map((row) => row.metric)).toEqual([...PROMOTION_METRICS]);
    for (const row of rows) {
      expect(row.value).toBeNull();
      expect(row.gap).toBeNull();
    }
  });

  it("a figure the lister cannot read is no data with its reason, never zero", () => {
    const rows = measurementRows(measured({ inquiries: 4, contacts: 0, viewings: 1, bookings: 0 }));
    const by = Object.fromEntries(rows.map((row) => [row.metric, row]));
    expect(by.inquiries).toEqual({ metric: "inquiries", value: 4, gap: null });
    expect(by.contacts).toEqual({ metric: "contacts", value: 0, gap: null });
    expect(by.impressions).toEqual({ metric: "impressions", value: null, gap: "notReadable" });
    expect(by.uniqueViewers).toEqual({ metric: "uniqueViewers", value: null, gap: "notKept" });
    for (const metric of ["saves", "shares", "transactions", "views"]) expect(by[metric]?.value).toBeNull();
  });

  it("keeps a recorded zero as a zero, and turns anything unrecorded into no data rather than zero", () => {
    expect(countOrNoData(0)).toBe(0);
    expect(countOrNoData(12)).toBe(12);
    for (const value of [undefined, null, "", "0", Number.NaN, Infinity, -1, 2.5, {}, []]) {
      expect(countOrNoData(value)).toBeNull();
    }
  });

  it("for a tier, shows only the tier's metrics and never fills a gap", () => {
    const rows = measurementRows(measured({ impressions: 40, saves: 0 }), "boost");
    expect(rows.map((row) => row.metric)).toEqual(["impressions", "views", "uniqueViewers", "saves", "inquiries"]);
    expect(rows.find((row) => row.metric === "impressions")?.value).toBe(40);
    expect(rows.find((row) => row.metric === "saves")?.value).toBe(0);
    expect(rows.find((row) => row.metric === "views")?.value).toBeNull();
  });

  it("has a name for every metric, a reason for every gap, and a no-data word that is not a number", () => {
    for (const metric of PROMOTION_METRICS) expect(t.experienceFeatures.promotion.metrics[metric].trim()).not.toBe("");
    expect(t.experienceFeatures.promotion.noData).not.toMatch(/\d/);
    for (const words of Object.values(t.experienceFeatures.promotion.gaps)) {
      expect(words.trim()).not.toBe("");
      expect(words).not.toMatch(/\d|\b0\b|zero/i);
    }
  });
});

describe("promoted against organic: not recorded yet, so never drawn", () => {
  it("with no source data, draws no split", () => {
    expect(sourceSplit(null)).toBeNull();
    expect(sourceSplit(measured({ impressions: 400, views: 40 }))).toBeNull();
    expect(sourceSplit(measured({ impressions: 400 }, { bySource: {} }))).toBeNull();
  });

  it("slots in when the read gains a source dimension, and only from recorded parts that add up", () => {
    const ok = measured({ impressions: 400, views: 40 }, { bySource: { impressions: { promoted: 270, organic: 130 } } });
    expect(sourceSplit(ok)).toEqual([{ metric: "impressions", promoted: 270, organic: 130 }]);
    /* Parts that do not add up to the recorded total, a missing part, or a
       non-count are not split: nothing is apportioned. */
    for (const parts of [{ promoted: 270, organic: 100 }, { promoted: 270 }, { promoted: 270.5, organic: 129.5 }, { promoted: "270", organic: 130 }]) {
      expect(sourceSplit(measured({ impressions: 400 }, { bySource: { impressions: parts } }))).toBeNull();
    }
    /* No total recorded: no split, however the parts read. */
    expect(sourceSplit(measured({}, { bySource: { impressions: { promoted: 1, organic: 1 } } }))).toBeNull();
  });

  it("the sentence for no split says it is not recorded, and claims no share", () => {
    const words = t.experienceFeatures.promotion.measure.splitNotRecorded;
    expect(words).toMatch(/not recorded yet/);
    expect(words).toMatch(/totals only/);
    expect(words).not.toMatch(/\d|percent|%|came from|thanks to|because of/i);
  });
});

describe("the results screen", () => {
  const results = withoutComments(
    readFileSync(join(__dirname, "..", "..", "components", "promotion", "PromotionResults.tsx"), "utf8"),
  );

  it("prints no data for a null figure, never a zero", () => {
    expect(results).toMatch(/value === null\s*\?\s*p\.noData/);
    expect(results).not.toMatch(/\?\?\s*0\b|\|\|\s*0\b/);
  });

  it("draws the split only from the split it is handed, and otherwise says it is not recorded", () => {
    expect(results).toMatch(/\{split \?/);
    expect(results).toMatch(/splitNotRecorded/);
    expect(results).not.toMatch(/bySource|apportion|estimate/);
  });

  /*
   * IT IS LINKED NOW, AND FROM ONE PLACE. This test used to assert the screen
   * was linked from nowhere while Session 2's reads were missing; the founder
   * could not find it, so it has doors (7 October 2026): the Promote action on
   * a live listing's row and `/agent/promotion`. Both build the address with
   * `promotionHref` in `lib/promotion/links.ts`, so the literal path appears
   * there and nowhere else, and buying on the screen still says it is not on
   * sale.
   */
  it("is linked only through lib/promotion/links.ts, from the listings row and the promotion hub", () => {
    const SRC = join(__dirname, "..", "..");
    const PAGE = join("app", "agent", "listings", "[listingId]", "promotion", "page.tsx");
    /* A literal path to the screen, outside the screen itself and the route maps
       (route-parents for the back link, route-labels for the page name); a
       map entry names the route, it does not link to it. */
    const LINK = /["'`][^"'`\n]*listings\/[^"'`\n]*\/promotion\b[^"'`\n]*["'`]/;
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        if (entry === "node_modules" || entry.startsWith(".")) continue;
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
          if (path.endsWith(PAGE) || /lib\/nav\/route-(parents|labels)\.ts$|lib\/docs\/coverage\.ts$/.test(path)) continue;
          if (LINK.test(withoutComments(readFileSync(path, "utf8")))) offenders.push(path.slice(SRC.length));
        }
      }
    };
    walk(SRC);
    expect(offenders).toEqual(["/lib/promotion/links.ts"]);

    /* The two doors use it, and the row offers it on a live listing only. */
    const row = readFileSync(join(SRC, "app", "agent", "listings", "ListingsWorkspace.tsx"), "utf8");
    expect(row).toMatch(/href=\{promotionHref\(listing\.id\)\}/);
    expect(row).toMatch(/canPromote\(listing\)/);
    const hub = readFileSync(join(SRC, "app", "agent", "promotion", "page.tsx"), "utf8");
    expect(hub).toMatch(/href=\{promotionHref\(listing\.id\)\}/);
    expect(hub).toContain("PROMOTION_NOT_ON_SALE");
  });
});
