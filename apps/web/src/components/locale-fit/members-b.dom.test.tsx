/**
 * Locale fit, the surfaces members use most, part two (north star checklist
 * point 22): listing detail (the lead with its move-in total and amenity tiles,
 * the cost breakdown, the section tabs, the agent card, the sale's facts and the
 * pinned actions), the reserve panel's steppers and summary, and the search
 * filters sheet opened, each mounted in
 * Chromium at 390px in English, Hausa, Igbo and Yorùbá from the real
 * dictionaries, on the product's real compiled cascade.
 *
 * The listings are the repository's own development fixtures
 * (`app/(dev)/preview/f3/fixtures`: RENTAL and SALE), composed as
 * `f3/listing` and `session-b/sweep-home/listing-parts` compose them. See
 * `fit-cases.ts` for the three things held.
 */
import { afterAll, beforeAll, describe, vi } from "vitest";
import { BROWSER_TEST_TIMEOUT, closeBrowser, hasBrowser, warmBrowser } from "@/lib/testing/mount-in-browser";
import { appCss } from "@/lib/testing/locale-fit";
import { fitCases } from "./fit-cases";

vi.setConfig({ testTimeout: BROWSER_TEST_TIMEOUT });
beforeAll(warmBrowser);
afterAll(closeBrowser);

const CSS = () => appCss();

/* The key is "<surface> <locale>"; the value is the report line. */
const KNOWN: Record<string, string> = {};

describe.skipIf(!hasBrowser && !process.env.CI)("locale fit: listing detail, reserve and filters at 390px", () => {
  fitCases(
    {
      name: "Listing detail, rental: lead, move-in total, breakdown, tabs, agent and pinned actions",
      imports: `
        import { UiIcon } from "@/design-system/icons/UiIcon";
        import { ICON, Section, Stack, TYPE } from "@/components/app/Screen";
        import { ListingMoveInBlock } from "@/components/app/listing/ListingMoveInBlock";
        import { ListingMoveIn } from "@/components/app/listing/ListingMoveIn";
        import { ListingSectionTabs } from "@/components/app/listing/ListingSectionTabs";
        import { ListingAmenityTiles } from "@/components/app/listing/ListingAmenityTiles";
        import { ListingAgentCard } from "@/components/app/listing/ListingAgentCard";
        import { ListingStickyBar } from "@/components/app/listing/ListingStickyBar";
        import { PhotoViewerProvider } from "@/components/app/listing/PhotoViewer";
        import { RENTAL } from "@/app/(dev)/preview/f3/fixtures";`,
      setup: `const listing = RENTAL; const where = listing.area + ", " + listing.city + ", Lagos State";`,
      body: `
        <PhotoViewerProvider title={listing.title} photos={listing.photos} hue={listing.hue} kind={listing.kind}>
          <div className="nf-shell mx-auto max-w-5xl">
            <div className="relative z-10">
              <Stack>
                <Section className="nf-glass nf-glass--card nf-detail-lead scroll-mt-16" id="overview">
                  <h1 className="nf-h2 [overflow-wrap:anywhere]">{listing.title}</h1>
                  <a href="#location" className={"nf-tap mt-inline-tight inline-flex max-w-full items-center gap-inline " + TYPE.body}>
                    <UiIcon name="location" size={ICON.inline} className="shrink-0" />
                    <span className="min-w-0">{where}</span>
                    <UiIcon name="arrow-right" size={16} className="shrink-0" />
                  </a>
                  <div className="mt-md"><ListingMoveInBlock listing={listing} locale={locale} t={t} /></div>
                  <div className="mt-md"><ListingAmenityTiles amenities={listing.amenities} limit={5} moreHref="#amenities" moreLabel={t.catalogue.detail.more} /></div>
                </Section>
                <Section title={t.moveIn.title} description={t.moveIn.lede} divided>
                  <ListingMoveIn listing={listing} locale={locale} t={t} />
                </Section>
                <ListingSectionTabs tabs={[
                  { id: "overview", label: t.catalogue.detail.overview },
                  { id: "amenities", label: t.catalogue.detail.amenities },
                  { id: "location", label: t.catalogue.detail.location },
                  { id: "reviews", label: t.catalogue.detail.reviews },
                ]} />
                <Section id="amenities" title={t.catalogue.detail.amenities} divided><ListingAmenityTiles amenities={listing.amenities} /></Section>
                <Section title={t.catalogue.detail.agent} divided>
                  <ListingAgentCard verified={listing.verified} t={t} messageHref={"/messages/new?listing=" + listing.id} />
                </Section>
              </Stack>
            </div>
            <ListingStickyBar variant="rental" priceMinor={listing.priceMinor} currency={listing.currency} locale={locale} perLabel={t.catalogue.card.perYear}
              action={{ label: t.catalogue.detail.bookInspection, href: "#reserve" }}
              secondary={{ label: t.catalogue.detail.calculateBreakdown, href: "/preview/f3/move-in" }} secondaryIcon="document"
              fallbackLabel={listing.title} moveInMinor={listing.moveInCostMinor} moveInStated={listing.moveInCostStated}
              moveInLabel={t.catalogue.detail.moveInTotal} moveInFromLabel={t.catalogue.detail.moveInFrom} secondaryShortLabel={t.catalogue.detail.breakdownShort} />
          </div>
        </PhotoViewerProvider>`,
      bleed: true,
      css: CSS,
    },
    KNOWN,
  );

  fitCases(
    {
      name: "Listing detail, sale: spec chips, amenities, purchase costs and tenure",
      imports: `
        import { Section, Stack } from "@/components/app/Screen";
        import { ListingPurchase } from "@/components/app/listing/ListingPurchase";
        import { ListingTenure } from "@/components/app/listing/ListingTenure";
        import { ListingSpecChips } from "@/components/app/listing/ListingSpecChips";
        import { specChips } from "@/components/app/listing/spec-chips";
        import { ListingAmenities } from "@/components/app/listing/ListingAmenities";
        import { ListingUtilities } from "@/components/app/listing/ListingUtilities";
        import { ListingCodeRow } from "@/components/app/listing/ListingCode";
        import { PhotoViewerProvider } from "@/components/app/listing/PhotoViewer";
        import { RENTAL, SALE } from "@/app/(dev)/preview/f3/fixtures";`,
      body: `
        <PhotoViewerProvider title={SALE.title} photos={SALE.photos} hue={SALE.hue} kind={SALE.kind}>
          <div className="nf-shell"><Stack>
            <Section title={t.catalogue.detail.overview} divided><ListingSpecChips chips={specChips(SALE, t, locale)} /></Section>
            <Section title={t.catalogue.detail.amenities} divided>
              <ListingAmenities bedrooms={RENTAL.bedrooms} bathrooms={RENTAL.bathrooms} amenities={RENTAL.amenities} />
            </Section>
            <Section title={t.catalogue.detail.location} divided><ListingUtilities utilities={RENTAL.utilities} access={null} bookingConfirmed={false} /></Section>
            <Section divided><ListingPurchase listing={SALE} locale={locale} t={t} /></Section>
            <Section divided><ListingTenure listing={SALE} /></Section>
            <Section divided><ListingCodeRow code="VAL-7K2Q" copy={t.listingReference} /></Section>
          </Stack></div>
        </PhotoViewerProvider>`,
      bleed: true,
      css: CSS,
    },
    KNOWN,
  );

  fitCases(
    {
      name: "Reserve panel, steppers and summary",
      imports: `
        import { Section, Stack } from "@/components/app/Screen";
        import { StayDatesProvider } from "@/components/app/listing/StayDates";
        import { PhotoViewerProvider } from "@/components/app/listing/PhotoViewer";
        import { ReservePanel } from "@/app/(app)/listing/[id]/ReservePanel";
        import { RENTAL } from "@/app/(dev)/preview/f3/fixtures";`,
      body: `
        <PhotoViewerProvider title={RENTAL.title} photos={RENTAL.photos} hue={RENTAL.hue} kind={RENTAL.kind}>
          <StayDatesProvider today="2026-09-23" blockedDates={[]} priceMinor={8_500_000} capacity={4}>
            <div className="nf-shell"><Stack>
              <Section title={t.catalogue.detail.moveInTotal} divided>
                <ReservePanel listingId={RENTAL.id} currency="NGN" locale={locale} instantBook messageHref="#" copy={t.memberFlows} />
              </Section>
            </Stack></div>
          </StayDatesProvider>
        </PhotoViewerProvider>`,
      bleed: true,
      css: CSS,
    },
    KNOWN,
  );

  fitCases(
    {
      name: "Search filters sheet, opened",
      imports: `
        import { FilterDrawer } from "@/components/app/filters/FilterDrawer";
        import { parseShelfQuery } from "@/components/app/search/shelf-query";`,
      body: `
        <div style={{ padding: 16 }}>
          <FilterDrawer query={parseShelfQuery({})} facts={[]} locale={locale} copy={t.catalogue.filters} costCopy={t.moveIn}
            compoundCopy={t.shape.compound} sortCopy={t.shape.sorts} serviceCopy={t.shape.service} cashCopy={t.shape.cash}
            unitCopy={t.shape.unit} commuteCopy={t.shape.commute} kindCopy={t.experienceLabels} />
        </div>`,
      bleed: true,
      scope: "body",
      before: async (page) => {
        await page.locator("[aria-haspopup=dialog]").first().click();
        await page.getByRole("dialog").waitFor();
      },
      css: CSS,
    },
    KNOWN,
  );
});
