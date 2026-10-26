"use server";

/**
 * STEP 7, FUND (D77): the renter pays the agreed rent into escrow from their
 * Vallo (Payluk) balance. A deliberate act (the money swipe), the renter only.
 *
 * Opens the arrangement at Payluk when there is none yet (standard escrow, the
 * lister bearing the fee), then funds it. Every check the database makes is
 * made there too (d73b's open, d77's gate trigger); the ones here are so the
 * renter reads a sentence rather than a code. Nothing is marked held here:
 * Payluk's `escrow.ongoing` webhook does that, and the held screen shows it.
 */
import { passcodeMoneyRefusal } from "@/lib/passcode/money";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "../actions/envelope";
import { NOT_CONFIGURED_MESSAGE, SIGNED_OUT_MESSAGE, resolveSession } from "../actions/session";
import { phoneGateFor } from "../phone-otp/gate";
import { recordAlert } from "../alerts";
import { lagosToday } from "../bookings/schema";
import { paylukContext } from "../payments/providers/payluk";
import { FUND_REFUSED } from "./copy";
import { adminDb } from "./member-wallet";
import { openArrangement, payArrangement, type ArrangementDeps } from "./provider-arrangements";

export type FundOutcome = { next: string; confirming: boolean };

const PAST_FUNDING = new Set(["payment_processing", "protected", "release_requested", "released", "disputed", "refunded", "split"]);

function refusal(reason: string): string {
  const key = reason.split(":")[0]!;
  if (key in FUND_REFUSED) return FUND_REFUSED[key]!;
  if (key === "not_payable") return FUND_REFUSED.not_payable!;
  /* A refusal Payluk itself gave (insufficient balance, wrong state). */
  if (key === "provider_unreadable" || key === "provider_mismatch" || key === "fee_share_unclear") return FUND_REFUSED.unavailable!;
  return FUND_REFUSED.provider_refused!;
}

export async function fundEscrowPayment(input: { agreementId: string }): Promise<ActionResult<FundOutcome>> {
  const parsed = z.object({ agreementId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return fail(FUND_REFUSED.not_found!);
  const agreementId = parsed.data.agreementId;
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);
  /* A passcode-locked session moves no money (docs/PASSCODE.md). */
  const lockedOut = await passcodeMoneyRefusal(session.user.id);
  if (lockedOut) return fail(lockedOut);
  /* FULL GATE (13 October 2026): the first payment needs a confirmed phone,
     flag on; a payment fails closed on a failed read (`phone-otp/core.ts`). */
  const phoneGate = await phoneGateFor(session.supabase, session.user.id, "payment");
  if (phoneGate) return phoneGate;
  const db = adminDb();
  const ctx = paylukContext();
  if (!db || !ctx) return fail(FUND_REFUSED.switched_off!);
  const held = `/agreements/${agreementId}/held`;

  try {
    /* The payer only, on an approved rental, or (ruling 2, 13 October 2026) a
       stay at a listing, that the gate says is payable on escrow. A hotel
       room is card only. */
    const { data: agRow } = await db
      .from("deal_agreements")
      .select("renter_id, kind, status, listing_id, accommodation_id")
      .eq("id", agreementId)
      .maybeSingle();
    const ag = agRow as {
      renter_id: string;
      kind: string;
      status: string;
      listing_id: string | null;
      accommodation_id: string | null;
    } | null;
    if (!ag || ag.renter_id !== session.user.id) return fail(FUND_REFUSED.not_found!);
    /* A rent or a stay; which stays may be held is the rail's answer below
       (a shortlet listing or a shortlet operator's room, never a hotel's
       room: pov03), so it is not guessed from the columns here. */
    const listingStay = ag.kind === "stay";
    if ((ag.kind !== "rent" && !listingStay) || ag.status !== "approved") return fail(FUND_REFUSED.not_payable!);
    const gate = await session.supabase.rpc("agreement_payable_for" as never, { p_agreement: agreementId } as never);
    const answer = (gate.data as { status?: string; rail?: string } | null) ?? null;
    if (gate.error || !answer) return fail(FUND_REFUSED.unavailable!);
    if (answer.status !== "payable") return fail(refusal(answer.status ?? "not_payable"));
    if (answer.rail !== "escrow") return fail(FUND_REFUSED.not_payable!);

    const deps: ArrangementDeps = {
      db,
      ctx,
      todayLagos: lagosToday,
      alert: async (kind, detail) => {
        await recordAlert({ kind, severity: "critical", detail });
      },
    };

    const { data: existing } = await db
      .from("provider_arrangements")
      .select("id, status")
      .eq("agreement_id", agreementId)
      .not("status", "in", "(failed,cancelled)")
      .maybeSingle();
    let arrangement = existing as { id: string; status: string } | null;
    if (arrangement && PAST_FUNDING.has(arrangement.status)) return ok({ next: held, confirming: false });

    if (!arrangement || arrangement.status !== "awaiting_payment") {
      const word = listingStay ? "Stay" : "Rent";
      let title = word;
      if (ag.listing_id) {
        const { data: l } = await db.from("listings").select("title").eq("id", ag.listing_id).maybeSingle();
        const t = (l as { title?: string } | null)?.title;
        if (t) title = `${word}: ${t}`.slice(0, 120);
      } else if (ag.accommodation_id) {
        const { data: acc } = await db.from("accommodations").select("name").eq("id", ag.accommodation_id).maybeSingle();
        const n = (acc as { name?: string } | null)?.name;
        if (n) title = `${word}: ${n}`.slice(0, 120);
      }
      const opened = await openArrangement(deps, { agreementId, kind: "standard", purpose: title });
      if (opened.outcome === "refused") return fail(refusal(opened.reason));
      if (opened.outcome === "unknown") return ok({ next: held, confirming: true });
      if (opened.outcome === "failed") return fail(FUND_REFUSED.provider_refused!);
      arrangement = { id: opened.arrangementId, status: opened.status };
      if (PAST_FUNDING.has(opened.status)) return ok({ next: held, confirming: false });
      if (opened.status !== "awaiting_payment") return ok({ next: held, confirming: true });
    }

    const paid = await payArrangement(deps, arrangement.id, session.user.id);
    revalidatePath(`/agreements/${agreementId}/fund`);
    revalidatePath(held);
    if (paid.outcome === "submitted") return ok({ next: held, confirming: false });
    if (paid.outcome === "unknown") return ok({ next: held, confirming: true });
    return fail("reason" in paid ? refusal(paid.reason) : FUND_REFUSED.unavailable!);
  } catch {
    return fail(FUND_REFUSED.unavailable!);
  }
}
