import Link from "next/link";
import { intlTag, type Dictionary, type Locale } from "@vallo/i18n/core";
import type { Listing } from "@/lib/listings/types";
import type { UiIconName } from "@/design-system/icons/UiIcon";
import { FeaturedBand } from "@/components/app/home/FeaturedBand";
import { HomeListingCard } from "@/components/app/home/HomeListingCard";
import { homeCardCopyOf } from "@/components/app/home/home-card-copy";
import { reasonText, type BestMatch, type MatchReason } from "@/components/app/home/best-matches";
import { Skeleton } from "@/components/ui/Skeleton";
import { ButtonLink } from "@/components/ui/Button";
import "@/app/css/home.css";
import "@/app/css/space-card.css";

/**
 * THE LISTS BELOW HOME'S PREMIUM CAROUSEL (13 October 2026), every one drawn as
 * the space card (`components/ui/space-card`):
 *
 *   Featured listings   more of the shelf, one card per row (two and three
 *                       across on a wider screen)
 *   Best matches        a sideways row of compact cards, each with the real
 *                       reason it is there
 *   New listings        newest published first, one per row
 *
 * Presentational: the page (or a streamed server component) chooses the
 * listings and hands them in. The headings, "See all" and the empty state are
 * the Premium band's own (`FeaturedBand`), so the sections read as one family.
 * Every list has a designed loading state (`HomeListSkeleton`) and a designed
 * empty state, never a gap.
 */
type Shared = { t: Dictionary; locale: Locale };

export function FeaturedListings({ listings, t, locale }: Shared & { listings: Listing[] }) {
  if (listings.length === 0) return null;
  const copy = homeCardCopyOf(t);
  return (
    <FeaturedBand
      title={t.homeV2.featuredTitle}
      seeAllHref="/search"
      seeAllLabel={t.common.seeAll}
      count={listings.length}
      testId="featured-listings"
      empty={null}
      body={
        <ul className="nf-sc-grid" data-testid="featured-listings" data-phone-cap="4">
          {listings.map((listing) => (
            <li key={listing.id}>
              <HomeListingCard listing={listing} locale={locale} copy={copy} layout="card" />
            </li>
          ))}
        </ul>
      }
    >
      {null}
    </FeaturedBand>
  );
}

/** A real glyph for each reason (the sparkle is retired, `sparkle-ban.test.ts`). */
const REASON_ICON: Record<MatchReason["kind"], UiIconName> = {
  search: "search",
  interest: "house-heart",
  saved: "heart",
};

/** The sentence and the glyph a best match carries, from its real signal. */
export function bestMatchRows(matches: BestMatch[], t: Dictionary, locale: Locale) {
  const lower = (value: string) => value.toLocaleLowerCase(intlTag[locale]);
  return matches.map((match) => ({
    listing: match.listing,
    reason: reasonText(match.reason, t.homeV2, t.experienceDiscover.home.types, lower),
    icon: REASON_ICON[match.reason.kind],
  }));
}

export function BestMatchesRow({
  rows,
  t,
  locale,
  empty,
}: Shared & {
  rows: { listing: Listing; reason: string; icon?: UiIconName }[];
  /** What to draw when there are none: the two honest empties, below. */
  empty: React.ReactNode;
}) {
  const copy = homeCardCopyOf(t);
  return (
    <FeaturedBand
      title={t.homeV2.bestTitle}
      seeAllHref="/search"
      seeAllLabel={t.common.seeAll}
      count={rows.length}
      testId="best-matches"
      empty={empty}
      body={
        <ul className="nf-feature-row nf-scroll-x nf-scroll-x--gutter" data-testid="best-matches">
          {rows.map(({ listing, reason, icon }) => (
            <li key={listing.id} className="nf-feature-row__item">
              <HomeListingCard
                listing={listing}
                locale={locale}
                copy={copy}
                layout="compact"
                reason={reason}
                reasonIcon={icon}
              />
            </li>
          ))}
        </ul>
      }
    >
      {null}
    </FeaturedBand>
  );
}

/** The empty states are one small panel: what is missing, and the door that fills it. */
function HomeEmpty({
  title,
  body,
  testId,
  actions,
}: {
  title: string;
  body: string;
  testId: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="nf-hempty" data-testid={testId}>
      <h3 className="nf-hempty__title">{title}</h3>
      <p className="nf-hempty__body">{body}</p>
      {actions ? <div className="nf-hempty__actions">{actions}</div> : null}
    </div>
  );
}

/** Signed in, and nothing said or kept yet: say what fills the row. */
export function BestMatchesAsk({ t }: { t: Dictionary }) {
  return (
    <HomeEmpty
      testId="best-matches-ask"
      title={t.homeV2.bestEmptyTitle}
      body={t.homeV2.bestEmptyBody}
      actions={
        <>
          <ButtonLink href="/settings/interests" variant="primary" size="md">
            {t.homeV2.bestEmptyAction}
          </ButtonLink>
          <Link
            href="/search"
            className="nf-link-quiet nf-tap nf-body-sm inline-flex items-center text-[var(--nf-content-link)]"
          >
            {t.homeV2.bestEmptySearch}
          </Link>
        </>
      }
    />
  );
}

/** Signals exist, and nothing in the catalogue fits them today. */
export function BestMatchesNone({ t }: { t: Dictionary }) {
  return <HomeEmpty testId="best-matches-none" title={t.homeV2.bestNoneTitle} body={t.homeV2.bestNoneBody} />;
}

export function NewListings({ listings, t, locale }: Shared & { listings: Listing[] }) {
  const copy = homeCardCopyOf(t);
  return (
    <FeaturedBand
      title={t.homeV2.newTitle}
      seeAllHref="/search?sort=newest"
      seeAllLabel={t.common.seeAll}
      count={listings.length}
      testId="new-listings"
      empty={<HomeEmpty testId="new-listings-empty" title={t.homeV2.newEmptyTitle} body={t.homeV2.newEmptyBody} />}
      body={
        /* A sideways row of small cards, high on Home (4 November 2026): the
           newest listings are seen at once without taking the screen. */
        <ul className="nf-feature-row nf-scroll-x nf-scroll-x--gutter" data-testid="new-listings">
          {listings.map((listing) => (
            <li key={listing.id} className="nf-feature-row__item">
              <HomeListingCard listing={listing} locale={locale} copy={copy} layout="compact" />
            </li>
          ))}
        </ul>
      }
    >
      {null}
    </FeaturedBand>
  );
}

/** One card's worth of slabs: the photograph and the info panel, in the card's own proportions. */
function SkeletonCard({ variant }: { variant: "card" | "compact" }) {
  return (
    <div className={`nf-sc nf-sc--${variant} nf-sc--skeleton`}>
      <div className="nf-sc__media">
        <Skeleton className="h-full w-full" radius="none" />
      </div>
      <div className="nf-sc__info">
        <Skeleton width="70%" height="1rem" radius="xs" />
        <Skeleton width="45%" height="0.875rem" radius="xs" />
        <Skeleton width="85%" height="0.75rem" radius="xs" />
      </div>
    </div>
  );
}

/**
 * The wait, in each list's own shape and proportions. Announced once, by the
 * section's label; the slabs themselves are hidden from assistive technology.
 */
export function HomeListSkeleton({
  shape,
  title,
  label,
}: {
  shape: "rows" | "tiles";
  /** The section's real heading while it loads; absent when the page's own loading shell already announces the wait. */
  title?: string;
  label?: string;
}) {
  return (
    <section
      className="mt-section-tight"
      {...(label ? { "aria-busy": true, "aria-label": label } : { "aria-hidden": true })}
      data-testid="home-list-skeleton"
    >
      <div className="nf-feature-head">
        {title ? <h2 className="nf-h3">{title}</h2> : <Skeleton width="11rem" height="1.5rem" radius="sm" />}
      </div>
      {shape === "tiles" ? (
        <div className="nf-feature-row nf-scroll-x nf-scroll-x--gutter" aria-hidden="true">
          {[0, 1].map((i) => (
            <div key={i} className="nf-feature-row__item">
              <SkeletonCard variant="compact" />
            </div>
          ))}
        </div>
      ) : (
        <ul className="nf-sc-grid" aria-hidden="true" data-phone-cap="4">
          {[0, 1, 2].map((i) => (
            <li key={i}>
              <SkeletonCard variant="card" />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
