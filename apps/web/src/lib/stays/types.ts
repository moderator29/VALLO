/**
 * Domain types for the stays side: the rows the M1 to M9 migrations created,
 * as the application reads them.
 *
 * Money is integer kobo everywhere here, exactly as the columns are bigint
 * kobo. Nothing in this module formats money; that is `formatMoney` in
 * `@vallo/i18n` at the edge, and nowhere else.
 *
 * Every field name below is the column name, so a reader can hold this file
 * beside the migration and see the same thing.
 */
import type { HoursAnswer } from "./hours";

export type BusinessKind =
  | "hotel"
  | "serviced_apartments"
  | "guest_house"
  | "resort"
  | "shortlet_operator"
  | "restaurant"
  | "agency";

export type MealPlan = "room_only" | "breakfast" | "half_board" | "full_board";

export type SourceKind = "first_party" | "partner" | "licensed_data";

export type FulfilmentMode = "vallo" | "external_completion" | "partner_handoff";

export type RoomCategory = "single" | "double" | "twin" | "suite" | "family" | "dorm";

export const ROOM_CATEGORIES: readonly RoomCategory[] = [
  "single",
  "double",
  "twin",
  "suite",
  "family",
  "dorm",
] as const;

export type LandmarkKind =
  | "airport"
  | "business_district"
  | "market"
  | "mall"
  | "stadium"
  | "beach"
  | "park"
  | "transport"
  | "education"
  | "hospital"
  | "worship"
  | "other";

export type CatalogueEntityKind = "listing" | "accommodation" | "restaurant";

/** The existing listing_status vocabulary, reused by businesses, accommodations and room types. */
export type PublishStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "MORE_INFO_REQUIRED"
  | "APPROVED"
  | "PUBLISHED"
  | "REJECTED"
  | "SUSPENDED";

/** One tier of a cancellation policy: refund_bps of the total until hours_before check-in. */
export type CancellationTier = {
  hours_before: number;
  refund_bps: number;
};

export type CancellationPolicyRow = {
  id: string;
  name: string;
  summary: string;
  rules: CancellationTier[];
  is_free_until_hours: number | null;
  refund_to: "wallet";
};

export type BusinessRow = {
  id: string;
  owner_id: string | null;
  agent_id: string | null;
  kind: BusinessKind;
  name: string;
  slug: string;
  description: string | null;
  source: SourceKind;
  status: PublishStatus;
  state_code: string | null;
  city: string | null;
  area: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  email: string | null;
  is_demo: boolean;
  published_at: string | null;
};

export type AccommodationRow = {
  id: string;
  business_id: string;
  name: string;
  slug: string;
  description: string | null;
  source: SourceKind;
  fulfilment: FulfilmentMode;
  star_rating: number | null;
  check_in_from: string | null;
  check_out_by: string | null;
  house_rules: string | null;
  cancellation_policy_id: string | null;
  status: PublishStatus;
  state_code: string | null;
  city: string | null;
  area: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  featured: boolean;
  is_demo: boolean;
  published_at: string | null;
};

export type AccommodationPhotoRow = {
  id: string;
  accommodation_id: string;
  storage_path: string;
  position: number;
};

export type BedSpec = { kind: string; count: number };

export type RoomTypeRow = {
  id: string;
  accommodation_id: string;
  name: string;
  category: RoomCategory;
  description: string | null;
  sleeps: number;
  beds: BedSpec[];
  size_sqm: number | null;
  units_total: number;
  base_rate_minor: number;
  currency: "NGN";
  status: PublishStatus;
  is_demo: boolean;
};

export type RatePlanRow = {
  id: string;
  room_type_id: string;
  name: string;
  meal_plan: MealPlan;
  cancellation_policy_id: string;
  rate_minor: number;
  currency: "NGN";
  min_stay_nights: number;
  max_stay_nights: number | null;
  active: boolean;
};

export type RateCalendarRow = {
  rate_plan_id: string;
  date: string;
  rate_minor: number | null;
  closed: boolean;
};

export type RoomInventoryRow = {
  room_type_id: string;
  date: string;
  units_open: number;
  units_booked: number;
};

export type RestaurantProfileRow = {
  business_id: string;
  cuisines: string[];
  price_band: number | null;
  menu_url: string | null;
  dress_code: string | null;
  parking: boolean;
  power_backup: boolean;
  outdoor: boolean;
};

/** weekday 0 is Sunday, as Postgres extract(dow). Times are "HH:MM:SS" in Lagos. */
export type ServiceWindowRow = {
  id: string;
  business_id: string;
  weekday: number;
  opens: string;
  last_seating: string;
  closes: string;
  covers: number;
};

export type LandmarkRow = {
  id: string;
  name: string;
  slug: string;
  kind: LandmarkKind;
  state_code: string;
  city: string;
  latitude: number;
  longitude: number;
  aliases: string[];
  source: SourceKind;
};

/** What `public.landmarks_resolve` returns per row. */
export type LandmarkHit = Omit<LandmarkRow, "aliases" | "source"> & { score: number };

/** One row of the projection, as the shelf reads it. */
export type CatalogueEntryRow = {
  id: string;
  entity_kind: CatalogueEntityKind;
  entity_id: string;
  title: string;
  area: string | null;
  city: string | null;
  state_code: string | null;
  kind: string;
  source: SourceKind;
  verified: boolean;
  is_demo: boolean;
  featured: boolean;
  headline_price_minor: number | null;
  headline_price_period: string | null;
  price_band: number | null;
  max_sleeps: number | null;
  cover_path: string | null;
  latitude: number | null;
  longitude: number | null;
  rating_avg: number | null;
  rating_count: number;
  has_breakfast: boolean;
  has_free_cancellation: boolean;
  room_categories: RoomCategory[];
  amenity_codes: string[];
};

/**
 * One row of `public.stays_search`: a projection row plus what a dated query
 * adds. `total_minor` is the whole stay for the rooms asked, in kobo, and is
 * null for anything that does not sell nights.
 */
export type StaySearchRow = CatalogueEntryRow & {
  distance_m: number | null;
  nights: number | null;
  room_type_id: string | null;
  rate_plan_id: string | null;
  nightly_minor: number | null;
  total_minor: number | null;
  total_count: number;
};

export type StaySearchResult = {
  rows: StaySearchRow[];
  total: number;
  /** The landmark the `near` term resolved to, when it did. */
  near: LandmarkHit | null;
};

/** A room type with its plans, as the stay page shows it. */
export type RoomTypeDetail = RoomTypeRow & {
  rate_plans: (RatePlanRow & { policy: CancellationPolicyRow | null })[];
  /**
   * The room type's own photographs (`room_type_photos`), cover first. Empty
   * when it has none, and empty for every room while the pending migration
   * that creates the table has not run.
   */
  photos?: { storage_path: string; position: number }[];
};

/**
 * The projection's own verdict on one accommodation: the badge and the
 * rating, exactly as the shelf card reads them.
 *
 * THE SHIELD IS THE PROJECTION'S, NOT A SECOND OPINION. `catalogue_entries.verified`
 * for an accommodation is `source = 'first_party' and not is_demo and the
 * owning agent carries a verified badge`, recomputed by the M9 triggers. Any
 * other arithmetic on the detail screen would let a property wear a shield on
 * its own page that the shelf refuses it, and ledger rule 12 says the shield
 * only ever means a human was checked.
 *
 * `rating_avg` is null and `rating_count` is 0 for every accommodation today,
 * because `reviews.listing_id` is a foreign key to `listings` and an
 * accommodation id matches no review row. This carries the projection's
 * numbers rather than inventing any, so the face lights up on its own the day
 * reviews can key on a stay and the M9 refresh averages them.
 */
export type StayCatalogueFacts = Pick<
  CatalogueEntryRow,
  "verified" | "rating_avg" | "rating_count"
>;

export type StayDetail = {
  /* `address` is not here: `anon` may not read the exact street address of a
     property, the same rule `listings` has always carried. */
  accommodation: Omit<AccommodationRow, "address">;
  /* `phone` and `email` are gone from this shape on purpose: `anon` may not
     read them since ledger section 68, and no screen ever drew them. */
  business: Pick<BusinessRow, "id" | "name" | "slug" | "kind" | "source" | "is_demo">;
  photos: AccommodationPhotoRow[];
  amenities: { code: string; label: string; category: string }[];
  room_types: RoomTypeDetail[];
  /** The property-level policy, when one is set; plans carry their own. */
  policy: CancellationPolicyRow | null;
  /**
   * The projection row behind this accommodation, or null when it has none
   * (an unpublished property, read by its own owner). Null is never "verified
   * and unrated"; it is "the shelf has nothing to say about this yet", and the
   * face draws neither shield nor rating for it.
   */
  catalogue: StayCatalogueFacts | null;
};

export type RestaurantDetail = {
  /* THE PUBLIC COLUMNS ONLY, and not `BusinessRow`. `/restaurant/[id]` is a
     signed-out surface and `businesses` withholds its personal columns from
     `anon`, so the row this carries is the one a visitor may actually be
     handed. See `RESTAURANT_BUSINESS_COLUMNS` in `lib/stays/queries.ts`. */
  business: Omit<BusinessRow, "address" | "phone" | "email">;
  profile: RestaurantProfileRow | null;
  windows: ServiceWindowRow[];
  open_now: boolean;
  /** What the clock says, as a fact; `hoursLabel` puts it in the reader's words ("Open until 23:00"). */
  hours: HoursAnswer;
};

export type RestaurantCard = {
  business: Pick<BusinessRow, "id" | "name" | "slug" | "area" | "city" | "state_code" | "source" | "is_demo" | "latitude" | "longitude">;
  profile: RestaurantProfileRow | null;
  open_now: boolean;
  hours: HoursAnswer;
};
