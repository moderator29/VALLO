import "server-only";

import { searchStays } from "@/lib/stays/search";
import { toStaysHref, type StaysQuery } from "@/lib/stays/query";
import { accommodationPhotoUrl } from "@/lib/stays/photos";
import type { StaySearchRow } from "@/lib/stays/types";
import { nairaToKobo } from "@/lib/listings/search-params";
import type { IntelligenceKind, IntelligenceResult, ResultAction, Understood } from "../contract";
import { bestWindowSimilarity } from "../fuzzy";
import { placeFromLabel } from "../places";
import { catalogueApplies, catalogueMatches, listingResult } from "./listings";
import { compact, matchesAllWords, nairaOf, whyLine } from "./format";
import type { Source, SourceContext, SourcePage } from "./types";

/**
 * STAYS AND RESTAURANTS.
 *
 * Two published reads, merged: the catalogue's nightly listings and tables
 * (`catalogueReader`, see `listings.ts`), and the business-grade hotels,
 * guest houses and venues of the stays projection, through `searchStays`
 * (`public.stays_search`, the same function and the same RLS-bound client the
 * /stays/search page uses; not security definer, published rows only). A
 * dated stay search asks the projection alone, because only it knows which
 * rooms are free on those nights.
 *
 * A row the projection also carries for a catalogue listing is shown once.
 */

/* The projection's lodging kinds, by the category a person names. */
const STAY_TYPE_KINDS: Record<string, string[]> = {
  hotel: ["hotel"],
  shortlet: ["shortlet", "shortlet_operator", "serviced_apartments"],
  apartment: ["apartment", "serviced_apartments"],
  villa: ["villa", "resort"],
  home: ["home", "guest_house"],
};

function staysQueryOf(u: Understood, page = 1): StaysQuery {
  const place = placeFromLabel(u.place);
  return {
    q: u.text,
    radiusM: 5000,
    stateCode: place?.stateCode,
    city: place?.city,
    area: place && !place.isCity ? place.name : undefined,
    checkIn: u.checkIn,
    checkOut: u.checkOut,
    rooms: 1,
    guests: u.guests,
    minPriceMinor: u.minPrice !== undefined ? nairaToKobo(u.minPrice) : undefined,
    maxPriceMinor: u.maxPrice !== undefined ? nairaToKobo(u.maxPrice) : undefined,
    roomCategories: [],
    amenities: u.amenities ?? [],
    breakfast: false,
    freeCancellation: false,
    verified: false,
    sort: "recommended",
    page,
  };
}

/** "See all" on the stays search, with the place, dates, guests and words. */
export function staysSeeAll(u: Understood): string {
  const q = staysQueryOf(u);
  const href = toStaysHref({ ...q, minPriceMinor: undefined, maxPriceMinor: undefined, amenities: [] }, "/stays/search");
  const type = u.listingKinds?.[0];
  if (type && STAY_TYPE_KINDS[type]) return `${href}${href.includes("?") ? "&" : "?"}type=${type}`;
  return href;
}

function rowPhoto(row: StaySearchRow): string | undefined {
  if (!row.cover_path) return undefined;
  return row.cover_path.startsWith("/") || /^https?:\/\//.test(row.cover_path) ? row.cover_path : accommodationPhotoUrl(row.cover_path);
}

function projectionResult(row: StaySearchRow, u: Understood, kind: IntelligenceKind): IntelligenceResult {
  const href = row.entity_kind === "restaurant" ? `/restaurant/${row.entity_id}` : `/stay/${row.entity_id}`;
  const nightly =
    row.nightly_minor !== null && row.nightly_minor > 0
      ? row.nightly_minor
      : row.headline_price_period === "night" && row.headline_price_minor !== null && row.headline_price_minor > 0
        ? row.headline_price_minor
        : null;
  const actions: ResultAction[] = [{ id: "open", label: "Open", href }];
  if (!row.is_demo) actions.push(kind === "restaurant" ? { id: "reserve", label: "Reserve a table", href } : { id: "book", label: "Book", href });
  const where = [row.area, row.city].filter((x, i, all) => x && all.indexOf(x) === i).join(", ");
  return compact({
    key: `${kind}:${row.entity_kind}:${row.entity_id}`,
    kind,
    title: row.title,
    href,
    subtitle: row.is_demo ? "Example listing. Not available." : row.kind.replace(/_/g, " "),
    imageUrl: rowPhoto(row),
    price: nightly !== null && kind === "stay" ? { amount: nairaOf(nightly), per: "night" } : undefined,
    place: where || undefined,
    verified: row.is_demo ? undefined : row.verified,
    why: whyLine(u, { area: row.area ?? undefined, city: row.city ?? undefined, priceNaira: nightly !== null ? nairaOf(nightly) : undefined, amenities: row.amenity_codes }),
    actions,
  });
}

function projectionKeeps(row: StaySearchRow, u: Understood, side: "stay" | "restaurant"): boolean {
  if (side === "restaurant") {
    if (row.entity_kind !== "restaurant" && row.kind !== "restaurant") return false;
  } else {
    if (row.entity_kind === "restaurant" || row.kind === "restaurant") return false;
    /* A catalogue listing in the projection is a stay only when it is let by the night. */
    if (row.entity_kind === "listing" && row.headline_price_period !== "night") return false;
    const kinds = (u.listingKinds ?? []).flatMap((k) => STAY_TYPE_KINDS[k] ?? [k]);
    if (kinds.length > 0 && !kinds.includes(row.kind)) return false;
  }
  /* Strict about silence: the projection does not say whether a room is furnished. */
  if (u.furnished !== undefined) return false;
  const place = placeFromLabel(u.place);
  if (place && !place.isCity && !`${row.area ?? ""} ${row.city ?? ""}`.toLowerCase().includes(place.name.toLowerCase())) return false;
  return true;
}

async function merged(ctx: SourceContext, side: "stay" | "restaurant"): Promise<{ results: IntelligenceResult[]; closestTitle?: string }> {
  const u = ctx.understood;
  const dated = side === "stay" && Boolean(u.checkIn && u.checkOut);
  const [catalogue, projection] = await Promise.all([
    dated ? Promise.resolve({ rows: [], closestTitle: undefined }) : catalogueMatches(u, side, ctx.hints),
    searchStays({
      location: { stateCode: placeFromLabel(u.place)?.stateCode, city: placeFromLabel(u.place)?.city },
      checkIn: u.checkIn,
      checkOut: u.checkOut,
      guests: u.guests,
      priceMin: u.minPrice !== undefined ? nairaToKobo(u.minPrice) : undefined,
      priceMax: u.maxPrice !== undefined ? nairaToKobo(u.maxPrice) : undefined,
      facilities: u.amenities,
      kinds: side === "restaurant" ? ["restaurant"] : dated ? ["listing", "accommodation"] : ["accommodation"],
      limit: 100,
      cursor: null,
      sort: ctx.hints.cheap ? "price-asc" : "recommended",
    }),
  ]);
  const seen = new Set(catalogue.rows.map((l) => l.id));
  const fromCatalogue = catalogue.rows.map((l) => listingResult(l, u, ctx.viewer, side));
  let rows = projection.rows.filter((r) => !seen.has(r.entity_id) && projectionKeeps(r, u, side));
  let closestTitle = catalogue.closestTitle;
  if (u.text) {
    const exact = rows.filter((r) => matchesAllWords(u.text, `${r.title} ${r.area ?? ""} ${r.city ?? ""} ${r.kind.replace(/_/g, " ")}`));
    if (exact.length > 0 || fromCatalogue.length > 0 || u.text.length < 4) rows = exact;
    else {
      rows = rows.filter((r) => bestWindowSimilarity(u.text!, r.title) >= 0.4);
      closestTitle ??= rows[0]?.title;
    }
  }
  return { results: [...fromCatalogue, ...rows.map((r) => projectionResult(r, u, side))], closestTitle };
}

function pageOf(all: IntelligenceResult[], ctx: SourceContext, more: string, closestTitle?: string): SourcePage {
  return { results: all.slice(ctx.offset, ctx.offset + ctx.limit), total: all.length, more, ...(closestTitle ? { closestTitle } : {}) };
}

export const staySource: Source = {
  kind: "stay",
  applies: ({ understood }) => catalogueApplies("stay", understood) && understood.intent !== "buy",
  async run(ctx) {
    const { results, closestTitle } = await merged(ctx, "stay");
    return pageOf(results, ctx, staysSeeAll(ctx.understood), closestTitle);
  },
};

export const restaurantSource: Source = {
  kind: "restaurant",
  applies: ({ understood }) => catalogueApplies("restaurant", understood) && understood.intent !== "buy" && understood.bedrooms === undefined,
  async run(ctx) {
    const { results, closestTitle } = await merged(ctx, "restaurant");
    return pageOf(results, ctx, "/restaurants", closestTitle);
  },
};
