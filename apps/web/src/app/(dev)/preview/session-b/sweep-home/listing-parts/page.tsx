import { getDictionary, type Locale } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { Section, Stack } from "@/components/app/Screen";
import { ButtonLink } from "@/components/ui/Button";
import { ListingPurchase } from "@/components/app/listing/ListingPurchase";
import { ListingTenure } from "@/components/app/listing/ListingTenure";
import { ListingSpecChips } from "@/components/app/listing/ListingSpecChips";
import { specChips } from "@/components/app/listing/spec-chips";
import { ListingAmenities } from "@/components/app/listing/ListingAmenities";
import { ListingUtilities } from "@/components/app/listing/ListingUtilities";
import { ListingReviews } from "@/components/app/listing/ListingReviews";
import { ListingCodeRow } from "@/components/app/listing/ListingCode";
import { ListingPhotoGrid } from "@/components/app/listing/ListingPhotoGrid";
import { ListingAgentCard } from "@/components/app/listing/ListingAgentCard";
import { PhotoViewerProvider } from "@/components/app/listing/PhotoViewer";
import { StayDatesProvider } from "@/components/app/listing/StayDates";
import { RentalPanel } from "@/app/(app)/listing/[id]/RentalPanel";
import { ReservePanel } from "@/app/(app)/listing/[id]/ReservePanel";
import { ReserveTable } from "@/app/(app)/listing/[id]/ReserveTable";
import { RENTAL, SALE } from "../../../f3/fixtures";
import { SweepFrame } from "../Frame";

/**
 * Every other panel `/listing/[id]` can mount, from fixtures: the sale's
 * purchase costs and tenure, the spec row, the amenity list, power and
 * water, reviews with one written review, the reference code row, the photo
 * grid, the agent card, the rental and sale panels, the stay reserve panel,
 * the restaurant table, and the example listing's booking panel.
 */
export const dynamic = "force-dynamic";

export default async function SweepListingParts() {
  const locale: Locale = await getLocale();
  const t = getDictionary(locale);
  return (
    <SweepFrame route="/listing/fixture-parts">
      <PhotoViewerProvider title={SALE.title} photos={SALE.photos} hue={SALE.hue} kind={SALE.kind}>
        <StayDatesProvider today="2026-09-23" blockedDates={[]} priceMinor={8_500_000} capacity={4}>
          <Stack>
            <Section title="Spec row" divided>
              <ListingSpecChips chips={specChips(SALE, t, locale)} />
            </Section>
            <Section title="What it costs to buy" divided>
              <ListingPurchase listing={SALE} locale={locale} t={t} />
            </Section>
            <Section title="What you would be buying" divided>
              <ListingTenure listing={SALE} />
            </Section>
            <Section title={t.catalogue.detail.amenities} divided>
              <ListingAmenities bedrooms={RENTAL.bedrooms} bathrooms={RENTAL.bathrooms} amenities={RENTAL.amenities} />
            </Section>
            <Section title="Power and water" divided>
              <ListingUtilities utilities={RENTAL.utilities} access={null} bookingConfirmed={false} />
            </Section>
            <Section title={t.catalogue.detail.reviews} divided>
              <ListingReviews
                rating={4.6}
                reviewCount={1}
                reviews={[
                  {
                    id: "r1",
                    rating: 5,
                    body: "Quiet street, the power held all week and the agent answered the same day.",
                    author: "Adaeze O.",
                    when: "4 Aug 2026",
                    response: { body: "Thank you, glad the stay went well.", when: "5 Aug 2026" },
                  },
                ]}
                locale={locale}
                t={t}
              />
            </Section>
            <Section divided>
              <ListingCodeRow code="VAL-7K2Q" copy={t.listingReference} />
            </Section>
            <Section title="Photos" divided>
              <ListingPhotoGrid photos={SALE.photos} hue={SALE.hue} kind={SALE.kind} title={SALE.title} />
            </Section>
            <Section title={t.catalogue.detail.agent} divided>
              <ListingAgentCard verified t={t} messageHref="#" name="Emeka Johnson" />
            </Section>
            <Section title="Rental panel" divided>
              <RentalPanel
                listingId={RENTAL.id}
                priceMinor={RENTAL.priceMinor}
                currency={RENTAL.currency}
                locale={locale}
                period="year"
                minimumTenancyMonths={12}
              />
            </Section>
            <Section title="Sale panel" divided>
              <RentalPanel
                listingId={SALE.id}
                priceMinor={SALE.priceMinor}
                currency={SALE.currency}
                locale={locale}
                period="sale"
                minimumTenancyMonths={undefined}
              />
            </Section>
            <Section title="Reserve panel (stays)" divided>
              <ReservePanel listingId={RENTAL.id} currency="NGN" locale={locale} instantBook messageHref="#" copy={t.memberFlows} />
            </Section>
            <Section title="Reserve a table (restaurants)" divided>
              <ReserveTable listingId={RENTAL.id} messageHref="#" copy={t.memberFlows} locale={locale} />
            </Section>
            <Section title="Example listing" divided>
              <div className="nf-card p-card">
                <p className="nf-body-sm text-[var(--nf-content-secondary)]">
                  Nothing here can be booked or paid for. Search for a real place with an owner you can reach.
                </p>
                <ButtonLink href="#" variant="primary" className="mt-block w-full">
                  Browse real listings
                </ButtonLink>
              </div>
            </Section>
          </Stack>
        </StayDatesProvider>
      </PhotoViewerProvider>
    </SweepFrame>
  );
}
