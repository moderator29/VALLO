import "server-only";
import { reportReadError } from "@/lib/observability/read-error";
import { subjectHref, subjectKey, subjectTitles, type AgreementSubject } from "./subject";

import { resolveSession } from "../actions/session";

/**
 * The agreements a person is a party to, read under their own RLS.
 */

/* What the read calls a party whose profile carries no name. Exported so a
   page can tell "no name" from a name, and not print "The owner or agent
   (owner or agent)" (Round 3 sweep, C3). */
export const UNNAMED_RENTER = "The renter";
export const UNNAMED_OWNER = "The owner or agent";

export type AgreementSummary = {
  id: string;
  kind: "rent" | "stay";
  status: string;
  listingId: string;
  /** The listing's page, or the hotel's for a room stay (ROOM BOOKINGS 1). */
  subjectHref: string;
  listingTitle: string;
  amountMinor: number;
  /**
   * The reader's side, or null when they are not a party (staff read every
   * agreement under RLS). Null draws no party controls.
   */
  role: "renter" | "owner" | null;
  updatedAt: string;
};

export type AgreementDetail = AgreementSummary & {
  termsVersion: number;
  terms: Record<string, unknown>;
  inspectionId: string | null;
  bookingId: string | null;
  renterName: string;
  ownerName: string;
  youConfirmedCurrent: boolean;
  otherConfirmedCurrent: boolean;
  decisionReason: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
  paidAt: string | null;
  claimWindow: { opens: string; closes: string } | null;
  events: { at: string; action: string; note: string | null }[];
  claims: {
    id: string;
    status: string;
    requestedMinor: number;
    approvedMinor: number | null;
    reason: string | null;
    createdAt: string;
    /** Filed by the person reading. `guarantee_claim_file_as` allows one open claim each. */
    mine: boolean;
  }[];
};

export async function readMyAgreements(): Promise<AgreementSummary[] | null> {
  const session = await resolveSession();
  if (session.state !== "signed-in") return null;
  const { data, error } = await session.supabase
    .from("deal_agreements")
    .select("id, kind, status, listing_id, accommodation_id, amount_minor, renter_id, owner_id, updated_at")
    // A sale offer lives in the Deal Room (/offers), never in the rent and stay agreements.
    .neq("kind", "sale")
    .order("updated_at", { ascending: false })
    .limit(100);
  await reportReadError("read.agreements.readMyAgreements", error);
  if (error) return null;
  const rows = (data ?? []) as unknown as (AgreementSubject & {
    id: string;
    kind: string;
    status: string;
    amount_minor: number;
    renter_id: string;
    owner_id: string;
    updated_at: string;
  })[];
  const title = await subjectTitles(session.supabase, rows);
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind === "stay" ? "stay" : "rent",
    status: r.status,
    listingId: r.listing_id ?? "",
    subjectHref: subjectHref(r),
    listingTitle: title.get(subjectKey(r)) || "A property",
    amountMinor: r.amount_minor,
    role: partyRole(session.user.id, r.renter_id, r.owner_id),
    updatedAt: r.updated_at,
  }));
}

function partyRole(me: string, renterId: string, ownerId: string): "renter" | "owner" | null {
  if (me === renterId) return "renter";
  if (me === ownerId) return "owner";
  return null;
}

function lagosStart(date: string | null): number | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  // Lagos is UTC+1 all year.
  return Date.parse(`${date}T00:00:00+01:00`);
}

export async function readAgreement(id: string): Promise<AgreementDetail | null> {
  const session = await resolveSession();
  if (session.state !== "signed-in") return null;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data: a } = await session.supabase.from("deal_agreements").select("*").eq("id", id).neq("kind", "sale").maybeSingle();
  if (!a) return null;
  const [listing, people, events, claims, policy] = await Promise.all([
    subjectTitles(session.supabase, [a as unknown as AgreementSubject]),
    session.supabase.from("profiles").select("id, display_name").in("id", [a.renter_id, a.owner_id]),
    session.supabase
      .from("deal_agreement_events")
      .select("created_at, action, note")
      .eq("agreement_id", a.id)
      .order("created_at", { ascending: true }),
    session.supabase
      .from("guarantee_claims")
      .select("id, status, requested_minor, approved_minor, decision_reason, created_at, claimant_id")
      .eq("agreement_id", a.id)
      .order("created_at", { ascending: false }),
    session.supabase.from("money_policy").select("claim_window_hours").maybeSingle(),
  ]);
  const name = new Map((people.data ?? []).map((p) => [p.id, p.display_name ?? ""]));
  const role = partyRole(session.user.id, a.renter_id, a.owner_id);
  const terms = (a.terms ?? {}) as Record<string, unknown>;
  const start = lagosStart(
    (typeof terms.move_in === "string" ? terms.move_in : null) ?? (typeof terms.check_in === "string" ? terms.check_in : null),
  );
  const hours = policy.data?.claim_window_hours ?? 72;
  const mine = role === "renter" ? a.renter_confirmed_version : role === "owner" ? a.owner_confirmed_version : null;
  const theirs = role === "renter" ? a.owner_confirmed_version : role === "owner" ? a.renter_confirmed_version : null;
  return {
    id: a.id,
    kind: a.kind === "stay" ? "stay" : "rent",
    status: a.status,
    listingId: a.listing_id ?? "",
    subjectHref: subjectHref(a as unknown as AgreementSubject),
    listingTitle: listing.get(subjectKey(a as unknown as AgreementSubject)) || "A property",
    amountMinor: a.amount_minor,
    role,
    updatedAt: a.updated_at,
    termsVersion: a.terms_version,
    terms,
    inspectionId: a.inspection_id,
    bookingId: a.booking_id,
    renterName: name.get(a.renter_id) || UNNAMED_RENTER,
    ownerName: name.get(a.owner_id) || UNNAMED_OWNER,
    youConfirmedCurrent: mine === a.terms_version,
    otherConfirmedCurrent: theirs === a.terms_version,
    decisionReason: a.decision_reason,
    submittedAt: a.submitted_at,
    decidedAt: a.decided_at,
    paidAt: a.paid_at,
    claimWindow:
      start !== null
        ? { opens: new Date(start).toISOString(), closes: new Date(start + hours * 3_600_000).toISOString() }
        : null,
    events: (events.data ?? []).map((e) => ({ at: e.created_at, action: e.action, note: e.note })),
    claims: (claims.data ?? []).map((c) => ({
      id: c.id,
      status: c.status,
      requestedMinor: c.requested_minor,
      approvedMinor: c.approved_minor,
      reason: c.decision_reason,
      createdAt: c.created_at,
      mine: c.claimant_id === session.user.id,
    })),
  };
}
