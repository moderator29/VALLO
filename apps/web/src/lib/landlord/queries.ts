import "server-only";
import { reportReadError } from "@/lib/observability/read-error";

import { resolveSessionClaims } from "../actions/session";
import { isSupabaseConfigured } from "../supabase/env";
import { createClient } from "../supabase/server";
import { readListingFacts, readRentFact, type ListingFacts, type RentFact } from "./facts";
import { readReply, type ReplyView } from "./reply";
import { callLandlordRpc } from "./rpc";

/**
 * EVERY READ THE LANDLORD LINE MAKES, AND EVERY ONE OF THEM FAILS SOFT.
 *
 * These reads sit on surfaces that exist without them: the catalogue, the
 * listing page, the paid-rent screen, the mandate desk. So a failure here is
 * never allowed to become that surface's failure. A read that errors (the
 * migration not yet applied, a network blip, a refused grant) returns the
 * empty answer, and the empty answer renders nothing, which the claims rule
 * already says is the right thing to draw for a fact we cannot prove.
 *
 * The one exception is the reply page, whose whole content IS this read, and
 * which therefore distinguishes "failed" from "unknown" so a landlord is told
 * the truth about whose fault it was.
 *
 * ===========================================================================
 * AND NONE OF THEM IS ASKED AT ALL FOR A SIGNED-OUT VISITOR.
 *
 * Every function here except `landlord_line_read` and `safety_share_read` is
 * granted to `authenticated` and revoked from `anon` on purpose (migrations
 * 20260924104312, 104806 and 105130): these are a landlord's facts, and a
 * stranger may not have them. That grant is correct and is not the thing to
 * change.
 *
 * What was wrong is that the app asked anyway. `readListingFactsFor` is on
 * `/search` and on the listing page, both of which N-1 opened to signed-out
 * visitors, so every signed-out browse called a function the visitor may not
 * execute. Postgres answered 42501, this file swallowed it and returned the
 * empty answer, and the page looked right: 1655 denials between 9 and 11
 * November, in `crash_reports` under `read.landlord.readListingFactsFor`,
 * with nobody any the wiser.
 *
 * IT WAS NOT FREE, AND THAT IS THE POINT. A denied statement ABORTS its
 * transaction. PostgREST runs every request as `BEGIN ... COMMIT`, so each of
 * those denials cost a round trip and left an aborted transaction behind on a
 * pooled connection. (The cascade of 25P02 measured on 11 November was
 * triggered by `stays_search` timing out rather than by this, but both end
 * the same way, and this one is ours to stop making.)
 *
 * So a read whose function needs a session asks `resolveSessionClaims` first
 * and answers its own empty value when there is nobody. That is not a guess
 * about the grant: `resolveSessionClaims` resolves the caller the way
 * PostgREST does, from the access token's verified claims, which is exactly
 * what decides whether the statement runs as `authenticated` or as `anon`. It
 * is memoised per request, so on a page that already knows who is asking it
 * costs nothing.
 */

/**
 * Is there a signed-in viewer, as PostgREST will see one?
 *
 * The claims reader, not `resolveSession`: it verifies the access token
 * locally rather than crossing to GoTrue, it is memoised per request, and it
 * has no finish-setup hold, so an account that still owes setup reads as
 * signed in here. That is right, because it IS `authenticated` at the
 * database and these functions are granted to that role.
 */
async function hasSession(): Promise<boolean> {
  return (await resolveSessionClaims()).state === "signed-in";
}

/** The reply page's question, by token. Works signed out: the landlord has no account. */
export async function readReplyByToken(token: string): Promise<ReplyView> {
  if (!isSupabaseConfigured()) return { state: "failed" };
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return { state: "unknown" };
  try {
    const db = await createClient();
    const { data, error } = await callLandlordRpc(db, "landlord_line_read", { p_token: token });
    await reportReadError("read.landlord.readReplyByToken", error);
    if (error) return { state: "failed" };
    return readReply(data);
  } catch {
    return { state: "failed" };
  }
}

/** Landlord facts for a page of listings, keyed by id. Empty on any failure. */
export async function readListingFactsFor(ids: readonly string[]): Promise<Map<string, ListingFacts>> {
  if (!isSupabaseConfigured() || ids.length === 0) return new Map();
  /* `/search` and the listing page are open to signed-out visitors, and this
     function is not. Nothing to show them, and nothing to ask the database. */
  if (!(await hasSession())) return new Map();
  try {
    const db = await createClient();
    const { data, error } = await callLandlordRpc(db, "listing_landlord_facts", { p_listings: ids.slice(0, 200) });
    await reportReadError("read.landlord.readListingFactsFor", error);
    if (error) return new Map();
    return readListingFacts(data);
  } catch {
    return new Map();
  }
}

export type PropertyOffer = {
  listingId: string;
  isThisListing: boolean;
  title: string;
  listingRole: "owner" | "agent" | "firm" | null;
  listerName: string | null;
  rentMinor: number | null;
  rentPeriod: string | null;
  moveInMinor: number | null;
  ownerConfirmedAt: string | null;
};

/**
 * Every published offer on this listing's property, or null when the read
 * failed. An empty list and a list of one both mean "no comparison to show".
 */
export async function readPropertyOffers(listingId: string): Promise<PropertyOffer[] | null> {
  if (!isSupabaseConfigured()) return [];
  /* The listing page is open signed out. The empty list, never null: there is
     nothing to compare for a stranger, which is not the same as a comparison
     that failed to load, and the view says those two things differently. */
  if (!(await hasSession())) return [];
  try {
    const db = await createClient();
    const { data, error } = await callLandlordRpc(db, "property_offers", { p_listing: listingId });
    await reportReadError("read.landlord.readPropertyOffers", error);
    if (error) return null;
    if (!Array.isArray(data)) return [];
    return data.flatMap((raw): PropertyOffer[] => {
      const row = raw as Record<string, unknown>;
      if (typeof row.listing_id !== "string" || typeof row.title !== "string") return [];
      const role = row.listing_role;
      return [
        {
          listingId: row.listing_id,
          isThisListing: row.is_this_listing === true,
          title: row.title,
          listingRole: role === "owner" || role === "agent" || role === "firm" ? role : null,
          listerName: typeof row.lister_name === "string" ? row.lister_name : null,
          rentMinor: typeof row.rent_amount_minor === "number" ? row.rent_amount_minor : null,
          rentPeriod: typeof row.rent_period === "string" ? row.rent_period : null,
          moveInMinor: typeof row.move_in_total_minor === "number" ? row.move_in_total_minor : null,
          ownerConfirmedAt: typeof row.availability_confirmed_at === "string" ? row.availability_confirmed_at : null,
        },
      ];
    });
  } catch {
    return null;
  }
}

/** The tenant's dated fact about the landlord's answer, or null for nothing to say. */
export async function readRentFactFor(inspectionId: string): Promise<RentFact | null> {
  if (!isSupabaseConfigured()) return null;
  if (!(await hasSession())) return null;
  try {
    const db = await createClient();
    const { data, error } = await callLandlordRpc(db, "rent_landlord_fact", { p_inspection: inspectionId });
    await reportReadError("read.landlord.readRentFactFor", error);
    if (error) return null;
    return readRentFact(data);
  } catch {
    return null;
  }
}

/**
 * THE LANDLORD LINE'S SWITCH, READ FAIL CLOSED, on the model of
 * `lib/flags/read.ts`. Used only to TELL the reviewer whether consent will
 * lead to a message yet; the database functions check the flag themselves.
 */
export async function landlordLineIsOpen(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const db = await createClient();
    const { data, error } = await db.from("feature_flags").select("enabled").eq("key", "landlord_line").maybeSingle();
    await reportReadError("read.landlord.landlordLineIsOpen", error);
    if (error) return false;
    return data?.enabled === true;
  } catch {
    return false;
  }
}

export type MandateConsent = {
  mandateId: string;
  consentedAt: string | null;
  readByName: string | null;
  withdrawnAt: string | null;
  hasNumber: boolean;
  /** When this NUMBER last asked us to stop, on any mandate, or null. */
  numberStoppedAt: string | null;
};

/** Consent for a set of mandates, for the console. Null when the read failed. */
export async function readMandateConsents(ids: readonly string[]): Promise<Map<string, MandateConsent> | null> {
  if (!isSupabaseConfigured()) return null;
  if (ids.length === 0) return new Map();
  if (!(await hasSession())) return new Map();
  try {
    const db = await createClient();
    const { data, error } = await callLandlordRpc(db, "mandate_consents", { p_mandates: ids.slice(0, 200) });
    await reportReadError("read.landlord.readMandateConsents", error);
    if (error || !Array.isArray(data)) return null;
    const out = new Map<string, MandateConsent>();
    for (const raw of data) {
      const row = raw as Record<string, unknown>;
      if (typeof row.mandate_id !== "string") continue;
      out.set(row.mandate_id, {
        mandateId: row.mandate_id,
        consentedAt: typeof row.consented_at === "string" ? row.consented_at : null,
        readByName: typeof row.read_by_name === "string" ? row.read_by_name : null,
        withdrawnAt: typeof row.withdrawn_at === "string" ? row.withdrawn_at : null,
        hasNumber: row.has_number === true,
        numberStoppedAt: typeof row.number_stopped_at === "string" ? row.number_stopped_at : null,
      });
    }
    return out;
  } catch {
    return null;
  }
}

export type PropertyCandidate = {
  listingId: string;
  reference: string | null;
  title: string;
  status: string;
  listerName: string | null;
  propertyId: string | null;
  samePrincipal: boolean;
  /** Both listings have an approved principal on record and they differ. */
  differentPrincipal: boolean;
  distanceM: number | null;
  sameShape: boolean;
  moveInMinor: number | null;
};

/** Proposed matches for the reviewer. Null when the read failed. */
export async function readPropertyCandidates(listingId: string): Promise<PropertyCandidate[] | null> {
  if (!isSupabaseConfigured()) return null;
  if (!(await hasSession())) return [];
  try {
    const db = await createClient();
    const { data, error } = await callLandlordRpc(db, "property_candidates", { p_listing: listingId });
    await reportReadError("read.landlord.readPropertyCandidates", error);
    if (error || !Array.isArray(data)) return null;
    return data.flatMap((raw): PropertyCandidate[] => {
      const row = raw as Record<string, unknown>;
      if (typeof row.listing_id !== "string") return [];
      return [
        {
          listingId: row.listing_id,
          reference: typeof row.reference === "string" ? row.reference : null,
          title: typeof row.title === "string" ? row.title : "",
          status: typeof row.status === "string" ? row.status : "",
          listerName: typeof row.lister_name === "string" ? row.lister_name : null,
          propertyId: typeof row.property_id === "string" ? row.property_id : null,
          samePrincipal: row.same_principal === true,
          differentPrincipal: row.different_principal === true,
          distanceM: typeof row.distance_m === "number" ? row.distance_m : null,
          sameShape: row.same_shape === true,
          moveInMinor: typeof row.move_in_total_minor === "number" ? row.move_in_total_minor : null,
        },
      ];
    });
  } catch {
    return null;
  }
}

/**
 * The property a listing is on, for the review page, or null. Read under the
 * caller's own RLS (staff read every listing). The column is not in the
 * generated types until they are regenerated, hence the narrow cast.
 */
export async function readListingPropertyId(listingId: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const db = await createClient();
    const { data, error } = await (db.from("listings") as unknown as {
      select: (cols: string) => {
        eq: (col: string, value: string) => { maybeSingle: () => PromiseLike<{ data: { property_id?: unknown } | null; error: unknown }> };
      };
    })
      .select("property_id")
      .eq("id", listingId)
      .maybeSingle();
    await reportReadError("read.landlord.readListingPropertyId", error);
    if (error || !data) return null;
    return typeof data.property_id === "string" ? data.property_id : null;
  } catch {
    return null;
  }
}

/**
 * V-48: which of a lister's listings are CLOSED, and why. Keyed by id; empty
 * on any failure, which draws every listing exactly as it was drawn before.
 * Kept out of the workspace's own select for the same reason the catalogue
 * facts are: a select naming a column the live database does not have yet
 * fails the whole read.
 */
export async function readClosedReasons(ids: readonly string[]): Promise<Record<string, string>> {
  if (!isSupabaseConfigured() || ids.length === 0) return {};
  try {
    const db = await createClient();
    const { data, error } = await (db.from("listings") as unknown as {
      select: (cols: string) => {
        in: (col: string, values: readonly string[]) => {
          not: (col: string, op: string, value: null) => PromiseLike<{ data: { id?: unknown; close_reason?: unknown }[] | null; error: unknown }>;
        };
      };
    })
      .select("id, close_reason")
      .in("id", ids.slice(0, 500))
      .not("closed_at", "is", null);
    await reportReadError("read.landlord.readClosedReasons", error);
    if (error || !data) return {};
    const out: Record<string, string> = {};
    for (const row of data) {
      if (typeof row.id === "string" && typeof row.close_reason === "string") out[row.id] = row.close_reason;
    }
    return out;
  } catch {
    return {};
  }
}

/** V-31 for owner listings: the caller's listings with an open "still available?" question. Empty on failure. */
export async function readOpenOwnerHeartbeats(): Promise<string[]> {
  if (!isSupabaseConfigured()) return [];
  if (!(await hasSession())) return [];
  try {
    const db = await createClient();
    const { data, error } = await callLandlordRpc(db, "owner_heartbeats_open", {});
    await reportReadError("read.landlord.readOpenOwnerHeartbeats", error);
    if (error || !Array.isArray(data)) return [];
    return data.flatMap((row) =>
      row && typeof (row as { listing_id?: unknown }).listing_id === "string" ? [(row as { listing_id: string }).listing_id] : [],
    );
  } catch {
    return [];
  }
}
