"use server";

/**
 * THE CALM WAY OUT OF THE ESCROW STEP (founder instruction, 13 October 2026:
 * if opening or funding escrow fails, the payer gets a calm message and can
 * switch to card where the rules allow; nobody is stranded; nothing is marked
 * paid without the partner's confirmation).
 *
 *   1. Card must be allowed on this deal (`payment_rail_options`, read as the
 *      payer): a purchase is escrow only, so it is refused with a sentence.
 *   2. An escrow opened at the partner and never funded is withdrawn THERE
 *      first (`withdrawForCard`), so it can never be funded for a deal that
 *      is now on card. Anything the partner may be moving, or holds, is never
 *      withdrawn: the payer is told where their money is instead.
 *   3. The payer's choice moves to card (`payment_rail_choose`, the database
 *      decides who and when) and the card checkout opens. If the gate asks a
 *      person to look first, the payer is told so on the agreement, where
 *      they can go back to escrow.
 * Nothing here charges anything.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fail, ok, type ActionResult } from "../actions/envelope";
import { NOT_CONFIGURED_MESSAGE, SIGNED_OUT_MESSAGE, resolveSession } from "../actions/session";
import { recordAlert } from "../alerts";
import { lagosToday } from "../bookings/schema";
import { paylukContext } from "../payments/providers/payluk";
import { payNextHref } from "../payments/rail-choice";
import { SWITCH_TO_CARD_REFUSED } from "./copy";
import { adminDb } from "./member-wallet";
import { withdrawForCard } from "./provider-arrangements";

export type SwitchedToCard = { next: string; review: boolean };

const WITHDRAW_WORDS: Record<string, string> = {
  held: SWITCH_TO_CARD_REFUSED.held!,
  moving: SWITCH_TO_CARD_REFUSED.moving!,
  provider_refused: SWITCH_TO_CARD_REFUSED.provider_refused!,
  unknown: SWITCH_TO_CARD_REFUSED.unknown!,
};

export async function switchEscrowToCard(input: { agreementId: string }): Promise<ActionResult<SwitchedToCard>> {
  const parsed = z.object({ agreementId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return fail(SWITCH_TO_CARD_REFUSED.unavailable!);
  const agreementId = parsed.data.agreementId;
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);
  const userDb = session.supabase as unknown as SupabaseClient;

  try {
    /* 1. Card is allowed here, and this person is the payer. */
    const { data: optionsData, error: optionsError } = await userDb.rpc("payment_rail_options", { p_agreement: agreementId });
    const options = (optionsData ?? {}) as { status?: unknown; options?: unknown; payer?: unknown };
    if (optionsError || options.status !== "ok" || !Array.isArray(options.options)) return fail(SWITCH_TO_CARD_REFUSED.unavailable!);
    if (options.payer !== true) return fail(SWITCH_TO_CARD_REFUSED.unavailable!);
    if (!(options.options as unknown[]).includes("card")) return fail(SWITCH_TO_CARD_REFUSED.card_not_allowed!);

    /* 2. An unfunded escrow is withdrawn at the partner first. */
    const db = adminDb();
    if (!db) return fail(SWITCH_TO_CARD_REFUSED.unavailable!);
    const ctx = paylukContext();
    if (ctx) {
      const withdrawn = await withdrawForCard(
        {
          db,
          ctx,
          todayLagos: lagosToday,
          alert: async (kind, detail) => {
            await recordAlert({ kind, severity: "critical", detail });
          },
        },
        agreementId,
        session.user.id,
      );
      if (withdrawn.outcome === "refused") {
        return fail(WITHDRAW_WORDS[withdrawn.reason] ?? SWITCH_TO_CARD_REFUSED.unavailable!);
      }
    } else {
      /* No key here: an open escrow cannot be withdrawn, so it is not touched. */
      const { data: live } = await db
        .from("provider_arrangements")
        .select("id")
        .eq("agreement_id", agreementId)
        .not("status", "in", "(failed,cancelled,refunded)")
        .limit(1);
      if ((live?.length ?? 0) > 0) return fail(SWITCH_TO_CARD_REFUSED.unavailable!);
    }

    /* 3. The choice moves to card, as the payer, through the database's rule. */
    const { data: chosen, error: chooseError } = await userDb.rpc("payment_rail_choose", {
      p_agreement: agreementId,
      p_choice: "card",
    });
    const answer = (chosen ?? {}) as { status?: unknown; review?: unknown };
    if (chooseError) return fail(SWITCH_TO_CARD_REFUSED.unavailable!);
    if (answer.status === "payment_started" || answer.status === "already_paid") return fail(SWITCH_TO_CARD_REFUSED.locked!);
    if (answer.status === "sale_escrow_only" || answer.status === "escrow_only") return fail(SWITCH_TO_CARD_REFUSED.card_not_allowed!);
    if (answer.status !== "ok") return fail(SWITCH_TO_CARD_REFUSED.unavailable!);

    revalidatePath(`/agreements/${agreementId}`);
    revalidatePath(`/agreements/${agreementId}/fund`);
    if (answer.review === true) return ok({ next: `/agreements/${agreementId}`, review: true });

    const { data: agRow } = await userDb
      .from("deal_agreements")
      .select("id, kind, booking_id, inspection_id")
      .eq("id", agreementId)
      .neq("kind", "sale")
      .maybeSingle();
    const ag = agRow as { id: string; kind: string; booking_id: string | null; inspection_id: string | null } | null;
    const next = ag
      ? payNextHref("card", { id: ag.id, kind: ag.kind, bookingId: ag.booking_id, inspectionId: ag.inspection_id })
      : null;
    return ok({ next: next ?? `/agreements/${agreementId}`, review: false });
  } catch {
    return fail(SWITCH_TO_CARD_REFUSED.unavailable!);
  }
}
