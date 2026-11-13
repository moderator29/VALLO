import { getDictionary, type Locale } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { ICON, Section, Stack, TYPE } from "@/components/app/Screen";
import { ListingGallery } from "@/components/app/listing/ListingGallery";
import { ListingMoveInBlock } from "@/components/app/listing/ListingMoveInBlock";
import { ListingMoveIn } from "@/components/app/listing/ListingMoveIn";
import { ListingSectionTabs } from "@/components/app/listing/ListingSectionTabs";
import { ListingAmenityTiles } from "@/components/app/listing/ListingAmenityTiles";
import { ListingAgentCard } from "@/components/app/listing/ListingAgentCard";
import { ListingAbout } from "@/components/app/listing/ListingAbout";
import { ListingStickyBar } from "@/components/app/listing/ListingStickyBar";
import { PhotoViewerProvider } from "@/components/app/listing/PhotoViewer";
import { RENTAL, SHELF } from "../fixtures";
import { FeaturedBand } from "@/components/app/home/FeaturedBand";
import { ListingCard } from "@/components/app/ListingCard";
import { forListingCard } from "@/lib/i18n/slice";
import { ListingMapPanel } from "@/components/app/listing/ListingMapPanel";
import { areaPoint } from "@/components/app/search/mapGeo";
import { airportFor, straightKm } from "@/lib/maps/landmarks";

/**
 * /listing/[id] on a tenancy, composed from the same components the route
 * mounts, with the fixture rental, in the anatomy the founder's send-back
 * asks for: the photo hero carrying the market and the check, a lit glass
 * lead card overlapping it with the title, the place, the Move-in Total
 * panel and the small amenity row, the section tabs on the page ground, the
 * description and agent cards, and the pinned foot with its two actions.
 * No page-wide sheet and no thumbnail strip.
 */
export default async function ListingPreview() {
  const locale: Locale = await getLocale();
  const t = getDictionary(locale);
  const listing = RENTAL;
  const where = `${listing.area}, ${listing.city}, Lagos State`;
  const messageHref = `/messages/new?listing=${listing.id}`;
  const mapPoint = areaPoint(listing.city, listing.area);
  const airport = airportFor(listing.city);

  return (
    <PhotoViewerProvider title={listing.title} photos={listing.photos} hue={listing.hue} kind={listing.kind}>
      <div className="mx-auto max-w-5xl">
        <ListingGallery
          listingId={listing.id}
          title={listing.title}
          hue={listing.hue}
          kind={listing.kind}
          photos={listing.photos}
          backFallback="/preview/f3"
          mark={{
            label: t.catalogue.card.forRent,
            icon: "key",
            verified: listing.verified,
            verifiedLabel: t.common.verified,
          }}
        />
        <div className="relative z-10 -mt-xl sm:-mt-2xl">
          <Stack>
            <Section className="nf-rise nf-glass nf-glass--card nf-detail-lead scroll-mt-16" id="overview">
              <h1 className="nf-h2 break-words">{listing.title}</h1>
              <a href="#location" className={`nf-tap mt-inline-tight inline-flex max-w-full items-center gap-inline ${TYPE.body}`}>
                <UiIcon name="location" size={ICON.inline} className="shrink-0 text-[var(--nf-brand-secondary)]" />
                <span className="min-w-0">{where}</span>
                <UiIcon name="arrow-right" size={16} className="shrink-0 text-[var(--nf-brand-secondary)]" />
              </a>
              <div className="mt-md">
                <ListingMoveInBlock listing={listing} locale={locale} t={t} />
              </div>
              <div className="mt-md">
                <ListingAmenityTiles
                  amenities={listing.amenities}
                  limit={5}
                  moreHref="#amenities"
                  moreLabel={t.catalogue.detail.more}
                />
              </div>
            </Section>

            {/*
              WHAT A TENANT WILL ACTUALLY PAY, where the route mounts it.

              The live `/listing/[id]` needs a database and this box has none,
              so the harness is the only production surface that can photograph
              this block. Two instances on purpose, because the whole point of
              the block is the DIFFERENCE between two facts and one instance
              can only show one of them:

                the fixture as it stands declares rent, caution, agency and
                legal and says nothing about agreement or service charge, so it
                draws four figures and two "Not declared";

                the same fixture with a DECLARED ZERO agency fee draws "No
                agency fee" in the success ink, which is the direct-from-owner
                argument in one line and is what an owner's listing will look
                like the day `listings.listing_role` lands.
            */}
            <Section title={t.moveIn.title} description={t.moveIn.lede} divided>
              <ListingMoveIn
                listing={listing}
                locale={locale}
                t={t}
                actions={{ ledgerHref: "/preview/f3/move-in", messageHref, shareTitle: listing.title }}
              />
            </Section>

            <Section title="The same listing, declared by its owner" divided>
              {/* The stated TOTAL goes with the fee. The component never
                  recomputes a total from its parts, deliberately, because the
                  database holds the lister's own figure; so a fixture that
                  zeroes the agency fee and keeps a total containing it would
                  demonstrate a contradiction the product cannot produce. With
                  no stated total the block sums the declared parts and labels
                  the result "Move in from", which is what an owner's listing
                  actually looks like. */}
              <ListingMoveIn
                listing={{
                  ...listing,
                  agencyFeeMinor: 0,
                  moveInCostMinor: undefined,
                  moveInCostStated: false,
                }}
                locale={locale}
                t={t}
              />
            </Section>

            <ListingSectionTabs
              tabs={[
                { id: "overview", label: t.catalogue.detail.overview },
                { id: "amenities", label: t.catalogue.detail.amenities },
                { id: "location", label: t.experienceDetail.map.tab },
                { id: "reviews", label: t.catalogue.detail.reviews },
              ]}
            />

            <div className="nf-glass nf-glass--card nf-detail-lead">
              <h2 className="nf-detail-panel__title">{t.catalogue.detail.description}</h2>
              <div className="mt-row">
                <ListingAbout
                  paragraphs={[
                    "Luxury 4 bedroom duplex with BQ is a 4 bedroom, 5 bathroom home to rent in Lekki Phase 1, Lagos, Lagos State. Amenities include a swimming pool, parking on site and Wi-Fi.",
                    "This home is let on an annual tenancy. Message the agent to ask questions and arrange an inspection, then pay only after you have inspected the property.",
                  ]}
                />
              </div>
            </div>

            <Section id="amenities" title={t.catalogue.detail.amenities} divided className="scroll-mt-16">
              <ListingAmenityTiles amenities={listing.amenities} />
            </Section>

            {/* The Map tab, as the route draws it (ListingMapPanel). */}
            <Section id="location" title={t.experienceDetail.map.title} divided className="scroll-mt-16">
              <ListingMapPanel
                where={where}
                area={listing.area}
                point={mapPoint}
                airport={mapPoint && airport ? { name: airport.name, km: straightKm(mapPoint, airport.at) } : null}
                hasWalkthrough={(listing.videos?.length ?? 0) > 0}
                photoCount={listing.photos.length}
                copy={t.experienceDetail.map}
              />
            </Section>

            <Section title={t.catalogue.detail.agent} divided>
              <ListingAgentCard verified={listing.verified} t={t} messageHref={messageHref} />
            </Section>

            <Section id="reviews" title={t.catalogue.detail.reviews} divided className="scroll-mt-16">
              <p className={TYPE.rowMeta}>No reviews yet.</p>
            </Section>

            {/* The route streams `SimilarListings` (a catalogue read); the
                harness draws the same band and card from the shelf fixture. */}
            <FeaturedBand
              title={t.experienceDetail.similar.title}
              seeAllHref="/preview/f3/search"
              seeAllLabel={t.experienceDetail.similar.seeAll}
              count={SHELF.length}
              testId="similar-listings"
              empty={null}
            >
              {SHELF.filter((row) => row.id !== listing.id).slice(0, 6).map((row, index) => (
                <li key={row.id} className="nf-feature-row__item">
                  <ListingCard listing={row} locale={locale} t={forListingCard(t)} index={index} />
                </li>
              ))}
            </FeaturedBand>
          </Stack>
        </div>
        <ListingStickyBar
          variant="rental"
          priceMinor={listing.priceMinor}
          currency={listing.currency}
          locale={locale}
          perLabel="per year"
          action={{ label: t.catalogue.detail.bookInspection, href: "#reserve" }}
          secondary={{ label: t.catalogue.detail.calculateBreakdown, href: "/preview/f3/move-in" }}
          secondaryIcon="document"
          fallbackLabel={listing.title}
          moveInMinor={listing.moveInCostMinor}
          moveInStated={listing.moveInCostStated}
          moveInLabel={t.catalogue.detail.moveInTotal}
          moveInFromLabel={t.catalogue.detail.moveInFrom}
          secondaryShortLabel={t.catalogue.detail.breakdownShort}
        />
      </div>
    </PhotoViewerProvider>
  );
}
