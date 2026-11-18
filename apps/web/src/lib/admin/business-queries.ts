import "server-only";

/**
 * The stays business approval queue.
 *
 * The `listings` queue's sibling, on the same frame: search, status chips
 * bound to the real enum, a Lagos date range, and a pager pushed into the
 * query rather than applied to a page of rows already fetched
 * (`lib/admin/queue-filter.ts` is the argument for all four).
 *
 * WHAT A REVIEWER ACTUALLY NEEDS IN FRONT OF THEM, per
 * docs/research/HOST_ONBOARDING_RESEARCH.md section 3.4: the business fields,
 * the uploaded documents opened in place, the CAC number and
 * registered name to compare against the free public search, the resolved
 * bank name beside the identity and business names, the rungs already
 * recorded, and whether the property is actually publishable (a cover photo
 * and the pin, MK-55). A decision taken without those is a tick, not a review.
 *
 * THE PRIVATE BUCKET IS THE POINT, exactly as in kyc-queries.ts:
 * host-documents is private because these objects are driving licences and
 * CAC certificates. It used to hand the reviewer a short-lived signed URL,
 * which the desk then opened in a tab on `supabase.co`. It hands out no URL
 * at all now: see `app/api/documents/[id]/route.ts`.
 *
 * Reads go through the service role, but only after `requireAdmin` has passed
 * inside this module, the same shape `bookings-queries.ts` uses: the console
 * sees every application, which is the point of a review desk.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "../supabase/admin";
import { Constants, type Database } from "../supabase/database.types";
import { documentMedia, type DocumentMedia } from "./documents";
import { requireAdmin } from "./guard";
import {
  lagosDayEnd,
  lagosDayStart,
  orSafe,
  pageRange,
  pickStatus,
  takePage,
  type AdminQueueFilter,
} from "./queue-filter";
import type { AdminRead } from "./queries";
import { accommodationPhotoUrl } from "../stays/photos";
import { readRoomTypePhotos } from "../stays/room-type-photos";

type Db = SupabaseClient<Database>;
type ListingStatus = Database["public"]["Enums"]["listing_status"];
type BusinessKind = Database["public"]["Enums"]["business_kind"];

const UNAVAILABLE = { state: "unavailable" } as const;


/** The rungs, in the order a real host passes them (M15, and lib/trust). */
export const BUSINESS_RUNGS = ["identity", "registration", "payout", "on_site"] as const;
export type BusinessRung = (typeof BUSINESS_RUNGS)[number];

/**
 * The statuses this queue offers as chips, read from the generated enum so a
 * value added to the column cannot go unoffered. `listing_status` is shared
 * with listings, and every one of its values is reachable by a business.
 */
export const BUSINESS_STATUSES: readonly ListingStatus[] = Constants.public.Enums.listing_status;

/** The statuses that mean somebody has to do something. */
const WAITING: readonly ListingStatus[] = ["SUBMITTED", "UNDER_REVIEW", "MORE_INFO_REQUIRED"];

export type BusinessDocumentView = {
  id: string;
  kind: string;
  uploadedAt: string;
  /** A short-lived URL that opens the actual file. Null if it would not sign. */
  /** How the in-app viewer draws it. See `lib/admin/documents.ts`. */
  media: DocumentMedia;
};

export type BusinessRungView = {
  rung: string;
  status: string;
  note: string | null;
  decidedAt: string;
  reviewerName: string | null;
};

export type BusinessPropertyView = {
  id: string;
  name: string;
  status: ListingStatus;
  /** Both halves of the pin. The publish gate, MK-55. */
  hasPin: boolean;
  photoCount: number;
  /** The public URLs of those photographs, cover first. */
  photos: string[];
  roomTypeCount: number;
  ratePlanCount: number;
  /**
   * Each room type's own photographs (`room_type_photos`), cover first, for
   * the room types that have any. Empty while the pending migration that
   * creates the table has not run.
   */
  roomPhotos: { roomTypeId: string; name: string; photos: string[] }[];
};

export type BusinessQueueRow = {
  id: string;
  name: string;
  slug: string;
  kind: BusinessKind;
  status: ListingStatus;
  hostType: string | null;
  city: string | null;
  area: string | null;
  stateCode: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  /** What the host typed, for the reviewer to compare against the CAC search. */
  cacNumber: string | null;
  registeredName: string | null;
  tin: string | null;
  representativeName: string | null;
  representativePhone: string | null;
  /** ISO instants keyed by consent id. Three separate decisions. */
  consents: Record<string, string>;
  hygieneAttestedAt: string | null;
  licenceAttestedAt: string | null;
  ownerId: string | null;
  ownerName: string | null;
  /** The name the BANK returned for the owner's default payout account. */
  payoutName: string | null;
  payoutBank: string | null;
  /**
   * True when the resolved bank name shares no word with the representative's
   * name or the registered name. A flag for the reviewer, never a refusal:
   * people bank under names that do not match their paperwork for honest
   * reasons, and this is a prompt to look, not a verdict.
   */
  payoutNameMismatch: boolean;
  verificationTier: number;
  verified: boolean;
  /**
   * Photographs on the venue itself (`business_photos`, P3), which is the
   * restaurant spine's only photo table. Shown on the desk because a published
   * venue with none draws a category plate under a "No photographs yet" chip,
   * and the reviewer is the person who can chase them for it. NOT a publish
   * gate: see `publishRestaurant`.
   */
  photoCount: number;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
  documents: BusinessDocumentView[];
  rungs: BusinessRungView[];
  properties: BusinessPropertyView[];
  restaurant: { priceBand: number | null; cuisineCount: number; windowCount: number } | null;
  /**
   * True when a refused or sent-back application has been edited and sent
   * again: it is SUBMITTED and already carries a decision.
   */
  resubmission: boolean;
  /** Every review decision on this business, newest first, from the audit log. */
  history: { at: string; decision: string; afterStatus: string | null; note: string | null; reviewerName: string | null }[];
  /** Consents the host gave and then withdrew, from `consents.withdrawals`. */
  consentWithdrawals: { id: string; at: string }[];
};

export type BusinessQueue = {
  rows: BusinessQueueRow[];
  /** True when another page exists. Evidence, not arithmetic. */
  full: boolean;
  /** Waiting on a human right now, whatever this page is narrowed to. */
  waitingCount: number;
};

const BUSINESS_COLUMNS =
  "id, name, slug, kind, status, host_type, city, area, state_code, address, phone, email, cac_number, registered_name, tin, representative_name, representative_phone, consents, hygiene_attested_at, licence_attested_at, owner_id, verification_tier, verified, submitted_at, reviewed_at, review_notes, created_at";

async function adminClient(): Promise<Db | null> {
  const access = await requireAdmin();
  if (access.state !== "admin") return null;
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

/** Words worth comparing: anything short is noise, case and spacing are not. */
function nameWords(value: string | null): Set<string> {
  return new Set(
    (value ?? "")
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((word) => word.length > 2),
  );
}

function looksMismatched(payout: string | null, ...against: (string | null)[]): boolean {
  if (!payout) return false;
  const payoutWords = nameWords(payout);
  if (payoutWords.size === 0) return false;
  for (const other of against) {
    for (const word of nameWords(other)) {
      if (payoutWords.has(word)) return false;
    }
  }
  return true;
}

/**
 * The queue, narrowed by the frame and paged in the query.
 *
 * The search is over the business name and the city, which is how a reviewer
 * describes an application to a colleague ("the Ikoyi guest house"). Not the
 * address, which identifies somebody's premises rather than a business, and
 * not the CAC number, which is a lookup rather than a search. The term is
 * stripped of the characters PostgREST's `or` grammar treats as structure
 * before it is interpolated (`orSafe`).
 */
export async function getBusinessQueue(
  filter?: AdminQueueFilter,
): Promise<AdminRead<BusinessQueue>> {
  const admin = await adminClient();
  if (!admin) return UNAVAILABLE;

  const term = (filter?.q ?? "").replace(/[,()*"\\]/g, "").trim();
  const status = pickStatus(BUSINESS_STATUSES, filter?.status);
  const { from, to } = pageRange(filter);

  try {
    let select = admin.from("businesses").select(BUSINESS_COLUMNS).eq("source", "first_party");
    if (status) select = select.eq("status", status);
    else select = select.neq("status", "DRAFT");
    if (term.length > 0) {
      select = select.or(`name.ilike.${orSafe(`%${term}%`)},city.ilike.${orSafe(`%${term}%`)}`);
    }
    if (filter?.from) select = select.gte("created_at", lagosDayStart(filter.from));
    if (filter?.to) select = select.lte("created_at", lagosDayEnd(filter.to));

    const [listed, waiting] = await Promise.all([
      select
        .order("submitted_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .range(from, to),
      admin
        .from("businesses")
        .select("id", { count: "exact", head: true })
        .eq("source", "first_party")
        .in("status", [...WAITING]),
    ]);
    if (listed.error) return UNAVAILABLE;

    const page = takePage(listed.data ?? []);
    const ids = page.rows.map((row) => row.id);
    if (ids.length === 0) {
      return {
        state: "ok",
        data: { rows: [], full: page.full, waitingCount: waiting.count ?? 0 },
      };
    }

    const ownerIds = page.rows
      .map((row) => row.owner_id)
      .filter((id): id is string => Boolean(id));

    const [documents, rungs, accommodations, restaurants, windows, photos, payouts, names, audits] =
      await Promise.all([
        admin
          .from("business_documents")
          .select("id, business_id, kind, storage_path, uploaded_at")
          .in("business_id", ids),
        admin
          .from("business_verification_checks")
          .select("business_id, rung, status, note, reviewer_id, decided_at")
          .in("business_id", ids),
        admin
          .from("accommodations")
          .select(
            "id, business_id, name, status, latitude, longitude, accommodation_photos(id, storage_path, position), room_types(id, name, rate_plans(id))",
          )
          .in("business_id", ids),
        admin
          .from("restaurant_profiles")
          .select("business_id, price_band, cuisines")
          .in("business_id", ids),
        admin.from("service_windows").select("business_id").in("business_id", ids),
        admin.from("business_photos").select("business_id").in("business_id", ids),
        ownerIds.length > 0
          ? admin
              .from("bank_accounts")
              .select("user_id, resolved_account_name, bank_name, is_default")
              .in("user_id", ownerIds)
              .is("deleted_at", null)
          : Promise.resolve({ data: [] as { user_id: string; resolved_account_name: string; bank_name: string; is_default: boolean }[] }),
        displayNames(admin, [
          ...ownerIds,
          ...(await reviewerIds(admin, ids)),
          ...(await decisionActorIds(admin, ids)),
        ]),
        /* The decision history: every review decision, newest first. */
        admin
          .from("audit_log")
          .select("entity_id, actor_id, metadata, created_at")
          .eq("entity_type", "business")
          .eq("action", "business.review")
          .in("entity_id", ids)
          .order("created_at", { ascending: false })
          .limit(200),
      ]);

    const payoutByUser = new Map<string, { name: string; bank: string }>();
    for (const row of payouts.data ?? []) {
      if (!payoutByUser.has(row.user_id) || row.is_default) {
        payoutByUser.set(row.user_id, {
          name: row.resolved_account_name,
          bank: row.bank_name,
        });
      }
    }

    const windowCount = new Map<string, number>();
    for (const row of windows.data ?? []) {
      windowCount.set(row.business_id, (windowCount.get(row.business_id) ?? 0) + 1);
    }

    /* The rooms' own photographs, one read for every property on the page.
       `unavailable` (the table is not there yet, or the read failed) draws
       no room photographs rather than failing the desk. */
    const roomPhotoRead = await readRoomTypePhotos(
      admin,
      (accommodations.data ?? []).flatMap((row) => row.room_types.map((roomType) => roomType.id)),
    );
    const roomPhotosOf = (id: string): string[] =>
      roomPhotoRead.state === "ok" ? (roomPhotoRead.byRoom.get(id) ?? []).map((photo) => photo.url) : [];

    const photoCount = new Map<string, number>();
    for (const row of photos.data ?? []) {
      photoCount.set(row.business_id, (photoCount.get(row.business_id) ?? 0) + 1);
    }

    const rows: BusinessQueueRow[] = page.rows.map((business) => {
      const payout = business.owner_id ? (payoutByUser.get(business.owner_id) ?? null) : null;
      const restaurant = (restaurants.data ?? []).find((r) => r.business_id === business.id);
      return {
        id: business.id,
        name: business.name,
        slug: business.slug,
        kind: business.kind,
        status: business.status,
        hostType: business.host_type,
        city: business.city,
        area: business.area,
        stateCode: business.state_code,
        address: business.address,
        phone: business.phone,
        email: business.email,
        cacNumber: business.cac_number,
        registeredName: business.registered_name,
        tin: business.tin,
        representativeName: business.representative_name,
        representativePhone: business.representative_phone,
        consents: readConsents(business.consents),
        hygieneAttestedAt: business.hygiene_attested_at,
        licenceAttestedAt: business.licence_attested_at,
        ownerId: business.owner_id,
        ownerName: business.owner_id ? (names.get(business.owner_id) ?? null) : null,
        payoutName: payout?.name ?? null,
        payoutBank: payout?.bank ?? null,
        payoutNameMismatch: looksMismatched(
          payout?.name ?? null,
          business.representative_name,
          business.registered_name,
          business.name,
        ),
        verificationTier: business.verification_tier,
        verified: business.verified,
        photoCount: photoCount.get(business.id) ?? 0,
        submittedAt: business.submitted_at,
        reviewedAt: business.reviewed_at,
        reviewNotes: business.review_notes,
        createdAt: business.created_at,
        documents: (documents.data ?? [])
          .filter((row) => row.business_id === business.id)
          .map((row) => ({
            id: row.id,
            kind: row.kind,
            uploadedAt: row.uploaded_at,
            media: documentMedia(row.storage_path),
          })),
        rungs: (rungs.data ?? [])
          .filter((row) => row.business_id === business.id)
          .map((row) => ({
            rung: row.rung,
            status: row.status,
            note: row.note,
            decidedAt: row.decided_at,
            reviewerName: row.reviewer_id ? (names.get(row.reviewer_id) ?? null) : null,
          })),
        properties: (accommodations.data ?? [])
          .filter((row) => row.business_id === business.id)
          .map((row) => ({
            id: row.id,
            name: row.name,
            status: row.status,
            hasPin: row.latitude !== null && row.longitude !== null,
            photoCount: row.accommodation_photos.length,
            /* THE PHOTOGRAPHS THEMSELVES, COVER FIRST, and not merely a count
               of them. The property desk has shown a reviewer every picture on
               a listing since it was built; this desk showed a number, which
               is backwards, because a stay is sold almost entirely on its
               pictures and the reviewer is the last person who can see that
               the room in them is not the room being described. The count was
               all that could honestly be shown while nothing in the product
               could upload one; that is no longer true. */
            photos: [...row.accommodation_photos]
              .sort((a, b) => a.position - b.position)
              .map((photo) => accommodationPhotoUrl(photo.storage_path)),
            roomTypeCount: row.room_types.length,
            ratePlanCount: row.room_types.reduce(
              (total, roomType) => total + roomType.rate_plans.length,
              0,
            ),
            roomPhotos: row.room_types
              .map((roomType) => ({ roomTypeId: roomType.id, name: roomType.name, photos: roomPhotosOf(roomType.id) }))
              .filter((roomType) => roomType.photos.length > 0),
          })),
        restaurant: restaurant
          ? {
              priceBand: restaurant.price_band,
              cuisineCount: restaurant.cuisines.length,
              windowCount: windowCount.get(business.id) ?? 0,
            }
          : null,
        resubmission: business.status === "SUBMITTED" && business.reviewed_at !== null,
        history: (audits.data ?? [])
          .filter((row) => row.entity_id === business.id)
          .map((row) => {
            const meta = (row.metadata ?? {}) as Record<string, unknown>;
            return {
              at: row.created_at,
              decision: typeof meta.decision === "string" ? meta.decision : "decision",
              afterStatus: typeof meta.after_status === "string" ? meta.after_status : null,
              note: typeof meta.note === "string" ? meta.note : null,
              reviewerName: row.actor_id ? (names.get(row.actor_id) ?? null) : null,
            };
          }),
        consentWithdrawals: readWithdrawals(business.consents),
      };
    });

    return { state: "ok", data: { rows, full: page.full, waitingCount: waiting.count ?? 0 } };
  } catch {
    return UNAVAILABLE;
  }
}

/** One application in full, for the decision sheet. */
export async function getBusinessForReview(
  businessId: string,
): Promise<AdminRead<BusinessQueueRow | null>> {
  const queue = await getBusinessQueue({ q: undefined, status: undefined });
  if (queue.state !== "ok") return UNAVAILABLE;
  const found = queue.data.rows.find((row) => row.id === businessId) ?? null;
  if (found) return { state: "ok", data: found };

  // Not on the first page of the unnarrowed queue: ask for it by id rather
  // than paging through, so a decision can always be reopened from a link.
  const admin = await adminClient();
  if (!admin) return UNAVAILABLE;
  const { data } = await admin
    .from("businesses")
    .select("name")
    .eq("id", businessId)
    .maybeSingle();
  if (!data) return { state: "ok", data: null };
  const narrowed = await getBusinessQueue({ q: data.name });
  if (narrowed.state !== "ok") return UNAVAILABLE;
  return { state: "ok", data: narrowed.data.rows.find((row) => row.id === businessId) ?? null };
}

/* ------------------------------------------------------------------ shared */

function readConsents(value: Database["public"]["Tables"]["businesses"]["Row"]["consents"]): Record<
  string,
  string
> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, at] of Object.entries(value as Record<string, unknown>)) {
    if (typeof at === "string" && at.length > 0) out[key] = at;
  }
  return out;
}

/** `consents.withdrawals`: consents a host gave and then took back. */
function readWithdrawals(value: unknown): { id: string; at: string }[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return [];
  const list = (value as Record<string, unknown>).withdrawals;
  if (!Array.isArray(list)) return [];
  return list.flatMap((entry) => {
    const row = (entry ?? {}) as Record<string, unknown>;
    return typeof row.id === "string" && typeof row.at === "string" ? [{ id: row.id, at: row.at }] : [];
  });
}

async function decisionActorIds(admin: Db, businessIds: string[]): Promise<string[]> {
  const { data } = await admin
    .from("audit_log")
    .select("actor_id")
    .eq("entity_type", "business")
    .eq("action", "business.review")
    .in("entity_id", businessIds)
    .limit(200);
  return (data ?? []).map((row) => row.actor_id).filter((id): id is string => Boolean(id));
}

async function reviewerIds(admin: Db, businessIds: string[]): Promise<string[]> {
  const { data } = await admin
    .from("business_verification_checks")
    .select("reviewer_id")
    .in("business_id", businessIds);
  return (data ?? []).map((row) => row.reviewer_id).filter((id): id is string => Boolean(id));
}

async function displayNames(admin: Db, ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return out;
  const { data } = await admin.from("profiles").select("id, display_name").in("id", unique);
  for (const row of data ?? []) if (row.display_name) out.set(row.id, row.display_name);
  return out;
}

/*
 * `signDocuments` STOOD HERE AND IT IS GONE ON PURPOSE.
 *
 * It minted a ten minute signed Supabase Storage URL per document and the
 * desk opened it with `target="_blank"`, so a reviewer read a driving licence
 * or a CAC certificate on `supabase.co` and the live signed link sat in our
 * DOM to be forwarded. Nothing signs for a browser now:
 * `/api/documents/<id>` streams from our own origin behind `requireAdmin`,
 * uncached, with an audit row per view.
 */
