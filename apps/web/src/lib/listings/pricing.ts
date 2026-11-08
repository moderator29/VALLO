/**
 * What a listing costs, resolved once for everybody who has to print it.
 *
 * The database now carries three separate money stories on one row, because
 * they are three separate markets and folding them into one column is what
 * produced `price_per_night_minor` holding annual rent:
 *
 *   RENT      rent_amount_minor per rent_period ('month' | 'quarter' | 'year'),
 *             plus the fee breakdown a Nigerian tenant actually shops on.
 *   RATE      rate_minor per rate_period ('night' | 'guest'). Shortlets and
 *             hotels price per night, a restaurant prices per head. Both are
 *             still listing_intent = 'rent': you are paying for occupancy, not
 *             buying the building.
 *   SALE      sale_price_minor, with tenure and a sale_status.
 *
 * Every surface that prints a headline price (a card, a map pin, the admin
 * queue, the assistant, the agent workspace) has to make the same choice about
 * which of those three applies. It is made here, once, so a card and a map pin
 * can never disagree about what a listing costs.
 *
 * Money is integer kobo throughout. Nothing in this file divides.
 */

import { getDictionary } from "@vallo/i18n";

export type ListingIntent = "rent" | "sale";
export type RentPeriod = "month" | "quarter" | "year";
export type RatePeriod = "night" | "guest";
export type LandTenure =
  | "certificate_of_occupancy"
  | "governors_consent"
  | "deed_of_assignment"
  | "gazette"
  | "freehold"
  | "leasehold";
export type SaleStatus = "available" | "under_offer" | "sold";
export type Furnishing = "unfurnished" | "semi_furnished" | "fully_furnished";
export type BuildCondition = "newly_built" | "renovated" | "old" | "off_plan";

export const LISTING_INTENT_VALUES = ["rent", "sale"] as const;
export const RENT_PERIOD_VALUES = ["month", "quarter", "year"] as const;
export const RATE_PERIOD_VALUES = ["night", "guest"] as const;
export const LAND_TENURE_VALUES = [
  "certificate_of_occupancy",
  "governors_consent",
  "deed_of_assignment",
  "gazette",
  "freehold",
  "leasehold",
] as const;
export const SALE_STATUS_VALUES = ["available", "under_offer", "sold"] as const;
export const FURNISHING_VALUES = ["unfurnished", "semi_furnished", "fully_furnished"] as const;
export const BUILD_CONDITION_VALUES = ["newly_built", "renovated", "old", "off_plan"] as const;

/**
 * Every period a headline price can be quoted in, plus "sale" for the one that
 * is not a period at all. A single union so a reader can switch on it once.
 */
export type PricePeriod = RentPeriod | RatePeriod;

/** What one listing's headline price is, and what unit it is quoted in. */
export type Headline =
  | { kind: "rent"; minor: number; period: RentPeriod }
  | { kind: "rate"; minor: number; period: RatePeriod }
  | { kind: "sale"; minor: number };

/** The columns `headlinePrice` needs, named exactly as Postgres spells them. */
export type PriceColumns = {
  listing_intent: string | null;
  rent_amount_minor: number | null;
  rent_period: string | null;
  rate_minor: number | null;
  rate_period: string | null;
  sale_price_minor: number | null;
};

function asRentPeriod(value: string | null | undefined): RentPeriod {
  return value === "month" || value === "quarter" ? value : "year";
}

function asRatePeriod(value: string | null | undefined): RatePeriod {
  return value === "guest" ? "guest" : "night";
}

/**
 * The one number a listing leads with.
 *
 * Order of resolution, and why:
 *
 *   1. A sale leads with its asking price. Nothing else on the row can stand in
 *      for it: a property for sale has no rent and no nightly rate.
 *   2. A rate, when one is set. rate_minor is the renamed `price_per_night_minor`
 *      and stays authoritative for nightly and per-head inventory. It is checked
 *      before rent because a shortlet may legitimately carry both (a flat let by
 *      the night that the owner would also let annually), and the nightly figure
 *      is the one a shortlet card means.
 *   3. Otherwise the rent, in whatever cycle the lister stated.
 *
 * Never returns null. A listing with nothing set answers zero, and a zero
 * headline is a real answer the UI renders as "price on request" rather than a
 * blank where a number should be.
 */
export function headlinePrice(row: PriceColumns): Headline {
  if (row.listing_intent === "sale") {
    return { kind: "sale", minor: Number(row.sale_price_minor ?? 0) };
  }
  const rate = Number(row.rate_minor ?? 0);
  if (rate > 0) {
    return { kind: "rate", minor: rate, period: asRatePeriod(row.rate_period) };
  }
  const rent = Number(row.rent_amount_minor ?? 0);
  if (rent > 0) {
    return { kind: "rent", minor: rent, period: asRentPeriod(row.rent_period) };
  }
  // Nothing stated. A rent listing with no figure is a draft somebody has not
  // finished, and the gate refuses to publish it, but a reader of this function
  // still needs a shape rather than a null.
  return { kind: "rent", minor: 0, period: asRentPeriod(row.rent_period) };
}

/**
 * A tenancy: rent by the month, quarter or year. ONE PREDICATE for every
 * surface that has to tell a tenancy from a stay (the rent market, the card's
 * Message agent, the listing page's move-in lead, the modest examples), so
 * they cannot drift into four different answers.
 *
 * It reads the resolved period, which `headlinePrice` derives from ONE
 * column: a row with a positive `rate_minor` is a rate (a night or a head),
 * anything else not for sale is a rent. The SQL half of the rent market reads
 * the same column (`rate_minor` null or zero), so the shelf, the drawer's
 * count and the saved-search alerts all ask the same question.
 */
export function isTenancyPeriod(period: PricePeriod | undefined): boolean {
  return period === "year" || period === "month" || period === "quarter";
}

/** The unit a headline is quoted in, flattened for callers that only need one. */
export function headlinePeriod(headline: Headline): PricePeriod | "sale" {
  return headline.kind === "sale" ? "sale" : headline.period;
}

/**
 * The words that follow a figure. "per year", "per night", "asking price".
 *
 * ENGLISH, AND ONLY FOR STAFF. The admin desk (`app/admin/listings`,
 * `lib/admin/queries.ts`) reads this map; every member surface reads the same
 * words in the reader's language from `t.agentListings.pricing.period`
 * (typed `PeriodWords` below). `pricing.test.ts` pins the two together, so
 * the English cannot drift apart.
 */
/** SW11: source of truth is now `packages/i18n/src/locales/listings-labels.en.ts`. */
const _ll = getDictionary("en").listingsLabels;
export const PERIOD_SUFFIX: PeriodWords = _ll.periodSuffix as PeriodWords;

/**
 * The words after a figure, one per period plus "sale", from the reader's
 * dictionary: `t.agentListings.pricing.period` (long, "per year"),
 * `t.experienceLabels.periodShort` (a card or a map pin, "/yr", typed
 * `PeriodSlashWords` because, like the slash set, it has no "sale").
 */
export type PeriodWords = Record<PricePeriod | "sale", string>;

/**
 * The booking panels' own style, with the slash: "₦450,000 / night", from
 * `t.experienceLabels.periodSlash`.
 *
 * A third set rather than a clever join, because neither of the two above
 * produces it: the long words have no slash and the short ones abbreviate.
 * Both panels were hardcoding their string instead, which is how
 * `RentalPanel` came to print "/ year" over a listing the row said was priced
 * monthly.
 *
 * "sale" is absent on purpose. An asking price divided by nothing is not a
 * rate and there is no unit to put after the slash; a sale never reaches a
 * panel that uses this.
 */
export type PeriodSlashWords = Record<PricePeriod, string>;

/**
 * One period, as the noun you would count. "2 years", "3 months".
 *
 * Singular here; `plural` in the i18n package puts the s on. Used by the
 * tenancy control, where the reader is choosing how many of these they want.
 */
export const PERIOD_NOUN: Record<RentPeriod, string> = {
  month: "month",
  quarter: "quarter",
  year: "year",
};

export const RENT_PERIOD_LABEL: Record<RentPeriod, string> = _ll.rentPeriodLabel as Record<RentPeriod, string>;

export const TENURE_LABEL: Record<LandTenure, string> = _ll.tenureLabel as Record<LandTenure, string>;

export const SALE_STATUS_LABEL: Record<SaleStatus, string> = _ll.saleStatusLabel as Record<SaleStatus, string>;

/** `listings.furnished` and `listings.build_condition` as words: `t.experienceLabels.furnishing` and `.condition`. */
export type FurnishingWords = Record<Furnishing, string>;
export type ConditionWords = Record<BuildCondition, string>;

/**
 * The parts of what it costs to move in, in the order a tenant meets them.
 *
 * Kept as an ordered list rather than an object so the breakdown renders in one
 * fixed order everywhere, and so a part nobody stated is simply absent rather
 * than printed as zero. A stated zero and an unstated fee are different facts:
 * "no agency fee" is a selling point, "we did not say" is not.
 */
export type MoveInPart = { key: string; label: string; minor: number };

export type MoveInColumns = {
  rent_amount_minor: number | null;
  rent_period: string | null;
  caution_deposit_minor: number | null;
  service_charge_minor: number | null;
  service_charge_period: string | null;
  agency_fee_minor: number | null;
  legal_fee_minor: number | null;
  agreement_fee_minor: number | null;
  total_move_in_cost_minor: number | null;
};

export function moveInParts(row: MoveInColumns): MoveInPart[] {
  const parts: MoveInPart[] = [];
  const push = (key: string, label: string, value: number | null) => {
    if (value === null || value === undefined) return;
    parts.push({ key, label, minor: Number(value) });
  };
  push("rent", `Rent (${RENT_PERIOD_LABEL[asRentPeriod(row.rent_period)].toLowerCase()})`, row.rent_amount_minor);
  push("caution", "Caution deposit", row.caution_deposit_minor);
  push(
    "service",
    row.service_charge_period
      ? `Service charge (${RENT_PERIOD_LABEL[asRentPeriod(row.service_charge_period)].toLowerCase()})`
      : "Service charge",
    row.service_charge_minor,
  );
  push("agency", "Agency fee", row.agency_fee_minor);
  push("legal", "Legal fee", row.legal_fee_minor);
  push("agreement", "Agreement fee", row.agreement_fee_minor);
  return parts;
}

/**
 * The total a tenant has to find, as the lister stated it.
 *
 * Never recomputed from the parts. The database holds
 * `total_move_in_cost_minor` at or above the sum of whatever parts were named,
 * precisely because agents fold fees into each other and a derived sum would
 * invent a breakdown nobody quoted. When the lister stated no total, the sum of
 * the named parts is the honest floor, and the caller is told which of the two
 * it received so it can say "from" rather than a flat figure.
 */
export function moveInTotal(row: MoveInColumns): { minor: number; stated: boolean } {
  if (row.total_move_in_cost_minor !== null && row.total_move_in_cost_minor !== undefined) {
    return { minor: Number(row.total_move_in_cost_minor), stated: true };
  }
  const sum = moveInParts(row).reduce((total, part) => total + part.minor, 0);
  return { minor: sum, stated: false };
}

/* ------------------------------------------------------- what a buyer pays

   The sale side's twin of the block above, and the reason it exists is the
   same one with a bigger number attached. A hundred and eighty million naira
   asking price in Lagos is routinely two hundred million by the time the deed
   is signed: agency and legal are conventionally five per cent each, and
   Governor's consent, stamp duty and registration run to several per cent
   more of the value of the land. None of it was collected until now.

   ONE DIFFERENCE FROM THE TENANCY MODEL, AND IT MATTERS. The price is one of
   the parts here. "Total to move in" is a figure beside the rent; "total to
   buy" INCLUDES the asking price, because that is what a buyer has to find.
   -------------------------------------------------------------------------- */

export type PurchaseColumns = {
  sale_price_minor: number | null;
  sale_agency_fee_minor: number | null;
  sale_legal_fee_minor: number | null;
  governors_consent_fee_minor: number | null;
  stamp_duty_minor: number | null;
  survey_registration_fee_minor: number | null;
  total_purchase_cost_minor: number | null;
};

export function purchaseParts(row: PurchaseColumns): MoveInPart[] {
  const parts: MoveInPart[] = [];
  const push = (key: string, label: string, value: number | null) => {
    if (value === null || value === undefined) return;
    parts.push({ key, label, minor: Number(value) });
  };
  push("price", "Asking price", row.sale_price_minor);
  push("agency", "Agency fee", row.sale_agency_fee_minor);
  push("legal", "Legal fee", row.sale_legal_fee_minor);
  push("consent", "Governor's consent", row.governors_consent_fee_minor);
  push("stamp", "Stamp duty", row.stamp_duty_minor);
  push("registration", "Survey and registration", row.survey_registration_fee_minor);
  return parts;
}

/**
 * Everything a buyer has to find, as the lister stated it.
 *
 * Never recomputed from the parts when a total was given, for the reason
 * `moveInTotal` states: sellers fold these into each other, so a derived sum
 * would invent a breakdown nobody quoted. When no total was stated, the sum of
 * the named parts is the honest floor and the caller is told which of the two
 * it received so it can say "from" rather than a flat figure.
 */
export function purchaseTotal(row: PurchaseColumns): { minor: number; stated: boolean } {
  if (row.total_purchase_cost_minor !== null && row.total_purchase_cost_minor !== undefined) {
    return { minor: Number(row.total_purchase_cost_minor), stated: true };
  }
  const sum = purchaseParts(row).reduce((total, part) => total + part.minor, 0);
  return { minor: sum, stated: false };
}
