import "server-only";

import { readCountedReviews } from "../reviews/weight";
import type { SupabaseClient } from "@supabase/supabase-js";
import { memo } from "../cache/memo";
import { honestExamplePhotos } from "./example-imagery";
import { rentMeansTenancy } from "./filter";
import { COMPOUND_BY_ID_COLUMNS, readCompound, type Compound, type CompoundRow } from "./compound";
import { SERVICE_BY_ID_COLUMNS, readService, type ServiceFacts, type ServiceRow } from "./service";
import { UNIT_BY_ID_COLUMNS, readUnit, type UnitFacts, type UnitRow } from "./unit-shape";
import type { Database } from "../supabase/database.types";
import { SUPABASE_URL } from "../supabase/env";
import { createClient } from "../supabase/server";
import { pointSelect } from "../supabase/public-point";
import { isListingRole } from "../supply/roles";
import { catalogueReadFailed } from "./read-failure";
import { diversePick, matchesFilter } from "./filter";
import {
  headlinePrice,
  moveInTotal,
  purchaseTotal,
  type BuildCondition,
  type Furnishing,
  type LandTenure,
  type RentPeriod,
  type SaleStatus,
} from "./pricing";
import type {
  Listing,
  ListingKind,
  ListingRepository,
  ListingSearchFilter,
  ListingSearchOptions,
} from "./types";

/**
 * The platform catalogue, read from Postgres.
 *
 * Public reads see PUBLISHED listings only, which is enforced by RLS rather
 * than by this file: the policy is the authority, the query simply asks for
 * what it needs. Every listing that comes back was listed on this platform by
 * a person on this platform, so it carries source "vallo". There is no other
 * source and there is not going to be one.
 *
 * Money stays integer kobo end to end. Which of the three money stories a row
 * leads with (an asking price, a nightly rate, an annual rent) is decided by
 * `headlinePrice` in ./pricing, once, so a card and a map pin cannot disagree.
 * No conversion happens anywhere in this mapping.
 *
 * Query shape, deliberately flat: one listings query with photos and amenity
 * joins embedded, one aggregate query for reviews, and two tiny reference
 * tables (states, amenities) cached in process. No per-listing round trips.
 *
 * Nothing here throws. Every path returns empty or null on failure so the
 * merged repository can fall back to the seed catalogue and discovery keeps
 * rendering.
 */

const PHOTO_BUCKET = "listing-photos";
/**
 * Walkthrough videos. PRIVATE, unlike listing-photos, and read through a
 * short-lived signed URL.
 *
 * A walkthrough is the strongest evidence a listing is real that a lister can
 * supply without an inspection, which is exactly what makes it the most
 * valuable thing on this platform to steal: a continuous walk through a real
 * Lagos flat, lifted from a public CDN, is what turns a fake listing on
 * somebody else's site into a convincing one. A photograph is trivially stolen
 * anyway and the bucket for those stays public; the video is not handed out.
 *
 * The bucket also carries a 100MB ceiling and a MIME allowlist in Postgres, so
 * the size and type rules hold against a caller that skips the server action.
 */
export const VIDEO_BUCKET = "listing-videos";

/** How long a walkthrough URL stays good. Long enough to watch it twice. */
const VIDEO_URL_SECONDS = 3600;

/** How many published listings one catalogue read pulls, at most. */
const CATALOGUE_LIMIT = 200;

/**
 * How much wider than its output `recommended` reads.
 *
 * `diversePick` alternates between property kinds, so a pool the size of the
 * ask returns whatever order the catalogue was already in. Ten times the ask is
 * wider than the six kinds the mapping produces and is a fifth of what reading
 * the whole catalogue page cost.
 */
const RECOMMENDED_POOL_FACTOR = 10;

/**
 * The row ceiling for one catalogue read.
 *
 * A caller may ask for fewer than the catalogue limit and never for more: the
 * limit is the protection against a single read pulling an unbounded page, and
 * an option must not be able to raise it. A nonsense request (zero, negative,
 * fractional, NaN) falls back to the ceiling rather than to nothing, because
 * the failure mode of a bad number should be an ordinary page, not an empty
 * discovery surface.
 */
function rowCap(requested: number | undefined): number {
  if (requested === undefined || !Number.isFinite(requested)) return CATALOGUE_LIMIT;
  const whole = Math.floor(requested);
  if (whole < 1) return CATALOGUE_LIMIT;
  return Math.min(whole, CATALOGUE_LIMIT);
}

/** Reference tables barely change, so they are cached for the process. */
const REFERENCE_TTL_MS = 600_000;

type Client = SupabaseClient<Database>;

/**
 * `states` code to name, and `amenities` id to code.
 *
 * Both tables are static reference data (37 and 15 rows live today) and both
 * are readable by anyone, so the memo holds one copy per instance rather than
 * one per request. They went through `lib/cache/memo` when that helper landed:
 * the behaviour is the same as the hand-rolled caches they replaced, except a
 * failed refresh now keeps the last good map instead of replacing it with an
 * empty one, and three requests arriving as the TTL expires make one query
 * between them rather than three.
 *
 * The loader builds its own client rather than borrowing the caller's. A cache
 * shared across requests must not close over a request-scoped, cookie-bound
 * client: the first caller's client would outlive their request and every later
 * reader would be refreshing reference data through a session that has gone.
 */
const statesMemo = memo<Map<string, string>>({
  ttlMs: REFERENCE_TTL_MS,
  empty: new Map(),
  load: async () => {
    const supabase = await createClient();
    const { data, error } = await supabase.from("states").select("code, name");
    if (error || !data) throw new Error("states unavailable");
    return new Map(data.map((row) => [row.code, row.name]));
  },
});

const amenitiesMemo = memo<Map<string, string>>({
  ttlMs: REFERENCE_TTL_MS,
  empty: new Map(),
  load: async () => {
    const supabase = await createClient();
    const { data, error } = await supabase.from("amenities").select("id, code");
    if (error || !data) throw new Error("amenities unavailable");
    return new Map(data.map((row) => [row.id, row.code]));
  },
});

/**
 * The columns and joins a listing card and a listing detail page need.
 *
 * THE WALKTHROUGH JOIN IS NOT IN HERE, and the reason is a round trip rather
 * than a few bytes. `listing_videos` holds a private storage path, so every
 * path that comes back has to be signed, and signing is an HTTP call to
 * Supabase Storage for the whole page. A catalogue read was therefore paying a
 * storage round trip on top of its database query to produce signed URLs that
 * nothing renders: `Listing.videos` is declared on the domain type, populated
 * here, and consumed by no component in the product.
 *
 * Nothing is deleted, because MED-2 and P-11 both want walkthroughs. They moved
 * to the one read that will render them, `byId`, which is the listing detail
 * page. A list surface has no player on it and never will.
 */
const LISTING_SELECT = `
  id,
  reference,
  title,
  property_type,
  listing_intent,
  rent_amount_minor,
  rent_period,
  rent_negotiable,
  rate_minor,
  rate_period,
  sale_price_minor,
  price_negotiable,
  caution_deposit_minor,
  service_charge_minor,
  service_charge_period,
  agency_fee_minor,
  legal_fee_minor,
  agreement_fee_minor,
  total_move_in_cost_minor,
  sale_agency_fee_minor,
  sale_legal_fee_minor,
  governors_consent_fee_minor,
  stamp_duty_minor,
  survey_registration_fee_minor,
  total_purchase_cost_minor,
  minimum_tenancy_months,
  available_from,
  furnished,
  tenure,
  sale_status,
  year_built,
  condition,
  size_sqm,
  toilets,
  parking_spaces,
  floor,
  total_floors,
  bedrooms,
  bathrooms,
  is_demo,
  agent_id,
  listing_role,
  area,
  city,
  state_code,
  latitude,
  longitude,
  published_at,
  created_at,
  address_verified_at,
  physically_inspected_at,
  power_grid,
  power_backup,
  power_backup_hours,
  water_supply,
  prepaid_meter,
  has_estate_access,
  listing_photos ( storage_path, position ),
  listing_amenities ( amenity_id )
`;

/**
 * The detail read: everything above, plus the walkthroughs.
 *
 * Written out rather than composed from `LISTING_SELECT`. The Supabase client
 * parses the select string AT THE TYPE LEVEL to work out the row shape it
 * returns, and it parses a literal type, so a composed or conditional select
 * degrades to `string` and takes the row typing down with it. Two literals cost
 * a duplicated column list; one composed one costs the type safety on every
 * column in it. `selects.test.ts` holds them to each other so the
 * duplication cannot drift.
 */
const LISTING_DETAIL_SELECT = `
  id,
  reference,
  title,
  property_type,
  listing_intent,
  rent_amount_minor,
  rent_period,
  rent_negotiable,
  rate_minor,
  rate_period,
  sale_price_minor,
  price_negotiable,
  caution_deposit_minor,
  service_charge_minor,
  service_charge_period,
  agency_fee_minor,
  legal_fee_minor,
  agreement_fee_minor,
  total_move_in_cost_minor,
  sale_agency_fee_minor,
  sale_legal_fee_minor,
  governors_consent_fee_minor,
  stamp_duty_minor,
  survey_registration_fee_minor,
  total_purchase_cost_minor,
  minimum_tenancy_months,
  available_from,
  furnished,
  tenure,
  sale_status,
  year_built,
  condition,
  size_sqm,
  toilets,
  parking_spaces,
  floor,
  total_floors,
  bedrooms,
  bathrooms,
  is_demo,
  agent_id,
  listing_role,
  area,
  city,
  state_code,
  latitude,
  longitude,
  published_at,
  created_at,
  address_verified_at,
  physically_inspected_at,
  power_grid,
  power_backup,
  power_backup_hours,
  water_supply,
  prepaid_meter,
  has_estate_access,
  listing_photos ( storage_path, position ),
  listing_videos ( storage_path, poster_path, duration_seconds, position ),
  listing_amenities ( amenity_id )
`;

/** Exported for the spec that holds the two selects to each other. */
export const LISTING_SELECTS = {
  card: LISTING_SELECT,
  detail: LISTING_DETAIL_SELECT,
} as const;

export type ListingRow = {
  id: string;
  reference: string | null;
  title: string;
  property_type: string;
  listing_intent: string | null;
  rent_amount_minor: number | null;
  rent_period: string | null;
  rent_negotiable: boolean | null;
  rate_minor: number | null;
  rate_period: string | null;
  sale_price_minor: number | null;
  price_negotiable: boolean | null;
  caution_deposit_minor: number | null;
  service_charge_minor: number | null;
  service_charge_period: string | null;
  agency_fee_minor: number | null;
  legal_fee_minor: number | null;
  agreement_fee_minor: number | null;
  total_move_in_cost_minor: number | null;
  sale_agency_fee_minor: number | null;
  sale_legal_fee_minor: number | null;
  governors_consent_fee_minor: number | null;
  stamp_duty_minor: number | null;
  survey_registration_fee_minor: number | null;
  total_purchase_cost_minor: number | null;
  minimum_tenancy_months: number | null;
  available_from: string | null;
  furnished: string | null;
  tenure: string | null;
  sale_status: string | null;
  year_built: number | null;
  condition: string | null;
  size_sqm: number | string | null;
  toilets: number | null;
  parking_spaces: number | null;
  floor: number | null;
  total_floors: number | null;
  bedrooms: number;
  bathrooms: number;
  is_demo: boolean;
  agent_id: string;
  listing_role: string | null;
  power_grid: string | null;
  power_backup: string | null;
  power_backup_hours: number | null;
  water_supply: string | null;
  prepaid_meter: boolean | null;
  has_estate_access: boolean | null;
  area: string | null;
  city: string | null;
  state_code: string | null;
  latitude: number | null;
  longitude: number | null;
  published_at: string | null;
  created_at: string;
  address_verified_at: string | null;
  physically_inspected_at: string | null;
  /* V-03: the two supply dates, granted to anon by migration 20260924130000.
     Optional on the type so a fixture written before them still builds. */
  ownership_verified_at?: string | null;
  mandate_verified_at?: string | null;
  listing_photos: { storage_path: string; position: number }[];
  listing_videos: {
    storage_path: string;
    poster_path: string | null;
    duration_seconds: number | null;
    position: number;
  }[] | null;
  listing_amenities: { amenity_id: string }[];
};

/** Category values the listings table can hold, mapped onto discovery kinds. */
const KIND_BY_PROPERTY_TYPE: Record<string, ListingKind> = {
  apartment: "apartment",
  hotel: "hotel",
  home: "home",
  villa: "villa",
  shortlet: "shortlet",
  rental: "rental",
  shop: "shop",
  office: "office",
  land: "land",
  /*
   * Restaurants somebody listed here.
   *
   * The category used to be filled by a Google Places feed, which meant no
   * verified badge, nobody to message and no way to hold anybody a table. The
   * feed is gone. A restaurant on Vallo is now what every other listing is:
   * a real place put up by a real person, with an owner to talk to and a
   * reservation that this platform actually holds.
   *
   * Priced per head rather than per night, which needs no column: the domain
   * type already states that restaurants and experiences ignore `pricePeriod`,
   * so the mapping below leaves it at "night" and every reader treats it as a
   * head price.
   *
   * There used to be a `YEARLY_KINDS` set here deciding which kinds were priced
   * by the year. It was dead: `headlinePrice` in ./pricing took over the period
   * decision so that a card and a map pin cannot disagree, and the set was left
   * behind still being cited by this comment. Removed.
   */
  restaurant: "restaurant",
};

/** Discovery kinds that live in the listings table at all. */
export function propertyTypeFor(kind: ListingKind): string | null {
  return kind in KIND_BY_PROPERTY_TYPE ? kind : null;
}

/**
 * How many words of a search term are pushed into SQL.
 *
 * Dropping the seventh word can only widen what SQL returns, and the matcher
 * judges every row that comes back, so the cap costs recall nothing. It exists
 * to bound the URL, because each word becomes its own `or` parameter.
 */
const MAX_QUERY_WORDS = 6;

/**
 * A search term, turned into PostgREST `or` groups: one group per word.
 *
 * WHY THIS EXISTS. Free text used to be matched only in memory, after the query
 * had already taken the newest 200 published rows. That is not a slow search,
 * it is a wrong one: the term never reached SQL, so it could only ever find
 * something inside the 200 most recent listings, and the 201st was invisible to
 * it. These groups make the term narrow the rows, so the cap lands on MATCHING
 * listings instead of recent ones.
 *
 * THE RULE THIS OBEYS. `matchesFilter` stays the authority, exactly as it does
 * for budget and for everything else here, and it asks whether the term is a
 * substring of `title area city state kind`. So SQL may return rows the matcher
 * will drop, and may never drop a row the matcher would have kept. Every choice
 * below is made to keep that one-directional:
 *
 *   Words are ANDed, columns are ORed. If the whole term is a substring of that
 *   joined haystack, then each word of the term is a substring of it too, and a
 *   word has no space in it, so it must sit inside a single one of those fields
 *   rather than straddle two. Requiring every word somewhere is therefore a
 *   superset of requiring the phrase in one piece, and a far tighter one than
 *   asking for any word anywhere.
 *
 *   Punctuation becomes a wildcard rather than being deleted. `%` matches the
 *   character it replaced, so a pattern can only ever match more than the raw
 *   word did. Deleting instead would turn `a,b` into `ab`, which stops matching
 *   the row that says `a,b`, and that is the one direction not allowed here. It
 *   also means a user typing `%` gets a literal-ish wildcard of our choosing
 *   rather than a pattern of theirs that matches the entire catalogue.
 *
 *   State and kind are matched here in JavaScript, against the same reference
 *   map the rows are decorated from, because the haystack holds a state's NAME
 *   while the row holds its code. Somebody searching Ogun has to reach a
 *   listing in Abeokuta, and no `ilike` over the listings table can do that.
 *   When the reference map is empty the codes drop out of the predicate, and
 *   the matcher is reading a haystack built from that same empty map, so the
 *   two narrow together rather than disagreeing.
 */
export function freeTextGroups(term: string, stateNames: Map<string, string>): string[] {
  const words = term.toLowerCase().split(/\s+/).filter(Boolean).slice(0, MAX_QUERY_WORDS);
  const groups: string[] = [];

  for (const word of words) {
    const pattern = word.replace(/[^a-z0-9]/g, "%");
    // A word of pure punctuation carries no signal, and `%%%` would match every
    // row, which is the same as not having asked.
    if (!/[a-z0-9]/.test(pattern)) continue;

    const parts = [
      `title.ilike.%${pattern}%`,
      `city.ilike.%${pattern}%`,
      `area.ilike.%${pattern}%`,
    ];

    const codes = [...stateNames.entries()]
      .filter(([, name]) => name.toLowerCase().includes(word))
      .map(([code]) => code);
    if (codes.length > 0) parts.push(`state_code.in.(${codes.join(",")})`);

    const types = Object.keys(KIND_BY_PROPERTY_TYPE).filter((type) => type.includes(word));
    if (types.length > 0) parts.push(`property_type.in.(${types.join(",")})`);

    groups.push(parts.join(","));
  }

  return groups;
}

/**
 * Public object URL for a stored photo, or the value itself if already a URL.
 *
 * An absolute PUBLIC PATH starting with a slash passes through untouched as
 * well: the app serves it from `apps/web/public` itself. The b2 example
 * listings carry that shape (`/brand/photos/<name>.jpg`, the photographs the
 * lead compressed and filed), and a bucket path never starts with a slash, so
 * the two cannot collide. Exported so the stays twin's test can hold the two
 * definitions side by side.
 */
export function photoUrl(storagePath: string): string {
  if (/^https?:\/\//i.test(storagePath)) return storagePath;
  if (storagePath.startsWith("/")) return storagePath;
  const path = storagePath.replace(new RegExp(`^${PHOTO_BUCKET}/`), "");
  const base = SUPABASE_URL.replace(/\/+$/, "");
  return `${base}/storage/v1/object/public/${PHOTO_BUCKET}/${path}`;
}

/**
 * Signed URLs for every walkthrough on a page, in one call.
 *
 * One request for the whole page rather than one per video, because a catalogue
 * of twenty listings with a video each would otherwise be twenty round trips
 * before anything renders. A path that fails to sign is dropped rather than
 * rendered as a broken player.
 */
async function signVideos(
  supabase: Client,
  paths: string[],
): Promise<Map<string, string>> {
  const signed = new Map<string, string>();
  if (paths.length === 0) return signed;
  try {
    const { data, error } = await supabase.storage
      .from(VIDEO_BUCKET)
      .createSignedUrls(paths, VIDEO_URL_SECONDS);
    if (error || !data) return signed;
    for (const entry of data) {
      if (entry.path && entry.signedUrl) signed.set(entry.path, entry.signedUrl);
    }
  } catch {
    /* An unreachable storage service is a page without videos, not a page
       without listings. */
  }
  return signed;
}

function slugPart(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * A readable, stable slug for links and analytics. The database has no slug
 * column yet, so it is derived from the title and locality; `byId` still
 * resolves listings by their uuid, which is what every link carries.
 */
function slugFor(row: ListingRow): string {
  const parts = [slugPart(row.title), slugPart(row.area ?? ""), slugPart(row.city ?? "")]
    .filter((p) => p.length > 0)
    .filter((p, i, all) => all.indexOf(p) === i);
  return parts.join("-") || row.id;
}

/** Deterministic gradient hue for the card fallback tile, 0 to 5. */
function hueFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) % 6;
  return h;
}

async function getStateNames(): Promise<Map<string, string>> {
  return statesMemo.get();
}

async function getAmenityCodes(): Promise<Map<string, string>> {
  return amenitiesMemo.get();
}

/**
 * The row ceiling on the two secondary reads, and the reason it is dangerous.
 *
 * `listing_amenities` and `reviews` are both read in bulk for one page and both
 * were capped at 5,000 rows with no signal. A cap with no signal on a query
 * whose result is then AGGREGATED is not a performance limit, it is a silent
 * wrong answer: past the ceiling, a listing that genuinely carries every
 * requested amenity is dropped from the results, and a rating is averaged over
 * a truncated sample and presented as the listing's rating.
 *
 * The right fix is SQL, and it is BE-4 and BE-5: a `group by ... having count`
 * for the amenity set, and either an aggregate RPC or trigger-maintained
 * `rating_avg` and `review_count` columns for the reviews. Neither is a change
 * this layer can make, because both are migrations.
 *
 * What this layer CAN do is stop the failure being silent. `warnIfTruncated`
 * makes a hit ceiling a greppable line in the deployment log, so the first
 * signal is a warning rather than a support conversation about a listing that
 * does not appear in a search it satisfies. This is the whole lesson of CASE-1
 * applied one directory over: the bug was not that something failed, it was
 * that nothing said so.
 */
const JOIN_ROW_LIMIT = 5_000;

function warnIfTruncated(rows: number, what: string, scope: number): void {
  if (rows < JOIN_ROW_LIMIT) return;
  console.warn(
    `[catalogue] ${what} read hit the ${JOIN_ROW_LIMIT} row ceiling for ${scope} listings. ` +
      "Results past it are missing and the answer is incomplete. See RECOMMENDATIONS BE-4 and BE-5.",
  );
}

/**
 * Published listing ids carrying EVERY requested amenity, through the join
 * table.
 *
 * The join is the only place this can be answered in SQL: one filtered read of
 * `listing_amenities`, then the ids that turned up with the full set. It is
 * pushed down rather than filtered in memory because a listing that fails it
 * should never occupy one of the catalogue page's rows.
 *
 * Returns an empty list, never a throw: an unknown code, an unreachable table
 * or an empty reference table all mean "the database half contributes nothing",
 * and the seed half still answers with the same rule applied by the matcher.
 */
async function listingIdsWithAllAmenities(
  supabase: Client,
  codes: string[],
): Promise<string[]> {
  try {
    const codeById = await getAmenityCodes();
    const idByCode = new Map<string, string>();
    for (const [id, code] of codeById) idByCode.set(code, id);

    const wanted: string[] = [];
    for (const code of codes) {
      const id = idByCode.get(code);
      if (!id) return [];
      wanted.push(id);
    }
    if (wanted.length === 0) return [];

    const { data, error } = await supabase
      .from("listing_amenities")
      .select("listing_id, amenity_id")
      .in("amenity_id", wanted)
      .limit(JOIN_ROW_LIMIT);
    if (error) {
      await catalogueReadFailed("amenity_join", error);
      return [];
    }
    if (!data) return [];
    warnIfTruncated(data.length, "listing_amenities", wanted.length);

    const found = new Map<string, Set<string>>();
    for (const row of data) {
      const set = found.get(row.listing_id) ?? new Set<string>();
      set.add(row.amenity_id);
      found.set(row.listing_id, set);
    }
    const out: string[] = [];
    for (const [listingId, set] of found) {
      if (set.size === wanted.length) out.push(listingId);
    }
    return out;
  } catch (error) {
    await catalogueReadFailed("amenity_join", error);
    return [];
  }
}

/** Rating average and count per listing, in one query for the whole page. */
async function getReviewStats(
  supabase: Client,
  listingIds: string[],
): Promise<Map<string, { rating: number; count: number }>> {
  const stats = new Map<string, { rating: number; count: number }>();
  if (listingIds.length === 0) return stats;
  /* V-58: a review from the lister's own shadow is not in the average. */
  const { data, error } = await readCountedReviews<{ id: string; listing_id: string; rating: number }>((table) =>
    (supabase as unknown as SupabaseClient)
      .from(table)
      .select("id, listing_id, rating")
      .in("listing_id", listingIds)
      .limit(JOIN_ROW_LIMIT),
  );
  if (error || !data) return stats;
  warnIfTruncated(data.length, "reviews", listingIds.length);

  const totals = new Map<string, { sum: number; count: number }>();
  for (const row of data) {
    const entry = totals.get(row.listing_id) ?? { sum: 0, count: 0 };
    entry.sum += row.rating;
    entry.count += 1;
    totals.set(row.listing_id, entry);
  }
  for (const [id, entry] of totals) {
    stats.set(id, {
      rating: Math.round((entry.sum / entry.count) * 10) / 10,
      count: entry.count,
    });
  }
  return stats;
}

/**
 * One database row as the domain type.
 *
 * EXPORTED FOR THE SPEC, for the same reason `LISTING_SELECTS` is. A column
 * only reaches a screen if three things hold at once: it is in the select, it
 * is on the row type, and this function copies it onto the domain object.
 * `listings.listing_role` is what happens when the first and third are missing
 * while both ends of the chain have passing tests of their own, so the middle
 * link is now testable rather than merely reviewable. The row type is exported
 * beside it so a spec has to build a REAL row rather than a hand-waved partial.
 */
export function mapRow(
  row: ListingRow,
  stateNames: Map<string, string>,
  amenityCodes: Map<string, string>,
  stats: Map<string, { rating: number; count: number }>,
  signedVideos: Map<string, string>,
  verifiedAgents: Set<string>,
  listerNames: Map<string, string>,
  /* V-03: when each checked agent's identity rung passed, from
     `agent_badges.verified_at`. Optional and last so every existing caller
     and spec reads exactly as before. */
  identitySeenAt: Map<string, string> = new Map(),
  /* V-05: the public count of renters' truth answers, from
     `public.listing_truth_summary` (two answers up, real listings only). */
  renterTruth: Map<string, { attended: number; asListed: number; lastAt: string }> = new Map(),
): Listing {
  const kind = KIND_BY_PROPERTY_TYPE[row.property_type] ?? "home";
  const stat = stats.get(row.id);
  const photos = [...row.listing_photos]
    .sort((a, b) => a.position - b.position)
    .map((p) => photoUrl(p.storage_path));
  const amenities = row.listing_amenities
    .map((a) => amenityCodes.get(a.amenity_id))
    .filter((code): code is string => Boolean(code))
    .sort();
  const videos = [...(row.listing_videos ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((v) => {
      const url = signedVideos.get(v.storage_path);
      return url === undefined
        ? null
        : {
            url,
            /* The poster still lives in the PUBLIC photo bucket, so it needs no
               signature and keeps working after the video URL expires. A card
               that shows a frame and asks you to tap is the right shape here. */
            posterUrl: v.poster_path ? photoUrl(v.poster_path) : null,
            durationSeconds: v.duration_seconds,
            position: v.position,
          };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);

  const headline = headlinePrice(row);
  const moveIn = moveInTotal(row);
  const purchase = purchaseTotal(row);

  /* A modest example wears honest imagery or none (see
     `lib/listings/example-imagery.ts`): the aspirational renders on its rows
     are not shown in place of a mini flat. Every other row is untouched. */
  const shownPhotos = honestExamplePhotos(
    {
      kind,
      bedrooms: row.bedrooms ?? 0,
      intent: row.listing_intent === "sale" ? "sale" : "rent",
      isDemo: row.is_demo,
      ...(headline.kind === "sale" ? {} : { pricePeriod: headline.period }),
    },
    photos,
  );

  return {
    id: row.id,
    slug: slugFor(row),
    /* Absent rather than null when the listing has no code yet, so the
       optional field on the model means exactly one thing. */
    ...(row.reference ? { reference: row.reference } : {}),
    title: row.title,
    kind,
    area: row.area ?? row.city ?? "",
    city: row.city ?? "",
    state: (row.state_code ? stateNames.get(row.state_code) : undefined) ?? row.state_code ?? "",
    ...(row.state_code ? { stateCode: row.state_code } : {}),
    /* Both columns are nullable and the wizard does not force a pin, so a row
       carries a coordinate or it carries neither. A half pair is refused rather
       than mapped, because a latitude with no longitude places a property on
       the Gulf of Guinea. */
    ...(row.latitude !== null && row.longitude !== null
      ? { lat: row.latitude, lng: row.longitude }
      : {}),
    /* The headline figure in kobo, whichever of the three markets this row is
       in. A sale carries its asking price here AND in salePriceMinor, because
       every card in discovery prints priceMinor and a sale that printed zero
       would read as free. */
    priceMinor: headline.minor,
    currency: "NGN",
    intent: row.listing_intent === "sale" ? "sale" : "rent",
    ...(headline.kind === "sale" ? {} : { pricePeriod: headline.period }),
    ...(headline.kind === "sale" ? { salePriceMinor: headline.minor } : {}),
    negotiable:
      row.listing_intent === "sale"
        ? (row.price_negotiable ?? false)
        : (row.rent_negotiable ?? false),
    /* What it actually costs to move in. Carried only for a rent listing, and
       only when somebody stated something: an unstated total renders as
       unstated, never as zero, because "no fees" and "we did not say" are
       different promises. */
    ...(row.listing_intent !== "sale" && (moveIn.stated || moveIn.minor > 0)
      ? { moveInCostMinor: moveIn.minor, moveInCostStated: moveIn.stated }
      : {}),
    ...(row.caution_deposit_minor === null
      ? {}
      : { cautionDepositMinor: Number(row.caution_deposit_minor) }),
    ...(row.service_charge_minor === null
      ? {}
      : { serviceChargeMinor: Number(row.service_charge_minor) }),
    ...(row.service_charge_period
      ? { serviceChargePeriod: row.service_charge_period as RentPeriod }
      : {}),
    ...(row.agency_fee_minor === null ? {} : { agencyFeeMinor: Number(row.agency_fee_minor) }),
    ...(row.legal_fee_minor === null ? {} : { legalFeeMinor: Number(row.legal_fee_minor) }),
    ...(row.agreement_fee_minor === null
      ? {}
      : { agreementFeeMinor: Number(row.agreement_fee_minor) }),
    /* WHAT A BUYER ACTUALLY PAYS. Carried only for a sale listing, and only
       when somebody stated something, for the same reason the move-in total
       is: an unstated total renders as unstated and never as zero, because
       "no fees" and "we did not say" are different promises. The five parts
       are carried whatever the total says, because the itemised block lists
       every cost a buyer meets and draws the silent ones as silent. */
    ...(row.listing_intent === "sale" && (purchase.stated || purchase.minor > 0)
      ? { purchaseCostMinor: purchase.minor, purchaseCostStated: purchase.stated }
      : {}),
    ...(row.sale_agency_fee_minor === null
      ? {}
      : { saleAgencyFeeMinor: Number(row.sale_agency_fee_minor) }),
    ...(row.sale_legal_fee_minor === null
      ? {}
      : { saleLegalFeeMinor: Number(row.sale_legal_fee_minor) }),
    ...(row.governors_consent_fee_minor === null
      ? {}
      : { governorsConsentFeeMinor: Number(row.governors_consent_fee_minor) }),
    ...(row.stamp_duty_minor === null ? {} : { stampDutyMinor: Number(row.stamp_duty_minor) }),
    ...(row.survey_registration_fee_minor === null
      ? {}
      : { surveyRegistrationFeeMinor: Number(row.survey_registration_fee_minor) }),
    ...(row.minimum_tenancy_months === null
      ? {}
      : { minimumTenancyMonths: row.minimum_tenancy_months }),
    ...(row.available_from ? { availableFrom: row.available_from } : {}),
    ...(row.furnished ? { furnished: row.furnished as Furnishing } : {}),
    ...(row.tenure ? { tenure: row.tenure as LandTenure } : {}),
    ...(row.sale_status ? { saleStatus: row.sale_status as SaleStatus } : {}),
    ...(row.year_built === null ? {} : { yearBuilt: row.year_built }),
    ...(row.condition ? { condition: row.condition as BuildCondition } : {}),
    /* size_sqm is the one numeric column on this table rather than an integer,
       because a plot is measured in fractions of a square metre and rounding it
       to a whole number would misstate land. PostgREST hands a numeric back as
       a string to preserve its precision, so it is parsed rather than trusted
       to already be a number. */
    ...(row.size_sqm === null || row.size_sqm === undefined
      ? {}
      : { sizeSqm: Number(row.size_sqm) }),
    ...(row.toilets === null ? {} : { toilets: row.toilets }),
    ...(row.parking_spaces === null ? {} : { parkingSpaces: row.parking_spaces }),
    ...(row.floor === null ? {} : { floor: row.floor }),
    ...(row.total_floors === null ? {} : { totalFloors: row.total_floors }),
    ...(row.physically_inspected_at ? { inspectedAt: row.physically_inspected_at } : {}),
    ...(row.address_verified_at ? { addressVerifiedAt: row.address_verified_at } : {}),
    /*
     * THE PROOF STRIP'S DATES (V-03), and none of them on an example listing.
     * The database already refuses the two supply stamps on an example and
     * refuses a verified lister behind one; the clamp here is the same second
     * lock `verified` carries, for the same reason. The identity date is only
     * carried where the badge itself is true, so the strip can never print an
     * identity line beside a listing that draws no badge.
     */
    ...(!row.is_demo && row.ownership_verified_at
      ? { ownershipVerifiedAt: row.ownership_verified_at }
      : {}),
    ...(!row.is_demo && row.mandate_verified_at
      ? { mandateVerifiedAt: row.mandate_verified_at }
      : {}),
    ...(!row.is_demo && verifiedAgents.has(row.agent_id) && identitySeenAt.has(row.agent_id)
      ? { listerIdentitySeenAt: identitySeenAt.get(row.agent_id) }
      : {}),
    ...(!row.is_demo && renterTruth.has(row.id) ? { renterTruth: renterTruth.get(row.id) } : {}),
    source: "vallo",
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    utilities: {
      ...(row.power_grid ? { powerGrid: row.power_grid as NonNullable<Listing["utilities"]>["powerGrid"] } : {}),
      ...(row.power_backup
        ? { powerBackup: row.power_backup as NonNullable<Listing["utilities"]>["powerBackup"] }
        : {}),
      ...(row.power_backup_hours === null ? {} : { powerBackupHours: row.power_backup_hours }),
      ...(row.water_supply
        ? { waterSupply: row.water_supply as NonNullable<Listing["utilities"]>["waterSupply"] }
        : {}),
      ...(row.prepaid_meter === null ? {} : { prepaidMeter: row.prepaid_meter }),
      hasEstateAccess: row.has_estate_access ?? false,
    },
    /*
     * A rating is a claim that people stayed there and rated it, so an example
     * listing reports none.
     *
     * It would already be zero without this: `reviews.booking_id` is NOT NULL,
     * a booking against an example listing is refused by trigger, so no review
     * can exist to be averaged. The clamp is here anyway because "never a
     * fabricated rating" is the single rule this whole catalogue exists to
     * keep, and a rule that important should not rest on a foreign key
     * somebody could later make nullable.
     */
    rating: row.is_demo ? 0 : (stat?.rating ?? 0),
    reviewCount: row.is_demo ? 0 : (stat?.count ?? 0),
    /*
     * THE TICK, AND IT IS EARNED NOW RATHER THAN ASSUMED.
     *
     * The history of this one line is the history of the same mistake made
     * twice. It began as `verified: true`, unconditionally, on the reasoning
     * that first-party inventory is admitted through agent approval so a
     * published listing is by definition a verified one; that is how this
     * repository once shipped twenty-three invented places with twenty-two of
     * them badged. It was then narrowed to `!row.is_demo`, which fixed the
     * example listings and left the real defect completely intact: EVERY
     * genuine listing still got the tick the moment it went live, whether or
     * not one person had ever looked at one document about the agent behind it.
     *
     * Meanwhile the whole apparatus for deciding this already existed and was
     * wired to nothing a stranger could see: four rungs in
     * `agent_verification_checks`, a tier computed by `private.agent_tier`, and
     * an admin queue that passes and fails each rung by hand.
     *
     * So the badge is now that decision, published through `agent_badges`:
     * a person here looked at a government document and said yes. Both
     * conditions have to hold. An example listing is never verified whatever
     * its lister's tier says, and a real listing from an agent nobody has
     * checked yet is not verified either - it is simply a listing, which is
     * what it is.
     *
     * The consequence is deliberate and is the point: an agent can publish
     * immediately and sell nothing on our word until we have earned the right
     * to lend it.
     */
    verified: !row.is_demo && verifiedAgents.has(row.agent_id),
    /*
     * WHAT THE LISTER IS TO THIS PROPERTY, CARRIED AT LAST.
     *
     * This one line is the middle of Track G's chain. The column has been not
     * null on every row since Track G migration 3 and `ListerRoleLine` has been
     * mounted on the listing page's agent card since the same week, and between
     * them there was nothing: the row was read, the column was not selected,
     * and the three sentences had no route to a screen. Both ends had tests and
     * both tests passed.
     *
     * NARROWED THROUGH THE DOMAIN GUARD, NEVER CAST. The column is a Postgres
     * enum, so `owner | agent | firm` is what it holds today, but a cast would
     * put whatever a fourth value turned out to be straight onto a prop that
     * indexes `LISTING_ROLE_SENTENCE`, and the reader would get `undefined`
     * rendered as a sentence. `isListingRole` refuses anything it does not
     * know and the field stays absent, which draws no line at all. Absent and
     * wrong are different, and only one of them is safe.
     *
     * It is NOT clamped on `is_demo`, unlike `verified` and `rating` above,
     * and that is deliberate. Those two are CLAIMS THIS PLATFORM MAKES, so an
     * example listing must make neither. This is a statement about who put the
     * listing up, which an example listing answers as honestly as a real one,
     * and the example banner over it already tells the reader what the whole
     * page is.
     */
    ...(isListingRole(row.listing_role) ? { listerRole: row.listing_role } : {}),
    /*
     * AND WHO THAT IS, WHEN THE SENTENCE NEEDS A NAME.
     *
     * Two of the three sentences in `LISTING_ROLE_SENTENCE` carry `{name}`,
     * and until today the public read had no way to fill it: `agents` is
     * RLS-bound to the agent themselves and to staff, correctly, so a stranger
     * has no path from `agent_id` to a display name. `fillLister` refuses to
     * print a template with its placeholder showing, so the agent and firm
     * sentences drew nothing at all, on every one of the 64 live listings.
     *
     * `public.listing_lister` is the door, added by migration
     * `20260923103838`. Two columns, published listings only, NULL for an
     * owner because that sentence names nobody by design. Nothing else about
     * a lister passes through it.
     *
     * ABSENT RATHER THAN EMPTY, for the same reason `listerRole` is: an
     * explicit `undefined` survives a spread and overwrites a real value in a
     * merge, and the seed catalogue has no such column at all.
     */
    ...(listerNames.has(row.id) ? { listerName: listerNames.get(row.id) } : {}),
    isDemo: row.is_demo,
    ...(row.published_at ? { publishedAt: row.published_at } : {}),
    /* Instant book is gone from the schema. The whole product moved from
       "reserve a room tonight" to "rent or buy a property", and no property in
       either of those markets changes hands without a person on both sides.
       The field stays on the domain type because the filter drawer and the card
       still read it; it is false for every database row, which is the truth. */
    instantBook: false,
    amenities,
    photos: shownPhotos,
    videos,
    hue: hueFor(row.id),
  };
}

/**
 * Which of these agents a person here has actually checked.
 *
 * ONE INDEXED READ OVER A PRIMARY KEY, for the whole page, and it returns one
 * boolean per agent and nothing else. `agents` itself is RLS-bound to the agent
 * and to staff, correctly, so the catalogue cannot join it and must not be able
 * to; `agent_badges` is the one derived fact that is published, maintained by
 * `private.sync_agent_badge` on the tier the KYC ladder computes.
 *
 * A MISSING ROW IS NOT VERIFIED. The migration backfilled every existing agent
 * and the trigger fires on insert, so a missing row means the agent row itself
 * is gone. Reading that as "not verified" is the safe direction: the failure
 * mode of this function is a tick that does not appear, never a tick that
 * appears without a check behind it.
 */
async function getAgentBadges(
  supabase: Client,
  agentIds: string[],
): Promise<{ verified: Set<string>; seenAt: Map<string, string> }> {
  const verified = new Set<string>();
  /* V-03: the date the badge turned true, which is the date the identity rung
     passed. Read in the same query, so the proof strip costs no round trip. */
  const seenAt = new Map<string, string>();
  if (agentIds.length === 0) return { verified, seenAt };
  const { data, error } = await supabase
    .from("agent_badges")
    .select("agent_id, verified, verified_at")
    .in("agent_id", agentIds);
  if (error || !data) return { verified, seenAt };
  for (const row of data as { agent_id: string; verified: boolean; verified_at: string | null }[]) {
    if (row.verified) {
      verified.add(row.agent_id);
      if (row.verified_at) seenAt.set(row.agent_id, row.verified_at);
    }
  }
  return { verified, seenAt };
}

/**
 * WHO PUT THESE LISTINGS UP, BY NAME, FOR THE TWO SENTENCES THAT NEED ONE.
 *
 * ONE INDEXED READ FOR THE WHOLE PAGE, the same shape as `getAgentBadges`
 * above and for the same reason: `agents` is RLS-bound to the agent themselves
 * and to staff, correctly, so the catalogue cannot join it and must not be
 * able to. `public.listing_lister` is the published door beside
 * `agent_badges`: two columns, `listing_id` and `lister_name`, published
 * listings only, and NULL for an owner listing because "Listed by the owner"
 * names nobody by design. It publishes no phone number, no email address, no
 * address, no document number, no user id and no verification tier, and the
 * migration that created it reads that back in its own body.
 *
 * A MISSING ROW IS A MISSING NAME, NOT AN EMPTY ONE. The map holds only the
 * ids the view answered for with a non-null name, so `mapRow` can leave the
 * field ABSENT rather than setting it to undefined. `fillLister` then draws no
 * line at all, which is the behaviour every reader had before this existed.
 * The failure mode of this function is a sentence that does not appear, never
 * a sentence with a placeholder or a wrong name in it.
 */
async function getListerNames(
  supabase: Client,
  listingIds: string[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (listingIds.length === 0) return names;
  const { data, error } = await supabase
    /* Not in `database.types.ts`, which is generated from the tables. The view
       is new; the cast is to the row shape this file already asserts in its
       spec, and nothing else about the client's typing is widened. */
    .from("listing_lister")
    .select("listing_id, lister_name")
    .in("listing_id", listingIds);
  if (error || !data) return names;
  for (const row of data as unknown as { listing_id: string; lister_name: string | null }[]) {
    const trimmed = (row.lister_name ?? "").trim();
    if (trimmed !== "") names.set(row.listing_id, trimmed);
  }
  return names;
}

/**
 * V-05: WHAT RENTERS WHO WENT THERE FOUND, AS A COUNT. One read of the
 * published view for the whole page, in parallel with the others. The view
 * only answers for published real listings with two answers or more, so a
 * missing row is the ordinary case and draws no line. A failed read is an
 * empty map: the failure mode is a line that does not appear.
 */
async function getRenterTruth(
  supabase: Client,
  listingIds: string[],
): Promise<Map<string, { attended: number; asListed: number; lastAt: string }>> {
  const out = new Map<string, { attended: number; asListed: number; lastAt: string }>();
  if (listingIds.length === 0) return out;
  try {
    const { data, error } = await (supabase as unknown as SupabaseClient)
      .from("listing_truth_summary")
      .select("listing_id, attended, as_listed, last_at")
      .in("listing_id", listingIds);
    if (error || !data) return out;
    for (const row of data as { listing_id: string; attended: number; as_listed: number; last_at: string }[]) {
      out.set(row.listing_id, { attended: row.attended, asListed: row.as_listed, lastAt: row.last_at });
    }
  } catch {
    return new Map();
  }
  return out;
}

/** Map raw rows into listings, resolving references and review stats in bulk. */
async function mapRows(supabase: Client, rows: ListingRow[]): Promise<Listing[]> {
  if (rows.length === 0) return [];
  const [stateNames, amenityCodes, stats, signedVideos, badges, listerNames, renterTruth] = await Promise.all([
    getStateNames(),
    getAmenityCodes(),
    getReviewStats(
      supabase,
      rows.map((r) => r.id),
    ),
    signVideos(
      supabase,
      rows.flatMap((r) => (r.listing_videos ?? []).map((v) => v.storage_path)),
    ),
    getAgentBadges(supabase, [...new Set(rows.map((r) => r.agent_id))]),
    getListerNames(supabase, rows.map((r) => r.id)),
    getRenterTruth(supabase, rows.filter((r) => !r.is_demo).map((r) => r.id)),
  ]);
  const ids = rows.map((r) => r.id);
  const [compounds, services, units] = await Promise.all([
    getCompoundFacts(supabase, ids),
    getServiceFacts(supabase, ids),
    getUnitFacts(supabase, ids),
  ]);
  return rows.map((row) => {
    const listing = mapRow(
      row,
      stateNames,
      amenityCodes,
      stats,
      signedVideos,
      badges.verified,
      listerNames,
      badges.seenAt,
      renterTruth,
    );
    const compound = compounds.get(row.id);
    const service = services.get(row.id);
    const unit = units.get(row.id);
    return {
      ...listing,
      ...(compound ? { compound } : {}),
      ...(service ? { service } : {}),
      ...(unit ? { unit } : {}),
    };
  });
}

/**
 * THE UNIT'S SHAPE (V-66), READ ON ITS OWN for the reason `getCompoundFacts`
 * gives: without migration `20260924150600` the read errors, which means no
 * shapes, and never costs the catalogue.
 */
async function getUnitFacts(supabase: Client, ids: string[]): Promise<Map<string, UnitFacts>> {
  const out = new Map<string, UnitFacts>();
  if (ids.length === 0) return out;
  try {
    const { data, error } = await supabase.from("listings").select(UNIT_BY_ID_COLUMNS).in("id", ids);
    if (error || !data) return out;
    for (const row of data as unknown as (UnitRow & { id: string })[]) {
      const unit = readUnit(row);
      if (unit) out.set(row.id, unit);
    }
  } catch {
    /* No shapes is the honest answer to a read that failed. */
  }
  return out;
}

/**
 * THE SERVICE CHARGE'S ANSWERS (V-68), READ ON THEIR OWN for the reason
 * `getCompoundFacts` gives: a database without migration `20260924150400`
 * answers with an error, which means nobody answered, and never costs the
 * catalogue.
 */
async function getServiceFacts(
  supabase: Client,
  ids: string[],
): Promise<Map<string, ServiceFacts>> {
  const out = new Map<string, ServiceFacts>();
  if (ids.length === 0) return out;
  try {
    const { data, error } = await supabase
      .from("listings")
      .select(SERVICE_BY_ID_COLUMNS)
      .in("id", ids);
    if (error || !data) return out;
    for (const row of data as unknown as (ServiceRow & { id: string })[]) {
      const service = readService(row);
      if (service) out.set(row.id, service);
    }
  } catch {
    /* No service facts is the honest answer to a read that failed. */
  }
  return out;
}

/**
 * THE COMPOUND'S FIVE ANSWERS (V-28), READ ON THEIR OWN.
 *
 * Not in the catalogue selects above, on purpose. A PostgREST select naming a
 * column that does not exist fails the whole read, and the catalogue has
 * already been taken off the air once by code that reached production ahead of
 * its migration. So these five come from their own small read, and a database
 * without migration `20260924150200` answers with an error that is treated as
 * "nobody answered", which is exactly what it means.
 *
 * After the batch above rather than inside it, so it can never fail that
 * batch; it is one primary key read either way.
 */
async function getCompoundFacts(
  supabase: Client,
  ids: string[],
): Promise<Map<string, Compound>> {
  const out = new Map<string, Compound>();
  if (ids.length === 0) return out;
  try {
    const { data, error } = await supabase
      .from("listings")
      .select(COMPOUND_BY_ID_COLUMNS)
      .in("id", ids);
    if (error || !data) return out;
    for (const row of data as unknown as (CompoundRow & { id: string })[]) {
      const compound = readCompound(row);
      if (compound) out.set(row.id, compound);
    }
  } catch {
    /* No compound facts is the honest answer to a read that failed. */
  }
  return out;
}

/**
 * Published listings by id, mapped for display. Used by the saved shortlist,
 * which holds listing ids rather than listings. One query, never a loop.
 */
export async function loadListingsByIds(
  supabase: Client,
  ids: string[],
): Promise<Map<string, Listing>> {
  const out = new Map<string, Listing>();
  if (ids.length === 0) return out;
  try {
    const { data, error } = await supabase
      .from("listings")
      // The shortlist renders cards, so no walkthroughs and no signing call.
      // NEW-A4-01: a signed-out reader is given the public point.
      .select(await pointSelect(supabase, LISTING_SELECT))
      .eq("status", "PUBLISHED")
      .in("id", ids);
    if (error) {
      await catalogueReadFailed("by_ids", error);
      return out;
    }
    if (!data) return out;
    for (const listing of await mapRows(supabase, data as unknown as ListingRow[])) {
      out.set(listing.id, listing);
    }
    return out;
  } catch (error) {
    await catalogueReadFailed("by_ids", error);
    return out;
  }
}

/**
 * V-10: one listing in ANY status, as the card model, read under the caller's
 * own client, so RLS decides (a draft comes back only to its owner). Used to
 * ask which saved searches a draft would match before it is published; never
 * for anything shown to somebody else. Null when it cannot be read.
 */
export async function loadOwnListingAnyStatus(supabase: Client, id: string): Promise<Listing | null> {
  try {
    /* NEW-A4-01: through `pointSelect`, like every other listing read, so a
       caller without a session asks for the public point. */
    const { data, error } = await supabase
      .from("listings")
      .select(await pointSelect(supabase, LISTING_SELECT))
      .eq("id", id)
      .limit(1);
    if (error || !data || data.length === 0) return null;
    const [listing] = await mapRows(supabase, data as unknown as ListingRow[]);
    return listing ?? null;
  } catch {
    return null;
  }
}

export class SupabaseListingRepository implements ListingRepository {
  readonly isSeed = false;

  /**
   * Where the rows are read through. The caller's own cookie-bound client by
   * default, so RLS answers as the person asking; the landing page's shared
   * read passes a cookie-free anonymous client instead (OPS-11), because a
   * value cached for every visitor must be the one a stranger would see.
   */
  constructor(private readonly connect: () => Promise<Client> = createClient) {}

  /**
   * The published catalogue, newest and featured first.
   *
   * What runs where, and why:
   *
   *   In SQL   category, free text, price floor and ceiling, bedroom, bathroom
   *            and guest minimums, instant book, and the amenity set through
   *            the `listing_amenities` join. Every one of them is a column
   *            predicate, so a row that cannot match must never be read, let
   *            alone occupy one of the page's rows.
   *   In memory  verified-only, which needs no predicate here: RLS publishes
   *            admitted rows only and admission is what makes them verified, so
   *            every row this query can return already satisfies it. The shared
   *            matcher still enforces it so that the browser count and the
   *            server answer cannot disagree.
   *
   * Free text moved into SQL and the reason was correctness, not speed. Matched
   * only in memory it ran AFTER the row cap, so it searched the newest 200
   * listings rather than the catalogue, and a term that lived on the 201st row
   * returned nothing at all. See `freeTextGroups` for how the term is pushed
   * down without ever narrowing past what the matcher would have kept.
   *
   * The matcher runs over the results either way, so SQL is an optimisation
   * and never the authority: the two halves cannot disagree.
   */
  async search(
    filter: ListingSearchFilter = {},
    opts: ListingSearchOptions = {},
  ): Promise<Listing[]> {
    if (filter.kind && propertyTypeFor(filter.kind) === null) return [];
    try {
      const supabase = await this.connect();

      // The amenity join is resolved first: with no listing carrying the whole
      // set there is nothing to ask the catalogue for.
      let amenityIds: string[] | null = null;
      if (filter.amenities && filter.amenities.length > 0) {
        amenityIds = await listingIdsWithAllAmenities(supabase, filter.amenities);
        if (amenityIds.length === 0) return [];
      }

      let query = supabase
        .from("listings")
        .select(await pointSelect(supabase, LISTING_SELECT))
        .eq("status", "PUBLISHED");
      if (filter.kind) {
        const propertyType = propertyTypeFor(filter.kind);
        if (propertyType) {
          query = query.eq(
            "property_type",
            propertyType as Database["public"]["Enums"]["property_type"],
          );
        }
      }
      if (amenityIds) query = query.in("id", amenityIds);

      /*
       * The search term, one `or` parameter per word.
       *
       * PostgREST ANDs repeated top-level parameters, and `.or()` appends
       * rather than replaces, so six words become six groups that must all
       * hold. `listings_title_trgm_idx` and its two neighbours are trigram
       * indexes over these same columns, which is what keeps an unanchored
       * `%term%` off a sequential scan.
       */
      const term = filter.q?.trim();
      if (term) {
        for (const group of freeTextGroups(term, await getStateNames())) {
          query = query.or(group);
        }
      }
      /* V-66: any of the areas, as ONE or-group. Each area contributes the
         group for its first word, which every row matching the whole area
         also matches, so SQL stays a superset of what `matchesFilter` keeps. */
      if (filter.areas && filter.areas.length > 0) {
        const stateNames = await getStateNames();
        const parts = filter.areas.flatMap((area) => freeTextGroups(area, stateNames).slice(0, 1));
        if (parts.length === filter.areas.length) query = query.or(parts.join(","));
      }

      if (filter.intent) {
        query = query.eq(
          "listing_intent",
          filter.intent as Database["public"]["Enums"]["listing_intent"],
        );
        /* The rent market is tenancies (V-26, UX-07): a row with no positive
           rate, which is the column `headlinePrice` reads to call a row a
           rate. A row that leads with a nightly or per-head rate is a stay or
           a table, so it is narrowed out here; `matchesFacts` decides the
           rest with the same `rentMeansTenancy` rule, for the drawer's count
           and the alerts. */
      }
      /* V-26 and V-67 ask the same question of the same column. */
      if (filter.propertySide || rentMeansTenancy(filter)) {
        query = query.or("rate_minor.is.null,rate_minor.lte.0");
      }

      /*
       * Budget, across three money columns rather than one.
       *
       * A row leads with an asking price, a nightly rate or a rent, and which
       * one it leads with is a property of the row rather than of the query, so
       * the predicate has to allow any of the three to satisfy the bound. An OR
       * of three AND groups does exactly that in one PostgREST call.
       *
       * This stays an optimisation and never the authority: `matchesFilter`
       * runs `headlinePrice` over every row that comes back and judges the one
       * figure the row actually leads with, so a listing whose rent fits the
       * budget but whose nightly rate does not is filtered out in memory. SQL
       * narrows, the matcher decides, and the two cannot disagree.
       */
      /*
       * V-65: on the Rent market the budget is the cash at the door, which is
       * never less than one period's rent. So a rent CEILING is still a safe
       * narrowing (cash within budget implies rent within budget), but a rent
       * FLOOR is not (a 2m rent can be 4m at the door), and the floor is left
       * to `matchesFacts` alone.
       */
      const cashBudget = rentMeansTenancy(filter);
      const sqlMin = cashBudget ? undefined : filter.minPriceMinor;
      const wantsBudget = sqlMin !== undefined || filter.maxPriceMinor !== undefined;
      if (wantsBudget) {
        const bounds = (column: string) => {
          const parts = [`${column}.gt.0`];
          if (sqlMin !== undefined) {
            parts.push(`${column}.gte.${sqlMin}`);
          }
          if (filter.maxPriceMinor !== undefined) {
            parts.push(`${column}.lte.${filter.maxPriceMinor}`);
          }
          return `and(${parts.join(",")})`;
        };
        query = query.or(
          [bounds("rent_amount_minor"), bounds("rate_minor"), bounds("sale_price_minor")].join(
            ",",
          ),
        );
      }
      if (filter.bedrooms !== undefined) query = query.gte("bedrooms", filter.bedrooms);
      if (filter.bathrooms !== undefined) query = query.gte("bathrooms", filter.bathrooms);
      /*
       * Party size and instant book are decided in memory now, and there is no
       * predicate to push down for either.
       *
       * `max_guests` and `instant_book` were dropped with the short-stay model.
       * The matcher still answers both: `sleeps` falls back to the
       * two-per-bedroom convention where no capacity is declared, which is now
       * every database row, and `instantBook` is false on every one of them.
       * Naming that here rather than deleting the branch silently, because the
       * filter drawer still offers both controls and a reader of this method is
       * entitled to know why they are missing from the SQL.
       */

      /*
       * Light and water, pushed down rather than filtered after the fact.
       *
       * `listings_power_idx` and `listings_water_idx` are partial indexes on
       * `status = 'PUBLISHED'`, which is the predicate already on this query,
       * so these three land on an index rather than a scan.
       *
       * The null half matters as much as the value half: a row where the host
       * never answered must not come back for somebody who asked for a
       * generator, and `neq` alone would not exclude it, because in SQL
       * `null <> 'NONE'` is null and a null predicate is not true. The
       * shared matcher runs afterwards and would catch it, but a predicate
       * that leans on a later pass to be correct is one refactor from being
       * wrong, so it is stated here too.
       */
      if (filter.powerBackup) {
        query = query.not("power_backup", "is", null).neq("power_backup", "NONE");
      }
      if (filter.powerBandA) query = query.eq("power_grid", "BAND_A");
      if (filter.waterSupply && filter.waterSupply.length > 0) {
        query = query.in("water_supply", filter.waterSupply);
      }

      /*
       * WHO IS OFFERING IT, pushed down onto the index Track G already built.
       *
       * `listings_role_published_idx` is `(listing_role, listing_intent,
       * state_code, city)`, partial on published rows, and until now nothing
       * in this tree queried it: the column shipped, the labels shipped in
       * `LISTING_ROLE_FILTER_LABEL`, and no reader could ask the question.
       * This is the ask.
       *
       * `listings.listing_role` is NOT NULL in the database, so every
       * published row has an answer and this predicate never silently drops
       * one. The row type this file maps from still admits null, because the
       * generated types do, and `isListingRole` already narrows it; the
       * shared matcher states in words what `in` does here anyway, so a
       * listing with no declared role is not shown to somebody who asked for
       * an owner direct. Both halves say so, because a predicate that leans
       * on a later pass to be correct is one refactor from wrong.
       */
      if (filter.listerRoles && filter.listerRoles.length > 0) {
        query = query.in("listing_role", filter.listerRoles);
      }

      /*
       * Hiding the example listings is pushed down, unlike most of the flags
       * above, because it is the one filter that will one day match a large
       * fraction of the catalogue. Filtering it in memory would spend the
       * page's whole row budget on rows that are then discarded, which is the
       * exact shape that makes a ceiling silently return too few results.
       *
       * `listings_demo_idx` is partial on `is_demo = true`, so this predicate
       * is answered from the small side of the table.
       */
      if (filter.excludeDemo) query = query.eq("is_demo", false);

      /*
       * THE MOVE-IN COST ORDER, AND THE INDEX THAT HAS NEVER BEEN QUERIED.
       *
       * `listings_move_in_cost_idx` is partial on published rows with a stated
       * total, and until this read nothing in the tree asked for it. `nullsFirst: false` is the honesty
       * half: a listing whose lister declared no total is not cheap, it is
       * unstated, so it sorts after every listing that said a number rather
       * than ahead of all of them as a null would.
       */
      /* V-22: Newest orders on the date it went live BEFORE the ceiling, for
         the same reason move-in does; the page still sorts what comes back. */
      if (opts.order === "newest") {
        query = query.order("published_at", { ascending: false, nullsFirst: false });
      }
      if (opts.order === "move-in") {
        query = query.order("total_move_in_cost_minor", {
          ascending: true,
          nullsFirst: false,
        });
      }

      /* V-06: there is no `featured` any more. The read is newest first, and
         "Recommended" is decided over what comes back by the published
         formula in `ranking.ts`, which nobody can pay to move. */
      const { data, error } = await query
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(rowCap(opts.limit));
      if (error) {
        await catalogueReadFailed("search", error);
        return [];
      }
      if (!data) return [];

      const listings = await mapRows(supabase, data as unknown as ListingRow[]);
      return listings.filter((l) => matchesFilter(l, filter));
    } catch (error) {
      await catalogueReadFailed("search", error);
      return [];
    }
  }

  /**
   * A short, varied rail. Six listings, and it used to read two hundred to find
   * them.
   *
   * `diversePick` alternates between property kinds, so it needs a pool wider
   * than its output or it simply returns the newest six. It does not need the
   * whole catalogue page. `RECOMMENDED_POOL_FACTOR` is the width of that pool
   * relative to the ask, and ten is comfortably more than the six kinds the
   * mapping can produce.
   *
   * The cap is an option rather than a filter for the reason `types.ts` gives:
   * it changes what the read costs and must never change which listings match.
   * That holds here because the rail promises "some good ones" rather than
   * "all of them", which is exactly the case the option is safe in.
   */
  async recommended(limit = 6): Promise<Listing[]> {
    const pool = await this.search({}, { limit: limit * RECOMMENDED_POOL_FACTOR });
    return diversePick(pool, limit);
  }

  async byId(id: string): Promise<Listing | null> {
    try {
      const supabase = await this.connect();
      const { data, error } = await supabase
        .from("listings")
        // The one surface a walkthrough belongs on, so it pays for the signing.
        .select(await pointSelect(supabase, LISTING_DETAIL_SELECT))
        .eq("status", "PUBLISHED")
        .eq("id", id)
        .maybeSingle();
      if (error) {
        await catalogueReadFailed("by_id", error);
        return null;
      }
      if (!data) return null;
      const [listing] = await mapRows(supabase, [data as unknown as ListingRow]);
      return listing ?? null;
    } catch (error) {
      await catalogueReadFailed("by_id", error);
      return null;
    }
  }

  /**
   * The same read, keyed on the code a person read out over the phone.
   *
   * `PUBLISHED` is kept, deliberately. A code for a listing that is still in
   * review correctly finds nothing for a stranger, while remaining something
   * the lister can quote to support, who read it through the admin console and
   * not through this door.
   *
   * The caller passes a value `lib/listings/reference.ts` has already
   * canonicalised, so this method never guesses at a shape.
   */
  async byReference(reference: string): Promise<Listing | null> {
    try {
      const supabase = await this.connect();
      const { data, error } = await supabase
        .from("listings")
        .select(await pointSelect(supabase, LISTING_DETAIL_SELECT))
        .eq("status", "PUBLISHED")
        .eq("reference", reference)
        .maybeSingle();
      if (error) {
        await catalogueReadFailed("by_reference", error);
        return null;
      }
      if (!data) return null;
      const [listing] = await mapRows(supabase, [data as unknown as ListingRow]);
      return listing ?? null;
    } catch (error) {
      await catalogueReadFailed("by_reference", error);
      return null;
    }
  }
}
