import "server-only";
import { reportReadError } from "@/lib/observability/read-error";
import { pointSelect } from "../supabase/public-point";

import { isSupabaseConfigured } from "../supabase/env";
import { staysClient, type StaysClient } from "./db";
import { openState } from "./hours";
import { PAGE_SIZE } from "./filters";
import type {
  AccommodationRow,
  BusinessRow,
  CancellationPolicyRow,
  RatePlanRow,
  RestaurantCard,
  RestaurantDetail,
  RoomTypeDetail,
  ServiceWindowRow,
  StayDetail,
  StaySearchRow,
} from "./types";

/**
 * Server-only reads over the stays tables.
 *
 * Every read goes through the caller's own RLS-bound client and asks; the
 * database answers with rows or with nothing. A signed-out visitor sees
 * PUBLISHED rows because the policies say so, and this module never
 * re-implements that rule. Every failure degrades into a renderable state:
 * an empty shelf, a null detail. Nothing here throws.
 */

/**
 * How a read is made. By default through the request's own RLS-bound client,
 * answering empty on any failure, as these reads always have. The public
 * catalogue cache (`lib/catalogue/stays.ts`) passes a cookie-free anonymous
 * client and `strict`, so a failed read THROWS instead of answering empty: an
 * empty answer returned inside the shared cache would be kept and served to
 * everybody, and a throw keeps nothing.
 */
export type StaysReadOptions = { client?: StaysClient; strict?: boolean };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/*
 * THE TWO PUBLIC COLUMN LISTS FOR `businesses`.
 *
 * `public.businesses` no longer hands `anon` the whole table. It grants a
 * column list, the way `public.listings` always has, and the twelve columns
 * left out are personal or internal: `address`, `phone`, `email`,
 * `cac_number`, `registered_name`, `tin`, `representative_name`,
 * `representative_phone`, `consents`, `reviewer_id`, `review_notes` and
 * `verification_tier`.
 *
 * A MISSING COLUMN PRIVILEGE FAILS THE WHOLE SELECT, not just that column.
 * That is the second half of the eleven hour catalogue outage of 23 September.
 * So these two strings are not tidiness: naming a withheld column in either of
 * them refuses the stay page or the restaurant page to every signed-out
 * visitor. `scripts/probes/businesses_column_grants.sql` runs both of them as
 * `anon` against the live database and fails if either is stranded.
 */
/*
 * `public.accommodations` carried the same shape as `businesses`: a table-wide
 * grant to `anon` under a `status = 'PUBLISHED'` policy, over a row holding the
 * exact street address and the internal reviewer's notes. It is narrowed the
 * same way and this is the list that survives it.
 */
const ACCOMMODATION_PUBLIC_COLUMNS =
  "id, business_id, name, slug, description, source, fulfilment, star_rating, check_in_from, check_out_by, house_rules, cancellation_policy_id, status, state_code, city, area, latitude, longitude, featured, is_demo, published_at";

const STAY_BUSINESS_COLUMNS = "id, name, slug, kind, source, is_demo";
const RESTAURANT_BUSINESS_COLUMNS =
  "id, owner_id, agent_id, kind, name, slug, description, source, status, state_code, city, area, latitude, longitude, is_demo, published_at";

/** The stays client is a loose cast of the server client; it carries `auth`. */
function asAuth(client: unknown): Parameters<typeof pointSelect>[0] {
  return client as Parameters<typeof pointSelect>[0];
}

/** A finite number, whatever the driver handed back, or null. Never NaN. */
function finiteOrNull(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * The undated stays shelf for a place: the projection in its standing order
 * (featured, then newest), through the same search function the filters use
 * so the two can never disagree about what exists.
 */
export async function listStaysShelf(
  scope: { stateCode?: string; city?: string } = {},
  limit = PAGE_SIZE,
  options: StaysReadOptions = {},
): Promise<StaySearchRow[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = options.client ?? (await staysClient());
    const { data, error } = await supabase.rpc("stays_search", {
      p_entity_kinds: ["listing", "accommodation"],
      p_state_code: scope.stateCode,
      p_city: scope.city,
      p_limit: limit,
    });
    await reportReadError("read.stays.listStaysShelf", error);
    if (error && options.strict) throw new Error("stays shelf read failed");
    if (error || !data) return [];
    return data;
  } catch (thrown) {
    if (options.strict) throw thrown;
    return [];
  }
}

/**
 * One accommodation with everything its page shows: the business behind it,
 * photos in order, amenities, room types with their rate plans and each
 * plan's policy, and the property-level policy summary.
 */
export async function getStayDetail(
  accommodationId: string,
  options: StaysReadOptions = {},
): Promise<StayDetail | null> {
  if (!isSupabaseConfigured() || !UUID_RE.test(accommodationId)) return null;
  try {
    const supabase = options.client ?? (await staysClient());

    const { data: accommodation, error: accommodationError } = await supabase
      /* NOT `select("*")`. Same reason as the business read below: this page
         is opened by signed-out visitors and `accommodations` withholds
         `address`, `reviewer_id` and `review_notes` from `anon`, exactly as
         `listings` always has. A star here would be refused outright and the
         stay page would answer not-found for every property. */
      .from("accommodations")
      /* NEW-A4-01: a signed-out visitor reads the public point. */
      .select(await pointSelect(asAuth(supabase), ACCOMMODATION_PUBLIC_COLUMNS))
      .eq("id", accommodationId)
      .maybeSingle();
    if (accommodationError && options.strict) throw new Error("stay read failed");
    if (!accommodation) return null;

    const [businessRes, photosRes, amenityLinksRes, roomTypesRes, catalogueRes] = await Promise.all([
      supabase
        /* THE PUBLIC COLUMNS AND NOT ONE MORE. `businesses` grants `anon` a
           COLUMN LIST rather than the table (ledger section 68), so this read
           names what a signed-out visitor may see. `phone` and `email` used to
           be selected here and were never drawn on any screen; they are the
           venue's contact details and they are now withheld from `anon`, so
           asking for them would fail THE WHOLE SELECT rather than one column
           and take the stay page down. */
        .from("businesses")
        .select(STAY_BUSINESS_COLUMNS)
        .eq("id", accommodation.business_id)
        .maybeSingle(),
      supabase
        .from("accommodation_photos")
        .select("id, accommodation_id, storage_path, position")
        .eq("accommodation_id", accommodationId)
        .order("position", { ascending: true }),
      supabase
        .from("accommodation_amenities")
        .select("amenity_id")
        .eq("accommodation_id", accommodationId),
      supabase
        .from("room_types")
        .select("*")
        .eq("accommodation_id", accommodationId)
        .eq("status", "PUBLISHED")
        .order("base_rate_minor", { ascending: true }),
      /* The shelf's own verdict on this property: the badge and the rating,
         read from the projection the search sorts by rather than recomputed
         here, so the detail screen and the card can never disagree about
         whether a human was checked. One indexed read on the unique
         (entity_kind, entity_id). */
      supabase
        .from("catalogue_entries")
        .select("verified, rating_avg, rating_count")
        .eq("entity_kind", "accommodation")
        .eq("entity_id", accommodationId)
        .maybeSingle(),
    ]);

    if (options.strict && [businessRes, photosRes, amenityLinksRes, roomTypesRes].some((r) => r.error)) {
      /* Reported first, then thrown so the cached reader keeps nothing. */
      for (const r of [businessRes, photosRes, amenityLinksRes, roomTypesRes]) if (r.error) await reportReadError("read.stays.getStay", r.error);
      throw new Error("stay read failed");
    }
    // A business that is not visible to this caller is a property that is not
    // on the shelf for them either.
    if (!businessRes.data) return null;

    const amenityIds = (amenityLinksRes.data ?? []).map((row) => row.amenity_id);
    const roomTypes = roomTypesRes.data ?? [];
    const roomTypeIds = roomTypes.map((row) => row.id);

    const [amenitiesRes, plansRes] = await Promise.all([
      amenityIds.length > 0
        ? supabase.from("amenities").select("code, label, category").in("id", amenityIds).order("code")
        : Promise.resolve({ data: [] as { code: string; label: string; category: string }[] }),
      roomTypeIds.length > 0
        ? supabase
            .from("rate_plans")
            .select("*")
            .in("room_type_id", roomTypeIds)
            .eq("active", true)
            .order("rate_minor", { ascending: true })
        : Promise.resolve({ data: [] as RatePlanRow[] }),
    ]);

    if (options.strict && [amenitiesRes, plansRes].some((r) => "error" in r && r.error)) {
      for (const r of [amenitiesRes, plansRes]) if ("error" in r && r.error) await reportReadError("read.stays.getStay", r.error);
      throw new Error("stay read failed");
    }
    const plans = plansRes.data ?? [];
    const policyIds = new Set<string>(plans.map((plan) => plan.cancellation_policy_id));
    if (accommodation.cancellation_policy_id) policyIds.add(accommodation.cancellation_policy_id);

    const policies = new Map<string, CancellationPolicyRow>();
    if (policyIds.size > 0) {
      const { data, error: policyError } = await supabase
        .from("cancellation_policies")
        .select("id, name, summary, rules, is_free_until_hours, refund_to")
        .in("id", [...policyIds]);
      if (policyError && options.strict) throw new Error("stay read failed");
      for (const policy of data ?? []) policies.set(policy.id, policy);
    }

    const room_types: RoomTypeDetail[] = roomTypes.map((room) => ({
      ...room,
      rate_plans: plans
        .filter((plan) => plan.room_type_id === room.id)
        .map((plan) => ({ ...plan, policy: policies.get(plan.cancellation_policy_id) ?? null })),
    }));

    return {
      accommodation: accommodation as Omit<AccommodationRow, "address">,
      business: businessRes.data,
      photos: photosRes.data ?? [],
      amenities: amenitiesRes.data ?? [],
      room_types,
      policy: accommodation.cancellation_policy_id
        ? (policies.get(accommodation.cancellation_policy_id) ?? null)
        : null,
      catalogue: catalogueRes.data
        ? {
            verified: catalogueRes.data.verified === true,
            /* `rating_avg` is numeric(3,2) and `rating_count` a count, and a
               driver that hands either back as a string must not turn a real
               rating into no rating. Anything that is not a finite number is
               "no rating", never a zero. */
            rating_avg: finiteOrNull(catalogueRes.data.rating_avg),
            rating_count: finiteOrNull(catalogueRes.data.rating_count) ?? 0,
          }
        : null,
    };
  } catch (thrown) {
    if (options.strict) throw thrown;
    return null;
  }
}

/** One restaurant with its profile, hours and whether it is seating now. */
export async function getRestaurantDetail(
  businessId: string,
  now: Date = new Date(),
  options: StaysReadOptions = {},
): Promise<RestaurantDetail | null> {
  if (!isSupabaseConfigured() || !UUID_RE.test(businessId)) return null;
  try {
    const supabase = options.client ?? (await staysClient());
    const { data: business, error: businessError } = await supabase
      /* NOT `select("*")`. This read is issued by a signed-out visitor on
         `/restaurant/[id]`, and `businesses` withholds its personal columns
         from `anon` (ledger section 68). A star here asks for `cac_number`,
         `tin` and the representative's phone number and would be refused
         outright, so the page would answer not-found for every venue. */
      .from("businesses")
      .select(await pointSelect(asAuth(supabase), RESTAURANT_BUSINESS_COLUMNS))
      .eq("id", businessId)
      .eq("kind", "restaurant")
      .maybeSingle();
    if (businessError && options.strict) throw new Error("restaurant read failed");
    if (!business) return null;

    const [profileRes, windowsRes] = await Promise.all([
      supabase.from("restaurant_profiles").select("*").eq("business_id", businessId).maybeSingle(),
      supabase
        .from("service_windows")
        .select("*")
        .eq("business_id", businessId)
        .order("weekday")
        .order("opens"),
    ]);

    if (options.strict && (profileRes.error || windowsRes.error)) throw new Error("restaurant read failed");
    const windows: ServiceWindowRow[] = windowsRes.data ?? [];
    const state = openState(windows, now);
    return {
      business: business as BusinessRow,
      profile: profileRes.data ?? null,
      windows,
      open_now: state.open_now,
      hours: state.hours,
    };
  } catch (thrown) {
    if (options.strict) throw thrown;
    return null;
  }
}

/**
 * Published restaurants for a place, each with open-now computed from its
 * service windows on the Lagos clock. Hours are fetched in one query for the
 * page rather than one per card.
 */
export async function listRestaurants(
  scope: { stateCode?: string; city?: string; openNow?: boolean } = {},
  limit = PAGE_SIZE,
  now: Date = new Date(),
): Promise<RestaurantCard[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const rows = await listRestaurantRows({ stateCode: scope.stateCode, city: scope.city }, limit);
    return restaurantCardsFrom(rows, now, scope.openNow === true);
  } catch {
    return [];
  }
}

/** A published restaurant's rows, before the clock is applied to its hours. */
export type RestaurantRows = {
  business: RestaurantCard["business"];
  profile: RestaurantCard["profile"];
  windows: ServiceWindowRow[];
};

/**
 * The rows behind `listRestaurants`, with no clock in them, so the public
 * catalogue cache can keep them and the open-now line is still worked out on
 * every request (`restaurantCardsFrom`).
 */
export async function listRestaurantRows(
  scope: { stateCode?: string; city?: string } = {},
  limit = PAGE_SIZE,
  options: StaysReadOptions = {},
): Promise<RestaurantRows[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = options.client ?? (await staysClient());
    let query = supabase
      .from("businesses")
      .select(
        await pointSelect(
          asAuth(supabase),
          "id, name, slug, area, city, state_code, source, is_demo, latitude, longitude",
        ),
      )
      .eq("kind", "restaurant")
      .eq("status", "PUBLISHED")
      .order("published_at", { ascending: false })
      .limit(limit);
    if (scope.stateCode) query = query.eq("state_code", scope.stateCode);
    if (scope.city) query = query.ilike("city", scope.city);

    const { data: businesses, error } = await query;
    await reportReadError("read.stays.listRestaurants", error);
    if (error && options.strict) throw new Error("restaurant list read failed");
    if (error || !businesses || businesses.length === 0) return [];
    const ids = businesses.map((b) => b.id);

    const [profilesRes, windowsRes] = await Promise.all([
      supabase.from("restaurant_profiles").select("*").in("business_id", ids),
      supabase.from("service_windows").select("*").in("business_id", ids),
    ]);
    if (options.strict && (profilesRes.error || windowsRes.error)) throw new Error("restaurant list read failed");

    const profiles = new Map((profilesRes.data ?? []).map((p) => [p.business_id, p]));
    const windowsByBusiness = new Map<string, ServiceWindowRow[]>();
    for (const w of windowsRes.data ?? []) {
      const list = windowsByBusiness.get(w.business_id) ?? [];
      list.push(w);
      windowsByBusiness.set(w.business_id, list);
    }

    return businesses.map((business) => ({
      business,
      profile: profiles.get(business.id) ?? null,
      windows: windowsByBusiness.get(business.id) ?? [],
    }));
  } catch (thrown) {
    if (options.strict) throw thrown;
    return [];
  }
}

/** The cards, with open-now worked out on `now`'s Lagos clock. */
export function restaurantCardsFrom(rows: RestaurantRows[], now: Date, openNowOnly: boolean): RestaurantCard[] {
  const cards: RestaurantCard[] = rows.map(({ business, profile, windows }) => {
    const state = openState(windows, now);
    return { business, profile, open_now: state.open_now, hours: state.hours };
  });
  return openNowOnly ? cards.filter((card) => card.open_now) : cards;
}
