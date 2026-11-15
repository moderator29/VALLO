/** Domain types for discovery results. Shared by every data source. */

import type { ListingRole } from "@/lib/supply/roles";
import type { Compound } from "./compound";
import type { ServiceFacts } from "./service";
import type { UnitFacts, UnitShape } from "./unit-shape";
import type {
  BuildCondition,
  Furnishing,
  LandTenure,
  ListingIntent,
  PricePeriod,
  RentPeriod,
  SaleStatus,
} from "./pricing";

export type {
  BuildCondition,
  Furnishing,
  LandTenure,
  ListingIntent,
  PricePeriod,
  RatePeriod,
  RentPeriod,
  SaleStatus,
} from "./pricing";

export type ListingKind =
  | "hotel"
  | "apartment"
  | "home"
  | "shortlet"
  | "villa"
  | "restaurant"
  | "experience"
  /**
   * Long-term lettings, the serious rent market: annual tenancy, priced per
   * year, no Reserve button. The path is message the agent, inspect, then
   * pay. Distinct from "apartment", which is nightly lodging.
   */
  | "rental"
  /**
   * The commercial and land market. Let on a tenancy exactly like a rental:
   * priced per year, arranged with the agent, inspected before payment, and
   * never reserved by the night.
   */
  | "shop"
  | "office"
  | "land";

/**
 * THERE IS NO PARTNER SHAPE HERE ANY MORE.
 *
 * `PartnerMeta` and `source: "partner"` described third-party stock: Google
 * Places venues and LiteAPI hotels, merged into discovery behind first-party
 * rows, carrying an off-platform booking link instead of an agent to message.
 * All of it is deleted. Every listing on Vallo is listed by a real person on
 * Vallo, which is the only reason the verified badge, escrow and an
 * inspection can mean anything at all.
 *
 * `source` is kept as a single-valued field rather than removed outright
 * because it is the honest name for the answer, and because a future
 * first-party import (an agency onboarding its own book) would be a second
 * value here rather than a second code path.
 */

export type Listing = {
  id: string;
  slug: string;
  /**
   * The code a person reads out over the phone. `VL-` plus six characters.
   *
   * Optional because the database issues it at PUBLISH and never at draft, so
   * a listing genuinely has none until it is live. Every reader treats absent
   * as "not published yet" rather than as a mapping fault.
   */
  reference?: string;
  title: string;
  kind: ListingKind;
  /** Display locality, e.g. "Lekki Phase 1". */
  area: string;
  /** Settlement, e.g. "Lagos". */
  city: string;
  state: string;
  /**
   * `listings.state_code` ("LA"), when the row has one. V-12 reads it to
   * print a state's published fee rule beside the listing's own ratios.
   * Absent on the seed catalogue.
   */
  stateCode?: string;
  /**
   * Where the place actually is, when the source knows.
   *
   * Optional because the source genuinely may not know:
   * `listings.latitude` and `listings.longitude` are nullable columns and the
   * listing wizard does not force a pin. Absent is therefore a real state, not
   * a mapping bug, and every reader has to handle it.
   *
   * `RealMap` still places by area centroid where a pin is missing, so an
   * absent coordinate degrades to an approximate position rather than to no
   * position at all.
   */
  lat?: number;
  lng?: number;
  /**
   * Rate in MINOR UNITS (kobo). Never a float, never naira.
   * 25_000_000 kobo is 250,000 naira. Nightly for stays, per head for
   * restaurants and experiences.
   */
  priceMinor: number;
  /**
   * Charged once per stay, on top of the nightly rate, in kobo.
   *
   * These exist so the breakdown a guest reads BEFORE booking is the same
   * arithmetic `reserve()` does after. They were server-only until now, which
   * meant the panel showed a "Total" that was really the subtotal and then
   * asked for a larger number at checkout. Absent or zero renders no row.
   */
  cleaningMinor?: number;
  serviceMinor?: number;
  currency: "NGN";
  /**
   * What the price covers.
   *
   * Widened from the original "night" | "year" pair because the database now
   * states the cycle rather than inferring it from the category: a rent can be
   * monthly, quarterly or yearly, and a rate can be per night or per head. Every
   * existing reader compares against "year" or falls through to nightly, which
   * stays correct under the wider union.
   *
   * Absent on a listing for sale, where `salePriceMinor` is the figure and there
   * is no period at all.
   */
  pricePeriod?: PricePeriod;
  /**
   * To let, or for sale. The discriminator the whole product turns on.
   *
   * Optional so the seed catalogue, which predates the distinction, still
   * type-checks; absent reads as "rent", which is what every seed row is.
   */
  intent?: ListingIntent;
  /** Asking price in kobo. Present only when `intent` is "sale". */
  salePriceMinor?: number;
  /** The lister will discuss the figure. Rendered as a chip, never as a discount. */
  negotiable?: boolean;
  /**
   * What it actually costs to move in, in kobo, as the lister stated it.
   *
   * THE NUMBER PEOPLE SHOP ON in the Nigerian rent market, where a 4.5m yearly
   * rent routinely means 7m at the door once caution, agency, legal and
   * agreement fees are counted. Absent when the lister named no parts and no
   * total, which the UI renders as unstated rather than as zero.
   */
  moveInCostMinor?: number;
  /** True when `moveInCostMinor` is the lister's own total rather than a sum of parts. */
  moveInCostStated?: boolean;
  cautionDepositMinor?: number;
  serviceChargeMinor?: number;
  serviceChargePeriod?: RentPeriod;
  agencyFeeMinor?: number;
  legalFeeMinor?: number;
  agreementFeeMinor?: number;
  /** Shortest tenancy the lister accepts, in months. */
  minimumTenancyMonths?: number;
  /** ISO date the property can be occupied from. */
  availableFrom?: string;
  /**
   * When the listing went live, as an ISO timestamp (`listings.published_at`).
   * Absent on a row that was never published and on the seed catalogue. Read
   * by the listed age on the card and the page (V-22) and by the Newest sort.
   */
  publishedAt?: string;
  /**
   * When the lister last said it is still available (`listings.lister_confirmed_at`).
   * Absent when they never have. The page says it as "Confirmed available 3
   * days ago" while it is recent (`confirmedAge`).
   */
  listerConfirmedAt?: string;
  /**
   * The compound's five answers (V-28): parking, how many homes share it,
   * whether the landlord lives there, how rubbish leaves, and whether a car
   * gets in. Absent when the lister answered none of them.
   */
  compound?: Compound;
  /** V-68: what the service charge covers, how it is charged, the gate. Absent: unanswered. */
  service?: ServiceFacts;
  /** V-66: the unit's shape, en-suite rooms and BQ. Absent: unanswered. */
  unit?: UnitFacts;
  /** V-41: set by the search page from the flood reads; absent means not judged. */
  floodClear?: boolean;
  furnished?: Furnishing;
  /**
   * WHAT A BUYER ACTUALLY PAYS, in kobo, as the lister stated it.
   *
   * The sale side's twin of `moveInCostMinor` and the five fields under it,
   * and it exists for the same reason with a much bigger number attached: an
   * asking price in Lagos is routinely twenty million naira short of what the
   * buyer has to find by the time the deed is signed, once agency, legal,
   * Governor's consent, stamp duty and registration are counted.
   *
   * ONE DIFFERENCE FROM THE TENANCY MODEL AND IT IS EASY TO GET BACKWARDS:
   * THE ASKING PRICE IS ONE OF THE PARTS. "Total to move in" sits beside the
   * rent; "total to buy" includes the price, because that is the number a
   * buyer has to find.
   *
   * Every one of them is absent rather than zero when the lister declared
   * nothing, because an undeclared cost and a declared zero are different
   * facts and nothing downstream may collapse them.
   */
  purchaseCostMinor?: number;
  /** True when `purchaseCostMinor` is the lister's own total rather than a sum of parts. */
  purchaseCostStated?: boolean;
  saleAgencyFeeMinor?: number;
  saleLegalFeeMinor?: number;
  governorsConsentFeeMinor?: number;
  stampDutyMinor?: number;
  surveyRegistrationFeeMinor?: number;
  /** The title a buyer would be taking. Present on sale listings that state one. */
  tenure?: LandTenure;
  saleStatus?: SaleStatus;
  yearBuilt?: number;
  condition?: BuildCondition;
  /** Floor area in square metres. A decimal, and the only non-integer here. */
  sizeSqm?: number;
  toilets?: number;
  parkingSpaces?: number;
  floor?: number;
  totalFloors?: number;
  /**
   * Walkthrough video URLs, best first. Empty rather than absent when the
   * listing has none, so a reader never has to test for undefined.
   */
  videos?: {
    url: string;
    posterUrl: string | null;
    durationSeconds: number | null;
    /** Its place in the row of photos and videos (lib/listings/media-order.ts). */
    position?: number;
  }[];
  /**
   * When somebody from Vallo stood in the property. Not the same claim as
   * `verified`, which only says the lister was admitted.
   */
  inspectedAt?: string;
  /** When the stated address was checked against the pin. */
  addressVerifiedAt?: string;
  /**
   * THE PROOF STRIP'S INPUTS (V-03). Each is a date a member of staff or a
   * trigger set when something happened, and each is ABSENT, never null or
   * empty, when nothing happened. `lib/trust/proof-strip.ts` prints a line
   * only from a present, parseable date.
   *
   * `listerIdentitySeenAt` is `agent_badges.verified_at`: when the lister's
   * identity rung passed and the published badge turned true. The other two
   * are `listings.ownership_verified_at` and `listings.mandate_verified_at`,
   * which the database refuses to hold at once. None of them is ever carried
   * on an example listing.
   */
  listerIdentitySeenAt?: string;
  ownershipVerifiedAt?: string;
  mandateVerifiedAt?: string;
  /**
   * V-05's aggregate: renters who attended an inspection and answered the
   * truth questions, and how many found the agent and the flat as listed.
   * Absent until at least one renter has answered.
   */
  renterTruth?: { attended: number; asListed: number; lastAt: string };
  /**
   * Where the listing comes from. There is one answer and it is "vallo":
   * inventory listed on this platform by a person on this platform.
   */
  source?: "vallo";
  bedrooms: number;
  bathrooms: number;
  /**
   * How many guests the host says the place takes, when the source states a
   * number. Agent inventory always carries one (`listings.max_guests`, which
   * the wizard collects and a check constraint keeps above zero). The seed
   * catalogue does not, so it is optional and the shared `sleeps` matcher
   * falls back to the two-per-bedroom convention for anything that omits it.
   */
  maxGuests?: number;
  /**
   * Light, water and the gate: the three questions asked here before the
   * price. Absent where the host has not answered, and rendered as unanswered
   * rather than as good news.
   */
  utilities?: {
    powerGrid?: PowerGrid;
    powerBackup?: PowerBackup;
    powerBackupHours?: number;
    waterSupply?: WaterSupply;
    prepaidMeter?: boolean;
    /** True when the host has stored gate details. Never the details themselves. */
    hasEstateAccess: boolean;
  };
  rating: number;
  reviewCount: number;
  verified: boolean;
  /**
   * WHAT THE LISTER IS TO THIS PROPERTY: `listings.listing_role`.
   *
   * The last mile of Track G. The column has been live and not null since
   * Track G migration 3, `LISTING_ROLE_SENTENCE` has held the three sentences
   * since the same day, and `ListerRoleLine` has been mounted on the listing
   * page's agent card waiting for a value. The chain was complete at both ends
   * and broken in the middle: this read never carried the column from the row
   * to the prop, so the three sentences had no way onto a screen. That is the
   * shape of failure this file should be read for - a constant with a test, a
   * component with a test, and nothing joining them.
   *
   * THIS IS NOT A TRUST MARK and nothing may draw it as one. It is what the
   * lister SAID they are to this property, and it stays a claim until a member
   * of staff dates `ownership_verified_at` or `mandate_verified_at` beside it.
   * `verified` above is the checked fact and the two never imply each other.
   *
   * Optional because the type is also satisfied by the seed catalogue and by
   * the external shapes, which have no such column; absent draws no line, which
   * is the same behaviour every reader had before the field existed. Typed as
   * the domain union from `lib/supply/roles.ts` rather than as a loose string,
   * so the three values cannot drift from the three sentences.
   */
  listerRole?: ListingRole;
  /**
   * WHO THAT LISTER IS, BY NAME, AND ONLY WHEN THE SENTENCE NEEDS ONE.
   *
   * `LISTING_ROLE_SENTENCE` carries `{name}` in two of its three sentences:
   * "Listed by {name}, agent" and "Listed by {name}". The owner sentence names
   * nobody on purpose, because the offer IS that there is no intermediary.
   *
   * Until migration `20260923103838` the public read could not fill either
   * one. `public.agents` is RLS-bound to the agent themselves and to staff, so
   * a stranger had no path from `agent_id` to a display name, and `fillLister`
   * correctly refuses to print a template with its placeholder showing. The
   * consequence was that on all 64 live listings, every one of them
   * `listing_role = 'agent'`, the line appeared on zero screens.
   *
   * It is filled from `public.listing_lister`, a published view with exactly
   * two columns, bounded to PUBLISHED listings, which resolves the agent's
   * display name for `agent`, the firm's name for `firm` and NULL for `owner`.
   * Nothing else about a lister travels: not a phone number, an email address,
   * an address, a document number, a user id or a verification tier.
   *
   * THIS IS A NAME AND NOT A CLAIM. It says who, not whether anybody checked
   * them. `verified` is the checked fact and the two never imply each other.
   *
   * Optional, and ABSENT rather than empty when there is no name, because the
   * seed catalogue and the external shapes have no such column and because an
   * explicit `undefined` survives a spread. Absent draws no line.
   */
  listerName?: string;
  /**
   * THE FLAG EVERY SURFACE MUST BRANCH ON.
   *
   * True when this listing illustrates what the catalogue will hold and **no
   * such property is available**. It maps one to one from `listings.is_demo`,
   * which the database defaults to false, so anything that is not explicitly
   * an example is real.
   *
   * What it obliges a surface to do:
   *
   *   1. **Say so, on the card and on the page.** Not in a tooltip, not in a
   *      footnote. The agreed wording is "This is an example listing. No such
   *      property is available. Vallo has not verified anything on this page."
   *      The words "demo", "sample", "preview" and "not live" are banned in UI
   *      copy and are enforced by `tests/agent-identity.spec.mjs`; "example"
   *      is the sanctioned word.
   *   2. **Render no action that implies a transaction.** Book, reserve, pay
   *      and request an inspection must raise an explanation rather than a
   *      flow. The database refuses all four anyway, so a control that appears
   *      to work would produce an error the person cannot act on.
   *   3. **Render no trust mark.** `verified` is already false on every one of
   *      these (see below), so a component that reads `verified` is correct by
   *      construction. A component that draws a badge from anything else must
   *      check this flag.
   *   4. **Stay out of anything that leaves the platform.** No sitemap, no
   *      JSON-LD, no Open Graph card, no email. An example listing indexed by
   *      Google is a fabricated property advertisement carrying our name.
   *
   * `verified` is ALWAYS false when this is true, and that is enforced in three
   * independent places so it cannot drift: a CHECK constraint refusing the
   * three stored trust columns, a trigger refusing a verified lister, and the
   * mapper in `supabase-repository.ts` deriving `verified` from this flag
   * rather than asserting it.
   */
  isDemo: boolean;
  /**
   * Listing stats (founder, 13 November 2026): lifetime views and current
   * saves, attached to the listings a page draws by `withListingStats` in one
   * query for the page. Absent until the pending SQL is applied or when the
   * read failed; a card then draws no count. Never on an example.
   */
  stats?: { views: number; saves: number; shares?: number };
  instantBook: boolean;
  amenities: string[];
  /**
   * Photo URLs, best first. Public CDN imagery until the media pipeline
   * lands; the card falls back to a gradient tile when a photo cannot load.
   */
  photos: string[];
  /** Deterministic hue index for the gradient fallback tile, 0 to 5. */
  hue: number;
};

/**
 * Light and water, as the database spells them.
 *
 * These mirror `public.power_grid`, `public.power_backup` and
 * `public.water_supply` exactly, and they are named here rather than inlined
 * so that the filter, the card, the detail panel and the agent wizard cannot
 * drift into four spellings of the same closed list.
 */
export type PowerGrid = "BAND_A" | "MOSTLY_ON" | "PATCHY" | "RARELY" | "NONE";
export type PowerBackup = "NONE" | "GENERATOR" | "INVERTER" | "SOLAR" | "GENERATOR_INVERTER";
export type WaterSupply = "TREATED_MAINS" | "BOREHOLE" | "PUMPED_STORAGE" | "TANKER" | "NONE";

/** Every water source that is water. `NONE` is an answer, not an option. */
export const WATER_SOURCES: readonly WaterSupply[] = [
  "TREATED_MAINS",
  "BOREHOLE",
  "PUMPED_STORAGE",
  "TANKER",
] as const;

export type ListingSearchFilter = {
  /** Free text matched against title, area, city and state. */
  q?: string;
  /** Restrict results to a single category. */
  kind?: ListingKind;
  /**
   * To let, or for sale. Absent means both, which is the honest default for a
   * marketplace that does all three of renting, buying and selling: somebody
   * who has not said which market they are in should see the whole catalogue.
   */
  intent?: ListingIntent;
  /**
   * Budget floor and ceiling in MINOR UNITS (kobo), matched against
   * `priceMinor` in its own period: per night for stays, per year for rentals,
   * per head for restaurants and experiences. A listing that carries no real
   * price is excluded the moment either bound is asked for, because nothing
   * can promise it fits a budget.
   */
  minPriceMinor?: number;
  maxPriceMinor?: number;
  /** Minimum bedrooms. A place with none never satisfies a bedroom minimum. */
  bedrooms?: number;
  /** Minimum bathrooms, same rule. */
  bathrooms?: number;
  /**
   * Minimum party size the place must take. Judged against the host's declared
   * capacity where there is one, and against the two-per-bedroom convention
   * where there is not. A listing with neither (a restaurant table, an
   * experience) has no capacity to judge and is never excluded by this.
   */
  guests?: number;
  /** Amenity codes that must ALL be present. Same codes the agent flow writes. */
  amenities?: string[];
  /** Only places that can be booked without waiting for an agent to reply. */
  instantBook?: boolean;
  /** Only listings whose owner has passed the verification ladder. */
  verifiedOnly?: boolean;
  /**
   * Hide the example listings.
   *
   * They exist because the catalogue is otherwise empty, and the day real
   * supply arrives somebody will want them gone. That should be a flag rather
   * than a migration, because the decision gets reversed while supply is thin
   * in one city and healthy in another.
   *
   * There is no inverse. "Show me only the examples" would be a discovery
   * surface whose entire content is properties that do not exist.
   */
  excludeDemo?: boolean;
  /**
   * Light and water: the two questions asked here before the price.
   *
   * All three are **strict**, and that is the point rather than an oversight.
   * A listing whose host has not answered is excluded the moment one of these
   * is asked for, because "we do not know" cannot be shown to somebody who
   * asked for a generator. A listing whose host skipped these questions never
   * satisfies one of them, which is correct: nobody but the host can promise a
   * borehole.
   *
   * Because a filter that can only ever return nothing is a dead end, the
   * drawer offers these controls only when the pool in front of the reader
   * actually holds an answer, and the water chips list only the sources
   * present in it. See `FilterDrawer`.
   */
  powerBackup?: boolean;
  /** Only a Band A feeder, the top grid band the discos sell. */
  powerBandA?: boolean;
  /**
   * WHO IS OFFERING IT: the owner directly, an agent, or a registered firm.
   *
   * OR semantics, like `waterSupply` and for the same reason: `listing_role`
   * is one column with one value, so asking for an owner AND a firm as an AND
   * would match nothing, every time, which is not a filter but a trap.
   *
   * STRICT ABOUT SILENCE, like the utility filters. `listings.listing_role` is
   * nullable and a listing that never declared one is excluded the moment this
   * is asked for, because "we do not know who is offering this" cannot be
   * shown to somebody who asked for an owner direct. The supply kind is the
   * whole point of the two-sided platform and a maybe is not an answer to it.
   *
   * The index `(listing_role, listing_intent, state_code, city)` was built for
   * this read in Track G and had nothing querying it until now.
   */
  listerRoles?: ListingRole[];
  /**
   * Water sources, any of which will do. This is the one filter here with OR
   * semantics, because a source is one column with one value: asking for both
   * a borehole and treated mains as an AND would match nothing, every time.
   */
  waterSupply?: WaterSupply[];
  /**
   * V-67: the Property side's shelf. Leaves out everything let by the night
   * or by the head (stays, hotel rooms, tables), which live on the Stays side.
   */
  propertySide?: boolean;
  /** V-28: only listings whose lister said the landlord lives elsewhere. Strict. */
  landlordAway?: boolean;
  /** V-28: only listings whose lister said the parking is inside the compound. Strict. */
  parkingInside?: boolean;
  /** V-68: only listings that are Serviced (diesel, water and security covered). Strict. */
  servicedOnly?: boolean;
  /** V-68: only listings in a gated estate with controlled entry. Strict. */
  gatedEstate?: boolean;
  /**
   * V-65: at most this many months of rent asked for up front (the larger of
   * one rent period and the shortest tenancy). Strict: not a tenancy, no match.
   * On the Rent market the budget bounds above are judged against the cash at
   * the door, see `budgetFigure`.
   */
  maxUpfrontMonths?: number;
  /** V-66: unit shapes, any of which will do. Strict: an unshaped listing matches none. */
  shapes?: UnitShape[];
  /** V-66: a boys' quarters comes with it. Strict. */
  withBq?: boolean;
  /**
   * V-66: areas, ANY of which will do, each matched like the free text (a
   * substring of title, area, city, state or kind). "Yaba/Akoka" in the search
   * box becomes two of these.
   */
  areas?: string[];
  /**
   * V-41: only listings with no flooding reported. Judged on facts the page
   * annotates (`floodClear`), never in the repository's SQL.
   */
  noFlood?: boolean;
};

/**
 * How a search should be answered, as opposed to what it asks for.
 *
 * The distinction is worth keeping: a FILTER is a promise to the reader about
 * which listings they are looking at, and an OPTION is a decision about what it
 * costs to answer them. A filter changes the result set and belongs in the URL.
 * An option changes the query plan and must never change which listings match.
 *
 * This type nearly died. It carried one field, `partners`, which told the
 * repository whether to spend a billed third-party request on top of the
 * database query, and when third-party inventory was deleted it became a shape
 * kept alive purely so existing call sites would still compile.
 *
 * It is load-bearing again, for the two decisions the catalogue read actually
 * has to make about its own cost.
 */
export type ListingSearchOptions = {
  /**
   * How many rows the catalogue read may pull, before the in-memory matcher
   * runs over them.
   *
   * Defaults to the repository's own catalogue limit. Lower it when the caller
   * needs a handful rather than a page: `recommended()` wants six listings and
   * was reading two hundred to find them.
   *
   * THIS IS NOT PAGINATION AND MUST NOT BE PRESENTED AS IT. The matcher runs
   * after the read, so a smaller limit can return fewer matches rather than the
   * same matches in a smaller page. It is a ceiling on cost, safe only where
   * the caller genuinely wants "some good ones" rather than "all of them".
   */
  limit?: number;
  /**
   * WHICH NUMBER THE DATABASE ORDERS ON BEFORE THE CEILING IS APPLIED.
   *
   * "default" is the catalogue's own order: newest first. "move-in"
   * orders on `total_move_in_cost_minor`, cheapest first, which is what
   * `listings_move_in_cost_idx` exists for and which nothing queried before
   * this sort. It matters for the same reason the budget predicate
   * matters: the read has a row ceiling, so ordering afterwards in memory
   * would sort whichever rows the NEWEST-first read happened to return, and a
   * renter asking for the cheapest to move into would be shown the cheapest of
   * the most recent rather than the cheapest.
   *
   * It narrows and orders; it never decides. `sortListings` on the search
   * page still applies the same ordering over the rows that come back, so the
   * two can never disagree, exactly as SQL narrows and `matchesFilter`
   * decides.
   */
  order?: "default" | "move-in" | "newest";
};

export interface ListingRepository {
  /** True when the results carry no pagination cursor behind them. */
  readonly isSeed: boolean;
  recommended(limit?: number): Promise<Listing[]>;
  /** Filtered catalogue lookup for the discovery surface. */
  search(filter?: ListingSearchFilter, opts?: ListingSearchOptions): Promise<Listing[]>;
  /** Single listing lookup for the detail page. Resolves null when unknown. */
  byId(id: string): Promise<Listing | null>;
  /**
   * Single listing lookup by the code a person typed, already canonicalised by
   * `lib/listings/reference.ts`. Resolves null when no PUBLISHED listing
   * carries it, which is also the honest answer for a code that names a draft.
   */
  byReference(reference: string): Promise<Listing | null>;
}
