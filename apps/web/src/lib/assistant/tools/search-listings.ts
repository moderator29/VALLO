import { z } from "zod";
import { getListingRepository } from "@/lib/listings/repository";
import type { Listing, ListingKind } from "@/lib/listings/types";
/*
 * THE SIDE LAW, FROM THE ONE PLACE THAT DECIDES IT.
 *
 * Both href call sites (here and in compare_listings) used to hardcode
 * `/listing/<id>` for every row the catalogue returned, so every hotel,
 * shortlet, villa and restaurant the concierge found opened in the PROPERTY
 * shell: property dock, property chrome, and a Book Inspection footer under a
 * room sold by the night (R2-3, R3 F-03). `lib/listings/href.ts` already
 * answers this for `ListingCard`, and the answer is a function of `kind` and
 * nothing else, so the assistant imports it rather than carrying a second copy
 * that can drift.
 */
import { hrefForListing, marketFactsOf } from "@/lib/listings/href";
import type { AssistantListingItem } from "../types";
import { priceLine } from "./listing-facts";
import { defineTool, TOOL_FRAMES } from "./types";

/**
 * Every market the model may search, named for it.
 *
 * This is the full `ListingKind` union rather than a subset. It used to omit
 * shop, office and land, which meant somebody asking the concierge for a plot
 * in Epe or a shop in Aba got a search with no category on it and whatever the
 * free text happened to catch. Those three are the commercial and land market
 * and they are exactly the ones a person cannot browse casually, so they are
 * the ones an assistant is most useful for.
 */
export const LISTING_KINDS = [
  "rental",
  "apartment",
  "home",
  "shortlet",
  "villa",
  "hotel",
  "restaurant",
  "experience",
  "shop",
  "office",
  "land",
] as const satisfies readonly ListingKind[];

/**
 * Written as an instruction rather than as data, because the model has to do
 * something specific with it and "example: true" on a row invites paraphrase.
 * Sent as the fence's `note`, outside `data`.
 *
 * FOUNDER, 26 NOVEMBER 2026: the assistant finds the examples the same way
 * VALLO Intelligence does, and says they are examples every time.
 *
 * What changed and why. This tool used to pass `excludeDemo: true` and hand
 * the model nothing at all, with a note forbidding it to describe any of
 * them. That was right while the examples were the only thing in the
 * catalogue and the risk was a recommendation nobody could act on. It reads
 * differently now: the search page, the map, every city page and
 * Intelligence all show these rows, labelled, and the assistant alone
 * answered "I found nothing" to a question whose answer is visibly on the
 * screen beside it. Being the one surface that pretends the catalogue is bare
 * is its own kind of dishonesty.
 *
 * So the rows come back, and the fence does the work the exclusion used to:
 * the model is told, on every reply that carries one, what an example is and
 * what it cannot do. A real listing still outranks every example (see the
 * sort below), so an example is never shown in place of something real.
 */
export const EXAMPLE_NOTE =
  "Some rows in this result are marked \"example\": true. Those are example listings Vallo publishes to show what a listing looks like while real supply is being recruited. SAY SO, in your own words, for every example you mention: it is an example, no such property is available, and it cannot be rented, booked, inspected or paid for. Never present one as available, never invite the person to book, visit or make an offer on one, and never imply Vallo has checked it. You may name it, say where it is and what it costs, because the person can see all of that on the listing itself; what you may not do is let them think it is real. Rows without the flag are real listings, and those come first.";

/**
 * Nothing real matched and nothing was shown, not even an example. Kept
 * separate from EXAMPLE_NOTE because the honest answer here is simply that
 * the search was too narrow.
 */
export const NO_MATCH_NOTE = "No listings matched. Suggest widening the search.";

const input = z.object({
  query: z.string().optional(),
  city: z.string().optional(),
  kind: z.enum(LISTING_KINDS).optional(),
  maxPricePerNightNaira: z.number().optional(),
  bedrooms: z.number().optional(),
});

/** Run the catalogue search server-side; the model only ever sees real rows. */
export async function runListingSearch(raw: z.output<typeof input>): Promise<{
  items: AssistantListingItem[];
  forModel: Omit<AssistantListingItem, "photo">[];
  /** True when any row being handed to the model is an example listing. */
  hasExample: boolean;
}> {
  const repo = getListingRepository();

  const query = raw.query?.trim() ? raw.query.trim() : undefined;
  const city = raw.city?.trim() ? raw.city.trim().toLowerCase() : undefined;
  const kind: ListingKind | undefined = raw.kind;
  const maxNaira =
    raw.maxPricePerNightNaira !== undefined && Number.isFinite(raw.maxPricePerNightNaira)
      ? raw.maxPricePerNightNaira
      : undefined;
  const bedrooms = raw.bedrooms !== undefined && Number.isFinite(raw.bedrooms) ? raw.bedrooms : undefined;

  const narrow = (rows: Listing[]): Listing[] =>
    rows.filter((l) => {
      if (city && !l.city.toLowerCase().includes(city) && !l.state.toLowerCase().includes(city)) {
        return false;
      }
      if (maxNaira !== undefined) {
        /* Zero is "we were not told", not "free", so an unpriced listing is
           not an answer to a budget question. This is the same ruling
           `matchesFacts` already makes for the search page, said here because
           this filter is hand written rather than shared. */
        if (l.priceMinor <= 0) return false;
        if (l.priceMinor > Math.round(maxNaira * 100)) return false;
      }
      if (bedrooms !== undefined && l.bedrooms < bedrooms) return false;
      return true;
    });

  /*
   * The same rows Intelligence reads, examples included. `excludeDemo` is
   * deliberately not passed: see EXAMPLE_NOTE above for the reversal and the
   * reasoning. The publication surfaces that must still exclude them do, and
   * each says so where it does it: the sitemap and the Open Graph card
   * through SYNDICATION_FILTER, saved-search alerts through
   * lib/saved/search-alerts, and the assistant's own "from your saves"
   * suggestions through lib/assistant/tools/saved, because suggesting one
   * unasked is recommending it.
   */
  let rows = narrow(await repo.search({ q: query, kind }));
  if (rows.length === 0 && query) {
    // Free text over-restricted; keep the structured filters and drop it.
    rows = narrow(await repo.search({ kind }));
  }

  /*
   * A REAL LISTING IS NEVER PUSHED DOWN BY AN EXAMPLE, whatever either is
   * rated. An example carries no reviews, so on rating alone it would sort
   * below anything real anyway; stating it as the first key means that stays
   * true if an example ever gains a rating, and means the five rows the model
   * sees are the five best real ones before any example is offered at all.
   */
  const top = rows
    .sort(
      (a, b) =>
        Number(a.isDemo) - Number(b.isDemo) ||
        b.rating - a.rating ||
        b.reviewCount - a.reviewCount,
    )
    .slice(0, 5);

  /*
   * What the model is given about each place.
   *
   * This used to be seven fields, and the concierge could therefore only ever
   * say "here is a hotel in Lagos for this much, rated 4.4". Everything that
   * makes an answer worth reading was sitting on the row and being dropped:
   * which part of the city it is in, how many people that rating is built on,
   * whether it is open right now, whether anybody here has checked it, and
   * where the facts came from.
   *
   * Every field below is read off a real row and none is inferred. Absent
   * values are OMITTED rather than sent as nulls or empty strings, because a
   * key with nothing behind it invites a model to describe the nothing.
   */
  const forModel = top.map((l) => ({
    id: l.id,
    title: l.title,
    /* Area first: "Victoria Island, Lagos" is an answer, "Lagos" is a
       postcode. It is the single most useful thing we were throwing away. */
    ...(l.area && l.area !== l.city ? { area: l.area } : {}),
    city: l.city,
    state: l.state,
    kind: l.kind,
    price: priceLine(l),
    rating: l.rating,
    /* A rating with no count behind it is not evidence. 4.9 from two people
       and 4.4 from twelve hundred are different claims, and the model cannot
       weigh them without this. */
    reviewCount: l.reviewCount,
    /* The three facts the result card shows under the price, each read off
       the row and omitted when the lister stated nothing: a zero bedroom
       count on a restaurant is "does not apply", not a fact. */
    ...(l.bedrooms > 0 ? { bedrooms: l.bedrooms } : {}),
    ...(l.bathrooms > 0 ? { bathrooms: l.bathrooms } : {}),
    ...(l.sizeSqm !== undefined && l.sizeSqm > 0 ? { sizeSqm: l.sizeSqm } : {}),
    /* Facts the source actually stated: "Open now", "Hotel", light and water
       where a first-party host answered. Never a guess. */
    ...(l.amenities.length > 0 ? { facts: l.amenities.slice(0, 6) } : {}),
    /*
     * How far up the ladder the person behind this listing has climbed.
     *
     * This used to also carry a provenance field, because discovery held
     * third-party stock that nobody at Vallo had checked and the model had to
     * be able to say so. There is no third-party stock any more: every row
     * here was listed by a person on this platform, so the only question left
     * is how much of that person we have verified, which is what this flag
     * answers.
     */
    verified: l.verified,
    /* UX-25: an example says so, so the model can say it too. */
    ...(l.isDemo ? { example: true } : {}),
    href: hrefForListing(l.kind, l.id, marketFactsOf(l)),
  }));
  const items: AssistantListingItem[] = forModel.map((entry, i) => {
    const photo = top[i]?.photos[0];
    return photo ? { ...entry, photo } : { ...entry };
  });
  return { items, forModel, hasExample: top.some((l) => l.isDemo) };
}

export const searchListingsTool = defineTool({
  name: "search_listings",
  description:
    "Search Vallo's catalogue of property listed by people on Vallo: rentals, property for sale, land, shops and offices, and shortlets, hotels and homes let by their owners, across Nigeria. Nothing comes from an outside feed. Real listings come first; a row marked \"example\": true is one Vallo publishes to show what a listing looks like, cannot be rented, bought, booked or inspected, and you say so every time you mention one. Returns up to five listings with formatted naira prices, ratings and in-app links. Always call this before recommending any property.",
  input,
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Free text matched against title, area, city and state.",
      },
      city: {
        type: "string",
        description:
          "Restrict to one city, e.g. Lagos, Abuja, Port Harcourt, Ibadan, Enugu or Calabar.",
      },
      kind: {
        type: "string",
        enum: [...LISTING_KINDS],
        description:
          "Restrict to one category. Use rental for annual and monthly tenancies, land for plots, shop and office for commercial space, and shortlet for a place let by the night.",
      },
      maxPricePerNightNaira: {
        type: "number",
        description:
          "Upper price bound in naira, in whatever period the listing is priced by: per year for a tenancy, per night for a shortlet. This bounds the rent or asking price alone and does not account for caution deposit, agency, legal or agreement fees.",
      },
      bedrooms: {
        type: "number",
        description: "Minimum number of bedrooms.",
      },
    },
    additionalProperties: false,
  },
  mode: "read",
  workspaces: TOOL_FRAMES,
  async run(_ctx, args) {
    const { items, forModel, hasExample } = await runListingSearch(args);
    if (forModel.length > 0) {
      /* The note rides along whenever an example is in the result, not only
         when the whole result is examples: the model is never left to
         remember a caveat about a row it was handed. */
      return hasExample
        ? { data: forModel, note: EXAMPLE_NOTE, listings: items }
        : { data: forModel, listings: items };
    }
    return { data: { results: [] }, note: NO_MATCH_NOTE, listings: items };
  },
});
