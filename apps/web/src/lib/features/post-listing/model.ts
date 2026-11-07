/**
 * PROPERTY-POWERED POSTS, THE PURE HALF (FEED_AND_CIRCLE_BRIEF part 2.2).
 *
 * What a featured listing's card shows, from the listing's own columns and
 * nothing else: the price the listing states with its own period, beds and
 * baths when stated, up to three amenity labels it carries. Never a guessed
 * figure. The read is `readPostListings` in `lib/social/posts-queries.ts`.
 *
 * WHY THIS EXISTS: that read used to select `price_per_night_minor` and
 * `price_period`, two columns `listings` has never had (checked live on
 * 7 November 2026), so it failed, returned nothing, and the listing plate on
 * a post could never render.
 */

export const POST_LISTING_COLUMNS =
  "id, title, area, city, listing_intent, rate_minor, rate_period, rent_amount_minor, rent_period, sale_price_minor, bedrooms, bathrooms, listing_photos ( storage_path, position ), listing_amenities ( amenities ( label ) )";

export type PostListingRow = {
  id: string;
  title: string;
  area: string | null;
  city: string | null;
  listing_intent: string | null;
  rate_minor: number | string | null;
  rate_period: string | null;
  rent_amount_minor: number | string | null;
  rent_period: string | null;
  sale_price_minor: number | string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  listing_photos: { storage_path: string; position: number }[] | null;
  listing_amenities: { amenities: { label: string | null } | { label: string | null }[] | null }[] | null;
};

const RENT_PERIOD: Record<string, string> = { year: "a year", quarter: "a quarter", month: "a month" };
const RATE_PERIOD: Record<string, string> = { night: "a night", guest: "a guest" };

/** The stated price in kobo and the words for its period, or null when the listing states none. */
export function statedPrice(row: PostListingRow): { minor: number; period: string; kind: "property" | "stay" } | null {
  const n = (v: number | string | null) => (v === null || v === undefined ? NaN : Number(v));
  if (row.listing_intent === "sale") {
    const minor = n(row.sale_price_minor);
    return Number.isFinite(minor) && minor > 0 ? { minor, period: "", kind: "property" } : null;
  }
  const rent = n(row.rent_amount_minor);
  if (Number.isFinite(rent) && rent > 0) {
    return { minor: rent, period: RENT_PERIOD[row.rent_period ?? "year"] ?? "a year", kind: "property" };
  }
  const rate = n(row.rate_minor);
  if (Number.isFinite(rate) && rate > 0) {
    return { minor: rate, period: RATE_PERIOD[row.rate_period ?? "night"] ?? "a night", kind: "stay" };
  }
  return null;
}

export function firstPhotoPath(row: PostListingRow): string | null {
  const first = [...(row.listing_photos ?? [])].sort((a, b) => a.position - b.position)[0];
  return first?.storage_path ?? null;
}

export function amenityLabels(row: PostListingRow, max = 3): string[] {
  const out: string[] = [];
  for (const link of row.listing_amenities ?? []) {
    const a = Array.isArray(link.amenities) ? link.amenities[0] : link.amenities;
    const label = a?.label?.trim();
    if (label && !out.includes(label)) out.push(label);
    if (out.length >= max) break;
  }
  return out;
}

export function countOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

/** A listing id from a pasted Vallo link ("https://www.vallospaces.com/listing/<id>") or a bare id; else null. */
export function listingIdFromText(text: string): string | null {
  const match = /(?:^|\/listing\/)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[/?#]|$)/i.exec(text.trim());
  return match ? match[1]!.toLowerCase() : null;
}
