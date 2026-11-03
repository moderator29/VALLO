"use server";

/**
 * STEP 10 to 11: the renter releases a protected payment to the lister.
 * A deliberate act (the money swipe), the renter only, through the service in
 * provider-arrangements.ts, which refuses unless the escrow flows are built,
 * `payments_payluk_on` is on (D77), the payment is held and the release is not
 * paused by Vallo (the database refuses a paused release as well). Nothing is
 * marked released here: Payluk's webhook does that.
 */
import { passcodeMoneyRefusal } from "@/lib/passcode/money";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "../actions/envelope";
import { NOT_CONFIGURED_MESSAGE, SIGNED_OUT_MESSAGE, resolveSession } from "../actions/session";
import { recordAlert } from "../alerts";
import { lagosToday } from "../bookings/schema";
import { paylukContext } from "../payments/providers/payluk";
import { adminDb } from "./member-wallet";
import { requestRelease } from "./provider-arrangements";

const REFUSED: Record<string, string> = {
  switched_off: "Releasing a protected payment is not open yet. The money stays held; nothing has moved.",
  not_found: "We could not find that payment on your account.",
  release_paused:
    "Vallo has paused the release of this payment for now. The money stays held with our licensed provider and nothing has moved. Ask support if you need to know more.",
  unknown:
    "We could not confirm the release went through. The money stays held until our licensed provider confirms; check back in a few minutes.",
};

export async function releaseHeldPayment(input: {
  agreementId: string;
  arrangementId: string;
  milestonePosition?: number;
}): Promise<ActionResult<{ submitted: true }>> {
  const parsed = z
    .object({ agreementId: z.string().uuid(), arrangementId: z.string().uuid(), milestonePosition: z.number().int().min(1).optional() })
    .safeParse(input);
  if (!parsed.success) return fail(REFUSED.not_found!);
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);
  /* A passcode-locked session moves no money (docs/PASSCODE.md). */
  const lockedOut = await passcodeMoneyRefusal(session.user.id);
  if (lockedOut) return fail(lockedOut);
  const db = adminDb();
  const ctx = paylukContext();
  if (!db || !ctx) return fail(REFUSED.switched_off!);
  const outcome = await requestRelease(
    {
      db,
      ctx,
      todayLagos: lagosToday,
      alert: async (kind, detail) => {
        await recordAlert({ kind, severity: "critical", detail });
      },
    },
    parsed.data.arrangementId,
    session.user.id,
    parsed.data.milestonePosition,
  );
  revalidatePath(`/agreements/${parsed.data.agreementId}/held`);
  if (outcome.outcome === "submitted") return ok({ submitted: true });
  if (!("reason" in outcome)) return fail(REFUSED.unknown!);
  return fail(REFUSED[outcome.reason] ?? "The release could not be asked for just now. The money stays held; nothing has moved.");
}
