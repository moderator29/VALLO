import { countOf, formatRating, getDictionary, type Locale } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { Section, Stack, TYPE } from "@/components/app/Screen";
import { ListingGallery } from "@/components/app/listing/ListingGallery";
import { ListingMoveInBlock } from "@/components/app/listing/ListingMoveInBlock";
import { ListingMoveIn } from "@/components/app/listing/ListingMoveIn";
import { ListingSectionTabs } from "@/components/app/listing/ListingSectionTabs";
import { ListingAmenityTiles } from "@/components/app/listing/ListingAmenityTiles";
import { ListingAgentCard } from "@/components/app/listing/ListingAgentCard";
import { ListingAbout } from "@/components/app/listing/ListingAbout";
import { ListingStickyBar } from "@/components/app/listing/ListingStickyBar";
import { ListingSpecChips } from "@/components/app/listing/ListingSpecChips";
import { ListingPhotoGrid } from "@/components/app/listing/ListingPhotoGrid";
import { ListingSummaryCard } from "@/components/app/listing/ListingSummaryCard";
import { ListingHighlights } from "@/components/app/listing/ListingHighlights";
import { listingHighlights } from "@/components/app/listing/highlights";
import { PhotoViewerProvider } from "@/components/app/listing/PhotoViewer";
import { specChips } from "@/components/app/listing/spec-chips";
import { listingMedia } from "@/components/app/listing/gallery-media";
import type { ListerCard } from "@/components/app/listing/lister-card";
import { StatusPill } from "@/components/ui/StatusPill";
import { Money } from "@/components/ui/Money";
import { RENTAL } from "../../../f3/fixtures";
import "@/app/css/space-card.css";
import { SweepFrame } from "../Frame";

/**
 * The platform sweep's copy of the f3 listing harness, in the anatomy the
 * route draws since the founder's reference of 13 October 2026: the photo
 * hero with "Watch video", the lead card (status chip, title with the price
 * opposite, rating and place, the fact chips with "+N"), the move-in total,
 * the section tabs, the description with Read more, "Listed by" with its two
 * round buttons, the gallery strip, the move-in breakdown, and the pinned
 * foot with "Schedule a visit". From `lg`, the sticky summary card.
 *
 * The live `/listing/[id]` needs a database and this box has none, so this is
 * the surface the layout is photographed on. Composed from the same
 * components the route mounts, with fixture data: the lister and the rating
 * below are FIXTURES for the picture and nothing on the route invents them.
 */
export const dynamic = "force-dynamic";

const LISTER: ListerCard = {
  name: "Daniel Okafor",
  handle: "danielokafor",
  avatarUrl: null,
  role: "landlord",
  tier: "gold",
};

export default async function SweepListing() {
  const locale: Locale = await getLocale();
  const t = getDictionary(locale);
  const listing = {
    ...RENTAL,
    rating: 4.8,
    reviewCount: 12,
    furnished: "fully_furnished" as const,
    floor: 1,
    utilities: { powerGrid: "BAND_A" as const, powerBackup: "GENERATOR_INVERTER" as const, powerBackupHours: 6, waterSupply: "BOREHOLE" as const, hasEstateAccess: true },
    videos: [{ url: "/brand/photos/villa-pool-terrace.jpg", posterUrl: "/brand/photos/villa-pool-terrace.jpg", durationSeconds: 42, position: 2 }],
  };
  const media = listingMedia(listing.photos, listing.videos);
  const messageHref = `/messages/new?listing=${listing.id}`;
  const visitHref = `/listing/${listing.id}/visit`;
  const d = t.catalogue.detail;

  const headline = (
    <p className="nf-detail-head__price" data-testid="detail-price">
      <Money minor={listing.priceMinor} locale={locale} currency={listing.currency} mode="glance" period="year" className="nf-detail-head__figure" />
      <span className="nf-detail-head__unit">{t.catalogue.card.perYear}</span>
    </p>
  );
  const lister = <ListingAgentCard verified={listing.verified} t={t} messageHref={messageHref} lister={LISTER} />;

  return (
    <SweepFrame route="/listing/fixture">
      <PhotoViewerProvider title={listing.title} photos={listing.photos} media={media} hue={listing.hue} kind={listing.kind}>
        <div className="nf-cat-surface mx-auto max-w-6xl">
          <div className="nf-detail-grid grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-2xl">
            <div className="min-w-0">
              <div className="nf-sc nf-sc-top" data-testid="detail-top">
              <ListingGallery
                listingId={listing.id}
                floatingBack={false}
                framed
                title={listing.title}
                hue={listing.hue}
                kind={listing.kind}
                photos={listing.photos}
                media={media}
                backFallback="/preview/session-b/sweep-home/search"
              />
                  <Section className="nf-sc-top__panel nf-rise nf-detail-lead scroll-mt-16" id="overview">
                    <div className="flex flex-wrap items-center gap-xs" data-testid="detail-status">
                      <StatusPill tone="brand" icon="key" size="sm">
                        {t.catalogue.card.forRent}
                      </StatusPill>
                    </div>
                    <div className="nf-detail-head mt-sm">
                      <h1 className="nf-detail-head__title nf-h2 break-words">{listing.title}</h1>
                      {headline}
                    </div>
                    <p className="nf-detail-meta mt-xs">
                      <a href="#reviews" className="nf-detail-meta__rating nf-tap">
                        <UiIcon name="star" size={16} filled className="text-[var(--nf-rating)]" />
                        <span className="nf-numeric font-semibold text-[var(--nf-content-primary)]">
                          {formatRating(listing.rating, locale)}
                        </span>
                        <span className="nf-numeric">({countOf(listing.reviewCount, "reviews", locale)})</span>
                      </a>
                      <a href="#location" className="nf-detail-meta__place nf-tap">
                        <UiIcon name="location" size={16} className="shrink-0" />
                        <span className="min-w-0">{`${listing.area}, ${listing.city}`}</span>
                      </a>
                    </p>
                    <div className="mt-md">
                      <ListingSpecChips
                        chips={specChips(listing, t, locale)}
                        labels={{ more: d.allFacts, fewer: d.fewerFacts }}
                      />
                    </div>
                  </Section>

              </div>

              <div className="mt-section-tight">
                <Stack>
                  <ListingHighlights items={listingHighlights(listing, t, locale, true)} title={d.highlights} />
                  <div data-testid="lead-amenities">
                    <ListingAmenityTiles variant="plates" amenities={listing.amenities} limit={5} moreHref="#amenities" moreLabel={d.more} />
                  </div>

                  <div data-testid="detail-lead-move-in">
                    <ListingMoveInBlock listing={listing} locale={locale} t={t} />
                  </div>

                  <ListingSectionTabs
                    tabs={[
                      { id: "overview", label: d.overview },
                      { id: "cost", label: t.experienceDetail.sections.costs },
                      { id: "amenities", label: d.amenities },
                      { id: "location", label: d.location },
                      { id: "reviews", label: d.reviews },
                    ]}
                  />

                  <Section id="about" title={d.description} divided>
                    <ListingAbout
                      labels={{ readMore: d.readMore, showLess: d.showLess }}
                      paragraphs={[
                        "Luxury 4 bedroom duplex with BQ is a 4 bedroom, 5 bathroom home to rent in Lekki Phase 1, Lagos, Lagos State. Amenities include a swimming pool, parking on site and Wi-Fi, with a gym on the estate and a backup generator and inverter for the whole house.",
                        "This home is let on an annual tenancy. Message the agent to ask questions and arrange an inspection, then pay only after you have inspected the property.",
                      ]}
                    />
                  </Section>

                  <Section id="agent" title={d.agent} divided>
                    {lister}
                  </Section>

                  <Section id="photos" divided>
                    <ListingPhotoGrid
                      photos={listing.photos}
                      media={media}
                      hue={listing.hue}
                      kind={listing.kind}
                      title={listing.title}
                      copy={{ title: d.gallery, viewAll: d.viewAll, viewAllMedia: d.viewAllMedia }}
                    />
                  </Section>

                  <Section id="cost" title={t.moveIn.title} description={t.moveIn.lede} divided>
                    <ListingMoveIn listing={listing} locale={locale} t={t} />
                  </Section>

                  <Section id="amenities" title={d.amenities} divided>
                    <ListingAmenityTiles amenities={listing.amenities} />
                  </Section>

                  <Section id="reviews" title={d.reviews} divided>
                    <p className={TYPE.rowMeta}>No reviews yet.</p>
                  </Section>
                </Stack>
              </div>
            </div>

            <aside className="hidden lg:sticky lg:top-6 lg:block">
              <ListingSummaryCard
                price={headline}
                note={
                  <a href="#cost" className="nf-tap nf-detail-summary__movein">
                    <span>{d.moveInTotal}</span>
                    <Money
                      minor={listing.moveInCostMinor ?? 0}
                      locale={locale}
                      currency={listing.currency}
                      mode="glance"
                      className="nf-numeric font-semibold text-[var(--nf-content-primary)]"
                    />
                  </a>
                }
                lister={<ListingAgentCard verified={listing.verified} t={t} messageHref={messageHref} lister={LISTER} className="nf-lister--flat" />}
                action={{ label: d.scheduleVisit, href: visitHref, icon: "calendar-booking" }}
                secondary={{ label: d.calculateBreakdown, href: "/preview/f3/move-in", icon: "document" }}
              />
            </aside>
          </div>

          <ListingStickyBar
            variant="rental"
            priceMinor={listing.priceMinor}
            currency={listing.currency}
            locale={locale}
            perLabel="per year"
            action={{ label: d.scheduleVisit, href: visitHref }}
            secondary={{ label: d.calculateBreakdown, href: "/preview/f3/move-in" }}
            secondaryIcon="document"
            fallbackLabel={listing.title}
            moveInMinor={listing.moveInCostMinor}
            moveInStated={listing.moveInCostStated}
            moveInLabel={d.moveInTotal}
            moveInFromLabel={d.moveInFrom}
            secondaryShortLabel={d.breakdownShort}
            sidePanelFromLg
            stackOnPhone
          />
        </div>
      </PhotoViewerProvider>
    </SweepFrame>
  );
}
