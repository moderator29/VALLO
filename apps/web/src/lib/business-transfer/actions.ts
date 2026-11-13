"use server";

/**
 * Handing a business to somebody, as an offer rather than as an act.
 *
 * THIS MODULE IS "use server", SO IT EXPORTS ASYNC FUNCTIONS AND NOTHING ELSE.
 * Every type and constant the screens need lives in `schema.ts` or
 * `queries.ts`. Section 10.7 of the ledger records what the other mistake
 * costs: twenty minutes of production, in this build. Types DECLARED inside
 * this module are erased whole and stay legal; an export STATEMENT for one is
 * what the actions manifest cannot answer for.
 *
 * WHAT THIS IS FOR. `public.businesses.owner_id` cascades onto `auth.users`,
 * and the account purge deliberately does not delete that row, so before this
 * existed a hotel could keep selling rooms with a tombstone behind it. Owning
 * a business a stranger can still transact against is now a deletion
 * precondition, and a precondition with no route out is a dead end wearing an
 * explanation. This is the first of the two routes out. The second is closing
 * the business, which is unpublishing the rooms, settling the diary and taking
 * it off the market, and which uses the surfaces that already exist.
 *
 * WHY THERE IS AN ACCEPT STEP. Ownership here carries the published inventory
 * a stranger books, the reservations a guest turns up for and the papers a
 * reviewer reads. Moving that onto somebody without asking would make a person
 * a merchant while they slept and would hand anybody a way to dump a failing
 * business onto an account that never asked for it. So an offer is PENDING
 * until it is accepted, and the acceptance is the consent record.
 *
 * THE SERVICE ROLE RESOLVES THE ADDRESS, AND THAT IS THE POINT. There is no
 * "does this email have an account" function reachable over PostgREST, because
 * one would be an enumeration oracle for every signed-in caller. The lookup
 * happens here, behind a session, behind a rate limit, and only after this
 * action has proved through the caller's OWN client that they own the business
 * they are trying to give away.
 *
 * AND IT STILL SAYS WHEN THERE IS NO ACCOUNT. A silent "we have sent it" for
 * an address nobody holds would leave the owner waiting for an answer that can
 * never come, which is the dead end the precondition exists to prevent. A
 * person acting on their own business, about an address they typed, is told
 * the truth: there is no Vallo account on it yet.
 *
 * THE ADDRESS IS NEVER STORED AND NEVER LOGGED. It lives inside one call.
 */

import { revalidatePath } from "next/cache";
import { catalogueChanged } from "@/lib/catalogue/invalidate";
import { fail, formDataToObject, ok, validate, type ActionResult } from "../actions/envelope";
import { NOT_CONFIGURED_MESSAGE, SIGNED_OUT_MESSAGE, resolveSession } from "../actions/session";
import { asRecord, callDeletionRpc } from "../account-deletion/rpc";
import { consume, subjectForUser } from "../security/rate-limit";
import { createAdminClient } from "../supabase/admin";
import { isSupabaseConfigured } from "../supabase/env";
import { writeTransferAudit } from "./audit";
import { closeBusinessSchema, offerTransferSchema, respondTransferSchema } from "./schema";

const GATED_MESSAGE =
  "We cannot move a business from here right now, and nothing has been changed. Try again shortly.";

const NOT_YOURS_MESSAGE =
  "That is not one of your businesses, so nothing has been changed. Pick one of your own businesses to move.";

/**
 * Every refusal the database can answer with, in plain words, and every one of
 * them says what to do next. Not one of them is "email us".
 */
const OFFER_REFUSALS: Record<string, string> = {
  incomplete: "Pick a business and enter an address, and we will send the offer.",
  no_business: "That business is no longer on your account.",
  not_owner: NOT_YOURS_MESSAGE,
  not_transferable:
    "That listing came from a partner rather than from a person, so there is no owner to move.",
  same_person: "That is your own address. Enter the address of the person taking it over.",
  no_account:
    "There is no Vallo account on that address yet. Ask them to sign up, then send the offer again.",
  receiver_unavailable:
    "That account cannot take a business on right now. Check the address, or choose somebody else.",
  receiver_unconfirmed:
    "That account has not confirmed an email address or a telephone number yet, so we cannot reach them about it. Ask them to confirm, then send the offer again.",
  receiver_leaving:
    "That person is closing their own Vallo account, so handing it to them would leave the business with nobody again. Choose somebody else.",
  already_offered:
    "This business is already offered to somebody. Take that offer back first, then send a new one.",
};

const RESPOND_REFUSALS: Record<string, string> = {
  incomplete: "That offer no longer exists.",
  not_found: "That offer no longer exists.",
  not_yours: "That offer was not made to you.",
  not_open: "That offer has already been answered.",
  expired: "That offer has run out. Ask the owner to send it again.",
  no_business: "That business is no longer there.",
  no_longer_theirs:
    "The person who offered this no longer owns it, so there is nothing to accept.",
  receiver_leaving:
    "Your own account is scheduled for deletion, so you cannot take a business on. Restore your account first if you want it.",
};

/** True when the platform holds a service role key it can act with. */
async function serviceClientOrNull() {
  if (!isSupabaseConfigured()) return null;
  if ((process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").length === 0) return null;
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

/**
 * Offer a business to another Vallo account.
 *
 * Nothing moves here. The offer is a row with a fourteen day clock on it, and
 * the business stays exactly where it is until somebody says yes.
 */
export async function offerBusinessTransfer(
  input: unknown,
): Promise<ActionResult<{ transferId: string; expiresAt: string }>> {
  const parsed = validate(offerTransferSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);

  const { supabase, user } = session;

  // Paced per person. The thing worth limiting is one account walking an
  // address list, and the lookup below is the only reason that would be worth
  // doing.
  const paced = await consume({
    bucket: "business_transfer_offer",
    subject: subjectForUser(user.id),
    limit: 10,
    windowSeconds: 3_600,
  });
  if (!paced.allowed) {
    return fail(`Too many offers sent just now. Try again ${paced.retryIn}.`);
  }

  // Proved through the caller's OWN client, under their own RLS, BEFORE the
  // service role is used for anything at all.
  const { data: owned, error: ownedError } = await supabase
    .from("businesses")
    .select("id, name, owner_id, source")
    .eq("id", parsed.data.businessId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (ownedError) return fail(GATED_MESSAGE);
  if (!owned) return fail(NOT_YOURS_MESSAGE);

  const admin = await serviceClientOrNull();
  if (!admin) return fail(GATED_MESSAGE);

  /*
   * The address, resolved and then dropped. It is never written to a row, an
   * audit line or a log.
   *
   * `public.user_id_by_email_for_transfer` is SECURITY DEFINER and service
   * role only: it is the whole of the platform's ability to turn an address
   * into a uuid for this flow, it answers with one uuid or null and never with
   * a row of `auth.users`, and no signed-in caller can reach it. The auth
   * schema is not exposed over PostgREST and this does not expose it.
   */
  const lookup = await callDeletionRpc(admin, "user_id_by_email_for_transfer", {
    p_email: parsed.data.email,
  });
  if (!lookup.ok) return fail(GATED_MESSAGE);
  const targetId = typeof lookup.data === "string" ? lookup.data : null;
  if (!targetId) return fail(OFFER_REFUSALS["no_account"] ?? GATED_MESSAGE);

  const answer = await callDeletionRpc(admin, "offer_business_transfer", {
    p_business: parsed.data.businessId,
    p_from: user.id,
    p_to: targetId,
    p_note: parsed.data.note ?? null,
  });
  if (!answer.ok) return fail(GATED_MESSAGE);

  const row = asRecord(answer.data);
  if (row["offered"] !== true) {
    const reason = typeof row["reason"] === "string" ? row["reason"] : "refused";
    return fail(OFFER_REFUSALS[reason] ?? GATED_MESSAGE);
  }

  const transferId = typeof row["transfer_id"] === "string" ? row["transfer_id"] : "";
  const expiresAt = typeof row["expires_at"] === "string" ? row["expires_at"] : "";

  // Uuids and nothing else. The address is not in this line and never will be.
  await writeTransferAudit(admin, {
    action: "business.transfer.offered",
    actorId: user.id,
    businessId: parsed.data.businessId,
    transferId,
  });

  revalidatePath("/host/transfer");
  revalidatePath("/settings/account");
  return ok({ transferId, expiresAt });
}

/** Form binding for the offer form. */
export async function offerBusinessTransferAction(
  _prev: ActionResult<{ transferId: string; expiresAt: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ transferId: string; expiresAt: string }>> {
  return offerBusinessTransfer(formDataToObject(formData));
}

/**
 * Accept it, decline it, or take it back.
 *
 * Accepting is the only thing in this flow that moves a business, and it can
 * only ever be done by the person it was offered to. The database re-checks
 * the ownership and re-checks that the receiver is not themselves leaving,
 * because fourteen days is long enough for both to have changed.
 */
export async function respondToBusinessTransfer(
  input: unknown,
): Promise<ActionResult<{ decision: string }>> {
  const parsed = validate(respondTransferSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);

  const { user } = session;

  const paced = await consume({
    bucket: "business_transfer_respond",
    subject: subjectForUser(user.id),
    limit: 30,
    windowSeconds: 3_600,
  });
  if (!paced.allowed) {
    return fail(`Too many attempts just now. Try again ${paced.retryIn}.`);
  }

  const admin = await serviceClientOrNull();
  if (!admin) return fail(GATED_MESSAGE);

  if (parsed.data.decision === "withdraw") {
    const answer = await callDeletionRpc(admin, "withdraw_business_transfer", {
      p_transfer: parsed.data.transferId,
      p_user: user.id,
    });
    if (!answer.ok) return fail(GATED_MESSAGE);
    if (asRecord(answer.data)["withdrawn"] !== true) {
      return fail("That offer has already been answered, so there is nothing to take back.");
    }
    await writeTransferAudit(admin, {
      action: "business.transfer.withdrawn",
      actorId: user.id,
      businessId: null,
      transferId: parsed.data.transferId,
    });
    revalidatePath("/host/transfer");
    return ok({ decision: "withdraw" });
  }

  const accept = parsed.data.decision === "accept";
  const answer = await callDeletionRpc(admin, "respond_to_business_transfer", {
    p_transfer: parsed.data.transferId,
    p_user: user.id,
    p_accept: accept,
  });
  if (!answer.ok) return fail(GATED_MESSAGE);

  const row = asRecord(answer.data);
  if (accept && row["accepted"] !== true) {
    const reason = typeof row["reason"] === "string" ? row["reason"] : "refused";
    return fail(RESPOND_REFUSALS[reason] ?? GATED_MESSAGE);
  }
  if (!accept && row["declined"] !== true) {
    const reason = typeof row["reason"] === "string" ? row["reason"] : "refused";
    return fail(RESPOND_REFUSALS[reason] ?? GATED_MESSAGE);
  }

  await writeTransferAudit(admin, {
    action: accept ? "business.transfer.accepted" : "business.transfer.declined",
    actorId: user.id,
    businessId: typeof row["business_id"] === "string" ? row["business_id"] : null,
    transferId: parsed.data.transferId,
  });

  revalidatePath("/host/transfer");
  revalidatePath("/host");
  revalidatePath("/settings/account");
  return ok({ decision: parsed.data.decision });
}

/** Form binding for the accept, decline and take-back controls. */
export async function respondToBusinessTransferAction(
  _prev: ActionResult<{ decision: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ decision: string }>> {
  return respondToBusinessTransfer(formDataToObject(formData));
}

/**
 * CLOSE IT: the second door, and it had no surface at all until this.
 *
 * WHAT WAS CHECKED RATHER THAN ASSUMED. The brief said the closing paths
 * mostly exist already and asked for them to be checked rather than named.
 * Three of the four do. `lib/agent/listings-actions.ts` carries
 * `unpublishListing`, which is a real control on `/agent/listings`;
 * `lib/reservations/actions.ts` carries `respondToReservation` and
 * `cancelReservation`, which `/agent/bookings` draws; the wallet settles on
 * `/wallet`. THE FOURTH DID NOT EXIST. Nothing in `lib/host/**` could take an
 * accommodation or a business off the market: `publishAccommodation` is in
 * `lib/admin/business-actions.ts` and is admin only, so a host asked to
 * unpublish their rooms had nowhere to go and the second door was a dead end.
 * This is that control.
 *
 * WHAT CLOSING MEANS, AND IT IS `DRAFT` RATHER THAN `SUSPENDED`. SUSPENDED is
 * what the platform does TO somebody; DRAFT is what a person does to their own
 * work, and it is exactly what `unpublishListing` already writes for a
 * property listing. The rows all stay. Nothing is deleted and nothing is
 * destroyed: the business stops being findable and its rooms stop being
 * bookable, and everything on it is still there if they come back.
 *
 * THE DIARY IS SETTLED FIRST, AND THE REFUSAL SAYS WHERE. Unpublishing a
 * restaurant that is holding tables tonight would leave those guests with a
 * booking against something nobody can find, and
 * `private.reservation_is_valid` would then refuse every write to those rows
 * including the cancellation, so they could never be settled at all. So a
 * business with a table still to come is refused here and sent to
 * `/agent/bookings`, which is where the control to settle it actually lives.
 *
 * EVERYTHING GOES THROUGH THE CALLER'S OWN CLIENT. `businesses_owner_all` and
 * `accommodations_owner_all` are the only permission this needs, so no service
 * key is used and this can never close somebody else's business.
 */
export async function closeBusiness(
  input: unknown,
): Promise<ActionResult<{ roomsClosed: number }>> {
  const parsed = validate(closeBusinessSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);

  const { supabase, user } = session;

  const { data: owned, error: ownedError } = await supabase
    .from("businesses")
    .select("id, status, owner_id")
    .eq("id", parsed.data.businessId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (ownedError) return fail(GATED_MESSAGE);
  if (!owned) return fail(NOT_YOURS_MESSAGE);

  const { data: tables, error: tablesError } = await supabase
    .from("reservations")
    .select("id")
    .eq("business_id", parsed.data.businessId)
    .in("status", ["PENDING", "CONFIRMED"])
    .gte("reserved_for", new Date().toISOString())
    .limit(1);
  if (tablesError) return fail(GATED_MESSAGE);
  if ((tables ?? []).length > 0) {
    return fail(
      "There is still a table booked here. Settle the diary first, then close it: the bookings screen has the control.",
    );
  }

  const { data: rooms, error: roomsError } = await supabase
    .from("accommodations")
    .update({ status: "DRAFT" })
    .eq("business_id", parsed.data.businessId)
    .in("status", ["PUBLISHED", "APPROVED"])
    .select("id");
  if (roomsError) return fail(GATED_MESSAGE);

  const { error: businessError } = await supabase
    .from("businesses")
    .update({ status: "DRAFT" })
    .eq("id", parsed.data.businessId)
    .eq("owner_id", user.id);
  if (businessError) return fail(GATED_MESSAGE);

  /* A closed business leaves the public shelves at once. */
  catalogueChanged();
  revalidatePath("/host/transfer");
  revalidatePath("/host");
  revalidatePath("/settings/account");
  return ok({ roomsClosed: (rooms ?? []).length });
}

/** Form binding for the close control. */
export async function closeBusinessAction(
  _prev: ActionResult<{ roomsClosed: number }> | null,
  formData: FormData,
): Promise<ActionResult<{ roomsClosed: number }>> {
  return closeBusiness(formDataToObject(formData));
}
