import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveSession } from "../actions/session";
import { escrowRailLive } from "../payments/providers";
import type { FundBalance, FundFacts } from "./fund-model";
import { readMyBalance } from "./member-wallet";

/**
 * STEP 7, FUND (D77): the facts behind the renter's funding screen, read under
 * the viewer's own RLS (the agreement and any arrangement are the parties'
 * only) plus the gate's own answer (`agreement_payable_for`) and the renter's
 * Payluk balance. Nothing is written here.
 */
export type FundRead =
  | { state: "ready"; agreementId: string; facts: FundFacts }
  | { state: "missing" | "signed-out" | "unavailable" };

export async function readFundPayment(agreementId: string): Promise<FundRead> {
  const session = await resolveSession();
  if (session.state !== "signed-in") return { state: "signed-out" };
  /* deal_agreements is typed; provider_arrangements arrives with d73b. */
  const db = session.supabase as unknown as SupabaseClient;
  try {
    const { data: agRow, error } = await db
      .from("deal_agreements")
      .select("id, kind, status, renter_id, owner_id, amount_minor, listing_id, accommodation_id, terms")
      .eq("id", agreementId)
      .neq("kind", "sale") /* Vallo takes no money for a purchase: a sale offer never opens a payment screen. */
      .maybeSingle();
    if (error) return { state: "unavailable" };
    if (!agRow) return { state: "missing" };
    const ag = agRow as {
      kind: string;
      status: string;
      renter_id: string;
      owner_id: string;
      amount_minor: number;
      listing_id: string | null;
      accommodation_id: string | null;
      terms: Record<string, unknown> | null;
    };
    const viewerIsRenter = ag.renter_id === session.user.id;
    if (!viewerIsRenter && ag.owner_id !== session.user.id) return { state: "missing" };

    const [payable, arr, listing, counterpart, railLive] = await Promise.all([
      db.rpc("agreement_payable_for", { p_agreement: agreementId }),
      db.from("provider_arrangements").select("status").eq("agreement_id", agreementId).not("status", "in", "(failed,cancelled)").maybeSingle(),
      ag.listing_id ? db.from("listings").select("title").eq("id", ag.listing_id).maybeSingle() : Promise.resolve({ data: null }),
      db
        .from("profiles")
        .select("display_name")
        .eq("id", viewerIsRenter ? ag.owner_id : ag.renter_id)
        .maybeSingle(),
      escrowRailLive().catch(() => false),
    ]);
    /* A failed gate read is not "payable": the screen closes rather than guess. */
    const gate = payable.error ? null : (payable.data as { status?: unknown; rail?: unknown } | null);
    const rail = gate?.rail === "escrow" || gate?.rail === "direct" ? gate.rail : null;
    const balance: FundBalance = viewerIsRenter && railLive ? await fundBalance() : { state: "not-live" };

    return {
      state: "ready",
      agreementId,
      facts: {
        viewerIsRenter,
        kind: ag.kind,
        /* Any stay may reach this screen; whether it is held is the rail's
           answer (`rail` below): a shortlet listing or a shortlet operator's
           room on escrow, a hotel's room never (pov03). */
        listingStay: ag.kind === "stay",
        agreementStatus: ag.status,
        payable: typeof gate?.status === "string" ? gate.status : null,
        rail,
        railLive,
        arrangementStatus: arr.error ? null : ((arr.data as { status?: string } | null)?.status ?? null),
        amountMinor: Number(ag.amount_minor),
        placeTitle: (listing.data as { title?: string } | null)?.title || "Your home",
        counterpartName:
          (counterpart.data as { display_name?: string | null } | null)?.display_name || (viewerIsRenter ? "The lister" : "The renter"),
        /* A stay's escrow is bounded by its check-in, a rental's by its move-in. */
        moveIn:
          typeof ag.terms?.move_in === "string"
            ? (ag.terms.move_in as string)
            : typeof ag.terms?.check_in === "string"
              ? (ag.terms.check_in as string)
              : null,
        balance,
      },
    };
  } catch {
    return { state: "unavailable" };
  }
}

/** The rail the gate resolves for an agreement, as a party reads it; null when it cannot be read. */
export async function readAgreementRail(agreementId: string): Promise<"escrow" | "direct" | null> {
  const session = await resolveSession();
  if (session.state !== "signed-in") return null;
  try {
    const { data, error } = await (session.supabase as unknown as SupabaseClient).rpc("agreement_payable_for", { p_agreement: agreementId });
    if (error) return null;
    const rail = (data as { rail?: unknown } | null)?.rail;
    return rail === "escrow" || rail === "direct" ? rail : null;
  } catch {
    return null;
  }
}

async function fundBalance(): Promise<FundBalance> {
  const read = await readMyBalance();
  if (read.state === "onboarding") return { state: "onboarding" };
  if (read.state === "not-live" || read.state === "signed-out") return { state: "not-live" };
  if (read.state !== "ready" || !read.figures) return { state: "error" };
  return {
    state: "ready",
    availableMinor: read.figures.available.minor,
    confirmedAt: read.figures.available.confirmedAt,
    live: read.live,
  };
}
