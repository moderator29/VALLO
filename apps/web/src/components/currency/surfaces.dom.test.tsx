import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { getDictionary } from "@vallo/i18n";
import type { DisplayMoney } from "@/lib/currency/display";
import { cardPrice } from "@/components/app/listing-card-model";
import { ListingCard } from "@/components/app/ListingCard";
import { StayCard } from "@/components/app/stays/StayCard";
import { SHELF, STAYS } from "@/app/(dev)/preview/f3/fixtures";
import { listingShelf } from "@/app/(app)/saved/shelf-rows";
import { DisplayMoneyProvider } from "./DisplayMoneyProvider";
import { guideCopyOf } from "./guide-copy";
import { ClientCopyProvider } from "@/lib/i18n/client-copy";
import { clientCopyOf } from "@/lib/i18n/client-copy-of";
import type { Listing } from "@/lib/listings/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, refresh: () => undefined, prefetch: () => undefined }),
  usePathname: () => "/search",
  useSearchParams: () => new URLSearchParams(),
}));

/**
 * PHASE 2: THE GUIDE ON THE REAL BROWSING CARDS, AND NOWHERE IT MUST NOT BE.
 *
 * The listing card, the stay card and the saved shelf are drawn with the
 * preview fixtures inside the provider a browsing page puts above them. An
 * asking price gains "about £..."; a move-in total never does; with no
 * provider (a money page) or naira chosen, nothing changes. Floor area
 * follows the reader's unit.
 */

const t = getDictionary("en");
const prefs = t.experienceSettings.preferences;
const POUNDS: DisplayMoney = {
  choice: "GBP",
  currency: "GBP",
  automatic: "NGN",
  areaUnit: "sqft",
  distanceUnit: "mi",
  rate: {
    currency: "GBP",
    ngnPerUnit: "1788.334597543",
    source: "exchangerate-api",
    sourceUpdatedAt: "2026-11-13T00:02:31.000Z",
    fetchedAt: "2026-11-13T00:50:04.000Z",
  },
};

const withCopy = (node: ReactNode) => <ClientCopyProvider copy={clientCopyOf(t)}>{node}</ClientCopyProvider>;
const inPounds = (node: ReactNode) =>
  renderToStaticMarkup(withCopy(<DisplayMoneyProvider value={{ display: POUNDS, copy: guideCopyOf(prefs) }}>{node}</DisplayMoneyProvider>));
const bare = (node: ReactNode) => renderToStaticMarkup(withCopy(node));

const headline = SHELF.find((l) => cardPrice(l).lead === "headline");
/* A yearly tenancy with a stated move-in total leads with that total. */
const moveIn: Listing | undefined = headline
  ? { ...headline, intent: "rent", pricePeriod: "year", moveInCostMinor: 900_000_000, moveInCostStated: true } as Listing
  : undefined;
const sized: Listing | undefined = headline ? { ...headline, sizeSqm: 120 } : undefined;
const priced = STAYS.find((s) => s.nightlyMinor !== null);

describe("the guide on the browsing cards", () => {
  it("has fixtures for each case", () => {
    expect(headline && moveIn && priced).toBeTruthy();
    expect(cardPrice(moveIn!).lead).toBe("moveIn");
  });

  it("adds the guide beside a listing's asking price", () => {
    const html = inPounds(<ListingCard listing={headline!} locale="en" t={t} index={0} />);
    expect(html).toContain('data-guide="GBP"');
    expect(html).toContain("about £");
  });

  it("never beside a move-in total, which is an obligation", () => {
    const html = inPounds(<ListingCard listing={moveIn!} locale="en" t={t} index={0} />);
    expect(html).not.toContain("data-guide");
  });

  it("adds the guide beside a stay's nightly rate", () => {
    const html = inPounds(<StayCard stay={priced!} locale="en" t={t} index={0} />);
    expect(html).toContain('data-guide="GBP"');
  });

  it("adds it on a saved shelf's asking price, and not on its move-in total", () => {
    expect(inPounds(listingShelf(headline!, "en", t, false))).toContain('data-guide="GBP"');
    expect(inPounds(listingShelf(moveIn!, "en", t, false))).not.toContain("data-guide");
  });

  it("draws nothing with no provider above it, as on a money page", () => {
    const html = bare(<ListingCard listing={headline!} locale="en" t={t} index={0} />);
    expect(html).not.toContain("data-guide");
    expect(html).not.toContain("about £");
  });

  it("writes floor area in the reader's unit", () => {
    const feet = inPounds(<ListingCard listing={sized!} locale="en" t={t} index={0} />);
    expect(feet).toContain("sq ft");
    const metres = bare(<ListingCard listing={sized!} locale="en" t={t} index={0} />);
    expect(metres).toContain("m²");
    expect(metres).not.toContain("sq ft");
  });
});
