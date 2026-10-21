import type { Metadata } from "next";
import { FunnelBeacon } from "@/components/site/FunnelBeacon";
import { forListingCard } from "@/lib/i18n/slice";
import { after } from "next/server";
import { demandRecorder } from "@/lib/demand/record";
import { demandCell } from "@/lib/demand/cell";
import { readListingFactsFor } from "@/lib/landlord/queries";
import { readPhotographedCaptions } from "@/lib/listings/photographed";
import { ownershipSeenForListings } from "@/lib/trust/ownership-seen";
import { collapseByProperty, ownerConfirmedLine, sinkNotReconfirmed } from "@/lib/landlord/facts";
import { requestNow } from "@/lib/format/when";
import { LandlordCardLine } from "@/components/app/listing/LandlordCardLine";
import Link from "next/link";
import { redirect } from "next/navigation";
import { formatMoney, formatNumber, getDictionary, type Locale } from "@vallo/i18n";
import { RealMap } from "@/components/app/search/RealMap";
import { ShelfBar } from "@/components/app/search/ShelfBar";
import { ShelfCount } from "@/components/app/search/ShelfCount";
import { MapListPill } from "@/components/app/search/MapListPill";
import { ResultsFade } from "@/components/app/search/ResultsFade";
import {
  clearedShelf,
  parseShelfQuery,
  applyWords,
  wordsHref,
  wordsShown,
  SAID_PARAM,
  staySideHref,
  shelfActiveCount,
  shelfFilter,
  shelfPoolFilter,
  toShelfHref,
  toShelfViewHref,
  type ShelfQuery,
} from "@/components/app/search/shelf-query";
import { getLocale } from "@/lib/locale";
import { getListingRepository } from "@/lib/listings/repository";
import { factsOf, matchesFacts, matchesFilter } from "@/lib/listings/filter";
import { nextChange } from "@/components/app/search/next-change";
import {
  hasOwnRequest,
  intentKindsPresent,
  orderByStatedIntent,
} from "@/lib/listings/intent";
import { readIntentTuning } from "@/lib/interests/queries";
import { getSavedListings } from "@/lib/saved/queries";
import { canonicalSearch, describeSearch } from "@/lib/saved/searches";
import { SearchMemory } from "@/components/app/search/SearchMemory";
import { findSavedSearch, listSavedSearches } from "@/lib/saved/searches-queries";
import { savedSearchSignal } from "@/lib/search/saved-search-signal";
import { SearchForYou } from "@/components/app/search/SearchForYou";
import { WideOnly } from "@/components/app/search/WideOnly";
import { SaveSearchControl } from "@/components/app/saved-searches/SaveSearchControl";
import { type SortKey } from "@/lib/listings/search-params";
import { rankRecommended } from "@/lib/listings/ranking";
import { feeSortKey } from "@/lib/listings/fee-share";
import { readListingReference } from "@/lib/listings/reference";
import { readRecordCode } from "@/lib/trust/record";
import type { Listing, ListingKind } from "@/lib/listings/types";
import { ListingCard } from "@/components/app/ListingCard";
import { BackButton } from "@/components/site/BackButton";
import { Reveal } from "@/components/site/Reveal";
import { ButtonLink } from "@/components/ui/Button";
import { DiscoveryEmpty } from "@/components/app/search/DiscoveryEmpty";
import { LastVisitProvider } from "@/components/app/search/LastVisit";
import { RecordViews } from "@/components/app/search/RecordViews";
import { ReadAs } from "@/components/app/search/ReadAs";
import { floodClearFor } from "@/lib/around/flood-facts";
import { readAnchors, readCommutes } from "@/lib/listings/commute-queries";
import { commuteLine, originKey, withinCommute, type CommuteBand } from "@/lib/listings/commute";
import { parseWords } from "@/lib/listings/query-parse";
import { looksCheckable } from "@/lib/doors/agent-check";
import "@/app/css/catalogue.css";
import "@/app/css/list-views.css";

export const metadata: Metadata = {
  title: "Search",
  robots: { index: false, follow: false },
};

/**
 * Discovery results, to 3EB3E2A9.
 *
 * Everything visible here is real behaviour, and all of it lives in the
 * address bar (`lib/listings/search-params.ts` is the contract, plus the
 * market the shelf adds in `shelf-query.ts`): free text, category, market,
 * sort, view, budget, bedrooms, bathrooms, party size, amenities, instant
 * book, verified only, light and water. A filtered hunt is therefore a link,
 * the back button walks it backwards, and a reload lands on the same results.
 */

function sentenceCase(value: string): string {
  return value.length === 0 ? value : value[0]!.toUpperCase() + value.slice(1);
}

function byVerification(a: Listing, b: Listing): number {
  return Number(b.verified) - Number(a.verified);
}

/**
 * The honest move-in figure for ordering, or null when there is none.
 *
 * A listing whose lister declared no total and no part has not said it is
 * cheap, it has said nothing, so it can never be given a number here. The
 * caller sorts those to the end rather than to the front, which is the same
 * ruling `nullsFirst: false` makes in the SQL.
 */
function moveInFigure(listing: Listing): number | null {
  const stated = listing.moveInCostMinor;
  if (stated !== undefined && stated !== null && stated > 0) return stated;
  const parts = [
    listing.priceMinor,
    listing.cautionDepositMinor,
    listing.serviceChargeMinor,
    listing.agencyFeeMinor,
    listing.legalFeeMinor,
    listing.agreementFeeMinor,
  ].filter((part): part is number => part !== undefined && part !== null);
  if (parts.length === 0) return null;
  const sum = parts.reduce((total, part) => total + part, 0);
  return sum > 0 ? sum : null;
}

function sortListings(listings: Listing[], sort: SortKey): Listing[] {
  const out = [...listings];
  switch (sort) {
    /* V-22. Newest first by the date the listing went live; a row with no
       date sorts last, because an unknown age is not a young one. */
    case "newest":
      out.sort((a, b) => {
        const left = a.publishedAt ? Date.parse(a.publishedAt) : Number.NEGATIVE_INFINITY;
        const right = b.publishedAt ? Date.parse(b.publishedAt) : Number.NEGATIVE_INFINITY;
        if (left === right) return byVerification(a, b);
        return right > left ? 1 : -1;
      });
      break;
    /*
     * THE NUMBER A NIGERIAN TENANT ACTUALLY SHOPS ON.
     *
     * The repository has already ordered the read on
     * `listings_move_in_cost_idx`, so the cheapest rows are the ones that got
     * under the row ceiling; this pass is the authority over whatever came
     * back, the same division of labour the budget predicate and
     * `matchesFilter` already have. A listing with no declared cost sorts
     * LAST: it is unstated, not free.
     */
    case "move-in-asc":
      out.sort((a, b) => {
        const left = moveInFigure(a);
        const right = moveInFigure(b);
        if (left === null && right === null) return byVerification(a, b);
        if (left === null) return 1;
        if (right === null) return -1;
        return left - right || byVerification(a, b);
      });
      break;
    /* V-12: the fees paid to the agent, as one share of a year's rent.
       A listing that stated no fee is unstated, not cheap: it sorts last. */
    case "fees-asc":
      out.sort((a, b) => {
        const left = feeSortKey(a);
        const right = feeSortKey(b);
        if (left === null && right === null) return byVerification(a, b);
        if (left === null) return 1;
        if (right === null) return -1;
        return left - right || byVerification(a, b);
      });
      break;
    case "price-asc":
      out.sort((a, b) => a.priceMinor - b.priceMinor || byVerification(a, b));
      break;
    case "price-desc":
      out.sort((a, b) => b.priceMinor - a.priceMinor || byVerification(a, b));
      break;
    default:
      /* V-06: Recommended is the published formula in `ranking.ts` (real
         before example, then points for facts about the listing, then
         newest), the same constants /standards prints in words. It still
         lifts a checked lister, as one point among four, never above
         everything. Nobody can pay to be higher. */
      return rankRecommended(out);
  }
  return out;
}

const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  Lagos: { lat: 6.5244, lng: 3.3792 },
  Ibadan: { lat: 7.3775, lng: 3.947 },
  Abuja: { lat: 9.0765, lng: 7.3986 },
  Enugu: { lat: 6.4584, lng: 7.5464 },
  "Port Harcourt": { lat: 4.8156, lng: 7.0498 },
  Calabar: { lat: 4.9757, lng: 8.3417 },
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale: Locale = await getLocale();
  const t = getDictionary(locale);
  const briefsCopy = t.frontDoor.briefs;
  const sx = t.experienceDiscover.search;
  const raw = await searchParams;
  const query: ShelfQuery = parseShelfQuery(raw);
  /* A stay typed on the Property side is sent to the Stays side, words kept (V-67). */
  const staySide = staySideHref(query.kind, raw);
  if (staySide) redirect(staySide);
  /* V-66: WhatsApp shorthand becomes filters, once. What is left over reads
     nothing, so this never redirects twice. */
  if (query.q) {
    const words = parseWords(query.q);
    if (words.recognised) {
      const href = wordsHref(applyWords(query, words), query.q);
      /* The open filter sheet survives the redirect (batch 4 review). */
      redirect(raw.filters === "open" ? `${href}&filters=open` : href);
    }
  }
  const saidRaw = raw[SAID_PARAM];
  const saidText = typeof saidRaw === "string" && saidRaw.trim() ? saidRaw.trim().slice(0, 120) : null;
  /* Shown only while it still describes the chips on screen. */
  const said = saidText && wordsShown(query, parseWords(saidText)) ? saidText : null;

  const repo = getListingRepository();
  /* The three catalogue reads: the results, the pool the sheet counts against (the whole
     catalogue for the current text), and the whole catalogue for the map. */
  /* V-41: "No flooding reported" is judged on facts this page reads, not in
     the repository's SQL, so the repository is asked without it and the
     results are narrowed below, once the flood facts are in. Like every
     in-memory filter here it narrows what the read returned, so it works
     within the repository's row ceiling, not past it. */
  const { noFlood: wantsNoFlood, ...shelfAsked } = shelfFilter(query);
  /*
   * WHETHER THIS EXACT SEARCH IS ALREADY KEPT.
   *
   * `canonicalSearch` is the same address the control would write, built from
   * the same parsed query these results were fetched with, so the control
   * cannot save one thing and the page show another. The read is the account's
   * own rows under its own policy in this request, which is what makes the
   * control honest after a reload rather than only after a tap.
   */
  const canonical = canonicalSearch(raw);
  /*
   * SEARCH BY LISTING CODE.
   *
   * A person reads a code down the phone, "Vee El, seven kay four em queue
   * pee", and the listener types it into the box they already have. There is
   * no second screen and no "enter a code here" field nobody would find.
   *
   * `readListingReference` guesses NOTHING, because guessing a code is how
   * somebody lands on the wrong house. It returns one of three answers: this
   * is a code, this is the shape of a code but carries a character we never
   * mint, or this is ordinary text.
   *
   * AND IT ONLY EXPLAINS ITSELF WHEN THEY TYPED THE `VL`. Six letters is a
   * common length for a Nigerian place name and several of the commonest
   * carry a character we never mint, so a search for Ibadan would otherwise
   * be answered with "that code has a character we do not use". A bare six
   * characters is still looked up, because a hit is unambiguous; a miss falls
   * through to ordinary results in silence.
   *
   * A code that matches replaces the results rather than redirecting, because
   * GOVERNING-12 screen four draws the found listing under a line saying how
   * it was found, and a redirect has nowhere to put that line.
   */
  const codeRead = readListingReference(query.q ?? "");
  /*
   * Every read that needs only the request goes out in this one batch: the
   * catalogue reads and the shortlist, saved-search, listing-code, stated
   * interest and anchor reads. Each is its own round trip and none of them
   * reads another's answer, so awaiting them one by one only added up their
   * latencies before the first byte.
   */
  const [rawResults, rawPool, whole, savedEntries, savedSearch, codeHit, tuning, anchors, savedList] = await Promise.all([
    /* The move-in ordering is pushed into the read, because the read has a row
       ceiling: sorting afterwards alone would order the newest rows rather
       than the cheapest ones to move into. See `ListingSearchOptions.order`. */
    repo.search(
      shelfAsked,
      query.sort === "move-in-asc" ? { order: "move-in" } : query.sort === "newest" ? { order: "newest" } : {},
    ),
    repo.search(shelfPoolFilter(query)),
    /* The Property side's catalogue, never its stays: a nightly rate must
       not become a city's "from" price on this map (V-67 review). */
    repo.search({ propertySide: true }),
    getSavedListings(),
    canonical.key.length > 0 ? findSavedSearch(canonical.key) : null,
    codeRead.state === "code" ? repo.byReference(codeRead.value) : null,
    readIntentTuning(),
    readAnchors(),
    /* Best matches (an unfiltered shelf only): the account's saved searches,
       in this same batch, so the section costs no round trip of its own.
       With a query the control above reads the same rows for its own answer. */
    canonical.key.length === 0 ? listSavedSearches() : null,
  ]);

  /*
   * THE SECOND BATCH: everything that needs only the catalogue answer.
   *
   * The landlord facts and the photo captions are read per listing and are
   * the same for a listing whichever set it is asked about with, so they are
   * asked for every result (and a code hit) up front instead of waiting for
   * the shelf to be ordered, collapsed and narrowed. Both readers keep only the
   * first 200 ids they are given, and the shelf's order is not the catalogue's,
   * so a superset larger than that could keep a different 200. In that case
   * they are read afterwards from the exact ids, as they always were.
   */
  const ID_READ_CAP = 200;
  const idSuperset = [...new Set([...(codeHit ? [codeHit.id] : []), ...rawResults.map((l) => l.id)])];
  const readAhead = idSuperset.length <= ID_READ_CAP;
  const demandResults = rawResults.filter((listing) => !listing.isDemo).length;
  const [floodClear, recordDemand, factsAhead, captionsAhead] = await Promise.all([
    floodClearFor([...rawResults, ...rawPool]),
    /*
     * V-10: THIS SEARCH AS A DEMAND CELL. A neighbourhood from the closed list
     * (the typed words are read and dropped), the market, a bedroom minimum, a
     * budget band and whether it found fewer than three REAL homes. Example
     * listings are not supply, so they are not counted as results here either.
     */
    demandRecorder(
      demandCell({
        q: query.q,
        intent: query.intent,
        bedrooms: query.bedrooms,
        maxMinor: query.maxMinor,
        results: demandResults,
      }),
    ),
    readAhead ? readListingFactsFor(idSuperset) : null,
    readAhead ? readPhotographedCaptions(idSuperset, locale) : null,
  ]);
  /* Fail closed (review): with no flood facts (flag off, signed out, a read
     that failed) "No flooding reported" is not a filter at all: no narrowing,
     no switch, no count. */
  if (!floodClear && query.noFlood) delete query.noFlood;
  const noFloodApplies = Boolean(wantsNoFlood && floodClear);
  const judged = (l: Listing): Listing =>
    floodClear && floodClear.has(l.id) ? { ...l, floodClear: floodClear.get(l.id)! } : l;
  const pool = rawPool.map(judged);
  const floodNarrowed = rawResults
    .map(judged)
    .filter((l) => !noFloodApplies || l.floodClear === true);
  const sorted = sortListings(floodNarrowed, query.sort);

  /* The demand cell is recorded on the server after the response, never by the client. */
  if (recordDemand) after(recordDemand);

  /*
   * WHICH OF THESE ARE ALREADY ON THE SHORTLIST.
   *
   * The card used to draw its heart from the device store alone, so a
   * signed-in reader whose save went to `saved_items` came back to an empty
   * heart on every result. The stored ids are read here, once, and handed to
   * each card; the device half is still resolved inside the control, so a
   * guest is unaffected. (R2 finding 4.)
   *
   * `getSavedListings` with no argument returns the account's rows only and
   * resolves them to listings, which is more work than an id set needs. It is
   * what the three detail pages already call for exactly this answer, so this
   * uses the same door rather than adding a second one; a cheap
   * `getSavedListingIds` in `lib/saved/queries.ts` would be the better read
   * and belongs to whoever owns that module.
   */
  const savedIds = new Set(savedEntries.map((entry) => entry.listing.id));

  /* V-34: a Record code (`VR-`) is a person, not a listing, and has its own
     page. Only with the prefix, so a six-letter place name is never taken
     for one. */
  const recordCode = readRecordCode(query.q ?? "");
  if (recordCode) redirect(`/record/${recordCode}`);

  /* A stated interest reorders an unfiltered shelf and nothing else. */
  const statedIntent = hasOwnRequest(query) ? [] : tuning.interests;
  const ordered = orderByStatedIntent(sorted, statedIntent);
  /*
   * V-31: WHAT THE OWNER SAID, beside each card, and "Not reconfirmed" sorted
   * last. Read in one call beside the catalogue rather than inside it, so a
   * failed read changes nothing: no line on any card and the order untouched.
   * Only a listing whose owner let a question go 21 days unanswered moves,
   * and it moves to the end of whatever order the page chose, not out of it.
   */
  const shelf = codeHit ? [codeHit] : ordered;
  const landlordFacts = factsAhead ?? (await readListingFactsFor(shelf.map((l) => l.id)));
  const notReconfirmed = new Set(
    [...landlordFacts].filter(([, facts]) => facts.notReconfirmed).map(([id]) => id),
  );
  /* V-37: the copies of one property become one card that says how many
     offers it carries. A code hit is the one listing the person asked for and
     is never collapsed. */
  const collapsed = codeHit ? { listings: shelf, offerCounts: new Map<string, number>() } : collapseByProperty(shelf, landlordFacts);
  /* The one listing the code named, or the ordinary shelf. */
  const ranked = sinkNotReconfirmed(collapsed.listings, notReconfirmed);

  /*
   * V-43: WHERE YOU GO EVERY DAY. With an anchor chosen, each card carries the
   * rush-hour band from its area to it (the route guide, or residents once
   * five have reported), and "within" keeps only homes whose morning band
   * ends inside it. Nothing is shown for an area with no band: the claims
   * rule. The drawer count does not see commutes yet; the shelf does.
   */
  const anchor = query.to ? (anchors.find((a) => a.slug === query.to) ?? null) : null;
  /* An anchor that does not resolve (unknown, or the flag off) is not a
     filter: it leaves the query, so no count or chip claims it (review). */
  if (query.to && !anchor) {
    delete query.to;
    delete query.within;
  }
  /* The results AND the drawer's pool, so the drawer can count "within". */
  const commutes = anchor ? await readCommutes(anchor.id, [...ranked, ...pool]) : new Map<string, CommuteBand[]>();
  const commuteOf = (l: Listing): CommuteBand[] => {
    /* An example has no real journey to it (review). */
    if (l.isDemo) return [];
    const key = originKey(l.stateCode, l.area);
    return key ? (commutes.get(key) ?? []) : [];
  };
  const within = query.within;
  const listings = anchor && within !== undefined ? ranked.filter((l) => withinCommute(commuteOf(l), within)) : ranked;
  /*
   * THE FIRST SCREENFUL, AND A PREFETCHED "SHOW MORE" (Track M performance).
   * The grid drew every result at once: 52 cards on the live catalogue, a
   * megabyte of HTML and 52 client cards for a phone to hydrate before the
   * page answered a tap. It draws 24, and 24 more per step from `?more=`.
   * The count, the map, the drawer's pool and the saved and seen state keep
   * the whole list; only the cards drawn are paged. The link to the next step
   * is prefetched when it scrolls into view, so it opens without a wait, and
   * it keeps the reader's place (`scroll={false}`).
   */
  const SHELF_STEP = 24;
  const moreParam = typeof raw.more === "string" ? Number.parseInt(raw.more, 10) : 1;
  const shelfSteps = Number.isFinite(moreParam) ? Math.min(Math.max(moreParam, 1), 40) : 1;
  const drawn = listings.slice(0, SHELF_STEP * shelfSteps);
  const shelfHref = toShelfHref(query);
  const moreHref =
    drawn.length < listings.length ? `${shelfHref}${shelfHref.includes("?") ? "&" : "?"}more=${shelfSteps + 1}` : null;
  /* V-70: "Photographed: kitchen, prepaid meter" under a card whose lister labelled its photos. */
  /* "Ownership seen" for the cards drawn, in one read for the page (never one
     per card), alongside the captions. */
  /* The "New listings" strip can draw a home from past the first screenful,
     so the eight newest are read with the cards drawn (still one read). */
  const newestCandidates = listings
    .filter((l) => !l.isDemo && l.publishedAt)
    .sort((a, b) => Date.parse(b.publishedAt!) - Date.parse(a.publishedAt!))
    .slice(0, 8);
  const [photographedCaptions, ownershipSeen] = await Promise.all([
    captionsAhead ?? readPhotographedCaptions(listings.map((l) => l.id), locale),
    ownershipSeenForListings([...drawn, ...newestCandidates].filter((l) => !l.isDemo).map((l) => l.id)),
  ]);
  const ownershipLabel = t.supply.register.owner.proof.seenMark;
  const landlordNow = requestNow();
  const intentApplied = !codeHit && ordered !== sorted;
  const intentKinds: ListingKind[] = intentApplied
    ? intentKindsPresent(ordered, statedIntent)
    : [];

  // The map reads the whole catalogue: every covered city keeps its pin and
  // lowest price regardless of the current text filter.
  const cityFloor = new Map<string, { count: number; minMinor: number; currency: string }>();
  for (const l of whole) {
    if (l.priceMinor <= 0) continue;
    const entry = cityFloor.get(l.city);
    if (!entry) {
      cityFloor.set(l.city, { count: 1, minMinor: l.priceMinor, currency: l.currency });
    } else {
      entry.count += 1;
      entry.minMinor = Math.min(entry.minMinor, l.priceMinor);
    }
  }

  const noun = query.kind ? t.experienceLabels.kinds[query.kind] : t.experienceLabels.anyKind;
  const narrowed = shelfActiveCount(query) > 0 || Boolean(query.kind);
  const poolInKind = query.kind ? pool.filter((l) => l.kind === query.kind) : pool;
  /*
   * WHAT TO CHANGE NEXT, WHEN NOTHING MATCHED (round 5 craft). Areas narrow
   * the shelf as surely as a filter does, so an area search that found
   * nothing is a "your search is narrower" state, not "nothing is listed".
   * The one change that brings the most back is offered as the action: a
   * dropped filter is counted against the pool the sheet already counts
   * against; looking beyond the areas is counted against the whole Property
   * side, text and all. Commute limits are honoured in both. The count only
   * ranks the changes (see next-change.ts); the next page prints its own.
   */
  const areaNarrowed = (query.areas?.length ?? 0) > 0;
  const next =
    listings.length === 0 && !codeHit && (narrowed || areaNarrowed)
      ? nextChange(query, (relaxed) => {
          const widened = (relaxed.areas?.length ?? 0) !== (query.areas?.length ?? 0);
          const filter = shelfFilter(relaxed);
          const commuteHolds = (l: Listing) =>
            !anchor || relaxed.within === undefined || withinCommute(commuteOf(l), relaxed.within);
          return widened
            ? whole.filter((l) => matchesFilter(l, filter) && commuteHolds(l)).length
            : pool.filter((l) => matchesFacts(l, filter) && commuteHolds(l)).length;
        })
      : null;
  const nextLabel = next
    ? next.key === "area"
      ? sx.next.area.replace(
          "{area}",
          (query.areas ?? []).map((area) => area.replace(/\b\p{L}/gu, (c) => c.toUpperCase())).join(", "),
        )
      : sx.next[next.key]
    : null;

  /*
   * BEST MATCHES AND NEW LISTINGS (search-map track, the founder's reference).
   * Only on the shelf as it opens: no words, no filter, no market, the
   * published order, the first page of the list. Everything they draw was
   * already read for this page (the shelf, the shortlist, the stated
   * interests, the saved searches in the first batch, the ownership marks of
   * the cards drawn and of the eight newest), so neither section adds a read.
   */
  const forYou =
    query.view === "list" &&
    !codeHit &&
    !query.q &&
    !narrowed &&
    !areaNarrowed &&
    query.sort === "recommended" &&
    shelfSteps === 1 &&
    listings.length > 0;
  /* "New" is the last thirty days, by the day each went live. */
  const NEW_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
  const newest = forYou
    ? listings
        .filter((l) => !l.isDemo && l.publishedAt && landlordNow - Date.parse(l.publishedAt) <= NEW_WINDOW_MS)
        .sort((a, b) => Date.parse(b.publishedAt!) - Date.parse(a.publishedAt!))
        .slice(0, 8)
    : [];
  const kindNames = Object.fromEntries(
    Object.entries(t.experienceLabels.kinds).map(([kind, noun]) => [kind, noun.one]),
  ) as Record<ListingKind, string>;
  const cardCopy = forListingCard(t);
  const mapPins = Object.entries(CITY_COORDS).flatMap(([city, at]) => {
    const floor = cityFloor.get(city);
    if (!floor) return [];
    return [{ city, ...at, count: floor.count, price: formatMoney(floor.minMinor, locale, floor.currency) }];
  });

  return (
    <>
      {/* A6: the funnel's "first search", once a search has something in it. */}
      {Object.keys(raw).length > 0 && <FunnelBeacon step="first_search" />}
      {/*
        THE WAY BACK, ON THE BAR'S OWN ROW.

        `/search` declares `/home` above it in `lib/nav/route-parents.ts` and
        drew no back control at all, which is the whole defect in miniature: the
        hierarchy said where the screen sits and the screen said nothing. It
        goes here rather than above the bar because `nf-shelf-bar` is sticky at
        `top: 0` and pulls itself up over the shell's padding, so a control
        placed before it would scroll away under the header on the first flick.

        `BackButton` and not `PageHeader`: this screen's title is a `sr-only`
        h1 and its visible head is the search field, so a second drawn title
        would be a duplicate of the field's own job.
      */}
      <ShelfBar
        query={query}
        facts={pool.map((l) => {
          /* V-43: the morning band's upper end to the chosen anchor, for the
             drawer's live count of "Under 45 minutes". */
          const band = anchor ? commuteOf(l).find((b) => b.peak === "am") : undefined;
          return band ? { ...factsOf(l), commuteAmHigh: band.highMin } : factsOf(l);
        })}
        locale={locale}
        t={t}
        openFilters={raw.filters === "open"}
        anchors={anchors}
        leading={<BackButton fallback="/" surface="round" />}
      />
      <ReadAs query={query} said={said} locale={locale} copy={t.shape.unit} />

      <h1 className="sr-only">
        {query.q
          ? t.experienceDiscover.search.headingQuery.replace("{q}", query.q)
          : query.kind
            ? t.experienceDiscover.search.headingKind.replace("{kind}", noun.many)
            : t.experienceDiscover.search.headingAll}
      </h1>

      <ShelfCount query={query} count={listings.length} narrowed={narrowed || Boolean(query.q)} locale={locale} t={t} />

      {/* HOW A CODE ANSWERED. A hit always says so, because a single result
          under no explanation looks like a strangely lucky search. A miss and
          a malformed code say so only when the person typed the VL and
          therefore plainly meant a code: somebody holding a piece of paper is
          owed the sentence, and somebody searching for a city is not. */}
      {codeHit && (
        <p data-testid="found-by-reference" className="nf-caption mt-inline text-[var(--nf-content-muted)]">
          {t.listingReference.foundById}
        </p>
      )}
      {/* A MISS IS ONLY WORTH A SENTENCE WHEN THEY TYPED THE VL. A bare six
          characters could be a place name, and answering a search for a
          place with "no listing carries that code" is worse than saying
          nothing. `explicit` is the field that knows the difference. */}
      {codeRead.state === "code" && codeRead.explicit && !codeHit && (
        <p data-testid="reference-miss" className="nf-caption mt-inline text-[var(--nf-content-muted)]">
          {t.listingReference.noneCarry}
        </p>
      )}
      {/* V-61: A NUMBER OR A VALLO AGENT CODE IN THE SEARCH BOX is somebody
          holding an advert. One line sends them to the check, carrying what
          they typed; the results underneath are untouched. */}
      {looksCheckable(query.q) && (
        <p data-testid="search-check-agent" className="nf-caption mt-inline">
          <Link
            href={`/check?q=${encodeURIComponent((query.q ?? "").slice(0, 40))}`}
            className="inline-flex min-h-11 items-center text-[var(--nf-content-secondary)] underline underline-offset-2"
          >
            {t.trustDoors.check.inSearch.replace("{query}", (query.q ?? "").trim().slice(0, 40))}
          </Link>
        </p>
      )}
      {codeRead.state === "impossible" && (
        <p data-testid="reference-impossible" className="nf-caption mt-inline text-[var(--nf-content-muted)]">
          {t.listingReference.impossible}
        </p>
      )}

      {/* B2: this hunt goes into the phone's recent searches, which the field
          offers back on focus. Only a real hunt (something asked), labelled
          by the same words a saved search gets. */}
      <SearchMemory
        view={query.view}
        label={canonical.key ? describeSearch(canonical.params, locale) : ""}
        href={canonical.href}
      />

      {/* Keeping the hunt, beside the count of what it found. It is drawn only
          when there is something to keep: an unfiltered /search is every place
          on the platform and saving that is a subscription to the catalogue
          rather than to a search. */}
      {savedSearch && savedSearch.state !== "unconfigured" && (
        <SaveSearchControl
          params={canonical.params}
          saved={savedSearch.state === "signed-in" ? savedSearch.saved : null}
          signedIn={savedSearch.state === "signed-in" || savedSearch.state === "unavailable"}
          signInHref={`/sign-in?next=${encodeURIComponent(canonical.href)}`}
        />
      )}

      {/* Says why the order is what it is, and only when it really is. */}
      {intentApplied && intentKinds.length > 0 && (
        <p
          data-testid="intent-note"
          data-intent={intentKinds.join(",")}
          className="nf-caption mt-inline text-[var(--nf-content-muted)]"
        >
          {sx.intentNote.replace("{kinds}", sentenceCase(intentKinds.map((kind) => t.experienceLabels.kinds[kind].many).join(", ")))}
        </p>
      )}

      {/* -------------------------------------------------------- map view */}
      {query.view === "map" && (
        <Reveal className="mt-md" delay={60}>
          <a href="#map-view" className="nf-skip-link">
            Skip to the map
          </a>
          <div className="nf-panel nf-panel--card relative overflow-hidden p-0">
            {/* THE MAP SHOWS THESE RESULTS (search-map track). It used to read
                the catalogue again by the words alone, so a filtered search
                put homes on the map that the count above it had filtered out,
                and a shortlet or a hotel matching the words landed on the
                Property side's map. It now draws exactly the list. */}
            <RealMap
              listHref={toShelfViewHref(query, "list")}
              active={query.q?.trim()}
              listings={listings}
              pins={mapPins}
            />
          </div>
        </Reveal>
      )}

      {/* ------------------------------------------------------ results grid */}
      {query.view !== "map" && (
        <div className="mt-md">
          {listings.length === 0 ? (
            /*
             * THE EMPTY SHELF IS THE CURRENT PRODUCT (Stage 5), so it is drawn
             * as a screen: the object settling in, the honest reason, the one
             * way onward, and the demand captured rather than lost. Three
             * states, three different truths: the filters are narrower than
             * the catalogue, the words matched nothing, or nothing is listed
             * at all yet. Each one says which.
             */
            <DiscoveryEmpty
              /* Clear of the floating dock: this is the whole page. */
              className="pb-4xl"
              data-testid="search-empty"
              object={narrowed || areaNarrowed || query.q ? "search-pin" : "apartment-block"}
              title={narrowed || areaNarrowed ? sx.noMatchTitle : query.q ? sx.noWordsTitle : sx.emptyTitle}
              body={narrowed || areaNarrowed ? sx.noMatchBody : query.q ? sx.noWordsBody : sx.emptyBody}
              primary={
                /* The one change that brings places back, named; then the old ways on. */
                next && nextLabel
                  ? { href: toShelfHref(next.query), label: nextLabel, testId: "empty-next", prefetch: true }
                  : narrowed
                    ? { href: toShelfHref(clearedShelf(query)), label: sx.clearFilters, testId: "empty-clear", prefetch: true }
                    : query.q || areaNarrowed
                      ? { href: "/search", label: sx.clearSearch, testId: "empty-clear-search", prefetch: true }
                      : { href: "/profile?switch=owner", label: sx.listYourPlace, testId: "empty-list-place" }
              }
              secondary={
                narrowed && (next || poolInKind.length > 0) ? (
                  <span className="flex flex-col items-center">
                    {/* Clearing everything stays, as the quiet second way on,
                        unless the next change already is everything. */}
                    {next && (next.key === "area" || shelfActiveCount(query) + (query.kind ? 1 : 0) > 1) && (
                      <Link
                        href={toShelfHref(clearedShelf(query))}
                        prefetch
                        data-testid="empty-clear"
                        className="nf-link-quiet nf-body inline-flex min-h-11 items-center text-[var(--nf-content-link)]"
                      >
                        {sx.clearFilters}
                      </Link>
                    )}
                    {poolInKind.length > 0 && (
                      <span className="nf-body-sm text-[var(--nf-content-muted)]">
                        {sx.waiting
                          .replace("{count}", formatNumber(poolInKind.length, locale))
                          .replace("{noun}", poolInKind.length === 1 ? noun.one : noun.many)}
                      </span>
                    )}
                  </span>
                ) : !narrowed && !areaNarrowed && !query.q ? (
                  <Link href="/docs" className="nf-link-quiet nf-body inline-flex min-h-11 items-center text-[var(--nf-content-link)]">
                    {sx.howItWorks}
                  </Link>
                ) : undefined
              }
              capture={
                /* V-95: nothing matches, so the renter can say what they need
                   and let verified listers answer with a listing. The words
                   are the brief's own. */
                <p data-testid="empty-post-brief">
                  {briefsCopy.zeroResults}
                  <Link
                    href={`/saved/searches?brief=1${canonical.key ? `&${canonical.key}` : ""}#briefs`}
                    className="nf-dempty__capture-link nf-link-quiet"
                  >
                    {briefsCopy.post}
                  </Link>
                </p>
              }
            />
          ) : (
            /* Two across on a phone, four from `lg`: the decision a person is
               making here is a comparison, and you cannot compare things you
               can only see one at a time. */
            /* The New mark reads the reader's previous visit on this device
               (V-22); the provider records this one. */
            <LastVisitProvider>
            {/* V-73: the first twenty cards drawn were seen. */}
            <RecordViews seen={listings.slice(0, 20).map((l) => l.id)} />
            {forYou && (
              <SearchForYou
                candidates={drawn}
                newest={newest}
                savedSearches={
                  savedList?.state === "signed-in" ? savedList.searches.map((saved) => savedSearchSignal(saved.params)) : []
                }
                savedHomes={savedEntries.map((entry) => ({
                  id: entry.listing.id,
                  area: entry.listing.area,
                  city: entry.listing.city,
                }))}
                interests={tuning.interests}
                savedIds={[...savedIds]}
                kindNames={kindNames}
                ownershipSeen={Object.fromEntries(ownershipSeen)}
                ownershipLabel={ownershipLabel}
                locale={locale}
                t={cardCopy}
                copy={{
                  bestMatches: t.searchV2.sections.bestMatches,
                  bestMatchesHint: t.searchV2.sections.bestMatchesHint,
                  newListings: t.searchV2.sections.newListings,
                  reasons: t.searchV2.reasons,
                }}
              />
            )}
            {/* The list beside a sticky map from a desktop's width; on a
                phone the map is one tap away (the Map pill) and is not
                mounted here at all (`WideOnly`). */}
            <div className="nf-search-split">
            <div className="min-w-0">
            {forYou && (
              <h2 className="nf-sx-section__title nf-sx-allhead" data-testid="all-homes">
                {t.searchV2.sections.allHomes}
              </h2>
            )}
            {/* Track M: while a filter, sort or view change is on its way
                the current cards dim to 60 per cent; the new grid arrives
                with the card entrance (ResultsFade.tsx). The `key` still
                remounts the list per query, so nothing is reused wrongly. */}
            <ResultsFade>
            <ul
              key={toShelfHref(query)}
              data-testid="results-grid"
              data-view={query.view}
              className={
                query.view === "rows"
                  ? "nf-results--rows grid grid-cols-1 gap-sm sm:gap-md lg:grid-cols-2"
                  : "nf-results--one"
              }
            >
              {drawn.map((l, i) => (
                <li key={l.id}>
                  {/* One card per row at a phone's width (the founder's
                      reference): the row card. The rows view keeps its
                      sideways tile. */}
                  <ListingCard
                    listing={l}
                    locale={locale}
                    t={cardCopy}
                    index={i}
                    eager={i === 0}
                    layout={query.view === "rows" ? "tile" : "row"}
                    brief={query.view !== "rows"}
                    saved={savedIds.has(l.id)}
                    intent={tuning.signedIn ? tuning.interests : undefined}
                    messageAgent
                    commute={anchor ? commuteLine(commuteOf(l), anchor.name, t.shape.commute) : null}
                    photographed={photographedCaptions.get(l.id) ?? null}
                    ownershipSeen={
                      ownershipSeen.has(l.id) ? { seenAt: ownershipSeen.get(l.id)!, label: ownershipLabel } : null
                    }
                  />
                  <LandlordCardLine
                    notReconfirmed={notReconfirmed.has(l.id)}
                    confirmed={ownerConfirmedLine(t.landlord.listing, landlordFacts.get(l.id)?.ownerConfirmedAt, landlordNow)}
                    copy={t.landlord.listing}
                    offerCount={collapsed.offerCounts.get(l.id) ?? 1}
                    offersCopy={t.landlord.offers.card}
                  />
                </li>
              ))}
            </ul>
            </ResultsFade>
            {moreHref && (
              <div className="mt-block flex justify-center">
                <ButtonLink href={moreHref} variant="secondary" scroll={false} prefetch data-testid="shelf-more">
                  {t.catalogue.shelf.showMore.replace(
                    "{count}",
                    formatNumber(Math.min(SHELF_STEP, listings.length - drawn.length), locale),
                  )}
                </ButtonLink>
              </div>
            )}
            </div>
            <aside className="nf-search-aside nf-panel nf-panel--card p-0" aria-label={t.searchV2.map.aside}>
              <WideOnly>
                <RealMap listHref={toShelfViewHref(query, "list")} active={query.q?.trim()} listings={listings} pins={mapPins} fill />
              </WideOnly>
            </aside>
            </div>
            </LastVisitProvider>
          )}
        </div>
      )}

      {query.view !== "map" && listings.length > 0 && !moreHref && repo.isSeed && (
        <p className="nf-caption mt-block text-center text-[var(--nf-content-muted)]">
          That is everything matching this search.
        </p>
      )}

      {/* Track M: the phone's quick switch between the results and the map,
          floating above the dock. Hidden from 640px, where the toggle is on
          the bar. */}
      {(listings.length > 0 || query.view === "map") && (
        <MapListPill
          href={toShelfViewHref(query, query.view === "map" ? "list" : "map")}
          to={query.view === "map" ? "list" : "map"}
        />
      )}
    </>
  );
}
