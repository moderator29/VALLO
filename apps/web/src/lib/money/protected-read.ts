import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveSession } from "../actions/session";
import { flagIsOn } from "../flags/read";
import { escrowPayEnabled } from "../payments/providers/escrowpay/switch";
import { ARRANGEMENT_STATUSES, type ArrangementStatus } from "./arrangement-states";
import {
  PROTECTED_PAYEE_DEFAULT,
  PROTECTED_PAYER_DEFAULT,
  PROTECTED_PLACE_DEFAULT,
  PROTECTED_REFUND_TERMS_DEFAULT,
  protectedMoveIn,
  protectedStayDates,
} from "./copy";
import { categoryMayUseProtectedRail, isProtectedCategory, readCategoryStatus, type ProtectedCategory } from "./protected-categories";
import { milestoneFor, stageFor } from "./protected-journey";
import { partnerMarkReady } from "./protected-wording";
import { issueFor } from "@/components/money/protected/issues";
import type { ProtectedDeal, ProtectedPaymentSummary } from "@/components/money/protected/types";

/**
 * THE PROTECTED PAYMENT, AS ONE VIEWER MAY SEE IT (BUILD 7.2; spec two).
 *
 * Builds the `ProtectedDeal` the screens draw for one agreement, read under
 * the viewer's OWN session (RLS: `provider_arrangements_parties_read`, the
 * agreement's parties). Nothing here uses the service role and nothing here
 * writes.
 *
 * NULL UNLESS ALL OF THESE HOLD, checked in this order, failing closed:
 *  1. `escrowPayEnabled()` (the founder's switch, `payments_escrowpay_on`,
 *     fail closed; `PAYMENTS_KILL_ESCROWPAY=1` stops it with no database).
 *     When it is off NOTHING else is read, so a page that asks behaves
 *     exactly as it did before this module existed.
 *  2. The viewer is a party to the arrangement, and its provider is
 *     'escrowpay' (a Payluk row is never drawn on these screens).
 *  3. The agreement's category is approved, as the database says it through
 *     `public.protected_category_status_for_agreement` (pending SQL
 *     protected_category_read_2026-11-10.sql). A function that does not
 *     exist yet, an error, or any word but `approved` is disabled.
 *  4. The category has a protected milestone (a sale never does).
 *
 * The lifecycle columns (protected_rail_prep, applied 10 November; and
 * `transfer_reported_at`, pending) are read with `select("*")` and taken
 * only when present, so a column that is not there is simply null.
 */

type Db = SupabaseClient;
type RowLike = Record<string, unknown>;

export type ProtectedDealRead = {
  deal: ProtectedDeal;
  role: "payer" | "lister";
  agreementId: string;
  arrangementId: string;
};

export type ProtectedReadDeps = {
  enabled: () => Promise<boolean>;
  now: number;
};

const HOW_HREF = "/docs/how-protection-works";
const HELP_HREF = "/support/new?kind=problem";

const str = (v: unknown): string | null => (typeof v === "string" && v.trim().length > 0 ? v : null);
const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : Number.NaN;
  return Number.isFinite(n) ? n : null;
};

function readStatus(v: unknown): ArrangementStatus | null {
  return typeof v === "string" && (ARRANGEMENT_STATUSES as readonly string[]).includes(v) ? (v as ArrangementStatus) : null;
}

async function isOn(enabled: () => Promise<boolean>): Promise<boolean> {
  try {
    return (await enabled()) === true;
  } catch {
    return false;
  }
}

/**
 * The category the database decides for an agreement, and whether it is
 * approved. Null for anything but a readable, approved, known category.
 */
export async function approvedCategory(db: Db, agreementId: string): Promise<ProtectedCategory | null> {
  try {
    const { data, error } = await db.rpc("protected_category_status_for_agreement", { p_agreement: agreementId });
    /* A missing function (not applied yet) is an error, and an error is disabled. */
    if (error || !data || typeof data !== "object") return null;
    const row = data as RowLike;
    if (!isProtectedCategory(row.category)) return null;
    return categoryMayUseProtectedRail(readCategoryStatus(row.status)) ? row.category : null;
  } catch {
    return null;
  }
}

/** The provider's funding instructions, only when every field is there. */
function readFunding(row: RowLike): ProtectedDeal["funding"] {
  const raw = row.funding_instructions;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const f = raw as RowLike;
  /* TODO(provider-docs): the instruction's own field names. Both spellings
     Vallo's adapter may store are read; anything else draws no details. */
  const bank = str(f.bank_name) ?? str(f.bank);
  const accountName = str(f.account_name);
  const accountNumber = str(f.account_number);
  if (!bank || !accountName || !accountNumber) return null;
  return { bank, accountName, accountNumber, expiresAt: str(row.funding_expires_at) ?? str(f.expires_at) };
}

function dayOf(iso: string): string | null {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  return new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "long", timeZone: "Africa/Lagos" }).format(at);
}

function datesFor(kind: string, terms: RowLike | null): string | null {
  if (!terms) return null;
  if (kind === "stay") {
    const from = str(terms.check_in);
    const to = str(terms.check_out);
    const a = from ? dayOf(from) : null;
    const b = to ? dayOf(to) : null;
    return a && b ? protectedStayDates(a, b) : a;
  }
  const moveIn = str(terms.move_in);
  const day = moveIn ? dayOf(moveIn) : null;
  return day ? protectedMoveIn(day) : null;
}

/** Whether a lister has no payout account at all. False whenever a read fails: unknown is not "missing". */
async function payoutMissing(db: Db, userId: string): Promise<boolean> {
  try {
    const [bank, agents] = await Promise.all([
      db.from("bank_accounts").select("id").eq("user_id", userId).is("deleted_at", null).limit(1),
      db.from("agents").select("id").eq("user_id", userId),
    ]);
    if (bank.error || agents.error) return false;
    if (Array.isArray(bank.data) && bank.data.length > 0) return false;
    const ids = ((agents.data ?? []) as { id: string }[]).map((a) => a.id);
    if (ids.length === 0) return true;
    const payout = await db.from("payout_accounts").select("id").in("agent_id", ids).limit(1);
    if (payout.error) return false;
    return !(Array.isArray(payout.data) && payout.data.length > 0);
  } catch {
    return false;
  }
}

/** Whether the partner mark may be drawn: the provider's asset supplied AND the founder's presentation flag. */
export async function partnerMarkOn(flag: (key: string) => Promise<boolean> = flagIsOn): Promise<boolean> {
  if (!partnerMarkReady) return false;
  try {
    return (await flag("protected_partner_mark_on")) === true;
  } catch {
    return false;
  }
}

/**
 * The core, with its database and switch handed in (the tests' door). The
 * page calls `readProtectedDeal`, which supplies the viewer's own session.
 */
export async function buildProtectedDeal(
  db: Db,
  userId: string,
  agreementId: string,
  deps: ProtectedReadDeps,
  mark: () => Promise<boolean> = partnerMarkOn,
): Promise<ProtectedDealRead | null> {
  if (!(await isOn(deps.enabled))) return null;
  try {
    const { data: arrRow, error: arrError } = await db
      .from("provider_arrangements")
      .select("*")
      .eq("agreement_id", agreementId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (arrError || !arrRow) return null;
    const arr = arrRow as RowLike;
    if (arr.provider !== "escrowpay") return null;
    const status = readStatus(arr.status);
    const arrangementId = str(arr.id);
    const reference = str(arr.reference);
    const amountMinor = num(arr.amount_minor);
    if (!status || !arrangementId || !reference || amountMinor === null) return null;
    const role = arr.buyer_user_id === userId ? "payer" : arr.seller_user_id === userId ? "lister" : null;
    if (!role) return null;

    const category = await approvedCategory(db, agreementId);
    if (!category) return null;
    const milestone = milestoneFor(category);
    if (!milestone) return null;

    const { data: agRow, error: agError } = await db
      .from("deal_agreements")
      .select("id, kind, listing_id, renter_id, owner_id, terms, terms_version")
      .eq("id", agreementId)
      .maybeSingle();
    if (agError || !agRow) return null;
    const ag = agRow as RowLike;
    const terms = ag.terms && typeof ag.terms === "object" && !Array.isArray(ag.terms) ? (ag.terms as RowLike) : null;
    const buyer = str(arr.buyer_user_id);
    const seller = str(arr.seller_user_id);

    const [listing, people, mark_, missing] = await Promise.all([
      str(ag.listing_id) ? db.from("listings").select("title, area, city").eq("id", ag.listing_id as string).maybeSingle() : Promise.resolve({ data: null }),
      db.from("profiles").select("id, display_name").in("id", [buyer, seller].filter(Boolean) as string[]),
      role === "payer" ? mark() : Promise.resolve(false),
      role === "lister" ? payoutMissing(db, userId) : Promise.resolve(false),
    ]);
    const place = (listing.data ?? null) as RowLike | null;
    const names = new Map(((people.data ?? []) as RowLike[]).map((p) => [p.id, str(p.display_name)]));

    const stamps = {
      fundedAt: str(arr.funded_at),
      releaseRequestedAt: str(arr.release_requested_at),
      releaseConfirmedAt: str(arr.release_confirmed_at),
      refundConfirmedAt: str(arr.refund_confirmed_at),
    };
    const lastCheckedAt = str(arr.last_provider_check_at) ?? str(arr.last_reconcile_at) ?? str(arr.last_webhook_at);
    const funding = readFunding(arr);
    const issue = issueFor({
      status,
      reviewReason: str(arr.review_reason),
      lastReconcileResult: str(arr.last_reconcile_result),
      lastConfirmedAt: lastCheckedAt ?? str(arr.status_observed_at),
      releaseRequestedAt: stamps.releaseRequestedAt,
      refundRequestedAt: str(arr.refund_requested_at),
      now: deps.now,
    });
    const stage = stageFor({ status, transferReported: arr.transfer_reported_at != null, fundingExpiresAt: funding?.expiresAt ?? null, now: deps.now });
    const final = stage === "released" || stage === "refunded";
    const area = [str(place?.area), str(place?.city)].filter(Boolean).join(", ");

    const deal: ProtectedDeal = {
      reference,
      amountMinor,
      currency: "NGN",
      category,
      milestone,
      place: { title: str(place?.title) ?? PROTECTED_PLACE_DEFAULT, area, photo: null },
      payerName: (buyer && names.get(buyer)) || PROTECTED_PAYER_DEFAULT,
      payeeName: (seller && names.get(seller)) || PROTECTED_PAYEE_DEFAULT,
      dates: datesFor(String(ag.kind ?? ""), terms),
      refundTerms: str(terms?.refund_terms) ?? PROTECTED_REFUND_TERMS_DEFAULT,
      status,
      transferReported: arr.transfer_reported_at != null,
      funding,
      stamps,
      lastCheckedAt,
      links: {
        agreement: `/agreements/${agreementId}`,
        receipt: final ? `/agreements/${agreementId}/held#receipt` : null,
        help: HELP_HREF,
        how: HOW_HREF,
      },
      issue,
      listerPayoutMissing: missing,
      partnerMark: mark_,
      receipt: {
        providerReference: str(arr.provider_reference) ?? str(arr.provider_arrangement_id),
        agreementVersion: num(arr.accepted_agreement_version),
        refundRequestedAt: str(arr.refund_requested_at),
      },
    };
    return { deal, role, agreementId, arrangementId };
  } catch {
    return null;
  }
}

/** The page's door: the viewer's own session, the real switch, the request's clock. */
export async function readProtectedDeal(agreementId: string, now: number = Date.now()): Promise<ProtectedDealRead | null> {
  if (!(await isOn(escrowPayEnabled))) return null;
  const session = await resolveSession();
  if (session.state !== "signed-in") return null;
  return buildProtectedDeal(session.supabase as unknown as Db, session.user.id, agreementId, { enabled: escrowPayEnabled, now });
}

/**
 * The viewer's protected payments as list rows (BUILD 7.5 and 7.4), newest
 * first, at most `limit`. Empty while the rail is off: nothing is read.
 */
export async function buildMyProtectedPayments(db: Db, userId: string, deps: ProtectedReadDeps, limit = 20): Promise<ProtectedPaymentSummary[]> {
  if (!(await isOn(deps.enabled))) return [];
  try {
    const { data, error } = await db
      .from("provider_arrangements")
      .select("*")
      .eq("provider", "escrowpay")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error || !Array.isArray(data)) return [];
    const rows: ProtectedPaymentSummary[] = [];
    for (const raw of data as RowLike[]) {
      const status = readStatus(raw.status);
      const agreementId = str(raw.agreement_id);
      const reference = str(raw.reference);
      const amountMinor = num(raw.amount_minor);
      const role = raw.buyer_user_id === userId ? "payer" : raw.seller_user_id === userId ? "lister" : null;
      if (!status || !agreementId || !reference || amountMinor === null || !role || raw.provider !== "escrowpay") continue;
      if (!(await approvedCategory(db, agreementId))) continue;
      const funding = readFunding(raw);
      const stage = stageFor({ status, transferReported: raw.transfer_reported_at != null, fundingExpiresAt: funding?.expiresAt ?? null, now: deps.now });
      rows.push({
        agreementId,
        reference,
        amountMinor,
        stage,
        title: PROTECTED_PLACE_DEFAULT,
        role,
        at: str(raw.status_observed_at) ?? str(raw.created_at) ?? new Date(deps.now).toISOString(),
        href: stage === "awaiting_transfer" || stage === "confirming" || stage === "expired" ? `/agreements/${agreementId}/fund` : `/agreements/${agreementId}/held`,
      });
    }
    if (rows.length === 0) return rows;
    /* The places' titles, in one read under the same session. */
    const { data: ags } = await db.from("deal_agreements").select("id, listing_id").in("id", rows.map((r) => r.agreementId));
    const listingOf = new Map(((ags ?? []) as RowLike[]).map((a) => [a.id, str(a.listing_id)]));
    const listingIds = [...new Set([...listingOf.values()].filter(Boolean) as string[])];
    if (listingIds.length > 0) {
      const { data: ls } = await db.from("listings").select("id, title").in("id", listingIds);
      const titles = new Map(((ls ?? []) as RowLike[]).map((l) => [l.id, str(l.title)]));
      for (const row of rows) {
        const title = titles.get(listingOf.get(row.agreementId) ?? "");
        if (title) row.title = title;
      }
    }
    return rows;
  } catch {
    return [];
  }
}

export async function readMyProtectedPayments(now: number = Date.now()): Promise<ProtectedPaymentSummary[]> {
  if (!(await isOn(escrowPayEnabled))) return [];
  const session = await resolveSession();
  if (session.state !== "signed-in") return [];
  return buildMyProtectedPayments(session.supabase as unknown as Db, session.user.id, { enabled: escrowPayEnabled, now });
}
