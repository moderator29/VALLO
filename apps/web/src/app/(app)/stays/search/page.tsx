import type { Metadata } from "next";
import { forStayCard, forStayFilterSheet } from "@/lib/i18n/slice";
import { StaysDatesRow, carriedParams } from "@/components/app/stays/StaysDatesRow";
import { formatNumber, getDictionary, type Locale } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { lagosToday, parseStaysQuery, toStaysHref, type StaysQuery } from "@/lib/stays/filters";
import { searchStays } from "@/lib/stays/search";
import { narrowByType, readType } from "./narrow";
import { StayCard } from "@/components/app/stays/StayCard";
import { StaySearchBar } from "@/components/app/stays/StaySearchBar";
import { SearchMemory } from "@/components/app/search/SearchMemory";
import { StayCategoryTiles } from "@/components/app/stays/StayCategoryTiles";
import { StayFilterSheet } from "@/components/app/stays/StayFilterSheet";
import { stayCardFromRow } from "@/components/app/stays/stay-card-model";
import { PageHeader } from "@/components/app/PageHeader";
import { DiscoveryEmpty } from "@/components/app/search/DiscoveryEmpty";
import { ResultsFade } from "@/components/app/search/ResultsFade";
import { resolveSession } from "@/lib/actions/session";
import { listSavedPlaces } from "@/lib/saved/places-actions";
import { isSaved, savedKeySet } from "@/lib/saved/places";

export const metadata: Metadata = {
  title: "Explore stays",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Stay search on BB's twelve filters.
 *
 * `parseStaysQuery` reads the address bar, `searchStays` asks the projection
 * once (every filter is carried inside the SQL function, so the page is
 * complete and `total` is true), and the sheet mirrors the property one over
 * the same query. The category tiles add one parameter the projection does
 * not filter on yet, `type`, which narrows the returned page by its `kind`
 * column; a seam, reported, until `StaysQuery` carries a kind of its own.
 */
export default async function StaysSearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale: Locale = await getLocale();
  const t = getDictionary(locale);
  const copy = t.catalogue.stays;
  const params = await searchParams;
  const today = lagosToday();
  const query: StaysQuery = parseStaysQuery(params, today);
  const type = readType(params.type);

  /* The shortlist this reader already has, so a result they hearted last week
     arrives lit. Keys only, one read for the page. Signed out there is
     nowhere for a tap on a hotel to be kept, so no heart is drawn. */
  const [result, session, savedPlaces] = await Promise.all([
    searchStays(query),
    resolveSession(),
    listSavedPlaces(),
  ]);
  const savedKeys = savedKeySet(savedPlaces.ok ? savedPlaces.data : []);
  const canSavePlaces = session.state === "signed-in";
  const rows = narrowByType(result.rows, type);
  const total = type ? rows.length : result.total;
  const stays = rows.map(stayCardFromRow);

  const countLine =
    total === 0 ? copy.resultsNone : total === 1 ? copy.resultsOne : copy.results.replace("{count}", formatNumber(total, locale));

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t.nav.exploreStays} subtitle={countLine} fallback="/stays" />
      {/* B2: a Stays hunt with a place in it joins the phone's recent searches. */}
      <SearchMemory
        label={query.q ? t.catalogue.recent.staysIn.replace("{place}", query.q.slice(0, 60)) : ""}
        href={toStaysHref(query, "/stays/search")}
      />

      <StaySearchBar
        t={t}
        q={query.q ?? ""}
        carried={{ type, in: query.checkIn, out: query.checkOut, guests: query.guests ? String(query.guests) : undefined }}
        filtersControl={
          <StayFilterSheet
            query={query}
            locale={locale}
            t={forStayFilterSheet(t)}
            today={today}
            extra={{ type }}
            openOnMount={params.filters === "open"}
          />
        }
      />

      {/* UX-08: the dates on the face of the page, not only inside Filters. */}
      <StaysDatesRow
        carried={carriedParams(
          toStaysHref({ ...query, checkIn: undefined, checkOut: undefined, guests: undefined }, "/stays/search"),
          type,
        )}
        checkIn={query.checkIn}
        checkOut={query.checkOut}
        guests={query.guests}
        today={today}
        copy={{
          checkIn: copy.checkIn,
          checkOut: copy.checkOut,
          guests: copy.guests,
          submit: t.stayDetail.datesSubmit,
        }}
      />

      <div className="mt-md">
        <StayCategoryTiles t={t} active={type} />
      </div>

      {/* A landmark the projection did not recognise is said, not hidden. */}
      {query.near && !result.near && (
        <p role="status" className="nf-caption mt-md text-[var(--nf-content-muted)]">
          {copy.nearMissed.replace("{term}", query.near)}
        </p>
      )}

      {stays.length === 0 ? (
        /* Stage 5: the honest reason and the one way onward, under an
           object that settles in. With dates set, the dates are the likeliest
           narrowing, so clearing them is the action. */
        <DiscoveryEmpty
          className="mt-section-tight"
          data-testid="stays-search-empty"
          object="hotel"
          /* "Nothing here for those dates" is said only when dates were asked
             for; a search with no dates that finds nothing says no stay
             matches, and why a shelf fills (Round 3 sweep, C1). */
          title={query.checkIn ? t.stays.emptyTitle : copy.resultsNone}
          body={query.checkIn ? t.stays.emptyBody : t.stays.shelfEmptyBody}
          primary={
            query.checkIn
              ? { href: toStaysHref({ ...query, checkIn: undefined, checkOut: undefined }, "/stays/search"), label: t.stays.clearDates }
              : { href: "/stays", label: t.nav.stays }
          }
        />
      ) : (
        /* Track M: the current stays dim while a new search is on its way. */
        <ResultsFade>
        <ul className="mt-block grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-3" data-testid="stay-results">
          {stays.map((stay, index) => (
            <li key={`${stay.id}-${index}`}>
              <StayCard
                stay={stay}
                locale={locale}
                t={forStayCard(t)}
                index={index}
                eager={index === 0}
                saved={stay.place ? isSaved(savedKeys, stay.place.kind, stay.place.id) : false}
                canSavePlaces={canSavePlaces}
              />
            </li>
          ))}
        </ul>
        </ResultsFade>
      )}
    </div>
  );
}
