"use server";

import { revalidatePath } from "next/cache";
import { fail, formDataToObject, ok, validate, type ActionResult } from "../actions/envelope";
import { resolveSession } from "../actions/session";
import { sendMessage, startReservationThread } from "../messages/actions";
import { consume, subjectForUser } from "../security/rate-limit";
import type { ReservationStatus } from "./db";
import { lagosInstant, reserveSchema, reserveTarget, respondSchema, whyNotBookable } from "./schema";
import { countOf } from "@vallo/i18n/core";
import { seatingRefusal } from "./seating";
import { seatingMissing } from "./seating-missing";
import { phoneGateFor } from "../phone-otp/gate";
import { flagIsOn } from "../flags/read";
import { getLocale } from "../locale";
import { getDictionary } from "@vallo/i18n";
import { RESTAURANT_DEPOSITS_FLAG } from "./deposits";

/**
 * Asking a restaurant to hold a table, and the restaurant answering.
 *
 * Both writes go through the caller's own RLS-bound client, never the service
 * role. That is not a style preference: `reservations_insert_own` pins
 * `guest_id` to `auth.uid()`, so a forged column cannot put a stranger's name
 * on a table, and `reservations_update_host` scopes a decision to the agent
 * who actually owns the restaurant. Writing as the service role would bypass
 * both and move the entire ownership question into this file, where the next
 * caller would not inherit it.
 *
 * The database is the authority on what is valid. The trigger refuses a
 * reservation against anything that is not a published restaurant, refuses
 * an example restaurant (the b3 migration; every listing in the catalogue
 * today is one), and refuses a moment in the past, so those rules hold for
 * the assistant's tool layer and the admin console too. What this file adds
 * is the sentence a person reads: a check constraint says "violates check
 * constraint reservations_party_size", and nobody should ever be shown that.
 *
 * THE THREAD. A reservation is a thing two people talk about ("we are running
 * twenty minutes late"), so the moment one exists its thread is opened
 * through the messaging module's own `startReservationThread` (M10 context,
 * party check in the database, the host resolved through the listing's agent
 * or the business's owner) and stamped back on the row as `conversation_id`.
 * A table at a first-party business (M7, `business_id` set, `listing_id`
 * null) takes the same path as a table at a restaurant listing. The guest's request, the venue's answer and a
 * cancellation are then posted INTO that thread by whoever did them, through
 * `sendMessage`, in their own voice: `messages.sender_id` stays NOT NULL and
 * there are no system rows. The thread is a courtesy and the reservation is
 * the record, so a thread that could not open never fails the reservation;
 * the notify trigger has already told the other side either way.
 */

/** A person may ask for a handful of tables in a few minutes, not a hundred. */
const RESERVE_LIMIT = 6;
const RESERVE_WINDOW_SECONDS = 300;

/**
 * The trigger's own words for an example listing, matched on the one phrase
 * every demo refusal carries. The message is honest about the fact and the
 * one step that works; it never says "coming soon".
 */
const EXAMPLE_RESTAURANT_MESSAGE =
  "This restaurant is an example of what the catalogue will hold, so no table can be held here. Open a real restaurant from search and ask there.";

const REFUSED_MESSAGE = "That table could not be held. Check the date and time, and try again.";

/** `conversationId` is optional so the existing form typing (reservation id and status) still fits. */
type Reserved = {
  reservationId: string;
  status: "PENDING";
  conversationId?: string | null;
  /**
   * D75: the deposit the restaurant's rule asks of this table, read back
   * from the database's own quote once the row exists (null: the table is
   * free). The form then shows the one step left: pay it by card.
   */
  deposit?: ReservedDeposit | null;
};

export type ReservedDeposit = { amountMinor: number; refundUntil: string | null; refundUntilHours: number; perGuest: boolean };

/**
 * The quote for a table just asked for, under the guest's own session
 * (`reservation_deposit_quote_for` answers the guest and the venue only).
 * Only while `restaurant_deposits` is on and only for a business venue,
 * which is the only kind a deposit rule can name. Any failure is no deposit:
 * the database asks again when the guest pays, and the venue cannot confirm
 * an unpaid one, so a missed quote here costs nobody anything.
 */
async function depositForNewTable(
  db: { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> },
  reservationId: string,
): Promise<ReservedDeposit | null> {
  try {
    if (!(await flagIsOn(RESTAURANT_DEPOSITS_FLAG))) return null;
    const { data, error } = await db.rpc("reservation_deposit_quote_for", { p_reservation: reservationId });
    const q = (data ?? {}) as {
      status?: string;
      amount_minor?: number;
      refund_until?: string;
      refund_until_hours?: number;
      per_guest?: boolean;
    };
    if (error || q.status !== "ok") return null;
    const amountMinor = Number(q.amount_minor);
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) return null;
    return {
      amountMinor,
      refundUntil: q.refund_until ?? null,
      refundUntilHours: Number(q.refund_until_hours ?? 0),
      perGuest: q.per_guest === true,
    };
  } catch {
    return null;
  }
}

/** "Fri 18 Sep, 19:30", on the Lagos clock, for the words in the thread. */
function lagosLabel(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "the time you chose";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(at);
}

function party(size: number): string {
  return countOf(size, "guests");
}

/**
 * Open (or find) the reservation's thread and say something in it. Best
 * effort by design: the reservation already stands and the other side has
 * already been notified, so a thread that will not open is reported as null,
 * never as a failure of the thing the person actually did.
 *
 * One call for both spines: `startContextThread` resolves the host through
 * `listings.agent_id` for a listing reservation and through
 * `businesses.owner_id` for a business one, which is the pair the b3 party
 * check admits, so the stamp lands on either kind of row.
 */
async function speakInThread(
  reservationId: string,
  body: string,
): Promise<string | null> {
  try {
    const thread = await startReservationThread({ reservationId });
    if (!thread.ok) return null;
    await sendMessage({ conversationId: thread.data.conversationId, body });
    return thread.data.conversationId;
  } catch {
    return null;
  }
}

export async function reserveTable(
  _previous: ActionResult<Reserved> | null,
  formData: FormData,
): Promise<ActionResult<Reserved>> {
  const session = await resolveSession();
  if (session.state === "unconfigured") {
    return fail(
      "Reservations are not available yet. The restaurant's phone number is on its page, so you can call and hold a table that way in the meantime.",
    );
  }
  if (session.state === "signed-out") {
    return fail("Sign in to hold a table.");
  }

  const parsed = validate(reserveSchema, formDataToObject(formData));
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  /* FULL GATE (13 October 2026): a table reservation is a booking. */
  const phoneGate = await phoneGateFor(session.supabase, session.user.id, "booking");
  if (phoneGate) return phoneGate;

  const at = lagosInstant(parsed.data.date, parsed.data.time);
  if (!at) {
    return fail("That date and time could not be read.", { date: "Pick a real date." });
  }
  const problem = whyNotBookable(at);
  if (problem) return fail(problem, { time: problem });

  const db = session.supabase;
  const target = reserveTarget(parsed.data);

  // The example check, before the limiter and before the write, so a person
  // reading the catalogue is told the truth without spending a token or a
  // round trip. The trigger refuses again underneath; this is the sentence.
  // A business is readable to a guest only while PUBLISHED, which is also the
  // only state the trigger lets a table be held in, so a row that does not
  // come back is left to the trigger's own refusal.
  const { data: venue } =
    target.kind === "business"
      ? await db.from("businesses").select("id, is_demo").eq("id", target.id).maybeSingle()
      : await db.from("listings").select("id, is_demo").eq("id", target.id).maybeSingle();
  if (venue?.is_demo) return fail(EXAMPLE_RESTAURANT_MESSAGE);

  const verdict = await consume({
    bucket: "reservation_create",
    subject: subjectForUser(session.user.id),
    limit: RESERVE_LIMIT,
    windowSeconds: RESERVE_WINDOW_SECONDS,
  });
  if (!verdict.allowed) {
    return fail(`That is a lot of tables at once. Try again ${verdict.retryIn}.`);
  }

  const note = parsed.data.note?.trim();
  const { data, error } = await db
    .from("reservations")
    .insert({
      // Exactly one of the two, as reservations_exactly_one_target_chk says.
      ...(target.kind === "business" ? { business_id: target.id } : { listing_id: target.id }),
      // Pinned by the insert policy as well. Sent explicitly because the column
      // is NOT NULL and the policy checks equality rather than defaulting it.
      guest_id: session.user.id,
      party_size: parsed.data.partySize,
      reserved_for: at.toISOString(),
      ...(note && note.length > 0 ? { note } : {}),
    })
    .select("id")
    .single();

  if (error || !data) {
    /* Told apart only where the difference changes what a person should do.
       23505 is the partial unique index, which means this exact table at this
       exact time is already theirs, and the useful answer is "you already have
       it" rather than "something went wrong". 23514 carrying the trigger's
       "example" sentence is the demo refusal, said honestly. Everything else,
       including every other message the trigger raises, is one honest
       refusal: the detail belongs in a log, not in front of a guest. */
    const code = (error as { code?: string; message?: string } | null)?.code;
    const message = (error as { message?: string } | null)?.message ?? "";
    if (code === "23505") {
      return fail("You already have a table booked there at that time.");
    }
    if (code === "23514" && /example/i.test(message)) {
      return fail(EXAMPLE_RESTAURANT_MESSAGE);
    }
    return fail(REFUSED_MESSAGE);
  }

  // The thread: opened, spoken into, and stamped on the row. Each step is a
  // courtesy the reservation does not depend on.
  const opening =
    `Table for ${party(parsed.data.partySize)} on ${lagosLabel(at.toISOString())}, please.` +
    (note && note.length > 0 ? ` ${note}` : "");
  const conversationId = await speakInThread(data.id, opening);
  if (conversationId) {
    await db.from("reservations").update({ conversation_id: conversationId }).eq("id", data.id);
  }

  const deposit =
    target.kind === "business"
      ? await depositForNewTable(
          db as unknown as Parameters<typeof depositForNewTable>[0],
          data.id,
        )
      : null;

  revalidatePath(target.kind === "business" ? `/restaurant/${target.id}` : `/listing/${target.id}`);
  revalidatePath("/bookings");
  return ok({ reservationId: data.id, status: "PENDING", conversationId, ...(deposit ? { deposit } : {}) });
}

/**
 * The restaurant accepting or declining.
 *
 * `responded_at` is stamped here rather than by a trigger because it records a
 * decision by a person, and the only place that knows a person just decided is
 * the call they made. The status guard is in the update itself: only a PENDING
 * row moves, so two taps on Accept write once and a decision cannot be reversed
 * by a stale tab. The answer is then said in the thread, in the venue's voice.
 */
export async function respondToReservation(
  _previous: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  const session = await resolveSession();
  if (session.state !== "signed-in") {
    return fail("Sign in to answer a reservation.");
  }

  const parsed = validate(respondSchema, formDataToObject(formData));
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const db = session.supabase;
  const { data, error } = await db
    .from("reservations")
    .update({
      status: parsed.data.decision,
      responded_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.reservationId)
    .eq("status", "PENDING")
    .select("id, party_size, reserved_for, conversation_id")
    .maybeSingle();

  if (error) {
    /* D75: the venue tried to confirm a table whose deposit the guest has
       not paid yet; `reservation_deposit_before_confirm` refuses it. Said
       plainly, in the venue's language: it is the one refusal here that
       tells them what to wait for. */
    if (/reservation_deposit_unpaid/.test((error as { message?: string }).message ?? "")) {
      let unpaid = getDictionary("en").tableDeposits.desk.unpaid;
      try {
        unpaid = getDictionary(await getLocale()).tableDeposits.desk.unpaid;
      } catch {
        // English, the reference language.
      }
      return fail(unpaid);
    }
    return fail("That answer could not be saved. Try again.");
  }
  if (!data) {
    /* No row moved. Either somebody already answered it, or this caller is not
       the host and the policy hid it. Both get the same sentence, because
       telling a stranger which of the two it was would confirm the reservation
       exists. */
    return fail("That reservation has already been answered.");
  }

  const when = lagosLabel(data.reserved_for);
  const body =
    parsed.data.decision === "CONFIRMED"
      ? `Confirmed: a table for ${party(data.party_size)} on ${when}. We look forward to seeing you.`
      : `Sorry, we cannot seat ${party(data.party_size)} on ${when}. Message us here if another time would work.`;
  const conversationId = await speakInThread(data.id, body);
  if (conversationId && !data.conversation_id) {
    await db.from("reservations").update({ conversation_id: conversationId }).eq("id", data.id);
  }

  /*
   * THE SURFACES THAT EXIST, AND ONLY THOSE (R2-7).
   *
   * `/host/reservations` stood here and there is no such route. A revalidate
   * of a path nothing serves is not harmless: it reads as a promise in the
   * code that the venue has a desk of its own, and it hid the real gap, which
   * is that the ONLY desk answering a table today is `/agent/bookings`. The
   * database is wider than that surface: `reservations_update_business_host`
   * admits any `businesses.owner_id` through `private.owns_business`, so a
   * venue owner who is not an agent may legally answer a table and has
   * nowhere to do it. `getHostReservations` in `lib/reservations/queries.ts`
   * is the reader that spine needs, and it has no caller yet; the surface is
   * `app/host/**`, which is not this module's to build.
   */
  revalidatePath("/agent/bookings");
  revalidatePath("/bookings");
  return ok(null);
}

/**
 * A guest calling off their own table.
 *
 * Separate from the host's decision even though both write CANCELLED, because
 * they are scoped by different policies and mean different things. This one is
 * allowed for a request the restaurant has not answered, and for a confirmed
 * table while it is still ahead: somebody who cannot come should be able to
 * say so whether or not the restaurant has answered yet, and a confirmed
 * table nobody releases is a table the restaurant loses. A table whose time
 * has passed is the venue's record (completed or not arrived) and is not
 * rewritten; the database refuses it as well. The word goes into the thread too,
 * so the venue reads it where they read everything else about this table.
 */
export async function cancelReservation(
  _previous: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  const session = await resolveSession();
  if (session.state !== "signed-in") {
    return fail("Sign in to cancel.");
  }

  const id = formDataToObject(formData)["reservationId"] ?? "";
  if (id.length === 0) {
    return fail(
      "That reservation could not be identified. Open it again from your bookings and cancel it from there.",
    );
  }

  const db = session.supabase;
  const cancelled: ReservationStatus = "CANCELLED";
  const { data, error } = await db
    .from("reservations")
    .update({ status: cancelled, responded_at: new Date().toISOString() })
    .eq("id", id)
    .eq("guest_id", session.user.id)
    /* An unanswered request can be withdrawn at any time; a confirmed table
       only while it is still ahead. Once it has passed, what happened is the
       venue's to record, and the database refuses it too. */
    .or(`status.eq.PENDING,and(status.eq.CONFIRMED,reserved_for.gt.${new Date().toISOString()})`)
    .select("id, party_size, reserved_for, conversation_id")
    .maybeSingle();

  if (error) return fail("That could not be cancelled. Try again.");
  if (!data) return fail("That reservation is already cancelled or has already happened.");

  const conversationId = await speakInThread(
    data.id,
    `I need to cancel the table for ${party(data.party_size)} on ${lagosLabel(data.reserved_for)}. Sorry for the trouble.`,
  );
  if (conversationId && !data.conversation_id) {
    await db.from("reservations").update({ conversation_id: conversationId }).eq("id", data.id);
  }

  revalidatePath("/bookings");
  return ok(null);
}

/**
 * THE RESTAURANT RECORDING HOW A TABLE WENT: seated, or nobody came.
 *
 * A table is never prepaid on Vallo: it is free to ask for, the restaurant
 * confirms it when a table is free, and the bill is paid at the restaurant.
 * What the venue records after the time is the one fact about the table that
 * is not already on it, and it is what Vallo bills a restaurant on later, so
 * it is a mark the venue makes deliberately, once, on each table.
 *
 * `private.guard_reservation_write` already allows exactly this and nothing
 * more: the venue moves a CONFIRMED table to COMPLETED (seated) or NO_SHOW
 * once its time has passed, and the guest is told about a no-show by the
 * database's own notification. The update repeats both conditions, so a
 * second tap or a stale tab writes nothing.
 */
export async function markReservationOutcome(input: {
  reservationId: string;
  outcome: "COMPLETED" | "NO_SHOW";
}): Promise<ActionResult<{ outcome: "COMPLETED" | "NO_SHOW"; disputed: boolean }>> {
  const session = await resolveSession();
  if (session.state !== "signed-in") return fail("Sign in to record how a table went.");

  const id = typeof input?.reservationId === "string" ? input.reservationId : "";
  const outcome = input?.outcome;
  if (!/^[0-9a-f-]{36}$/i.test(id) || (outcome !== "COMPLETED" && outcome !== "NO_SHOW")) {
    return fail("That table could not be identified.");
  }

  /* Founder decision D: once migration 20261013100000 is applied the
     seating function records the outcome with who decided it, and opens a
     dispute when the diner already said otherwise. Before that, the plain
     update below, which the guard already allows. */
  const viaSeating = await (session.supabase as unknown as {
    rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { code?: string } | null }>;
  }).rpc("reservation_record_outcome", { p_reservation: id, p_outcome: outcome === "COMPLETED" ? "SEATED" : "NO_SHOW" });
  if (!viaSeating.error || !seatingMissing(viaSeating.error)) {
    if (viaSeating.error) return fail("That could not be saved. Try again.");
    const status = (viaSeating.data as { status?: string } | null)?.status;
    /* `disputed` is a success: the venue's mark IS recorded, and because the
       diner already said otherwise a dispute was opened beside it. It used
       to come back as a failure, so the desk drew a saved mark in red. */
    if (status !== "recorded" && status !== "disputed") return fail(seatingRefusal(status));
    revalidatePath("/host/reservations");
    revalidatePath("/host");
    revalidatePath("/bookings");
    return ok({ outcome, disputed: status === "disputed" });
  }

  const { data, error } = await session.supabase
    .from("reservations")
    .update({ status: outcome })
    .eq("id", id)
    .eq("status", "CONFIRMED")
    .lte("reserved_for", new Date().toISOString())
    .select("id")
    .maybeSingle();
  if (error) return fail("That could not be saved. Try again.");
  if (!data) {
    return fail("That table has already been marked, or its time has not come yet.");
  }

  revalidatePath("/host/reservations");
  revalidatePath("/host");
  revalidatePath("/bookings");
  return ok({ outcome, disputed: false });
}
