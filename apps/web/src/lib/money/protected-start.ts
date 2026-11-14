import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveSession } from "../actions/session";
import { recordAlert } from "../alerts";
import { reportReadFault } from "../observability/read-error";
import { escrowPayEnabled } from "../payments/providers/escrowpay/switch";
import { PROTECTED_PAYEE_DEFAULT, PROTECTED_PAYER_DEFAULT, PROTECTED_PLACE_DEFAULT, PROTECTED_REFUND_TERMS_DEFAULT } from "./copy";
import { readAgreementRail } from "./fund-view";
import { adminDb } from "./member-wallet";
import { protectedQuote, type ProtectedQuote } from "./protected-fees";
import { milestoneFor } from "./protected-journey";
import { findParty, protectedRailDeps, protectedRailOpen } from "./protected-provider";
import { approvedCategory, datesFor } from "./protected-read";
import type { ProtectedDeal } from "@/components/money/protected-rail/types";

/**
 * THE START OF A PROTECTED PAYMENT, AS THE PAYER MAY SEE IT (spec two,
 * screen 2): what the review screen draws before anything exists at the
 * provider, and whether the payer's identity has been checked yet.
 *
 * NULL UNLESS ALL OF THESE HOLD, checked in this order, failing closed:
 *  1. the rail may start money for a member right now (`protectedRailOpen`:
 *     verified, configured, credentials that may start a payment on this
 *     deployment, the founder's switch on);
 *  2. the viewer is the agreement's tenant, or the payer the tenant named
 *     and who accepted, and the agreement is approved;
 *  3. the agreement goes down the protected rail, and its category is
 *     approved and has a milestone;
 *  4. no protected payment is live on it already (the funding page draws
 *     that one instead), and a fee can be quoted for the amount.
 *
 * Read under the viewer's own session. The one provider call (is this payer
 * known?) is made with the server's key; its answer is only a yes or a no.
 */
export type ProtectedStartRead = {
  agreementId: string;
  agreementVersion: number;
  quote: ProtectedQuote;
  deal: Pick<ProtectedDeal, "amountMinor" | "place" | "payerName" | "payeeName" | "dates" | "refundTerms" | "milestone" | "links">;
  /** Whether the payer still owes the one identity check. `unknown` when the provider could not be asked. */
  identity: "done" | "needed" | "unknown";
  /** The viewer is the tenant and somebody else pays: the payer does the identity step themselves. */
  payerIsViewer: boolean;
};

type RowLike = Record<string, unknown>;
const str = (v: unknown): string | null => (typeof v === "string" && v.trim().length > 0 ? v : null);

export async function readProtectedStart(agreementId: string): Promise<ProtectedStartRead | null> {
  try {
    const admin = adminDb();
    if (!admin) return null;
    const deps = protectedRailDeps(admin, async (kind, detail) => {
      await recordAlert({ kind, severity: "critical", detail });
    });
    if (!(await protectedRailOpen(deps))) return null;
    const session = await resolveSession();
    if (session.state !== "signed-in") return null;
    const db = session.supabase as unknown as SupabaseClient;
    const me = session.user.id;

    const { data: agRow, error: agError } = await db
      .from("deal_agreements")
      .select("id, kind, status, listing_id, renter_id, owner_id, terms, terms_version, amount_minor, named_payer_id, named_payer_by_renter_at, named_payer_accepted_at")
      .eq("id", agreementId)
      .maybeSingle();
    await reportReadFault("read.money.protected_start_agreement", agError);
    if (agError || !agRow) return null;
    const ag = agRow as RowLike;
    if (ag.status !== "approved") return null;
    const renter = str(ag.renter_id);
    const owner = str(ag.owner_id);
    const named = str(ag.named_payer_id) && ag.named_payer_by_renter_at && ag.named_payer_accepted_at ? str(ag.named_payer_id) : null;
    const payer = named ?? renter;
    if (!renter || !owner || !payer || (me !== renter && me !== payer)) return null;

    if ((await readAgreementRail(agreementId)) !== "escrow") return null;
    const category = await approvedCategory(db, agreementId);
    if (!category) return null;
    const milestone = milestoneFor(category);
    if (!milestone) return null;

    const { data: live, error: liveError } = await db.from("provider_arrangements").select("id, status").eq("agreement_id", agreementId);
    await reportReadFault("read.money.protected_start_live", liveError);
    if (liveError) return null;
    if (((live ?? []) as RowLike[]).some((r) => r.status !== "failed" && r.status !== "cancelled")) return null;

    const amountMinor = Number(ag.amount_minor);
    const version = Number(ag.terms_version);
    const quote = Number.isSafeInteger(amountMinor) ? protectedQuote(amountMinor) : null;
    if (!quote || !Number.isSafeInteger(version) || version < 1) return null;

    const [listing, people, party] = await Promise.all([
      str(ag.listing_id) ? db.from("listings").select("title, area, city").eq("id", ag.listing_id as string).maybeSingle() : Promise.resolve({ data: null }),
      db.from("profiles").select("id, display_name").in("id", [payer, owner]),
      findParty(deps, payer),
    ]);
    const place = (listing.data ?? null) as RowLike | null;
    const names = new Map(((people.data ?? []) as RowLike[]).map((p) => [p.id, str(p.display_name)]));
    const terms = ag.terms && typeof ag.terms === "object" && !Array.isArray(ag.terms) ? (ag.terms as RowLike) : null;

    return {
      agreementId,
      agreementVersion: version,
      quote,
      deal: {
        amountMinor,
        place: { title: str(place?.title) ?? PROTECTED_PLACE_DEFAULT, area: [str(place?.area), str(place?.city)].filter(Boolean).join(", "), photo: null },
        payerName: names.get(payer) || PROTECTED_PAYER_DEFAULT,
        payeeName: names.get(owner) || PROTECTED_PAYEE_DEFAULT,
        dates: datesFor(String(ag.kind ?? ""), terms),
        refundTerms: str(terms?.refund_terms) ?? PROTECTED_REFUND_TERMS_DEFAULT,
        milestone,
        links: { agreement: `/agreements/${agreementId}`, receipt: null, help: "/support/new?kind=problem", how: "/docs/how-protection-works" },
      },
      identity: party.state === "known" ? "done" : party.state === "unknown_member" ? "needed" : "unknown",
      payerIsViewer: me === payer,
    };
  } catch {
    return null;
  }
}

export type ProtectedSetupRead = { identity: "done" | "needed" | "unknown"; payoutAccount: "ready" | "missing" | "unknown" };

/**
 * A member's own readiness to be paid through a protected payment: whether
 * the one identity check is done, and whether a bank account is on their
 * Vallo account for the payout. Null while the rail is off.
 */
export async function readProtectedSetup(): Promise<ProtectedSetupRead | null> {
  try {
    if (!(await escrowPayEnabled())) return null;
    const admin = adminDb();
    if (!admin) return null;
    const deps = protectedRailDeps(admin, async () => undefined);
    if (!(await protectedRailOpen(deps))) return null;
    const session = await resolveSession();
    if (session.state !== "signed-in") return null;
    const db = session.supabase as unknown as SupabaseClient;
    const [party, bank] = await Promise.all([
      findParty(deps, session.user.id),
      db.from("bank_accounts").select("id").eq("user_id", session.user.id).is("deleted_at", null).limit(1),
    ]);
    return {
      identity: party.state === "known" ? "done" : party.state === "unknown_member" ? "needed" : "unknown",
      payoutAccount: bank.error ? "unknown" : Array.isArray(bank.data) && bank.data.length > 0 ? "ready" : "missing",
    };
  } catch {
    return null;
  }
}
