import type { Metadata } from "next";
import { marketOf } from "@/lib/listings/market";
import { getDictionary, intlTag, type Locale } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { catalogueReader } from "@/lib/catalogue/listings";
import { publicStaysShelf } from "@/lib/catalogue/stays";
import type { Listing, ListingKind } from "@/lib/listings/types";
import { Suspense } from "react";
import { InviteStepNudge } from "@/components/app/referral/InviteStepNudge";
import { StaysFeatured } from "@/components/app/stays/StaysFeatured";
import { STAY_KINDS } from "@/components/app/stays/model";
import { stayCardFromListing, stayCardFromRow, type StayCardData } from "@/components/app/stays/stay-card-model";
import { CategoryRow, type HomeCategory } from "@/components/app/home/CategoryRow";
import { CityRow } from "@/components/app/home/CityRow";
import { HomeHero } from "@/components/app/home/HomeHero";
import { getHomeOverview } from "@/lib/app/home-queries";
import { LogoMark } from "@/design-system/brand/Logo";
import { DiscoveryEmpty } from "@/components/app/search/DiscoveryEmpty";
import { AreaFigure, type AreaShelfSummary } from "@/components/app/stays/AreaFigure";
import { resolveSession } from "@/lib/actions/session";
import { listSavedPlaces } from "@/lib/saved/places-actions";
import { isSaved, savedKeySet } from "@/lib/saved/places";
import "@/app/css/home.css";
import { GuideScope } from "@/components/currency/GuideScope";

export const metadata: Metadata = {
  title: "Stays",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * The Stays home page, to `GOVERNING-09` SCREEN ONE.
 *
 * SAME ANATOMY AS THE PROPERTY SIDE, STAYS CONTENT, and it is literally the
 * same three components: `HomeHero`, `CategoryRow` and `FeaturedBand`. When
 * the coin flips, the whole page becomes this one, which is what the flip has
 * always promised, and it can only keep that promise if the two sides are one
 * object with two sets of words rather than two screens that look similar.
 *
 * THE GREETING AND THE LOCATION ARE KEPT, on the founder's instruction, EVEN
 * THOUGH THE RENDER DROPS THEM for a bare place chip in the corner. They are
 * the reader's own facts and they are the same facts on both sides, so a flip
 * does not change who you are or where you are.
 *
 * FIVE TILES BECAME FOUR AND THE SET CHANGED. `StayCategoryTiles` drew Hotels,
 * Apartments, Resorts, Guest Houses and Serviced, which are five property
 * TYPES. The render draws four DOORS: Hotels, Shortlets, Restaurants and
 * Nearby. A type is a filter and a door is a thing you came here to do, and
 * the render is right. The five types are still reachable, from the filter
 * sheet on `/stays/search` where every other type filter already lives.
 *
 * THE RESTAURANTS RAIL CAME OFF and Restaurants is a tile now, pointing at the
 * same `/restaurants` the rail's "See all" pointed at. Nothing became
 * unreachable; one surface stopped being drawn twice on one screen.
 *
 * The featured shelf reads BB's catalogue projection first (`stays_search`
 * through `listStaysShelf`, which carries accommodations as well as
 * listings) and falls back to the listing repository, so the shelf is never
 * empty while one read has rows and the other does not.
 */
async function readShelf(kinds: readonly ListingKind[], perKind: number): Promise<Listing[]> {
  const repo = catalogueReader();
  /* UX-10: only listings actually let by the night are stays, so each kind
     is read a little deeper and filtered before it is interleaved. */
  const rows = (await Promise.all(kinds.map((kind) => repo.search({ kind }, { limit: perKind * 4 })))).map(
    (group) => group.filter((listing) => marketOf(listing) === "stay").slice(0, perKind),
  );
  const seen = new Set<string>();
  const merged: Listing[] = [];
  for (let i = 0; i < perKind; i += 1) {
    for (const group of rows) {
      const listing = group[i];
      if (listing && !seen.has(listing.id)) {
        seen.add(listing.id);
        merged.push(listing);
      }
    }
  }
  return merged;
}

export default async function StaysHomePage() {
  const locale: Locale = await getLocale();
  const t = getDictionary(locale);
  const copy = t.catalogue.stays;

  /*
   * THE HEARTS ARE LIT FROM THE ACCOUNT'S OWN SHORTLIST.
   *
   * `saved_places` is where a hotel or a restaurant is saved and nothing on
   * this shelf read it, so a stay the reader had already hearted came back
   * every visit with an empty heart on it. `listSavedPlaces` answers with the
   * keys alone; `savedKeySet` and `isSaved` decide each card with no second
   * read per card. Signed out there is no shelf to write to at all, which is
   * what `canSavePlaces` carries to the card: the heart is absent rather than
   * present and refusing.
   */
  const [projection, session, savedPlaces, overview] = await Promise.all([
    publicStaysShelf({}, 6),
    resolveSession(),
    listSavedPlaces(),
    /* The greeting, the name and the place, the SAME read the property home
       does. Kept on this side on the founder's instruction even though the
       render drops them: a flip changes what you are browsing, never who you
       are or where you are. WITHOUT the trending strip (platform speed,
       13 November 2026): this page never draws it, and reading it was three
       more waves of round trips (stories, posts, their signed photo URLs)
       before the shelf could paint. */
    getHomeOverview({ trending: false }),
  ]);
  const savedKeys = savedKeySet(savedPlaces.ok ? savedPlaces.data : []);
  const canSavePlaces = session.state === "signed-in";
  const featured: StayCardData[] =
    projection.length > 0
      ? projection.filter((row) => row.entity_kind !== "restaurant").map(stayCardFromRow)
      : (await readShelf(STAY_KINDS, 3)).map((listing) => stayCardFromListing(listing));

  /*
   * THE AREA'S FIGURE HERO (`AreaFigure.tsx`) waits on a read Session 2 owns:
   * the live stays in the reader's place and the lowest stated nightly rate
   * among them, behind a sample floor (request W2-R3). Until it lands this is
   * null and the greeting leads, rather than a figure summed from whichever
   * six rows the shelf happened to read.
   */
  const areaSummary: AreaShelfSummary | null = null;

  /* The greeting and the welcome are HomeScreen's words (`experienceDiscover.home`). */
  const greeting = t.experienceDiscover.home.greeting[overview.daypart];
  const name = overview.firstName || (overview.signedIn ? t.experienceDiscover.home.there : "");
  const stays = t.directHome.stays;

  /*
   * THE FOUR DOORS OF `GOVERNING-09`.
   *
   * Hotels and Shortlets narrow the stays catalogue by its own `kind` column,
   * which is what `/stays/search?type=` already reads. Restaurants is its own
   * surface and always has been. NEARBY IS `/around`, which is the local
   * surface this product actually has: what is live near the reader, in the
   * place the selector above names. It is not a map and it is not a radius
   * search, because neither of those exists, and inventing a dead parameter
   * for a tile is how a tile ends up doing nothing.
   */
  const doors: HomeCategory[] = [
    {
      key: "hotels",
      art: "hotel",
      label: stays.hotels,
      meaning: stays.hotelsNote,
      href: "/stays/search?type=hotel",
      icon: "hotel-room",
    },
    {
      key: "shortlets",
      art: "shortlet",
      label: stays.shortlets,
      meaning: stays.shortletsNote,
      href: "/stays/search?type=shortlet",
      icon: "shortlet",
    },
    {
      key: "restaurants",
      art: "restaurant",
      label: stays.restaurants,
      meaning: stays.restaurantsNote,
      href: "/restaurants",
      icon: "concierge-bell",
    },
    {
      key: "nearby",
      art: "local-talks",
      label: stays.nearby,
      meaning: stays.nearbyNote,
      href: "/around",
      icon: "pin-map",
    },
  ];

  return (
    <GuideScope copy={t.experienceSettings.preferences}>
    <div className="nf-home">
      {/* ------------------------------------------- the greeting, as kept */}
      <section className="nf-rise">
        <p className="nf-body-sm font-normal text-[var(--nf-content-secondary)]">{greeting}</p>
        {name ? (
          <h1 className="nf-rise nf-rise-2 mt-inline-tight flex items-center gap-inline">
            <span className="nf-h1">{name}</span>
            <span className="inline-block shrink-0 translate-y-[2px]">
              <LogoMark size={26} title="Vallo" />
            </span>
          </h1>
        ) : (
          <h1 className="nf-rise nf-rise-2 mt-inline-tight">
            <span className="nf-h1">{t.experienceDiscover.home.welcome}</span>
          </h1>
        )}
        <CityRow
          label={overview.place.label}
          context={overview.place.context}
          isOwn={overview.place.isOwn}
          signedIn={overview.signedIn}
        />
      </section>

      {/* An invited member's one step left (renders nothing for anyone else). */}
      <Suspense fallback={null}>
        <InviteStepNudge back="/stays" />
      </Suspense>

      {/* ------------------------------------- the figure hero for the area */}
      {areaSummary ? (
        <AreaFigure
          summary={areaSummary}
          locale={locale}
          tag={intlTag[locale]}
          copy={{
            caption: t.experienceDiscover.stays.areaCaption,
            unitOne: t.experienceDiscover.stays.staysOne,
            unitMany: t.experienceDiscover.stays.staysMany,
            from: t.experienceDiscover.stays.fromNight,
          }}
        />
      ) : null}

      {/* ------------------------------------------------ 1. the hero plate */}
      <div className="mt-md">
        <HomeHero
          id="stays-q"
          place={overview.place.label || null}
          title={stays.heroTitle}
          lede={stays.heroLede}
          searchPlaceholder={stays.heroSearch}
          searchAction="/stays/search"
          filtersHref="/stays/search?filters=open"
          filtersLabel={t.directHome.filters}
          searchLabel={stays.heroSearch}
          kind="hotel"
          recent={t.catalogue.recent}
        />
      </div>

      {/* ----------------------------------------------------- 2. the doors */}
      <CategoryRow categories={doors} label={copy.title} columns={2} />

      {/* ----------------------------------------------- 3. featured stays */}
      {/* The featured shelf as a swipeable stack (the travel-app reference). */}
      <StaysFeatured
        stays={featured}
        title={stays.featured}
        seeAllHref="/stays/search"
        locale={locale}
        t={t}
        isSaved={(stay) => (stay.place ? isSaved(savedKeys, stay.place.kind, stay.place.id) : false)}
        canSavePlaces={canSavePlaces}
        empty={
          <DiscoveryEmpty
              data-testid="stays-empty"
              object="hotel"
              title={t.stays.shelfEmptyTitle}
              body={t.stays.shelfEmptyBody}
              primary={{ href: "/stays/search", label: t.stays.findStay }}
            />
        }
      />
    </div>
    </GuideScope>
  );
}
