import type { SupabaseClient } from "@supabase/supabase-js";

import { SUPABASE_URL } from "@/lib/supabase/env";

import { isNotLive } from "../degrade";
import type { IdentityState } from "./review";
import { roommatePhotoUrl, type ListingStatus, type PersonRef } from "./model";

/**
 * THE STAFF REVIEW QUEUE (the room offers waiting for a decision). It runs on
 * the staff member's OWN session through `admin_roommate_review_queue`, so the
 * database decides who may see it. The row carries what a reviewer needs and
 * nothing private: no phone, no email, no exact address.
 */

export type ReviewQueueRow = {
  id: string;
  title: string;
  status: ListingStatus;
  city: string | null;
  area: string | null;
  stateCode: string | null;
  description: string;
  rentMinor: number | null;
  rentPeriod: "month" | "year";
  authority: string | null;
  declared: boolean;
  photoCount: number;
  photoUrls: string[];
  linkedListingId: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  owner: PersonRef | null;
  ownerBadges: string[];
  ownerIdentity: IdentityState;
  openCases: number;
};

export type ReviewQueueRead = { state: "ok"; rows: ReviewQueueRow[] } | { state: "not-open" } | { state: "refused" } | { state: "failed" };

type Raw = {
  id: string;
  title: string;
  status: ListingStatus;
  city: string | null;
  area: string | null;
  stateCode: string | null;
  description: string | null;
  rentMinor: number | null;
  rentPeriod: "month" | "year";
  authority: string | null;
  declaredAt: string | null;
  photoCount: number;
  photoPaths: string[] | null;
  linkedListingId: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  owner: PersonRef | null;
  ownerVerified: string[] | null;
  ownerIdentity?: string | null;
  openCases: number;
};

/** Turn the database's row into the desk's: storage paths become URLs, the declaration becomes a plain yes or no. */
export function mapQueueRow(r: Raw, supabaseUrl: string = SUPABASE_URL): ReviewQueueRow {
  return {
    id: r.id,
    title: r.title,
    status: r.status,
    city: r.city,
    area: r.area,
    stateCode: r.stateCode,
    description: r.description ?? "",
    rentMinor: r.rentMinor,
    rentPeriod: r.rentPeriod,
    authority: r.authority,
    declared: Boolean(r.declaredAt),
    photoCount: r.photoCount ?? 0,
    photoUrls: (r.photoPaths ?? []).slice(0, 12).map((p) => roommatePhotoUrl(supabaseUrl, p)),
    linkedListingId: r.linkedListingId,
    submittedAt: r.submittedAt,
    reviewedAt: r.reviewedAt,
    reviewNote: r.reviewNote,
    owner: r.owner,
    ownerBadges: r.ownerVerified ?? [],
    ownerIdentity: r.ownerIdentity === "approved" || r.ownerIdentity === "pending" || r.ownerIdentity === "rejected" ? r.ownerIdentity : "none",
    openCases: Number(r.openCases ?? 0),
  };
}

export const REVIEW_QUEUE_FILTERS = ["submitted", "in_review", "changes_requested", "rejected", "live"] as const;

export async function readReviewQueue(db: SupabaseClient, status: string | null = null): Promise<ReviewQueueRead> {
  const f = (REVIEW_QUEUE_FILTERS as readonly string[]).includes(status ?? "") ? status : null;
  const { data, error } = await db.rpc("admin_roommate_review_queue", { p: { status: f, limit: 50, offset: 0 } });
  if (error) {
    if (isNotLive(error)) return { state: "not-open" };
    if ((error as { code?: string }).code === "42501") return { state: "refused" };
    return { state: "failed" };
  }
  return { state: "ok", rows: ((data ?? []) as Raw[]).map((r) => mapQueueRow(r)) };
}
