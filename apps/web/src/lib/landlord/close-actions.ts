"use server";

import { revalidatePath } from "next/cache";
import { catalogueChanged } from "@/lib/catalogue/invalidate";
import { z } from "zod";
import { fail, ok, type ActionResult } from "../actions/envelope";
import { NOT_CONFIGURED_MESSAGE, SIGNED_OUT_MESSAGE, resolveSession } from "../actions/session";
import { callLandlordRpc } from "./rpc";

/**
 * V-48. A LISTER CLOSES A RENTAL WITH A REASON.
 *
 * One call to `public.close_listing`, which checks the caller holds the
 * listing, that it is a live or approved rental, and, for "Let through Vallo",
 * that a rent charge on it was actually paid. A let through Vallo closes every
 * copy of the same property in the same transaction, because the payment proves
 * it. Any other reason closes this copy only, since one lister's word never
 * takes a rival's listing down; after "Let elsewhere" the other copies' listers
 * are told and their own principals are asked, within the weekly limit.
 * Nothing here decides any of that; this is the door.
 *
 * The workspace draws this in place of "Take down" on a live rental.
 * `unpublishListing` in `lib/agent/listings-actions.ts` still exists and still
 * works: making the close the ONLY unpublish path for a rental means changing
 * the listings transition rule, which the audit session holds, so that half is
 * reported to it rather than changed here.
 */

export type CloseReason = "let_through_vallo" | "let_elsewhere" | "owner_withdrew" | "mandate_ended";

const INPUT = z.object({
  listingId: z.string().uuid(),
  reason: z.enum(["let_through_vallo", "let_elsewhere", "owner_withdrew", "mandate_ended"]),
});

export type CloseOutcome = { closed: number };

export async function closeListingWithReason(input: {
  listingId: string;
  reason: CloseReason;
}): Promise<ActionResult<CloseOutcome>> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);

  const parsed = INPUT.safeParse(input);
  if (!parsed.success) return fail("Choose how it ended.", { reason: "Choose how it ended." });

  const { data, error } = await callLandlordRpc(session.supabase, "close_listing", {
    p_listing: parsed.data.listingId,
    p_reason: parsed.data.reason,
    p_rent_payment: null,
  });
  if (error) {
    const message = error.message ?? "";
    if (message.includes("no rent has been paid")) {
      return fail(
        "No rent has been paid through Vallo for this listing, so it cannot be closed as let through Vallo. Choose Let elsewhere instead.",
        { reason: "no-rent" },
      );
    }
    return fail("The listing was not closed. Nothing has changed. Please try again.");
  }

  revalidatePath("/agent/listings");
  catalogueChanged({ listingId: parsed.data.listingId });
  revalidatePath(`/listing/${parsed.data.listingId}`);
  const closed = typeof (data as { closed?: unknown } | null)?.closed === "number" ? (data as { closed: number }).closed : 1;
  return ok({ closed });
}

/**
 * V-31 FOR AN OWNER LISTING: the owner answers "still available".
 *
 * The answer stops the 21 day clock. It becomes the public "Owner confirmed
 * available" line only when staff have dated `ownership_verified_at`, which
 * `owner_heartbeat_answer` decides and reports back as `public`.
 */
export async function answerOwnerHeartbeat(input: { listingId: string }): Promise<ActionResult<{ public: boolean }>> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);
  const id = z.string().uuid().safeParse(input.listingId);
  if (!id.success) return fail("That answer did not reach us. Nothing has changed. Please try again.");

  const { data, error } = await callLandlordRpc(session.supabase, "owner_heartbeat_answer", { p_listing: id.data });
  if (error) return fail("That answer did not reach us. Nothing has changed. Please try again.");
  catalogueChanged({ listingId: id.data });
  revalidatePath("/agent/listings");
  return ok({ public: (data as { public?: unknown } | null)?.public === true });
}
