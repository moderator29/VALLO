import "server-only";
import { reportReadError } from "@/lib/observability/read-error";
import { withPublicPoint } from "../supabase/public-point";
import { PrivateFieldsUnavailable, withBusinessPrivate } from "../supabase/private-fields";

/**
 * Reading a host's own application.
 *
 * Everything goes through the caller's own RLS-bound client:
 * `businesses_owner_all` scopes rows by `owner_id`, and every child table
 * scopes through `private.owns_business` or `private.owns_accommodation`, so
 * another host's application simply does not come back. Nothing here uses the
 * service role.
 *
 * NEITHER READ EVER THROWS UPWARDS. The wizard renders whatever happens here:
 * a failed read comes back as an empty draft rather than as an error screen,
 * because the draft the person is typing lives in the browser until it is
 * saved and a crash would be the one way to lose it.
 *
 * The one exception is a draft whose private fields (contact, registration,
 * consents) could not be read. An empty wizard over a business that has them
 * would save blanks over the real values, so `readMyHostDraft` says
 * "unavailable" and the wizard is not drawn.
 */

import { resolveSession } from "../actions/session";
import {
  emptyHostDraft,
  type ConsentId,
  type HostDocumentKind,
  type HostDraft,
  type HostType,
} from "./onboarding";
import type { Database } from "../supabase/database.types";
import { accommodationPhotoUrl } from "../stays/photos";
import { businessPhotoUrl } from "../stays/business-photos";
import { MAX_BUSINESS_PHOTOS } from "./photos";
import { bedsTotal } from "./stays-setup";
import { readArrivalCharges } from "../stays/arrival-charges";
import { lagosToday } from "../bookings/schema";
import { readHostAgreementVersion } from "./agreement";
import { acceptedVersion } from "../legal/workspace-acceptance";
import {
  BUSINESS_TIER_NAME,
  asBusinessTier,
  ladderView,
  nextRung,
  type BusinessLadderRow,
  type BusinessRung,
  type BusinessTier,
} from "../admin/business-ladder";

/**
 * THE BEDROOMS AND BEDS A ROOM TYPE RECORDS.
 *
 * THIS COMMENT USED TO SAY "`room_types.beds` has no shape constraint" AND
 * THAT WAS FALSE. The column has carried
 * `room_types_beds_check (jsonb_typeof(beds) = ''array'')` since it was
 * created, with the shape written on the line above it in
 * `20260918081453_m04_room_types_units_rate_plans_rate_calendar.sql`. The
 * sentence was inherited rather than checked, the shortlet screen was written
 * from it and wrote an OBJECT, and the probe that should have caught that
 * asserted a round trip BECAUSE of this sentence. Every real save would have
 * failed with `23514`. **A comment asserting an absence is exactly as
 * unverified as a test asserting a presence**, and this file now asserts
 * neither: `bedsTotal` reads what is there and the probe asks the database.
 *
 * WHAT IS STILL UNCONSTRAINED, precisely. The column must be an ARRAY. What is
 * IN the array is not checked by anything: the schema's own comment says the
 * entries are "validated in the app" and no schema in this repository
 * validates them, which is a second unbacked claim and is named in the ledger.
 * So every entry is read defensively and nothing here throws, because a
 * malformed row must not take down the step that would let somebody fix it.
 *
 * `bedrooms` IS ITS OWN COLUMN, added by
 * `20260922200000_imgc_a_bedroom_is_not_a_bed.sql`, because a bedroom is not a
 * bed and can only enter that array as a fake entry. Null while that migration
 * has not run, and null for every hotel room type, which has never been asked.
 */
function readBeds(
  beds: unknown,
  bedrooms: unknown,
): { bedrooms: number | null; beds: number } | null {
  const total = bedsTotal(beds);
  const rooms =
    typeof bedrooms === "number" && Number.isInteger(bedrooms) && bedrooms >= 0
      ? bedrooms
      : null;
  if (total === 0 && rooms === null) return null;
  return { bedrooms: rooms, beds: total };
}

type BusinessRow = Database["public"]["Tables"]["businesses"]["Row"];
type ListingStatus = Database["public"]["Enums"]["listing_status"];

/** One of the caller's businesses, as the host's own list shows it. */
export type MyBusiness = {
  id: string;
  name: string;
  slug: string;
  kind: Database["public"]["Enums"]["business_kind"];
  status: ListingStatus;
  hostType: HostType | null;
  /** Rungs passed with no gap below, 0 to 4. Derived by the database. */
  verificationTier: number;
  verified: boolean;
  submittedAt: string | null;
  reviewedAt: string | null;
  /** The reviewer's words, when they sent it back or refused it. */
  reviewNotes: string | null;
  createdAt: string;
};

/* The business's contact and registration details, its reviewer's
   note and its tier are the owner's and staff's. The table read names only
   the public columns; the private ones come from `business_private_fields`,
   which answers only for the caller's own businesses. */
const BUSINESS_COLUMNS =
  "id, name, slug, kind, status, host_type, description, area, city, state_code, hygiene_attested_at, licence_attested_at, submitted_at, reviewed_at, verified, created_at";
const BUSINESS_PRIVATE_KEYS = [
  "phone",
  "email",
  "address",
  "registered_name",
  "cac_number",
  "tin",
  "representative_name",
  "representative_phone",
  "consents",
  "review_notes",
  "verification_tier",
] as const;

function asHostType(value: string | null): HostType | null {
  return value === "individual" || value === "business" || value === "restaurant" ? value : null;
}

/** The consents jsonb, read defensively: anything malformed is no consent. */
function readConsents(value: BusinessRow["consents"]): Partial<Record<ConsentId, string>> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Partial<Record<ConsentId, string>> = {};
  for (const id of ["accuracy", "terms", "processing"] as const) {
    const at = (value as Record<string, unknown>)[id];
    if (typeof at === "string" && at.length > 0) out[id] = at;
  }
  return out;
}

/**
 * The consents withdrawn, from `consents.withdrawals` (`[{id, at}]`), which
 * `saveHostDraft` appends to when a host unticks a consent they had given.
 * Anything malformed is skipped rather than thrown on.
 */
export function readConsentWithdrawals(value: unknown): { id: ConsentId; at: string }[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return [];
  const list = (value as Record<string, unknown>).withdrawals;
  if (!Array.isArray(list)) return [];
  return list.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const { id, at } = entry as Record<string, unknown>;
    return (id === "accuracy" || id === "terms" || id === "processing") && typeof at === "string"
      ? [{ id, at }]
      : [];
  });
}

/** A whole number from a column the generated types may not carry yet. */
function smallNumber(row: unknown, key: string): number | null {
  const value = (row as Record<string, unknown> | null)?.[key];
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

/**
 * The application the caller is still working on, with everything
 * `missingFrom` needs to say what is absent.
 *
 * "Still working on" is DRAFT, MORE_INFO_REQUIRED or SUBMITTED, newest first:
 * a host sent back for more information is editing the same row, and a host
 * who has submitted should still see what they sent rather than a blank
 * wizard. Nothing here creates a row; the first save does that.
 */
export type HostDraftRead = { state: "ready"; draft: HostDraft } | { state: "unavailable" };

/** The draft, or "unavailable" when its private fields could not be read. */
const HOST_ACCOMMODATION_READ =
  "id, name, latitude, longitude, star_rating, check_in_from, check_out_by, house_rules, cancellation_policy_id, accommodation_photos(id, storage_path, position), accommodation_amenities(amenities(code))";

export async function readMyHostDraft(): Promise<HostDraftRead> {
  try {
    return { state: "ready", draft: await loadMyHostDraft() };
  } catch (error) {
    if (error instanceof PrivateFieldsUnavailable) return { state: "unavailable" };
    return { state: "ready", draft: emptyHostDraft() };
  }
}

/**
 * The draft for read-only screens. An unreadable draft shows as none; nothing
 * on those screens can save it.
 */
export async function getMyHostDraft(): Promise<HostDraft> {
  const read = await readMyHostDraft();
  return read.state === "ready" ? read.draft : emptyHostDraft();
}

async function loadMyHostDraft(): Promise<HostDraft> {
  const session = await resolveSession();
  if (session.state !== "signed-in") return emptyHostDraft();

  try {
    const { data: publicBusiness } = await session.supabase
      .from("businesses")
      .select(BUSINESS_COLUMNS)
      .eq("owner_id", session.user.id)
      /* REJECTED too: a refused host edits the same application and sends it
         again, as on Airbnb and Booking.com, rather than starting over. */
      .in("status", ["DRAFT", "MORE_INFO_REQUIRED", "SUBMITTED", "REJECTED"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!publicBusiness) return emptyHostDraft();
    const [business] = await withBusinessPrivate(session.supabase, [publicBusiness], BUSINESS_PRIVATE_KEYS);
    if (!business) return emptyHostDraft();

    const [documents, accommodations, restaurant, windows, bankAccounts, businessPhotos] = await Promise.all([
      session.supabase.from("business_documents").select("kind").eq("business_id", business.id),
      session.supabase
        .from("accommodations")
        /* Only whether a pin exists is read here, and the public point is null
           exactly when the exact one is. */
        .select(withPublicPoint(HOST_ACCOMMODATION_READ) as typeof HOST_ACCOMMODATION_READ)
        .eq("business_id", business.id)
        .order("created_at", { ascending: true })
        .limit(1),
      session.supabase
        .from("restaurant_profiles")
        /* `*` so the sitting, hold and notice columns come back once
           `20261013090200_...` has run, and nothing breaks before it has. */
        .select("*")
        .eq("business_id", business.id)
        .maybeSingle(),
      session.supabase
        .from("service_windows")
        .select("id, weekday, opens, last_seating, closes, covers")
        .eq("business_id", business.id)
        .order("weekday", { ascending: true })
        .limit(50),
      session.supabase
        .from("bank_accounts")
        .select("id")
        .eq("user_id", session.user.id)
        .is("deleted_at", null)
        .limit(1),
      /* SUP-17: a restaurant is submitted with a photograph, as a property is.
         The rows rather than a count, cover first, so the restaurant's step
         can draw and manage them. */
      session.supabase
        .from("business_photos")
        .select("id, storage_path, position")
        .eq("business_id", business.id)
        .order("position", { ascending: true })
        .limit(MAX_BUSINESS_PHOTOS),
    ]);

    const accommodation = accommodations.data?.[0] ?? null;

    /* The charges at the door, newest declaration, read through the owner's
       own policy (`arrival_charge_declarations_owner_read`). Only a complete
       set counts, which is what the publish gate checks. */
    let arrivalCharges: HostDraft["arrivalCharges"] = null;
    if (accommodation) {
      const { data: declared } = await session.supabase
        .from("arrival_charge_declarations")
        .select("charges")
        .eq("accommodation_id", accommodation.id)
        .order("declared_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      arrivalCharges = declared ? readArrivalCharges(declared.charges) : null;
    }

    let roomTypeCount = 0;
    let ratePlanCount = 0;
    let roomTypes: HostDraft["roomTypes"] = [];
    if (accommodation) {
      const { data: rows } = await session.supabase
        .from("room_types")
        .select(
          /*
           * `*` RATHER THAN A COLUMN LIST, FOR ONE COLUMN AND ONE REASON.
           * `bedrooms` is added by a migration this box cannot apply, and
           * `database.types.ts` is GENERATED from the live schema, so naming
           * the column here would not typecheck. Hand-editing the generated
           * file would make the type system assert a schema that may not
           * exist, which is the invisible kind of claim that caused the `beds`
           * fault. `*` returns it at runtime when it is there, the read below
           * tolerates it being absent, and the column list comes back the
           * moment the types are regenerated.
           */
          "*, rate_plans(id, name, meal_plan, rate_minor)",
        )
        .eq("accommodation_id", accommodation.id)
        /* Oldest first: the shortlet's place is the first room type
           (`setShortletPlaceDraft` writes onto the oldest), and a hotel's list
           should not reshuffle between two visits to the same step. */
        .order("created_at", { ascending: true })
        .limit(50);
      roomTypeCount = rows?.length ?? 0;
      ratePlanCount = (rows ?? []).reduce((total, row) => total + row.rate_plans.length, 0);
      roomTypes = (rows ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        sleeps: row.sleeps,
        unitsTotal: row.units_total,
        rateCount: row.rate_plans.length,
        category: row.category,
        baseRateMinor: row.base_rate_minor,
        beds: readBeds(row.beds, (row as { bedrooms?: unknown }).bedrooms),
        rates: row.rate_plans.map((plan) => ({
          id: plan.id,
          name: plan.name,
          mealPlan: plan.meal_plan,
          rateMinor: plan.rate_minor,
        })),
      }));
    }

    const present: Partial<Record<HostDocumentKind, true>> = {};
    for (const row of documents.data ?? []) {
      present[row.kind as HostDocumentKind] = true;
    }

    return {
      businessId: business.id,
      status: business.status,
      hostType: asHostType(business.host_type),
      kind: business.kind,
      name: business.name,
      description: business.description ?? "",
      phone: business.phone ?? "",
      email: business.email ?? "",
      address: business.address ?? "",
      area: business.area ?? "",
      city: business.city ?? "",
      stateCode: business.state_code ?? "",
      registeredName: business.registered_name ?? "",
      cacNumber: business.cac_number ?? "",
      tin: business.tin ?? "",
      representativeName: business.representative_name ?? "",
      representativePhone: business.representative_phone ?? "",
      documents: present,
      accommodation: accommodation
        ? {
            id: accommodation.id,
            name: accommodation.name,
            /* Both halves of the pin, because one without the other is not a
               place on a map (MK-55). */
            hasPin: accommodation.latitude !== null && accommodation.longitude !== null,
            /* Cover first, because position 0 is the cover everywhere these
               rows are read and the embed does not promise an order. */
            photos: [...accommodation.accommodation_photos]
              .sort((a, b) => a.position - b.position)
              .map((photo) => ({
                id: photo.id,
                url: accommodationPhotoUrl(photo.storage_path),
              })),
            facilities: accommodation.accommodation_amenities
              .map((link) => link.amenities?.code)
              .filter((code): code is string => typeof code === "string"),
            starRating: accommodation.star_rating,
            /* `time` comes back as `HH:MM:SS`; every screen and every schema on
               this spine works in `HH:MM`, so it is cut once, here. */
            checkInFrom: (accommodation.check_in_from ?? "").slice(0, 5),
            checkOutBy: (accommodation.check_out_by ?? "").slice(0, 5),
            houseRules: accommodation.house_rules ?? "",
            cancellationPolicyId: accommodation.cancellation_policy_id,
          }
        : null,
      roomTypeCount,
      ratePlanCount,
      roomTypes,
      restaurant: restaurant.data
        ? {
            priceBand: restaurant.data.price_band,
            cuisineCount: restaurant.data.cuisines.length,
            cuisines: restaurant.data.cuisines,
            sittingMinutes: smallNumber(restaurant.data, "sitting_minutes"),
            holdMinutes: smallNumber(restaurant.data, "hold_minutes"),
            cancelNoticeHours: smallNumber(restaurant.data, "cancel_notice_hours"),
          }
        : null,
      serviceWindowCount: windows.data?.length ?? 0,
      businessPhotoCount: businessPhotos.data?.length ?? 0,
      businessPhotos: (businessPhotos.data ?? []).map((photo) => ({
        id: photo.id,
        url: businessPhotoUrl(photo.storage_path),
      })),
      serviceWindows: (windows.data ?? []).map((row) => ({
        id: row.id,
        weekday: row.weekday,
        opens: row.opens.slice(0, 5),
        lastSeating: row.last_seating.slice(0, 5),
        closes: row.closes.slice(0, 5),
        covers: row.covers,
      })),
      hygieneAttestedAt: business.hygiene_attested_at,
      licenceAttestedAt: business.licence_attested_at,
      hasBankAccount: (bankAccounts.data?.length ?? 0) > 0,
      consents: readConsents(business.consents as Parameters<typeof readConsents>[0]),
      reviewNotes: business.review_notes ?? null,
      arrivalCharges,
      consentWithdrawals: readConsentWithdrawals(business.consents),
      hostAgreementVersion: readHostAgreementVersion(business.consents),
      payOnValloVersion: acceptedVersion(business.consents, "pay_on_vallo"),
    };
  } catch (error) {
    if (error instanceof PrivateFieldsUnavailable) throw error;
    /* The wizard renders whatever happens here. An empty draft is survivable;
       a crashed page loses what somebody has typed. */
    return emptyHostDraft();
  }
}

/** Every business this account owns, newest first. Empty when signed out. */
export async function getMyBusinesses(): Promise<MyBusiness[]> {
  const session = await resolveSession();
  if (session.state !== "signed-in") return [];

  try {
    const { data, error } = await session.supabase
      .from("businesses")
      .select(
        "id, name, slug, kind, status, host_type, verified, submitted_at, reviewed_at, created_at",
      )
      .eq("owner_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    await reportReadError("read.host.getMyBusinesses", error);
    if (error) return [];

    const rows = await withBusinessPrivate(session.supabase, data ?? [], ["verification_tier", "review_notes"] as const);
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      kind: row.kind,
      status: row.status,
      hostType: asHostType(row.host_type),
      verificationTier: row.verification_tier ?? 0,
      verified: row.verified,
      submittedAt: row.submitted_at,
      reviewedAt: row.reviewed_at,
      reviewNotes: row.review_notes,
      createdAt: row.created_at,
    }));
  } catch {
    return [];
  }
}

/** One of the caller's properties, as the photograph surface needs it. */
export type MyAccommodation = {
  id: string;
  name: string;
  status: ListingStatus;
};

/**
 * The property a business lets, for a surface that hangs something on it.
 *
 * ONE PER BUSINESS TODAY, which is the wizard's own rule (`addAccommodationDraft`
 * creates or updates the first one and says why), so this returns the oldest
 * and null when there is none. A host with a second property adds it from a
 * console that does not exist yet; when it does, this becomes a list and every
 * caller of it gains a picker, exactly as `/host/photos` already draws one for
 * a second business.
 *
 * Scoped by `accommodations_owner_all` through the business row, so another
 * host's property does not come back. Null on any failure: a photograph
 * surface with nothing to hang on draws an empty state, never a crash.
 */
export async function getPrimaryAccommodation(
  businessId: string,
): Promise<MyAccommodation | null> {
  const session = await resolveSession();
  if (session.state !== "signed-in") return null;

  try {
    const { data, error } = await session.supabase
      .from("accommodations")
      .select("id, name, status, businesses!inner(owner_id)")
      .eq("business_id", businessId)
      .eq("businesses.owner_id", session.user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    await reportReadError("read.host.getPrimaryAccommodation", error);
    if (error || !data) return null;
    return { id: data.id, name: data.name, status: data.status };
  } catch {
    return null;
  }
}

/** One room type as the host's own room console shows it. */
export type MyRoomType = {
  id: string;
  name: string;
  category: Database["public"]["Enums"]["room_category"];
  sleeps: number;
  unitsTotal: number;
  /** The lowest active rate on the type, in kobo, or null when it has none. */
  lowestRateMinor: number | null;
  status: ListingStatus;
  /** Nights from today onwards that carry an inventory row. */
  nightsOnSale: number;
  /** The last night on sale, ISO, or null when none is. */
  lastNightOnSale: string | null;
};

/**
 * The rooms of one property, with what is on sale, for the host's console.
 *
 * WHY THE NIGHT COUNT IS HERE AND NOT A GUESS ON THE SCREEN. `stays_search`
 * treats a missing `room_inventory` row as NOT OFFERED, so "how far ahead am I
 * bookable" is the single question this surface exists to answer, and it can
 * only be answered by counting the rows. Nothing is inferred from a horizon
 * constant: what is printed is what the table holds.
 *
 * Scoped by `room_types_owner_all` and `room_inventory_owner_write`'s select
 * twin, so another host's rooms do not come back. Empty on any failure.
 */
export async function getMyRoomTypes(accommodationId: string): Promise<MyRoomType[]> {
  const session = await resolveSession();
  if (session.state !== "signed-in") return [];

  try {
    const { data, error } = await session.supabase
      .from("room_types")
      .select("id, name, category, sleeps, units_total, status, rate_plans(rate_minor, active)")
      .eq("accommodation_id", accommodationId)
      .order("created_at", { ascending: true })
      .limit(50);
    await reportReadError("read.host.getMyRoomTypes", error);
    if (error || !data) return [];
    /* An empty `in` list is not a query anybody wants sent: PostgREST renders
       it as `in.()`, which is a syntax error rather than "no rows". A property
       with no room types is the common first state, not an edge case. */
    if (data.length === 0) return [];

    /* The Lagos calendar day: the UTC one is still yesterday until 01:00. */
    const today = lagosToday();
    const { data: nights } = await session.supabase
      .from("room_inventory")
      .select("room_type_id, date")
      .in(
        "room_type_id",
        data.map((room) => room.id),
      )
      .gte("date", today)
      .order("date", { ascending: false })
      .limit(20_000);

    const counted = new Map<string, { nights: number; last: string }>();
    for (const night of nights ?? []) {
      const seen = counted.get(night.room_type_id);
      /* Ordered newest first, so the first night seen for a room type is the
         furthest ahead it is bookable. */
      if (seen) seen.nights += 1;
      else counted.set(night.room_type_id, { nights: 1, last: night.date });
    }

    return data.map((room) => {
      const active = room.rate_plans.filter((plan) => plan.active).map((plan) => plan.rate_minor);
      const sale = counted.get(room.id);
      return {
        id: room.id,
        name: room.name,
        category: room.category,
        sleeps: room.sleeps,
        unitsTotal: room.units_total,
        lowestRateMinor: active.length > 0 ? Math.min(...active) : null,
        status: room.status,
        nightsOnSale: sale?.nights ?? 0,
        lastNightOnSale: sale?.last ?? null,
      };
    });
  } catch {
    return [];
  }
}

/** The host's own ladder, as their status page shows it. */
export type MyBusinessLadder = {
  businessId: string;
  name: string;
  /** Rungs passed with no gap below, read from the row the trigger wrote. */
  tier: BusinessTier;
  tierName: string;
  /** The badge, as the database derived it. */
  verified: boolean;
  rungs: BusinessLadderRow[];
  /** The lowest rung not yet passed, or null when the ladder is complete. */
  next: BusinessRung | null;
};

/**
 * The trigger-computed tier, read back for the host who owns the business,
 * with every rung's recorded decision beside it.
 *
 * Both reads go through the caller's own RLS-bound client:
 * `businesses_owner_all` scopes the row, and
 * `business_verification_checks_select_own` lets an owner read the rungs on
 * their own business and nothing else. The tier is the row's own column,
 * never recomputed here; `ladderView` only lays the rungs out in order and
 * marks a passed rung above a gap as not yet counting, which is what
 * `private.business_tier` decided too.
 *
 * Null when signed out, when the business is not the caller's, or when the
 * read failed: a status page renders "nothing to show" from null and never a
 * crash.
 */
export async function getMyBusinessLadder(businessId: string): Promise<MyBusinessLadder | null> {
  const session = await resolveSession();
  if (session.state !== "signed-in") return null;

  try {
    const { data: publicRow, error } = await session.supabase
      .from("businesses")
      .select("id, name, verified")
      .eq("id", businessId)
      .eq("owner_id", session.user.id)
      .maybeSingle();
    await reportReadError("read.host.getMyBusinessLadder", error);
    if (error || !publicRow) return null;
    const [business] = await withBusinessPrivate(session.supabase, [publicRow], ["verification_tier"] as const);
    if (!business) return null;

    const { data: checks } = await session.supabase
      .from("business_verification_checks")
      .select("rung, status, note, decided_at")
      .eq("business_id", business.id);

    const rows = (checks ?? []).map((check) => ({
      rung: check.rung,
      status: check.status,
      note: check.note,
      decidedAt: check.decided_at,
    }));
    const tier = asBusinessTier(business.verification_tier);

    return {
      businessId: business.id,
      name: business.name,
      tier,
      tierName: BUSINESS_TIER_NAME[tier],
      verified: business.verified,
      rungs: ladderView(rows),
      next: nextRung(rows),
    };
  } catch {
    return null;
  }
}
