import "server-only";

import { catalogueReader } from "@/lib/catalogue/listings";
import { hrefForListing, marketFactsOf } from "@/lib/listings/href";
import { marketOf, type ListingMarket } from "@/lib/listings/market";
import { makeOfferHref } from "@/lib/offers/routes";
import { nairaToKobo, parseDiscoveryQuery, toSearchHref, KIND_NOUN } from "@/lib/listings/search-params";
import type { Listing, ListingKind, ListingSearchFilter } from "@/lib/listings/types";
import type { IntelligenceKind, IntelligenceResult, ResultAction, Understood } from "../contract";
import { bestWindowSimilarity } from "../fuzzy";
import { placeFromLabel } from "../places";
import type { Viewer } from "../viewer";
import { compact, matchesAllWords, nairaOf, whyLine } from "./format";
import type { Source, SourceContext, SourcePage } from "./types";

/**
 * HOMES, STAYS AND TABLES FROM THE PUBLISHED CATALOGUE.
 *
 * Read through `catalogueReader()`, the public-read path every catalogue page
 * uses: an anonymous client, `status = 'PUBLISHED'`, public columns only, kept
 * for a minute in the shared cache. So a member and a visitor are shown the
 * same rows, and an owner's draft or an admin's queue can never appear here
 * whoever is asking.
 *
 * The structured filters go to the repository (SQL narrows, and the same
 * `matchesFilter` the search page uses is the authority); the words are
 * matched here, every word against title, area, city and kind, and, when no
 * row has them all, by trigram similarity to the title, so a misspelled title
 * still finds its listing and the closest title is offered as "Did you mean".
 *
 * Example listings (`isDemo`) are shown as the search page shows them: said to
 * be examples, with no trust mark and no action but opening them.
 */

/** Which side of the product a listing belongs to, from its own data. */
export function sideOf(listing: Listing): IntelligenceKind {
  const market: ListingMarket = marketOf({ kind: listing.kind, ...marketFactsOf(listing) });
  if (market === "dining") return "restaurant";
  if (market === "stay") return "stay";
  return "property";
}

/** The marketplace filter for what was understood. Text is matched by the caller. */
export function listingFilter(u: Understood, side: IntelligenceKind): ListingSearchFilter {
  const filter: ListingSearchFilter = {};
  if (side === "property") filter.propertySide = true;
  if (side === "property" && u.intent === "buy") filter.intent = "sale";
  if (side === "property" && u.intent === "rent") filter.intent = "rent";
  const kinds = (u.listingKinds ?? []).filter((k): k is ListingKind => k in KIND_NOUN);
  if (kinds.length === 1) filter.kind = kinds[0];
  if (u.bedrooms !== undefined && side !== "restaurant") filter.bedrooms = u.bedrooms;
  if (u.maxPrice !== undefined) filter.maxPriceMinor = nairaToKobo(u.maxPrice);
  if (u.minPrice !== undefined) filter.minPriceMinor = nairaToKobo(u.minPrice);
  if (u.amenities && u.amenities.length > 0) filter.amenities = u.amenities;
  if (u.guests !== undefined && side === "stay") filter.guests = u.guests;
  const place = placeFromLabel(u.place);
  if (place) filter.areas = [place.name.toLowerCase()];
  return filter;
}

function haystack(l: Listing): string {
  return `${l.title} ${l.area} ${l.city} ${l.state} ${KIND_NOUN[l.kind]?.one ?? ""} ${KIND_NOUN[l.kind]?.many ?? ""}`;
}

function furnishedOf(l: Listing): boolean | undefined {
  if (l.furnished === "fully_furnished" || l.furnished === "semi_furnished") return true;
  if (l.furnished === "unfurnished") return false;
  return undefined;
}

/** The headline price as the contract carries it, or nothing when the unit has no plain name. */
export function priceOf(l: Listing): IntelligenceResult["price"] {
  if (l.intent === "sale") {
    const minor = l.salePriceMinor ?? l.priceMinor;
    return minor > 0 ? { amount: nairaOf(minor), per: "once" } : undefined;
  }
  if (!(l.priceMinor > 0)) return undefined;
  if (l.pricePeriod === "night") return { amount: nairaOf(l.priceMinor), per: "night" };
  if (l.pricePeriod === "month") return { amount: nairaOf(l.priceMinor), per: "month" };
  if (l.pricePeriod === "year") return { amount: nairaOf(l.priceMinor), per: "year" };
  return undefined;
}

export function listingResult(l: Listing, u: Understood, viewer: Viewer, kind: IntelligenceKind): IntelligenceResult {
  const href = hrefForListing(l.kind, l.id, marketFactsOf(l));
  const actions: ResultAction[] = [{ id: "open", label: "Open", href }];
  if (!l.isDemo) {
    if (viewer.signedIn) actions.push({ id: "save", label: "Save" });
    if (kind === "property" && l.intent === "sale") actions.push({ id: "offer", label: "Make an offer", href: makeOfferHref(l.id) });
    if (kind === "stay") actions.push({ id: "book", label: "Book", href });
    if (kind === "restaurant") actions.push({ id: "reserve", label: "Reserve a table", href });
  }
  const price = priceOf(l);
  const where = [l.area, l.city].filter((x, i, all) => x && all.indexOf(x) === i).join(", ");
  return compact({
    key: `${kind}:${l.id}`,
    kind,
    title: l.title,
    href,
    subtitle: l.isDemo ? "Example listing. Not available." : `${KIND_NOUN[l.kind]?.one ?? l.kind}${l.intent === "sale" ? " for sale" : ""}`,
    imageUrl: l.photos[0],
    price,
    place: where || undefined,
    bedrooms: kind !== "restaurant" && l.bedrooms > 0 ? l.bedrooms : undefined,
    verified: l.isDemo ? undefined : l.verified,
    why: whyLine(u, {
      bedrooms: l.bedrooms,
      area: l.area,
      city: l.city,
      priceNaira: price?.amount,
      furnished: furnishedOf(l),
      amenities: l.amenities,
    }),
    actions,
  });
}

/** "See all" on /search, carrying what was understood in its own address contract. */
export function propertySeeAll(u: Understood): string {
  const raw: Record<string, string> = {};
  if (u.text) raw.q = u.text;
  const kinds = (u.listingKinds ?? []).filter((k) => k in KIND_NOUN);
  if (kinds.length === 1) raw.type = kinds[0]!;
  if (u.maxPrice !== undefined) raw.max = String(u.maxPrice);
  if (u.minPrice !== undefined) raw.min = String(u.minPrice);
  if (u.bedrooms !== undefined) raw.beds = String(u.bedrooms);
  if (u.amenities && u.amenities.length > 0) raw.amenities = u.amenities.join(",");
  const place = placeFromLabel(u.place);
  if (place) raw.area = place.name.toLowerCase();
  const href = toSearchHref(parseDiscoveryQuery(raw));
  if (u.intent !== "buy" && u.intent !== "rent") return href;
  return `${href}${href.includes("?") ? "&" : "?"}market=${u.intent === "buy" ? "buy" : "rent"}`;
}

type Scored = { listing: Listing; score: number };

/**
 * The catalogue rows of one side that meet every filter and the words. When
 * no row carries every word, the closest titles by trigram similarity are
 * returned instead, and the best of them is offered as "Did you mean".
 */
export async function catalogueMatches(
  u: Understood,
  side: IntelligenceKind,
  opts: { cheap?: boolean; newest?: boolean } = {},
): Promise<{ rows: Listing[]; closestTitle?: string }> {
  const filter = listingFilter(u, side);
  const kinds = new Set((u.listingKinds ?? []).filter((k) => k in KIND_NOUN));
  const read = await catalogueReader().search(filter);
  const sided = read.filter((l) => sideOf(l) === side && (kinds.size <= 1 || kinds.has(l.kind)));
  const filtered = sided.filter((l) => {
    if (u.furnished !== undefined && furnishedOf(l) !== u.furnished) return false;
    if (u.addedSince && !(l.publishedAt && l.publishedAt.slice(0, 10) >= u.addedSince)) return false;
    return true;
  });

  let scored: Scored[] = filtered.filter((l) => matchesAllWords(u.text, haystack(l))).map((listing) => ({ listing, score: 1 }));
  let closestTitle: string | undefined;
  if (scored.length === 0 && u.text && u.text.length >= 4) {
    scored = filtered
      .map((listing) => ({ listing, score: bestWindowSimilarity(u.text!, listing.title) }))
      .filter((s) => s.score >= 0.4)
      .sort((a, b) => b.score - a.score);
    if (scored[0]) closestTitle = scored[0].listing.title;
  }

  const rows = scored.map((s) => s.listing);
  const priceKey = (l: Listing) => (l.intent === "sale" ? (l.salePriceMinor ?? l.priceMinor) : l.priceMinor) || Number.MAX_SAFE_INTEGER;
  if (opts.cheap) rows.sort((a, b) => priceKey(a) - priceKey(b));
  else if (opts.newest) rows.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  /* Real listings before examples, keeping the order inside each. */
  rows.sort((a, b) => Number(a.isDemo) - Number(b.isDemo));
  return { rows, closestTitle };
}

function pageOf(rows: IntelligenceResult[], ctx: SourceContext, more: string, closestTitle?: string): SourcePage {
  return { results: rows.slice(ctx.offset, ctx.offset + ctx.limit), total: rows.length, more, ...(closestTitle ? { closestTitle } : {}) };
}

/**
 * Whether a catalogue source has something to say when the words point at
 * ANOTHER kind: only when something narrows it (a place, words, an amenity,
 * dates). Otherwise "a restaurant for dinner" would list every home.
 */
export function catalogueApplies(own: IntelligenceKind, u: Understood): boolean {
  if (u.kind === own) return true;
  if (u.kind !== undefined && !["place", "property", "stay", "restaurant", "roommate"].includes(u.kind)) return false;
  return Boolean(u.place || u.text || (u.amenities && u.amenities.length > 0) || u.checkIn || u.addedSince || u.kind === undefined);
}

export const propertySource: Source = {
  kind: "property",
  applies: ({ understood }) => catalogueApplies("property", understood),
  async run(ctx) {
    const { rows, closestTitle } = await catalogueMatches(ctx.understood, "property", ctx.hints);
    return pageOf(
      rows.map((l) => listingResult(l, ctx.understood, ctx.viewer, "property")),
      ctx,
      propertySeeAll(ctx.understood),
      closestTitle,
    );
  },
};
