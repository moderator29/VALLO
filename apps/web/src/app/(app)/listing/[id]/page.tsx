import type { Metadata } from "next";
import { forProofStrip } from "@/lib/i18n/slice";
import { StillAvailable } from "@/components/app/listing/StillAvailable";
import { readRecentlyLet } from "@/lib/availability/queries";
import { readViewingSlots } from "@/lib/viewings/queries";
import { readOpenInspectionFor } from "@/lib/inspections/queries";
import { ViewingSlots } from "@/components/app/inspections/ViewingSlots";
import { Suspense } from "react";
import { marketOf, type ListingMarket } from "@/lib/listings/market";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { NONCE_HEADER } from "@/lib/security/csp";
import { countOf, getDictionary, intlTag, type Locale, formatRating } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { listingById } from "@/lib/listings/listing-by-id";
import {
  listingMetadata,
  listingStructuredData,
  structuredDataJson,
} from "@/lib/listings/syndication";
import { siteUrl } from "@/lib/site";
import { factsOf, sleeps } from "@/lib/listings/filter";
import type { Listing } from "@/lib/listings/types";
import {
  type PricePeriod,
  type RentPeriod,
} from "@/lib/listings/pricing";
import { formatDate, formatNumber } from "@vallo/i18n";
import { listedAge, listedAgeText, staleMonthOptions } from "@/lib/listings/listed-age";
import { isModestExample } from "@/lib/listings/example-imagery";
import { ListingCompound } from "@/components/app/listing/ListingCompound";
import { ListingService } from "@/components/app/listing/ListingService";
import { RecordViews } from "@/components/app/search/RecordViews";
import { ListingNeighbours } from "@/components/app/listing/ListingNeighbours";
import { readFlooding, readNeighbours } from "@/lib/around/pulse-queries";
import { flagIsOn, NEIGHBOURS_FLAG, SHOW_ME_FLAG } from "@/lib/flags/read";
import { readCommutesFrom } from "@/lib/listings/commute-queries";
import { commuteLine } from "@/lib/listings/commute";
import { getBlockedDates } from "@/lib/bookings/queries";
import { getListingReviews } from "@/lib/reviews/queries";
import { getSavedListings } from "@/lib/saved/queries";
import { lagosToday } from "@/lib/bookings/schema";
import { TrustFacts } from "@/components/app/listing/TrustFacts";
import { earnedTrust, withEarnedTrust } from "@/components/app/listing/earned-trust";
import { ListingGallery } from "@/components/app/listing/ListingGallery";
import { RecordVisit } from "@/components/app/listing/RecordVisit";
import { cardGlance } from "@/lib/listings/card-glance";
import { ReservePanel } from "./ReservePanel";
import { readDeclaration } from "@/lib/stays/arrival-queries";
import { toDoorCharges } from "@/lib/stays/door-total";
import { RentalPanel } from "./RentalPanel";
import { ReserveTable } from "./ReserveTable";
import { ListingAbout } from "@/components/app/listing/ListingAbout";
import { ListingAmenities } from "@/components/app/listing/ListingAmenities";
import { ListingAmenityTiles } from "@/components/app/listing/ListingAmenityTiles";
import { ListingAgentCard } from "@/components/app/listing/ListingAgentCard";
import { ProofStrip } from "@/components/app/listing/ProofStrip";
import { proofFactsOf, proofLines } from "@/lib/trust/proof-strip";
import { doorHonestyLine, readDoorHonesty } from "@/lib/tenancy/door";
import { readListingRecord } from "@/lib/trust/record-read";
import { ownershipSeenForListing } from "@/lib/trust/ownership-seen";
import { OwnershipSeenMark } from "@/components/trust/OwnershipSeenMark";
import { ValloRecord } from "@/components/app/trust/ValloRecord";
import { readListingCredentials } from "@/lib/trust/credentials-read";
import { ListingMoveInBlock } from "@/components/app/listing/ListingMoveInBlock";
import { OwnerAvailabilityLine, PropertyOffers } from "@/components/app/listing/LandlordFacts";
import { ExactPlace } from "@/components/app/listing/ExactPlace";
import { ListingCodeRow } from "@/components/app/listing/ListingCode";
import { ListingMoveIn } from "@/components/app/listing/ListingMoveIn";
import { SimilarListings } from "@/components/app/listing/SimilarListings";
import { ListingMapPanel } from "@/components/app/listing/ListingMapPanel";
import { areaPoint } from "@/components/app/search/mapGeo";
import { airportFor, straightKm } from "@/lib/maps/landmarks";
import { readPayeeRecords } from "@/lib/after-gate/payee";
import { LastLetLine } from "@/components/app/listing/LastLetLine";
import { ReplyTimeLine } from "@/components/app/listing/ReplyTimeLine";
import { PriceContextRow } from "@/components/app/listing/PriceContextRow";
import { PhotographedLine } from "@/components/app/listing/PhotographedLine";
import { CautionRecordLine } from "@/components/app/listing/CautionRecordLine";
import { ListingPurchase } from "@/components/app/listing/ListingPurchase";
import { ListingSectionTabs } from "@/components/app/listing/ListingSectionTabs";
import { ListingSpecChips } from "@/components/app/listing/ListingSpecChips";
import { specChips } from "@/components/app/listing/spec-chips";
import { ListingSummaryCard } from "@/components/app/listing/ListingSummaryCard";
import { ListingHighlights } from "@/components/app/listing/ListingHighlights";
import { listingHighlights } from "@/components/app/listing/highlights";
import { ListerCallButton } from "@/components/app/listing/ListerCallButton";
import { readListerCard } from "@/lib/listings/lister-card-read";
import { videoCallsOn } from "@/lib/calls/flags";
import { findConversationForListing } from "@/lib/messages/actions";
import { Money } from "@/components/ui/Money";
import { StatusPill } from "@/components/ui/StatusPill";
import { ListingPhotoGrid } from "@/components/app/listing/ListingPhotoGrid";
import { listingMedia } from "@/components/app/listing/gallery-media";
import { ListingUtilities } from "@/components/app/listing/ListingUtilities";
import { ListingTenure } from "@/components/app/listing/ListingTenure";
import { readListingAccess } from "@/lib/listings/access-queries";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { CancellationTimeline } from "@/lib/trust/CancellationTimeline";
import { ListingReviews } from "@/components/app/listing/ListingReviews";
import {
  ListingStickyBar,
  type StickyAction,
} from "@/components/app/listing/ListingStickyBar";
import { StayDatesProvider } from "@/components/app/listing/StayDates";
import { readStayDates } from "@/components/app/stays/model";
import { PhotoViewerProvider } from "@/components/app/listing/PhotoViewer";
import { ReportSheet } from "@/components/app/ReportSheet";
import { resolveSession } from "@/lib/actions/session";
import { Reveal } from "@/components/site/Reveal";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import { ButtonLink } from "@/components/ui/Button";
import { Amount } from "@/components/ui/Amount";
import type { StatusTone } from "@/components/ui/StatusPill";
import { Disclosure } from "@/components/app/Disclosure";
import { publicListingTitle } from "@/lib/listings/public-title";
import {
  LISTING_RENT_QUOTED,
  LISTING_RENTAL_ABOUT,
  LISTING_SALE_ABOUT,
  LISTING_STAY_PAY_AFTER,
  PAY_ONLY_THROUGH_VALLO,
} from "@/lib/money/copy";
import { FactGrid, ICON, Section, Stack, TYPE, type Fact } from "@/components/app/Screen";
import "@/app/css/catalogue.css";
import "@/app/css/space-card.css";

/**
 * Listing detail.
 *
 * THE MOST IMPORTANT SCREEN IN THE PRODUCT, rebuilt around one question: what
 * does a person need, in what order, to decide whether to act on this property?
 *
 * ---------------------------------------------------------------------------
 * THE ORDER, AND WHY IT IS THIS ORDER
 * ---------------------------------------------------------------------------
 *
 *   1. MEDIA, edge to edge, with the frame counter and the save and share
 *      controls floating over it. Nobody reads a property, they look at it.
 *   2. ONE LINE OF STATUS. Which market this is in, and the rating if it has
 *      one. One line, not a pile.
 *   3. TITLE and PLACE.
 *   4. PRICE, at display size, with what the price buys in the muted tone.
 *   5. BED, BATH and what the place carries, as one inline run.
 *   6. THE NIGERIAN NUMBER. On a rental, the total to move in: the figure
 *      people actually shop on, which this page did not previously show at all.
 *      On a sale, the title, in the real vocabulary, and stated plainly as
 *      unstated when the seller named none.
 *   7. LIGHT, WATER AND THE GATE.
 *   8. Everything else, in descending order of how many readers need it, with
 *      the long tail behind a `Disclosure` rather than deleted.
 *
 * That is the reference platforms' order (media, status, price, bed and bath,
 * then a sticky contact bar) with the two facts that matter in this market and
 * that neither of them carries.
 *
 * ---------------------------------------------------------------------------
 * WHAT THE REBUILD REMOVED, AND WHAT IT DID NOT
 * ---------------------------------------------------------------------------
 *
 * Removed: containers. The status row could previously carry five simultaneous
 * chips; it carries one pill and a rating. Four sections were `.nf-card` boxes
 * stacked inside the glass content sheet, each with its own border, radius and
 * shadow, and each containing further bordered blocks: those are now sections
 * on the ground, grouped by heading, space and a single hairline where the eye
 * needs one. Nesting went from three surfaces deep to one.
 *
 * NOT removed: any capability. Every panel, every policy, every control that
 * was reachable before is reachable now. The cancellation schedule moved behind
 * a `Disclosure`, one tap away, because it is a real thing that almost nobody
 * needs at the moment they are deciding. The market still decides the action: a
 * rental never carries a Reserve control (docs/HYBRID_INVENTORY.md sections 1
 * and 4), and nothing on this page is hardcoded inventory.
 */

/* The kind as the description names it now lives in the dictionary
   (`experienceDetail.listing.kinds`), article included, so "an apartment"
   no longer reads "a apartment" (Round 3 sweep, C3). */

/**
 * The market pill: the one line of status.
 *
 * A tinted icon and label naming the market the property is in, in a semantic
 * colour rather than a generic grey. It is a restatement of `listing.kind`,
 * which every record carries, so nothing here can be invented.
 */
/**
 * The resolved period, narrowed to the three a tenancy can be quoted in.
 *
 * A nightly or per-head rate never belongs to a rental listing, and if one
 * somehow reached this page, falling back to the year the rest of the screen
 * assumes beats labelling a year's rent as a night's.
 */
function rentPeriodOf(value: PricePeriod | null | undefined): RentPeriod {
  return value === "month" || value === "quarter" ? value : "year";
}

/*
 * UX-10 / UI-P2-03: the pill names the MARKET the listing is in
 * (`marketOf`), not its kind. A villa let by the year is "For rent", not
 * "For stays"; restaurant premises let on a rent are "For rent", not
 * "Dining". Semantic tones, never generic grey: a status pill in a neutral
 * wash reads as an absence of state rather than as a market.
 */
const MARKET_PILL: Record<ListingMarket, { icon: UiIconName; tone: StatusTone }> = {
  tenancy: { icon: "key", tone: "brand" },
  sale: { icon: "key", tone: "brand" },
  stay: { icon: "calendar-booking", tone: "success" },
  dining: { icon: "utensils", tone: "info" },
  experience: { icon: "ticket", tone: "info" },
};

/** "Lagos State" reads naturally; the FCT does not take the suffix. The words are the reader's (`experienceLabels`). */
function stateLabel(state: string, words: { state: string; stateFct: string }): string {
  return state === "FCT" ? words.stateFct : words.state.replace("{state}", state);
}

/**
 * How many guests this place takes, as one number the whole page agrees on.
 *
 * The host's declared `max_guests` where there is one, the two-per-bedroom
 * convention where there is not, and null where capacity is not a knowable
 * thing about the place at all.
 */
function capacityOf(listing: Listing): number | null {
  return sleeps(factsOf(listing));
}

/** An ISO date as a Lagos reader would write it. */
function dateLabel(iso: string, locale: Locale): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return new Intl.DateTimeFormat(intlTag[locale], {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Lagos",
  }).format(parsed);
}

/**
 * THE ROBOTS DIRECTIVE AND THE SOCIAL CARD ARE NOT DECIDED HERE.
 *
 * They are decided in `lib/listings/syndication.ts`, the one gate the sitemap,
 * the structured data below and any email that carries a listing all read
 * through. Four copies of "is this row real?" drift into four different
 * answers, and the consequence of the drift is a fabricated property
 * advertisement in Google's index. See that file for the whole argument.
 *
 * This used to return `index: false` for EVERY listing, which was the right
 * blunt instrument while the entire catalogue was invented and is the wrong
 * one now that only some of it is. A property marketplace whose inventory
 * cannot be found is most of the way to not being a marketplace.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const listing = await listingById(id);
  /* OPS-17: metadata resolves before the body streams for crawlers and
     link checkers, so a missing listing answers them with a real 404 rather
     than a 200 that streams a not-found page. */
  if (!listing) notFound();
  return listingMetadata(listing, siteUrl());
}

/**
 * Does this caller hold a confirmed booking here?
 *
 * Only used to choose which sentence the withheld gate block shows, never to
 * decide what they may read: that decision belongs to the policy on
 * public.listing_access and to nothing in this file. A failed count reads as
 * no, because the safe answer to "may I see the gate code" is no.
 */
async function hasConfirmedBooking(
  supabase: SupabaseClient<Database>,
  listingId: string,
  userId: string,
): Promise<boolean> {
  try {
    const { count } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("listing_id", listingId)
      .eq("guest_id", userId)
      .eq("status", "CONFIRMED");
    return (count ?? 0) > 0;
  } catch {
    return false;
  }
}

export default async function ListingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  /** A stay's dates and party size, carried from the stays search. */
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const requested = readStayDates((await searchParams) ?? {});
  const locale: Locale = await getLocale();
  const t = getDictionary(locale);

  const raw = await listingById(id);
  if (!raw) notFound();
  /*
   * D24: THE PAGE DRAWS ONLY THE TRUST THIS SPACE EARNED.
   *
   * Every component below reads `listing`, and `listing` is the row with its
   * trust fields passed through `withEarnedTrust`: on an example row the
   * verified badge, the inspection and address dates and the rating are
   * cleared before anything can draw them. The row's own label ("example")
   * is not drawn anywhere on this page either, per the founder's ruling; what
   * keeps it safe is this, not a word.
   */
  const listing = withEarnedTrust(raw);
  const trust = earnedTrust(raw);
  const sx = t.experienceDetail;


  /*
   * WHERE "MESSAGE AGENT" GOES, AND THE DEAD END THIS REPLACES.
   *
   * This used to be `conversationIdForListing(id)` with a fallback of
   * "/messages". That fallback is the common case and, under the default
   * configuration, the ONLY case: the repository's `conversationIdForListing`
   * returns null unless a thread already exists, so every Message agent control
   * on a stay, a restaurant or a sale landed the reader on their empty inbox
   * instead of in a conversation about the property they were looking at. Five
   * call sites: the sticky bar, the host panel, the reserve panel, the table
   * panel and the restaurant panel.
   *
   * `/messages/new?listing=` is the route that already does this correctly, and
   * the rental branch was already using it. It resolves the listing's agent
   * server side, FINDS an existing thread before creating one, redirects
   * straight into it, and carries designed states for signed out, for a seed
   * listing with no agent behind it, and for messaging being switched off. It
   * is strictly better than the old link in every branch, so every branch now
   * uses it and the property context is never lost on the way to the thread.
   */
  const messageHref = `/messages/new?listing=${listing.id}`;

  // Rentals are annual tenancies: no Reserve control anywhere on the page.
  // The path is message the agent, inspect the property, then pay.
  /* UX-10: the market decides, by the price period and the intent, with the
     kind only as the fallback (`lib/listings/market.ts`). A villa or an
     apartment let by the year is a tenancy here, never a nightly stay. */
  const listingMarket = marketOf(listing);
  const isRental = listingMarket === "tenancy";

  /* A restaurant is ours to take a booking for, and it is NOT a stay. Without
     this it fell into the nightly branch and drew a date range picker, a
     cleaning fee and a per-night total for a table. What a restaurant takes is
     a party size at a moment (docs/HYBRID_INVENTORY.md section 9). */
  const isRestaurant = listingMarket === "dining";

  /*
   * A property FOR SALE is not bookable, and until now it was.
   *
   * `isBookable` was `!isRental && !isRestaurant`, which is a statement about
   * the CATEGORY and ignores the intent entirely. A three-bedroom home listed
   * for sale has kind "home", so it fell straight into the nightly branch and
   * was rendered with a date range picker, a cleaning fee, a per-night total
   * and a Check availability button, for a building somebody is trying to buy.
   * Intent is the discriminator the whole product turns on, so it is honoured
   * here.
   */
  const isSale = listing.intent === "sale";
  const isBookable = !isRental && !isRestaurant && !isSale;

  const today = lagosToday();

  /*
   * EVERY READ THE PAGE NEEDS, AT ONCE (Track M performance).
   *
   * These ran one after another, about fifteen round trips before the first
   * byte left the server: 680ms on production for a listing, and the reader
   * watched the loading state for all of it. Each read needs only the listing
   * (and the reader's session, for the three that follow), so they go out
   * together and the page waits for the slowest one. What each read is, and
   * when it is skipped, is unchanged.
   */
  const [
    reviews,
    credentials,
    doorHonesty,
    record,
    viewingSlots,
    blockedDates,
    savedListings,
    session,
    showMeOpen,
    commute,
    neighboursFlag,
    access,
    recentlyLet,
    doorDeclared,
    listerCard,
    ownershipSeen,
  ] = await Promise.all([
    // Written reviews for this listing. Public by policy for a PUBLISHED
    // listing, so this read works for a signed-out visitor too.
    getListingReviews(listing.id, locale),
    /* V-87: the lister's dated credential checks, for the proof strip. */
    listing.isDemo ? Promise.resolve([]) : readListingCredentials(listing.id),
    listing.isDemo ? Promise.resolve(null) : readDoorHonesty(listing.id),
    /* V-34: the lister's Record under the agent card. An example listing has
       no Record, and a null draws nothing. */
    listing.isDemo ? Promise.resolve(null) : readListingRecord(listing.id),
    /* V-94: free viewing slots, read only for a rental (null or empty draws
       nothing), and not for a reader who already has a live viewing here:
       the picker offered them times that `book_viewing_slot` then refused
       ("you already have a viewing of this home"). The rental panel below
       says where their viewing stands instead. */
    isRental
      ? readOpenInspectionFor(listing.id).then((mine) => (mine ? null : readViewingSlots(listing.id)))
      : Promise.resolve(null),
    // Nights a guest cannot pick: booked or blocked dates from the platform
    // calendar. Empty for catalogue listings and when Supabase is not
    // configured, so the picker simply has nothing to refuse.
    isBookable ? getBlockedDates(listing.id) : Promise.resolve([]),
    // The heart opens in the right state for a signed-in account. Device saves
    // live in localStorage and are reconciled by the control itself on mount.
    getSavedListings(),
    // Reporting belongs to somebody, so the sheet needs to know whether there
    // is a somebody. Signed out is a designed state inside the sheet rather
    // than a hidden control: a visitor who spots a scam should not have to
    // guess that reporting exists.
    resolveSession(),
    /* V-41: the neighbours' account, for a home to let or sell. */
    flagIsOn(SHOW_ME_FLAG),
    /* V-43: rush-hour bands from this area (nothing when the flag is off). */
    (isRental || isSale) && !listing.isDemo
      ? readCommutesFrom({ stateCode: listing.stateCode, area: listing.area, city: listing.city })
      : Promise.resolve({ anchors: 0, rows: [] }),
    isRental || isSale ? flagIsOn(NEIGHBOURS_FLAG) : Promise.resolve(false),
    /* Light, water and the gate. The first two are public columns; the gate
       details are read through the caller's own policies and come back null
       for anyone who is not the host, an admin, or a guest holding a CONFIRMED
       booking on this listing. A refusal and an absence are the same answer
       here on purpose, so nobody can learn whether a code exists by watching
       the page change. */
    readListingAccess(listing.id),
    /* V-14's "recently let" line, for a rental. PERF-SWEEP 3: read with the
       rest rather than in series while the page renders. */
    isRental ? readRecentlyLet(listing.id) : Promise.resolve(null),
    /* V-57: what a nightly stay declared for the door, so the reserve panel
       states every cost before booking, as the hotel stay page does. */
    isBookable && !listing.isDemo ? readDeclaration({ listingId: listing.id }) : Promise.resolve(null),
    /* The "Listed by" row: the lister's public profile (name, handle,
       photograph, side) and their published badge (lister-card-read.ts). */
    readListerCard(listing),
    /* "Ownership seen": a reviewer approved the owner's proof of ownership.
       Only an owner's own listing can carry it; never an example. Read with
       the rest rather than after them. */
    listing.isDemo ? Promise.resolve(null) : ownershipSeenForListing(listing.id),
  ]);
  /* V-59: "Moved in for the Vallo price", the one public number from the
     tenancy reviews. Null (and no line) on every example listing. */
  const doorLine = doorHonesty === null ? null : doorHonestyLine(doorHonesty, t.trustVisible.tenancy);
  const initialSaved = savedListings.some((entry) => entry.listing.id === listing.id);
  const signedIn = session.state === "signed-in";

  /* V-41: the neighbours' account is read with the caller's session; the
     summary function applies its own threshold. These three need the session,
     so they follow the reads above, together. */
  const neighboursOn = (isRental || isSale) && session.state === "signed-in" && neighboursFlag;
  const [bookingConfirmed, neighbours, flooding, callThread] = await Promise.all([
    session.state === "signed-in"
      ? hasConfirmedBooking(session.supabase, listing.id, session.user.id)
      : Promise.resolve(false),
    neighboursOn && session.state === "signed-in"
      ? readNeighbours(session.supabase, listing.stateCode, listing.area)
      : Promise.resolve({ state: "unavailable" } as const),
    neighboursOn && session.state === "signed-in"
      ? readFlooding(session.supabase, listing.id)
      : Promise.resolve(undefined),
    /* THE CALL BUTTON ON "LISTED BY", only where a call can really be placed:
       the `video_calls` switch on, a signed-in reader, a real listing, and a
       conversation about it that already exists (calls belong to a
       conversation, VC1). The lookup starts nothing. Anything else is null,
       and the card's call button opens the conversation instead. */
    session.state === "signed-in" && !listing.isDemo && listerCard
      ? (async () => {
          try {
            if (!(await videoCallsOn())) return null;
            const found = await findConversationForListing({ listingId: listing.id });
            return found.ok ? found.data.conversationId : null;
          } catch {
            return null;
          }
        })()
      : Promise.resolve(null),
  ]);

  // An area is only worth naming when it says something the city does not.
  const where =
    listing.area && listing.area !== listing.city
      ? `${listing.area}, ${listing.city}, ${stateLabel(listing.state, t.experienceLabels)}`
      : `${listing.city}, ${stateLabel(listing.state, t.experienceLabels)}`;

  const L = sx.listing;
  const kindPhrase = L.kinds[listing.kind];
  const market = { ...MARKET_PILL[listingMarket], label: L.market[listingMarket] };

  /*
   * What the price buys, from the one place that owns that mapping.
   *
   * This was a local ternary that could only ever answer "per year", "per
   * guest" or "per night", so a monthly rent read as nightly and a SALE read
   * "per night" under its asking price. The period words are keyed by the
   * period the database actually stated, and carries "asking price" for the
   * case that has no period at all.
   */
  const periodWords = t.agentListings.pricing.period;
  const perLabel = isSale
    ? periodWords.sale
    : listing.pricePeriod
      ? periodWords[listing.pricePeriod]
      : isRental
        ? periodWords.year
        : periodWords.night;

  const amenityNames: Record<string, string> = L.amenities;
  const amenityPhrases = listing.amenities
    .map((a) => amenityNames[a])
    .filter((a): a is string => Boolean(a));
  const amenitySentence =
    amenityPhrases.length > 0
      ? ` ${L.amenitiesInclude.replace("{list}", new Intl.ListFormat(intlTag[locale], { type: "conjunction" }).format(amenityPhrases))}`
      : "";

  /*
   * The description, written from the listing record alone. Every sentence is
   * derived from a field that exists, so nothing here can misdescribe the
   * property, and the paragraphs after the first are what Read more reveals.
   */
  const firstSentence = (listing.bedrooms > 0 ? (listing.bathrooms > 0 ? L.aboutRooms : L.aboutBeds) : L.aboutKind)
    .replace("{title}", listing.title)
    .replace("{kind}", kindPhrase)
    .replace("{bedrooms}", countOf(listing.bedrooms, "bedrooms", locale))
    .replace("{bathrooms}", countOf(listing.bathrooms, "bathrooms", locale))
    .replace("{where}", where);

  const aboutParagraphs: string[] = [`${firstSentence}${amenitySentence}`];

  if (isSale) {
    aboutParagraphs.push(LISTING_SALE_ABOUT);
  } else if (isRental) {
    aboutParagraphs.push(LISTING_RENTAL_ABOUT);
    aboutParagraphs.push(`${LISTING_RENT_QUOTED}${listing.verified ? ` ${L.agentChecked}` : ""}`);
  } else {
    aboutParagraphs.push(
      `${
        listing.instantBook ? L.instantBookOn : L.instantBookOff
      } ${LISTING_STAY_PAY_AFTER}`,
    );
    const closing: string[] = [];
    const capacity = capacityOf(listing);
    if (capacity !== null) {
      closing.push(L.sleeps.replace("{guests}", countOf(capacity, "guests", locale)));
    }
    if (listing.reviewCount > 0) {
      closing.push(
        L.rated
          .replace("{rating}", formatRating(listing.rating, locale))
          .replace("{count}", formatNumber(listing.reviewCount, locale))
          .replace("{reviews}", t.common.reviews),
      );
    }
    if (listing.verified) {
      closing.push(L.agentChecked);
    }
    if (closing.length > 0) aboutParagraphs.push(closing.join(" "));
  }

  /*
   * ONE PRIMARY ACTION, decided by the market.
   *
   * A stay can be reserved, so its primary is the dates and its quiet second is
   * the conversation. Everything else - a rental, a restaurant, a sale - has
   * exactly one honest path, which is to talk to the agent, so it gets one
   * button at full strength and no decorative twin beside it.
   */
  /*
   * AN EXAMPLE LISTING OFFERS NOTHING, BECAUSE THERE IS NOTHING TO OFFER.
   *
   * The database refuses every transaction against these rows: bookings,
   * inspection requests and reviews are all turned away by trigger, and the
   * lister is an institutional account with nobody behind it to message. So a
   * "Check availability" button here is not merely decorative, it is an offer
   * the platform cannot honour, and the person who presses it gets an error
   * they can do nothing about.
   *
   * Both the panel and the sticky bar therefore explain instead of acting. The
   * one link offered goes to search, because the honest next step for somebody
   * who liked this place is to look for a real one.
   */
  const isExample = listing.isDemo;

  /* V-22: the listed age, from the same pure rule the card uses. */
  const ageNow = new Date();
  const age = isExample ? null : listedAge(listing.publishedAt, ageNow);
  const listedLine = age
    ? listedAgeText(
        age,
        t.shape.listed,
        age.kind === "stale" ? formatDate(age.since, locale, staleMonthOptions(age.since, ageNow)) : "",
      )
    : null;

  /* The footer of 9E8B56ED on a tenancy: Calculate breakdown (the move-in
     ledger) and Book inspection (the real request, in the panel below). A
     stay keeps Check availability with the conversation beside it; a sale
     and a table keep the conversation. */
  /* UX-21: while every listing is an example, "Browse real listings" led back
     to more examples. The honest next step is to be told when a real one
     arrives here: the area's search, where "Save this search" sends alerts. */
  /* D24: the page no longer says the row is an example, so its one action
     no longer says "real" either. What stays true and useful: nothing here
     takes a request, and the area's search is where "Save this search"
     tells the reader when a space there does. */
  const areaName = listing.area || listing.city;
  const realSoonHref = `/search?q=${encodeURIComponent(areaName)}`;
  /*
   * SCHEDULE A VISIT (founder's reference, 13 October 2026). A home to rent
   * or to buy has one primary action now: book a visit, at
   * `/listing/[id]/visit`, the viewing flow. A viewing never takes money
   * (HANDOFF section 2). The panel's own inspection request and the message
   * path are still on the page, below. A stay keeps Check availability and
   * its reserve flow; a table keeps the conversation; an example keeps the
   * honest way out it always had.
   */
  const isVisit = !isExample && (isRental || isSale);
  const visitHref = `/listing/${listing.id}/visit`;
  const stickyAction: StickyAction | null = isExample
    ? { label: sx.closed.action.replace("{area}", areaName), href: realSoonHref }
    : isBookable
      ? { label: t.catalogue.detail.checkAvailability, href: "#reserve" }
      : isVisit
        ? { label: t.catalogue.detail.scheduleVisit, href: visitHref }
        : { label: L.messageAgent, href: messageHref };

  const stickySecondary: StickyAction | null = isExample
    ? /*
       * THE BREAKDOWN SURVIVES ON AN EXAMPLE ROW, and nothing else does.
       *
       * The foot used to carry one control here, which is the founder's
       * send-back note that it shows "a price and Browse real listings"
       * rather than the render's pair. The ledger is honest on this row:
       * it is arithmetic over the figures the row itself states, it
       * commits nobody to anything, and its own page says in full that the
       * listing is an example. The inspection is the one that cannot be
       * offered, so it is the one that stays replaced.
       */
      isRental
      ? { label: t.catalogue.detail.calculateBreakdown, href: `/rent/move-in/${listing.id}` }
      : null
    : isBookable
      ? { label: L.messageAgent, href: messageHref }
      : isRental
        ? { label: t.catalogue.detail.calculateBreakdown, href: `/rent/move-in/${listing.id}` }
        : isSale
          ? /* The conversation was a sale's primary; with the visit taking
               that place it stays on the bar as the quiet half. */
            { label: L.messageAgent, href: messageHref }
          : null;

  /*
   * THE SAME DISCLOSURE WAS ON THIS PAGE THREE TIMES.
   *
   * The notice sat in the hero above the price, again at the top of this
   * panel, and a third statement of it followed as a full paragraph: "Nothing
   * can be booked, inspected or paid for here, and there is nobody to message
   * about it. When real properties are listed in this area they will appear in
   * search with an owner you can actually reach." Then a filled button, then
   * the same button again in the sticky bar. Five elements, one fact, and
   * between them they pushed the actual property below the fold on a phone.
   *
   * Saying a thing three times does not make it three times as honest. It
   * makes the page read as an apology for itself, which is what the owner saw
   * and objected to. The disclosure stays exactly ONCE, in the hero, where a
   * reader meets it before the price forms a belief; that placement was argued
   * for and it is the right one. What is left here is the CONSEQUENCE, in one
   * line: what you cannot do, and the one link that leads somewhere real.
   */
  const bookingPanel = isExample ? (
    <div className="nf-panel nf-panel--card isolate p-card">
      <p className={TYPE.rowMeta} data-testid="space-closed">
        {sx.closed.body.replace("{area}", areaName)}
      </p>
      <ButtonLink href={realSoonHref} variant="primary" className="mt-block w-full">
        {sx.closed.action.replace("{area}", areaName)}
      </ButtonLink>
    </div>
  ) : isRestaurant ? (
    <div className="flex flex-col gap-md">
      <ReserveTable listingId={listing.id} messageHref={messageHref} success={t.success} copy={t.memberFlows} locale={locale} />
      <RestaurantPanel listing={listing} locale={locale} messageHref={messageHref} t={t} />
    </div>
  ) : isRental || isSale ? (
    /*
      V-14: on a rental, "Still available?" comes first. It is the first
      WhatsApp message about every Nigerian listing; here it is one tap each
      way and a counted answer. A sale keeps its panel as it was.

      The panel gets the SAME period the hero above it gets.

      It used to get none and print "/ year" regardless, so this page could
      state two different units for one price forty pixels apart - and did,
      on every monthly rental and on every sale. `rentPeriodOf` narrows the
      resolved value to what a tenancy can actually be quoted in; a nightly or
      per-head rate never reaches a rental listing, and if one somehow did,
      falling back to the year the rest of this page assumes is better than
      labelling annual rent as nightly.
    */
    <div className="flex flex-col gap-md">
      {isRental && (
        <StillAvailable
          listingId={listing.id}
          copy={t.frontDoor.available}
          recentlyLet={recentlyLet}
          locale={locale}
        />
      )}
      {/* V-94: the lister's free viewing slots, when they have set windows. */}
      {isRental && viewingSlots && viewingSlots.length > 0 && (
        <ViewingSlots listingId={listing.id} slots={viewingSlots} copy={t.frontDoor.viewings} locale={locale} success={t.success} />
      )}
      <RentalPanel
        listingId={listing.id}
        priceMinor={listing.priceMinor}
        currency={listing.currency}
        locale={locale}
        period={isSale ? "sale" : rentPeriodOf(listing.pricePeriod)}
        minimumTenancyMonths={listing.minimumTenancyMonths}
      />
    </div>
  ) : (
    <ReservePanel
      listingId={listing.id}
      currency={listing.currency}
      locale={locale}
      instantBook={listing.instantBook}
      messageHref={messageHref}
      success={t.success}
      door={toDoorCharges(doorDeclared, t.afterTheGate.arrival)}
      doorCopy={t.afterTheGate.arrival}
      copy={t.memberFlows}
    />
  );

  /*
   * The key facts, from columns the page has never printed.
   *
   * The schema has carried floor area, furnishing, build condition, year built,
   * toilets, parking, floor level, availability date and minimum tenancy for a
   * while, and not one of them appeared on this screen. They are the questions
   * asked immediately after bed and bath, so they are answered immediately
   * after bed and bath.
   *
   * Built by filtering, so a fact nobody stated is absent rather than rendered
   * as a zero or a dash. `?? undefined` is deliberate on the numeric ones: a
   * stated zero is a real answer ("no parking") and must survive, while an
   * absent column must not.
   */
  const facts: Fact[] = [];
  if (listing.sizeSqm !== undefined) {
    facts.push({
      label: L.facts.floorArea,
      value: `${formatNumber(listing.sizeSqm, locale)} m²`,
    });
  }
  if (listing.furnished) {
    facts.push({ label: L.facts.furnishing, value: t.experienceLabels.furnishing[listing.furnished] });
  }
  if (listing.condition) {
    facts.push({ label: L.facts.condition, value: t.experienceLabels.condition[listing.condition] });
  }
  if (listing.yearBuilt !== undefined) {
    facts.push({ label: L.facts.yearBuilt, value: String(listing.yearBuilt) });
  }
  if (listing.toilets !== undefined) {
    facts.push({ label: L.facts.toilets, value: formatNumber(listing.toilets, locale) });
  }
  if (listing.parkingSpaces !== undefined) {
    facts.push({
      label: L.facts.parking,
      value:
        listing.parkingSpaces === 0
          ? L.facts.parkingNone
          : countOf(listing.parkingSpaces, "spaces", locale),
    });
  }
  if (listing.floor !== undefined) {
    facts.push({
      label: L.facts.floor,
      value:
        listing.floor === 0
          ? L.facts.groundFloor
          : L.facts.floorN.replace("{n}", formatNumber(listing.floor, locale)),
      note:
        listing.totalFloors !== undefined
          ? L.facts.ofN.replace("{n}", formatNumber(listing.totalFloors, locale))
          : undefined,
    });
  }
  if (listing.availableFrom) {
    facts.push({ label: L.facts.availableFrom, value: dateLabel(listing.availableFrom, locale) });
  }
  if (listing.minimumTenancyMonths !== undefined) {
    facts.push({
      label: L.facts.minimumTenancy,
      value: countOf(listing.minimumTenancyMonths, "months", locale),
    });
  }

  /*
   * The trust marks.
   *
   * These were three of the five chips that could stack on the old status row.
   * They are facts about the listing rather than states of it, so they read as
   * a quiet run of icon-and-word marks under the price instead of as three
   * tinted pills competing with the market pill above. No container of any kind
   * behind the glyphs.
   */
  const marks: { icon: UiIconName; label: string }[] = [];
  /* TRUST FACTS ARE DATES, NEVER TICKS (north star 12 point 15). The
     inspection and the address check used to be marks here with no date;
     they are dated rows in "Why trust this space?" now, and what is left in
     this run is the listing's terms, which are not checks of anything. */
  if (listing.instantBook && isBookable) {
    marks.push({ icon: "calendar-check", label: L.instantBook });
  }
  if (listing.negotiable) marks.push({ icon: "chat-bubble", label: L.negotiable });

  const proof = proofLines({ ...proofFactsOf(listing), credentials });

  /* The sections, in page order. The row carries the five a reader decides
     on (and reviews, which it always carried); the InnerNav lists them all. */
  const hasCost = isRental || isSale;
  /* The Map tab's two facts we hold: the area's centroid (the search map's
     own pin, never the address) and the city's airport. */
  const mapPoint = areaPoint(listing.city, listing.area);
  const airport = airportFor(listing.city);

  const sectionTabs = [
    { id: "overview", label: sx.sections.overview },
    ...(hasCost ? [{ id: "cost", label: sx.sections.costs }] : []),
    { id: "amenities", label: sx.sections.amenities },
    { id: "trust", label: sx.sections.trust },
    { id: "location", label: sx.map.tab },
    { id: "reviews", label: sx.sections.reviews },
  ];
  /* The gallery, the viewer and the grid share one row: photos and videos in
     the order the lister arranged, cover first (gallery-media.ts). */
  const media = listingMedia(listing.photos, listing.videos);
  const sectionIndex: { id: string; label: string; icon: UiIconName }[] = [
    { id: "overview", label: sx.sections.overview, icon: "home" },
    ...(hasCost ? [{ id: "cost", label: sx.sections.costs, icon: "receipt" as UiIconName }] : []),
    { id: "amenities", label: sx.sections.amenities, icon: "circle-check" },
    { id: "trust", label: sx.sections.trust, icon: "shield-check" },
    ...(facts.length > 0 ? [{ id: "details", label: sx.sections.details, icon: "clipboard-list" as UiIconName }] : []),
    ...(media.length > 1 ? [{ id: "photos", label: sx.sections.photos, icon: "picture" as UiIconName }] : []),
    { id: "location", label: sx.map.tab, icon: "location" },
    { id: "agent", label: sx.sections.agent, icon: "user" },
    { id: "reviews", label: sx.sections.reviews, icon: "star" },
  ];

  /*
   * Structured data, or nothing at all.
   *
   * `listingStructuredData` returns null for an example listing, and null here
   * means no script element is rendered rather than an empty one. That is the
   * whole rule and it is deliberately not softened: a node with the price
   * stripped, or with a caveat property bolted on, is still a machine-readable
   * claim that a property exists at a place, and nothing that consumes
   * structured data is obliged to read a caveat it was not expecting.
   *
   * The nonce is the same one `layout.tsx` reads. `script-src` carries
   * `strict-dynamic` beside the nonce, so an inline block without one is a
   * report at best and a blocked element at worst.
   */
  /*
   * THE HEADLINE FIGURE, beside the title as the founder's reference draws it:
   * the figure in full ink and what it buys in grey ("/year"). The rent on a
   * tenancy (its move-in total leads the block under the card), the asking
   * price on a sale with no unit, the rate on a stay. Glance notation through
   * `formatMoney`'s own glance rule, so it never rounds a figure up, with the
   * whole amount spoken for a screen reader. No figure, no headline: a listing
   * that states no price is not drawn as free.
   */
  const unitWords = t.catalogue.card;
  const period = listing.pricePeriod;
  const headlineUnit = isSale
    ? null
    : period === "month"
      ? unitWords.perMonth
      : period === "quarter"
        ? unitWords.perQuarter
        : period === "night"
          ? unitWords.night
          : period === "guest"
            ? unitWords.head
            : period === "year" || isRental
              ? unitWords.perYear
              : unitWords.night;
  const spokenPeriod = isSale
    ? null
    : period === "month" || period === "quarter" || period === "night"
      ? period
      : period === "guest"
        ? "person"
        : isRental || period === "year"
          ? "year"
          : "night";
  const headline =
    listing.priceMinor > 0 ? (
      <p className="nf-detail-head__price" data-testid="detail-price">
        <Money
          minor={listing.priceMinor}
          locale={locale}
          currency={listing.currency}
          mode="glance"
          period={spokenPeriod}
          className="nf-detail-head__figure"
        />
        {headlineUnit && <span className="nf-detail-head__unit">{headlineUnit}</span>}
      </p>
    ) : null;

  /* The place as the reference writes it, "Ikoyi, Lagos": the area and the
     city, or the city and its state when the area says nothing more. */
  const placeLine =
    listing.area && listing.area !== listing.city
      ? `${listing.area}, ${listing.city}`
      : `${listing.city}, ${stateLabel(listing.state, t.experienceLabels)}`;

  /* "Listed by": the lister's public row, their published badge, and the two
     round buttons. The call button is live only where a call can really be
     placed (see `callThread` above); otherwise it opens the conversation. */
  const listerWho =
    listerCard?.name ??
    (listerCard?.role ? t.socialProfile.roleLine[listerCard.role] : null) ??
    t.catalogue.detail.theLister;
  const callButton =
    callThread && listerCard ? (
      <ListerCallButton
        conversationId={callThread}
        name={listerWho}
        contextLine={publicListingTitle(listing)}
        copy={{
          label: t.calls.buttons.voiceWith,
          notEngagedTitle: t.calls.refusal.notEngagedTitle,
          notEngagedBody: t.calls.refusal.notEngagedBody,
          busy: t.calls.outgoing.busy,
          dismiss: t.calls.refusal.dismiss,
        }}
      />
    ) : undefined;
  const listerCardNode = (
    <ListingAgentCard
      verified={listing.verified}
      t={t}
      messageHref={messageHref}
      name={listing.listerName ?? null}
      listingRole={listing.listerRole ?? null}
      lister={listerCard}
      call={callButton}
    />
  );

  const structuredData = listingStructuredData(listing, siteUrl());
  const nonce = (await headers()).get(NONCE_HEADER) ?? undefined;

  const body = (
    <PhotoViewerProvider
      title={listing.title}
      photos={listing.photos}
      media={media}
      hue={listing.hue}
      kind={listing.kind}
    >
      <div className="nf-cat-surface mx-auto max-w-6xl">
        {structuredData && (
          <script
            type="application/ld+json"
            nonce={nonce}
            dangerouslySetInnerHTML={{ __html: structuredDataJson(structuredData) }}
          />
        )}

        {/* Nothing rendered. Puts this place in the recently-viewed memory the
            search page offers back, whichever way it was reached. */}
        {/* V-73: this listing was opened (counted once per person per day). */}
        <RecordViews opened={listing.id} />
        {/* B2: with the card's own glance (photo, price line, mark), so
            Home's "Looked at recently" draws a real small card. */}
        <RecordVisit glance={cardGlance(listing, locale, t.catalogue.card)} />

        {/* ------------------------------------------------------- 1. MEDIA */}
        {/*
          THE LISTING PAGE, TO THE FOUNDER'S REFERENCE (13 October 2026).

          One calm page: the photograph edge to edge with the round back,
          share and save over it (and "Watch video" when there is one), then
          the status, the title with the price opposite it, the rating and the
          place, the fact chips, the description, who listed it, the gallery,
          and everything else this page has always carried, in the same order
          of how many readers need it. From `lg` the photographs and the
          details are the left column and a sticky summary card is the right:
          the price, the lister and the one primary action.
        */}
        <div className="nf-detail-grid grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-2xl">
          {/* --------------------------------------------- main column */}
          <div className="min-w-0">
        {/*
          THE SPACE CARD'S TOP (the founder, 13 October 2026): one large soft
          rounded card holding the photograph, inset with an even gap and its
          own corners, and under it a SEPARATE rounded panel with the status,
          the title and the price. The floating back, share and save, Watch
          video and the photo counter stay on the photograph.
        */}
        <div className="nf-sc nf-sc-top" data-testid="detail-top">
        <ListingGallery
          listingId={listing.id}
          floatingBack={false}
          framed
          title={listing.title}
          shareTitle={publicListingTitle(listing)}
          hue={listing.hue}
          kind={listing.kind}
          photos={listing.photos}
          media={media}
          drawn={isModestExample(listing)}
          initialSaved={initialSaved}
          backFallback="/home"
          /* The market is no longer a mark on the photograph: it is the
             status chip above the title, where the reference puts it. The
             lister's published badge is on "Listed by". */
        />

                {/* ------------------------------- 2 to 5. THE LEAD BLOCK
                    The reference's order: the status chip, the title with
                    the price opposite, the rating (only with real reviews)
                    and the place with its pin, then the fact chips. */}
                <Section className="nf-sc-top__panel nf-rise nf-detail-lead scroll-mt-16" id="overview">
                  <div className="flex flex-wrap items-center gap-xs" data-testid="detail-status">
                    <StatusPill tone={market.tone} icon={market.icon} size="sm">
                      {/* Rent and sale in the reader's language. Stays, dining and
                          experiences read their market word. */}
                      {isSale
                        ? t.catalogue.card.forSale
                        : listingMarket === "tenancy"
                          ? t.catalogue.card.forRent
                          : market.label}
                    </StatusPill>
                  </div>

                  <div className="nf-detail-head mt-sm">
                    <h1 className="nf-detail-head__title nf-h2 [overflow-wrap:anywhere]">{listing.title}</h1>
                    {headline}
                  </div>

                  <p className="nf-detail-meta mt-xs">
                    {/* A rating only with the reviews behind it; a count only
                        when the record carries one. The stars are
                        --nf-rating, the warm spark (spec section 18). */}
                    {listing.rating > 0 && listing.reviewCount > 0 && (
                      <a href="#reviews" className="nf-detail-meta__rating nf-tap" data-testid="detail-rating">
                        <UiIcon name="star" size={16} filled className="text-[var(--nf-rating)]" />
                        <span className="nf-numeric font-semibold text-[var(--nf-content-primary)]">
                          {formatRating(listing.rating, locale)}
                        </span>
                        <span className="nf-numeric">({countOf(listing.reviewCount, "reviews", locale)})</span>
                      </a>
                    )}
                    <a href="#location" className="nf-detail-meta__place nf-tap" data-testid="detail-place">
                      <UiIcon name="location" size={16} className="shrink-0" />
                      <span className="min-w-0">{placeLine}</span>
                    </a>
                  </p>

                  {/* The street address and exact pin, only for the lister,
                      staff, a confirmed viewing or a live agreement. */}
                  {!listing.isDemo && (
                    <Suspense fallback={null}>
                      <ExactPlace listingId={listing.id} />
                    </Suspense>
                  )}

                  {/* How old it is (V-22). Never on an example, which
                      illustrates a flat that does not exist. */}
                  {listedLine && (
                    <p className={`mt-inline-tight ${TYPE.body}`} data-testid="detail-listed-age">
                      {listedLine}
                    </p>
                  )}

                  {/* The fact chips (beds, baths, size, then what the place
                      carries), five at a time with "+N" for the rest. */}
                  <div className="mt-md">
                    <ListingSpecChips
                      chips={specChips(listing, t, locale)}
                      labels={{ more: t.catalogue.detail.allFacts, fewer: t.catalogue.detail.fewerFacts }}
                    />
                  </div>

                  {/* The listing's terms (Instant Book, a negotiable price): icon
                      and word, no container. Not checks, so never a tick. */}
                  {marks.length > 0 && (
                    <ul className="mt-row flex flex-wrap items-center gap-x-lg gap-y-inline">
                      {marks
                        .map((mark) => (
                          <li key={mark.label} className={`flex items-center gap-xs ${TYPE.body}`}>
                            <UiIcon
                              name={mark.icon}
                              size={ICON.inline}
                              className="shrink-0 text-[var(--nf-brand-secondary)]"
                            />
                            <span className="font-normal text-[var(--nf-content-secondary)]">
                              {mark.label}
                            </span>
                          </li>
                        ))}
                    </ul>
                  )}

                </Section>

        </div>

        {/*
          THE PAGE GROUND IS THE APP CANVAS, and it used to be a sheet. The
          lead is now the card's own panel, so the sections below start on the
          ground, one rhythm apart.
        */}
        <div className="mt-section-tight">
              <Stack>
                {/* Two or three answered facts (light, backup hours, water,
                    the stated move-in total), never an estimate: nothing at
                    all when fewer than two were answered (highlights.ts). */}
                <ListingHighlights
                  items={listingHighlights(listing, t, locale, isRental && !isSale)}
                  title={t.catalogue.detail.highlights}
                />

                {/* What the place carries, as the founder's "Property
                    Detail" reference draws it: round monochrome plates
                    with the word under each, five and "+N" to the full
                    list below. Only the listing's own amenity codes. */}
                {listing.amenities.length > 0 && (
                  <div data-testid="lead-amenities">
                    <ListingAmenityTiles
                      variant="plates"
                      amenities={listing.amenities}
                      limit={5}
                      moreHref="#amenities"
                      moreLabel={t.catalogue.detail.more}
                    />
                  </div>
                )}

                {/*
                  THE MOVE-IN TOTAL, DIRECTLY UNDER THE LEAD ON A TENANCY.

                  The figure people actually shop on in this market (PRODUCT.md
                  section 5). The rent per period is the headline beside the
                  title, as the founder's reference draws it; this block is
                  what the rent becomes at the door, with the breakdown one tap
                  away. A sale and a stay have no such block.
                */}
                {isRental && !isSale && (
                  <div className="flex flex-col gap-sm">
                    <div data-testid="detail-lead-move-in">
                      <ListingMoveInBlock listing={listing} locale={locale} t={t} />
                    </div>
                    {/* V-69: ask for one clip before crossing Lagos. Behind the
                        show_me flag; never on an example, which has nobody to
                        film anything. */}
                    {showMeOpen && isRental && !isSale && !listing.isDemo && (
                      <div data-testid="detail-show-me">
                        <ButtonLink
                          href={`/messages/new?listing=${listing.id}&then=showme`}
                          variant="secondary"
                          className="w-full"
                        >
                          {t.shape.showMe.entry}
                        </ButtonLink>
                        <p className="nf-caption mt-2xs text-[var(--nf-content-muted)]">{t.shape.showMe.entryHint}</p>
                      </div>
                    )}
                    {/* V-31: what the OWNER said about availability, or nothing.
                        Streams on its own and never holds the page. */}
                    {isRental && !isSale && (
                      <Suspense fallback={null}>
                        <OwnerAvailabilityLine listingId={listing.id} isDemo={listing.isDemo} copy={t.landlord.listing} />
                      </Suspense>
                    )}
                  </div>
                )}

                {/* The anchor row keeps its place (9E8B56ED) and gains the two
                    sections a reader decides on: what it costs and why to
                    trust it. The InnerNav at its end lists every section. */}
                <ListingSectionTabs
                  tabs={sectionTabs}
                  index={{ label: sx.sections.navLabel, toggle: sx.sections.toggle, items: sectionIndex }}
                />

                {/* ---------------------------------------- the description */}
                <Section id="about" title={t.catalogue.detail.description} divided className="scroll-mt-16">
                  <ListingAbout
                    paragraphs={aboutParagraphs}
                    labels={{ readMore: t.catalogue.detail.readMore, showLess: t.catalogue.detail.showLess }}
                  />
                </Section>

                {/* ------------------------------------------- listed by */}
                <Section id="agent" title={t.catalogue.detail.agent} divided className="scroll-mt-16">
                    {/*
                      THE LAST MILE OF TRACK G, AND IT IS ONE PROP.
                      `listings.listing_role` has been live and not null on
                      every row since Track G migration 3, and this card has
                      mounted `ListerRoleLine` for it since the same week. The
                      value simply never travelled: the read did not select the
                      column. It does now, so "Listed by the owner" is on a
                      screen rather than in a constant with a passing test.
                      Absent draws no line, which is what this card drew before.

                      AND THE NAME, WHICH IS THE OTHER HALF. Two of the three
                      sentences carry `{name}` and the public read could not
                      fill either one, so on all 64 live listings, every one of
                      them `listing_role = 'agent'`, the line appeared on zero
                      screens. `listing.listerName` comes from
                      `public.listing_lister`, a published view of exactly two
                      columns added by migration `20260923103838`. It carries a
                      name and nothing else about the person.
                    */}
                  {listerCardNode}
                  <OwnershipSeenMark
                    seenAt={ownershipSeen}
                    label={t.supply.register.owner.proof.seenMark}
                    className="mt-2xs"
                  />
                  {/* B7: the reply-time line, only when the record supports one. */}
                  <ReplyTimeLine listingId={listing.id} locale={locale} className="mt-2xs" />
                  <ValloRecord record={record} t={t} locale={locale} className="mt-row" />
                </Section>

                {/* ------------------------------------------- the gallery */}
                {/* A single photograph is already the hero; a strip of one
                    states nothing, so it is not rendered below two. Videos
                    are frames of it too, in the lister's order. */}
                {media.length > 1 && (
                  <Section id="photos" divided className="scroll-mt-16">
                    <ListingPhotoGrid
                      photos={listing.photos}
                      media={media}
                      hue={listing.hue}
                      kind={listing.kind}
                      title={listing.title}
                      copy={{
                        title: t.catalogue.detail.gallery,
                        viewAll: t.catalogue.detail.viewAll,
                        viewAllMedia: t.catalogue.detail.viewAllMedia,
                      }}
                    />
                  </Section>
                )}

                {/* --------------------- 6. THE NIGERIAN NUMBER, ITEMISED */}
                {/*
                  WHAT A TENANT WILL ACTUALLY PAY. The page used to show ONE
                  NUMBER while the component that draws the whole breakdown
                  sat unimported.

                  The block above the fold still leads with the total, which is
                  the figure somebody shops on. This section is the itemised
                  answer to "made up of what", drawn to GOVERNING-08 screen two,
                  including every cost the lister DID NOT declare, because the
                  silence is the finding. A tenancy only: a sale has its own
                  cost model and none of its columns exist yet, which is Group
                  C's schema work.
                */}
                {isRental && !isSale && (
                  <Section
                    id="cost"
                    title={t.moveIn.title}
                    description={t.moveIn.lede}
                    divided
                    className="scroll-mt-16"
                  >
                    <ListingMoveIn
                      listing={listing}
                      locale={locale}
                      t={t}
                      records={await readPayeeRecords(listing.id)}
                      actions={{
                        ledgerHref: `/rent/move-in/${listing.id}`,
                        messageHref,
                        shareTitle: publicListingTitle(listing),
                      }}
                    />
                    {/* B8: the door to Price Check, drawn only where it would answer. */}
                    <PriceContextRow listing={listing} locale={locale} />
                    {/* V-38: what this flat was last let at through Vallo. Nothing when there is no such let. */}
                    <LastLetLine listingId={listing.id} locale={locale} />
                    {/* V-70: which of the shot list's photos this listing has. */}
                    <PhotographedLine listingId={listing.id} locale={locale} />
                    {/* V-36: the lister's caution record, once five have settled. */}
                    <CautionRecordLine listingId={listing.id} listerName={null} locale={locale} />
                  </Section>
                )}

                {/* ------------------- 6b. AND THE SAME ANSWER FOR A BUYER */}
                {/*
                  WHAT IT WILL ACTUALLY COST TO BUY, which until this commit
                  this platform could not show anybody. The tenancy block above
                  has listed every cost a tenant meets, declared or not, since
                  Track H; a buyer got an asking price and nothing else, and
                  buying is where a Nigerian is most often surprised by a
                  number. Same anatomy, same honesty rule, and the three
                  statutory charges named as the state's rather than as
                  anybody's on this platform.
                */}
                {isSale && (
                  <Section
                    id="cost"
                    title={t.purchase.title}
                    description={t.purchase.lede}
                    divided
                    className="scroll-mt-16"
                  >
                    <ListingPurchase listing={listing} locale={locale} t={t} />
                  </Section>
                )}

                {isSale && (
                  <Section title={L.buyingTitle} divided>
                    <ListingTenure listing={listing} />
                  </Section>
                )}

                {/* ------------------------------------------- amenities */}
                <Section id="amenities" title={t.catalogue.detail.amenities} divided className="scroll-mt-16">
                  {listing.amenities.length > 0 ? (
                    <ListingAmenityTiles amenities={listing.amenities} />
                  ) : (
                    <ListingAmenities
                      locale={locale}
                      bedrooms={listing.bedrooms}
                      bathrooms={listing.bathrooms}
                      amenities={listing.amenities}
                      guests={isBookable ? (capacityOf(listing) ?? undefined) : undefined}
                    />
                  )}
                </Section>

                {/* The compound's answers, what the service charge covers, and
                    every offer on this property: facts about the building,
                    after what is inside it. Each draws nothing when unanswered. */}
                {(listing.compound || listing.service) && (
                  <Section divided>
                    {/* The compound's answers (V-28); absent when none was given. */}
                    {listing.compound && (
                      <div className="mt-md first:mt-0">
                        <ListingCompound compound={listing.compound} copy={t.shape.compound} />
                      </div>
                    )}
                    {/* What the service charge covers, and Serviced only when
                        the database derived it (V-68). */}
                    {listing.service && (
                      <div className="mt-md first:mt-0">
                        <ListingService service={listing.service} copy={t.shape.service} />
                      </div>
                    )}
                  </Section>
                )}
                {/* V-37: every offer on this property, side by side, each with
                    its own move-in total. Nothing when there is one offer. */}
                {isRental && !isSale && (
                  <Suspense fallback={null}>
                    <PropertyOffers
                      listingId={listing.id}
                      isDemo={listing.isDemo}
                      copy={t.landlord.offers}
                      listingCopy={t.landlord.listing}
                      locale={locale}
                    />
                  </Suspense>
                )}

                {/* ------------------------- 7. LIGHT, WATER AND THE GATE */}
                {(listing.utilities || neighbours.state !== "unavailable" || flooding !== undefined) && (
                  <Reveal>
                    <Section
                      title={L.utilitiesTitle}
                      description={L.utilitiesBody}
                      divided
                    >
                      {listing.utilities && (
                        <ListingUtilities
                          locale={locale}
                          utilities={listing.utilities}
                          access={access}
                          bookingConfirmed={bookingConfirmed}
                          copy={sx.utilities}
                        />
                      )}
                      {/* V-41: the lister's flooding answer, and what residents
                          report, beside the claims above. */}
                      <div className="mt-md">
                        <ListingNeighbours
                          neighbours={neighbours}
                          flooding={flooding}
                          area={listing.area || listing.city}
                          copy={t.shape.neighbours}
                        />
                      </div>
                    </Section>
                  </Reveal>
                )}

                {/* ------------------------- WHY TRUST THIS SPACE? (D25) */}
                {/*
                  The dated facts, here in summary, with the door to the inner
                  page that answers the question completely. Every fact is a
                  date; a check that has not happened is not drawn, so a null
                  never reads as a negative.
                */}
                <Reveal>
                  <Section id="trust" title={sx.trust.title} divided className="scroll-mt-16">
                    <TrustFacts
                      listingId={listing.id}
                      trust={trust}
                      strip={
                        /* V-03, THE PROOF STRIP: each line opens what the
                           check is and is not. Nothing at all when nothing is
                           dated, which today is every example listing. */
                        <ProofStrip lines={proof} variant="full" t={forProofStrip(t)} locale={locale} />
                      }
                      proofCount={proof.length}
                      locale={locale}
                      t={t}
                    />
                  </Section>
                </Reveal>

                {/* ------------------------- V-43. GETTING TO WORK FROM HERE */}
                {commute.anchors > 0 && (
                  <Reveal>
                    <Section
                      title={t.shape.commute.locationTitle}
                      description={t.shape.commute.locationLede.replace("{area}", listing.area || listing.city)}
                      divided
                    >
                      {commute.rows.length > 0 ? (
                        <ul className="flex flex-col gap-sm" data-testid="listing-commute">
                          {commute.rows.map((row) => (
                            <li key={row.anchor.id} className="nf-body-sm break-words text-[var(--nf-content-secondary)]">
                              {commuteLine(row.bands, row.anchor.name, t.shape.commute)}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="nf-caption text-[var(--nf-content-muted)]">
                          {t.shape.commute.locationNone.replace("{area}", listing.area || listing.city)}
                        </p>
                      )}
                    </Section>
                  </Reveal>
                )}

                {/* -------------------------------------- 8. THE DETAILS */}
                {facts.length > 0 && (
                  <Reveal>
                    <Section id="details" title={L.detailsTitle} divided className="scroll-mt-16">
                      <FactGrid facts={facts} />
                    </Section>
                  </Reveal>
                )}

                {/* "About this place" stood here and printed the same
                    paragraphs as the description above, word for word. One
                    statement of a thing is enough. */}

                {/* ------------------------------------------ listing code */}
                {/*
                  THE CODE, WHERE SOMEBODY WOULD BE STANDING WHEN THEY READ IT
                  OUT. A person on the phone to a friend about this exact flat
                  needs nine characters, not a URL with a uuid in it. Every
                  listing on this page is PUBLISHED, so the code always exists;
                  it is still guarded, because the model carries it as optional
                  and a guard is cheaper than a promise.
                */}
                {listing.reference && (
                  <Reveal>
                    <Section divided>
                      <ListingCodeRow code={listing.reference} copy={t.listingReference} />
                    </Section>
                  </Reveal>
                )}

                {/* ------------------------------ booking panel, mobile */}
                {/*
                  The anchor stays in the document at every width. On a stay,
                  a table and an example the panel itself is dropped from `lg`
                  up, where it is the sticky side panel, so the pinned bar's
                  Check availability always has a target to scroll to. On a
                  home to rent or to buy the side panel is the summary card, so
                  this panel (the term, the viewing slots, the inspection
                  request) stays in the column at every width.
                */}
                <div id="reserve" className="scroll-mt-20">
                  <div className={isVisit ? undefined : "lg:hidden"}>{bookingPanel}</div>
                  {isVisit || isBookable ? <p className="nf-caption mt-inline text-[var(--nf-content-muted)]" data-testid="listing-pay-inside">{PAY_ONLY_THROUGH_VALLO}</p> : null}
                </div>

                {/* ------------------------------------------- location */}
                <Section id="location" title={sx.map.title} divided className="scroll-mt-16">
                  {/* THE MAP TAB (the founder's travel-app set, 7 October): a
                      still map of the AREA, getting there only where both ends
                      are ours, Preview and Photo tour. ListingMapPanel. */}
                  <ListingMapPanel
                    where={where}
                    area={listing.area || listing.city}
                    point={mapPoint}
                    airport={mapPoint && airport ? { name: airport.name, km: straightKm(mapPoint, airport.at) } : null}
                    hasWalkthrough={(listing.videos?.length ?? 0) > 0}
                    photoCount={listing.photos.length}
                    copy={sx.map}
                  />
                    {/*
                      TRAVEL TIME WAS REMOVED AND IT IS NOT COMING BACK AS A
                      STUB. It posted to `/api/travel-time`, a route that has
                      never existed in this tree, and its designed failure was
                      to hide itself. So the whole of it, from a person's side,
                      was: tap a control, grant a location permission whose
                      alert promised the position stayed on the device, and
                      watch the control vanish. A bug, a broken promise and a
                      permission prompt with no payoff, in one tap. Building
                      the routing integration is a feature with its own
                      provider key, not a rejection fix. See the store research
                      file, A.3 fix 1.
                    */}
                </Section>

                {/* --------------------------------------------- reviews */}
                {/* The band renders nothing rather than inventing
                    testimonials, and suppresses a count that is zero. Both
                    behaviours are correct and are preserved exactly. */}
                <Reveal>
                  <Section id="reviews" title={t.catalogue.detail.reviews} divided className="scroll-mt-16">
                    {doorLine && (
                      <p className={`mb-row ${TYPE.body}`} data-testid="door-honesty">
                        {doorLine}
                      </p>
                    )}
                    <ListingReviews
                      rating={listing.rating}
                      reviewCount={listing.reviewCount}
                      reviews={reviews}
                      locale={locale}
                      t={t}
                      signedIn={signedIn}
                      tenancy={isRental}
                    />
                  </Section>
                </Reveal>

                {/* More like this: the one card on the home shelf, real rows
                    from the same market and area, streamed so it never holds
                    the page, and absent when there is nothing to show. */}
                {(isRental || isSale) && (
                  <Suspense fallback={null}>
                    <SimilarListings
                      listing={listing}
                      locale={locale}
                      t={t}
                      savedIds={new Set(savedListings.map((entry) => entry.listing.id))}
                      title={sx.similar.title}
                      seeAllLabel={sx.similar.seeAll}
                    />
                  </Suspense>
                )}

                {/* ------------------------------- the long tail, one tap */}
                {/*
                  MOVED, NOT DELETED. The cancellation schedule is real and
                  occasionally decisive, and it is not what somebody deciding
                  whether to enquire needs in front of them. It sits behind a
                  disclosure with the report control, which is the thing you go
                  looking for rather than the thing you are offered, and which
                  must always be findable.

                  Not on a rental or a sale: neither has a booking to cancel.
                */}
                <Section divided>
                  <div className="divide-y divide-[var(--nf-panel-hair)]">
                    {isBookable && (
                      <Disclosure
                        label={L.cancellationTitle}
                        hint={L.cancellationHint}
                        data-testid="cancellation-disclosure"
                      >
                        <CancellationTimeline locale={locale} headingLevel="h3" />
                      </Disclosure>
                    )}
                    <div className="py-md">
                      <ReportSheet
                        targetType="listing"
                        targetId={listing.id}
                        targetLabel={listing.title}
                        signedIn={signedIn}
                      />
                    </div>
                  </div>
                </Section>
              </Stack>
            </div>
          </div>

          {/* ------------------------------- the side panel, desktop */}
            {/* A home to rent or to buy: the summary card (price, lister,
                Schedule a visit). Everything else: the booking panel. */}
            <aside className="hidden lg:sticky lg:top-6 lg:block">
              {isVisit && stickyAction ? (
                <ListingSummaryCard
                  price={headline}
                  note={
                    isRental && (listing.moveInCostMinor ?? 0) > 0 ? (
                      <a href="#cost" className="nf-tap nf-detail-summary__movein" data-testid="summary-move-in">
                        <span>
                          {listing.moveInCostStated === true
                            ? t.catalogue.detail.moveInTotal
                            : t.catalogue.detail.moveInFrom}
                        </span>
                        <Money
                          minor={listing.moveInCostMinor ?? 0}
                          locale={locale}
                          currency={listing.currency}
                          mode="glance"
                          className="nf-numeric font-semibold text-[var(--nf-content-primary)]"
                        />
                      </a>
                    ) : null
                  }
                  lister={listerCard ? (
                    <ListingAgentCard
                      verified={listing.verified}
                      t={t}
                      messageHref={messageHref}
                      lister={listerCard}
                      call={callButton}
                      className="nf-lister--flat"
                    />
                  ) : null}
                  action={{ label: stickyAction.label, href: stickyAction.href, icon: "calendar-booking" }}
                  secondary={
                    stickySecondary
                      ? { ...stickySecondary, icon: isRental ? "document" : "chat-bubble" }
                      : null
                  }
                />
              ) : (
                bookingPanel
              )}
            </aside>
          </div>

        {/* The clearance the pinned bar needs is the bar's own measured
            height, and `ListingStickyBar` now ships its own spacer, so the
            hardcoded `5.5rem` that used to stand here (shorter than the bar
            at 390, which is why the tabs painted under it) is gone. */}
        <ListingStickyBar
          variant={isBookable ? "stay" : "rental"}
          priceMinor={listing.priceMinor}
          currency={listing.currency}
          locale={locale}
          perLabel={perLabel}
          action={stickyAction}
          secondary={stickySecondary}
          secondaryIcon={isRental ? "document" : undefined}
          fallbackLabel={listing.title}
          moveInMinor={listing.moveInCostMinor}
          moveInStated={listing.moveInCostStated}
          moveInLabel={t.catalogue.detail.moveInTotal}
          moveInFromLabel={t.catalogue.detail.moveInFrom}
          secondaryShortLabel={t.catalogue.detail.breakdownShort}
          sidePanelFromLg
          stackOnPhone={isVisit}
        />
      </div>
    </PhotoViewerProvider>
  );

  // Only a stay has dates to share, and the provider is what keeps the panel
  // and the sticky bar quoting one number instead of two.
  if (!isBookable) return body;
  return (
    <StayDatesProvider
      today={today}
      blockedDates={blockedDates}
      priceMinor={listing.priceMinor}
      cleaningMinor={listing.cleaningMinor ?? 0}
      serviceMinor={listing.serviceMinor ?? 0}
      capacity={capacityOf(listing)}
      requested={{ checkIn: requested.checkIn, checkOut: requested.checkOut, guests: requested.guests }}
    >
      {body}
    </StayDatesProvider>
  );
}

/**
 * The panel a restaurant of ours gets.
 *
 * The difference between this and a stay is the two things only a first-party
 * listing can have: somebody to message, and a table that can actually be held.
 * A restaurant is priced per head rather than per night, which is the rule
 * `lib/listings/types.ts` already states for this category, and one that has
 * not stated a price shows none rather than a zero.
 */
function RestaurantPanel({
  listing,
  locale,
  messageHref,
  t,
}: {
  listing: Listing;
  locale: Locale;
  messageHref: string;
  /* Its three lines were English literals on every locale (listing page
     upgrade, 13 October 2026); they read the dictionary now. */
  t: ReturnType<typeof getDictionary>;
}) {
  return (
    <div className="nf-panel nf-panel--card isolate p-lg">
      {listing.priceMinor > 0 && (
        <p>
          <Amount
            minorUnits={listing.priceMinor}
            locale={locale}
            currency={listing.currency}
            className="nf-figure leading-none"
            secondaryClassName="text-[length:max(0.54em,0.75rem)] font-semibold opacity-60"
          />
          <span className={`ml-2xs ${TYPE.body}`}>{t.catalogue.card.head}</span>
        </p>
      )}

      <p className={`mt-xs ${TYPE.body}`}>{t.catalogue.detail.restaurantLede}</p>

      <ButtonLink href={messageHref} variant="secondary" full className="mt-md">
        {t.catalogue.detail.message}
      </ButtonLink>

    </div>
  );
}
