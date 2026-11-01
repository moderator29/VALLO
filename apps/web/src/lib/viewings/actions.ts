"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { formatDate, getDictionary } from "@vallo/i18n";
import { fail, ok, validate, type ActionResult } from "../actions/envelope";
import { resolveSession } from "../actions/session";
import { getLocale } from "../locale";
import { sendMessage, startConversation } from "../messages/actions";
import { windowProblem } from "./route";
import { bookWithMode, type BookRpc } from "./book-slot";
import { oncePerTap, tapKey } from "../offline/replay-guard";
import { phoneGateFor } from "../phone-otp/gate";
import { videoCallsOn } from "../calls/flags";
import { VISIT_MODES } from "../inspections/visit";

/**
 * V-94: BOOKING A SLOT, KEEPING WINDOWS, AND "RUNNING LATE".
 *
 * Booking goes through `book_viewing_slot`, which accepts only a slot the
 * database would offer at that instant and writes a CONFIRMED inspection;
 * then, like an inspection request, the thread beside it is found or made and
 * stamped on the row (best effort: the booking is what matters). Windows are
 * written under the lister's own RLS, which admits only their own listings.
 * "Running late" is an ordinary message in the lister's name into the next
 * renter's thread, so it is scanned and notified like anything else typed.
 *
 * This module exports only async functions, per the server-actions rule.
 */

const bookSchema = z.object({
  listingId: z.string().uuid(),
  slotAt: z.string().refine((v) => !Number.isNaN(Date.parse(v))),
  note: z.string().trim().max(400).optional(),
  /* `inspection_requests.visit_mode`; absent is in person, as before. */
  mode: z.enum(VISIT_MODES).optional(),
});

/**
 * Book an open slot. ONE TAP, ONE BOOKING: the screen sends a `tapKey`, and a
 * replay of the same tap (a double tap, a retry after a dropped answer)
 * answers with the first booking instead of the "you already have a viewing"
 * refusal `book_viewing_slot` gives a second call. The database still refuses
 * a second live viewing of the same home whatever arrives.
 */
export async function bookViewingSlot(input: unknown): Promise<ActionResult<{ id: string }>> {
  const t = getDictionary(await getLocale()).frontDoor.viewings;
  const parsed = validate(bookSchema, input);
  if (!parsed.ok) return fail(t.failed);
  const session = await resolveSession();
  if (session.state !== "signed-in") return fail(t.signIn);
  const key = tapKey((input as { tapKey?: unknown } | null)?.tapKey);
  return oncePerTap("outbox.viewing", session.user.id, key, () => bookViewingSlotWork(session, parsed.data));
}

async function bookViewingSlotWork(
  session: Extract<Awaited<ReturnType<typeof resolveSession>>, { state: "signed-in" }>,
  input: z.infer<typeof bookSchema>,
): Promise<ActionResult<{ id: string }>> {
  const locale = await getLocale();
  const t = getDictionary(locale).frontDoor.viewings;
  const parsed = { data: input };
  /* V-50, as `requestInspection` holds it: a booked viewing is the first
     inspection request too, so it needs a confirmed phone when the
     phone_confirmation flag is on. Booking a slot used to skip this gate. */
  const phoneGate = await phoneGateFor(session.supabase, session.user.id, "inspection");
  if (phoneGate) return phoneGate;
  const mode = parsed.data.mode ?? "in_person";
  if (mode === "video" && !(await videoCallsOn())) return fail(getDictionary(locale).visit.problems.videoOff);

  const rpc = session.supabase.rpc.bind(session.supabase) as unknown as BookRpc;
  const { data, error } = await bookWithMode(
    rpc,
    (id, value) => session.supabase.from("inspection_requests").update({ visit_mode: value }).eq("id", id),
    {
      p_listing: parsed.data.listingId,
      p_slot: new Date(parsed.data.slotAt).toISOString(),
      p_note: parsed.data.note && parsed.data.note.length > 0 ? parsed.data.note : null,
    },
    mode,
  );
  if (error || typeof data !== "string") {
    if (error?.hint === "viewing_slot_taken") return fail(t.taken);
    if (error?.hint === "viewing_already_booked") return fail(t.already);
    if (error?.hint === "viewing_own_home") return fail(t.ownHome);
    return fail(t.failed);
  }
  const thread = await startConversation({ listingId: parsed.data.listingId });
  if (thread.ok) {
    await session.supabase.from("inspection_requests").update({ conversation_id: thread.data.conversationId }).eq("id", data);
  }
  revalidatePath(`/listing/${parsed.data.listingId}`);
  revalidatePath("/bookings");
  revalidatePath("/agent/inspections");
  return ok({ id: data });
}

const windowSchema = z.object({
  listingIds: z.array(z.string().uuid()).min(1).max(20),
  weekday: z.number().int().min(0).max(6),
  starts: z.string().regex(/^\d{2}:\d{2}$/),
  ends: z.string().regex(/^\d{2}:\d{2}$/),
  slotMinutes: z.union([z.literal(15), z.literal(20), z.literal(30), z.literal(45), z.literal(60)]),
});

type WindowsTable = {
  from: (table: "viewing_windows") => {
    insert: (row: Record<string, unknown>) => PromiseLike<{ error: unknown }>;
    update: (row: Record<string, unknown>) => {
      eq: (col: string, value: string) => { select: (cols: string) => PromiseLike<{ data: unknown[] | null; error: unknown }> };
    };
  };
};

export async function saveViewingWindow(input: unknown): Promise<ActionResult<null>> {
  const t = getDictionary(await getLocale()).frontDoor.viewings;
  const parsed = validate(windowSchema, input);
  if (!parsed.ok) return fail(t.problems.failed);
  const problem = windowProblem(parsed.data);
  if (problem) return fail(t.problems[problem]);
  const session = await resolveSession();
  if (session.state !== "signed-in") return fail(t.signIn);
  const { error } = await (session.supabase as unknown as WindowsTable).from("viewing_windows").insert({
    lister_id: session.user.id,
    listing_ids: parsed.data.listingIds,
    weekday: parsed.data.weekday,
    starts: parsed.data.starts,
    ends: parsed.data.ends,
    slot_minutes: parsed.data.slotMinutes,
  });
  if (error) return fail(t.problems.failed);
  revalidatePath("/agent/inspections");
  return ok(null);
}

export async function removeViewingWindow(input: unknown): Promise<ActionResult<null>> {
  const t = getDictionary(await getLocale()).frontDoor.viewings;
  const parsed = validate(z.object({ id: z.string().uuid() }), input);
  if (!parsed.ok) return fail(t.problems.failed);
  const session = await resolveSession();
  if (session.state !== "signed-in") return fail(t.signIn);
  /* Switched off rather than deleted, so a booked viewing keeps its window. */
  const { data, error } = await (session.supabase as unknown as WindowsTable)
    .from("viewing_windows")
    .update({ active: false })
    .eq("id", parsed.data.id)
    .select("id");
  /* Row-level security answers somebody else's window with no row and no
     error, which used to read as "removed" while nothing changed. */
  if (error || !data || data.length === 0) return fail(t.problems.failed);
  revalidatePath("/agent/inspections");
  return ok(null);
}

const lateSchema = z.object({ conversationId: z.string().uuid(), slotAt: z.string().refine((v) => !Number.isNaN(Date.parse(v))) });

export async function sayRunningLate(input: unknown): Promise<ActionResult<null>> {
  const locale = await getLocale();
  const t = getDictionary(locale).frontDoor.viewings;
  const parsed = validate(lateSchema, input);
  if (!parsed.ok) return fail(t.lateFailed);
  const time = formatDate(new Date(parsed.data.slotAt), locale, { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });
  const sent = await sendMessage({ conversationId: parsed.data.conversationId, body: t.lateMessage.replace("{time}", time) });
  return sent.ok ? ok(null) : fail(t.lateFailed);
}

/* ------------------------------------------------- the renter's own viewing */

/**
 * CANCEL OR MOVE MY VIEWING (1 November 2026).
 *
 * Cancelling is the withdrawal the renter always had (`closeInspection`, which
 * the database guard allows the requester alone, and which tells the lister
 * through the inspection triggers). Moving is `reschedule_my_viewing`: the old
 * viewing is withdrawn and the new time booked through the same function the
 * listing page uses, in ONE transaction, so a time that is no longer free
 * leaves the current viewing exactly where it was. Only the person who asked
 * for the viewing may do either, only while it is open and still ahead.
 */
const myViewingInput = z.object({ id: z.string().uuid() });
const moveInput = z.object({ id: z.string().uuid(), slotAt: z.string().refine((v) => !Number.isNaN(Date.parse(v))) });

type OwnViewing = { id: string; listing_id: string; requester_id: string; state: string; slot_at: string | null; requested_at: string };

const LIVE = ["REQUESTED", "PROPOSED", "CONFIRMED"];

async function readMine(
  session: Extract<Awaited<ReturnType<typeof resolveSession>>, { state: "signed-in" }>,
  id: string,
): Promise<OwnViewing | null> {
  const { data, error } = await session.supabase
    .from("inspection_requests")
    .select("id, listing_id, requester_id, state, slot_at, requested_at")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as OwnViewing;
  return row.requester_id === session.user.id ? row : null;
}

const MOVE_WORDS: Record<string, string> = {
  viewing_not_found: "That viewing could not be found.",
  viewing_closed: "That viewing is already closed, so it cannot be moved.",
  viewing_time_passed: "That viewing's time has passed, so it cannot be moved.",
  viewing_same_time: "That is already the time of your viewing.",
  viewing_slot_taken: "That time is no longer free. Pick another.",
};

/** Cancel the viewing I asked for. The lister is told through the existing notification. */
export async function cancelMyViewing(input: unknown): Promise<ActionResult<null>> {
  const parsed = validate(myViewingInput, input);
  if (!parsed.ok) return fail("That viewing could not be found.");
  const session = await resolveSession();
  if (session.state !== "signed-in") return fail("Sign in to change this viewing.");
  const mine = await readMine(session, parsed.data.id);
  if (!mine) return fail("That viewing could not be found.");
  if (!LIVE.includes(mine.state)) return fail("That viewing is already closed.");
  const { closeInspection } = await import("../inspections/actions");
  return closeInspection({ id: mine.id, state: "WITHDRAWN" });
}

/** The open times I could move my viewing to, from the listing's own windows. */
export async function myViewingMoveOptions(
  input: unknown,
): Promise<ActionResult<{ listingId: string; slots: { slotAt: string; label: string }[] }>> {
  const parsed = validate(myViewingInput, input);
  if (!parsed.ok) return fail("That viewing could not be found.");
  const session = await resolveSession();
  if (session.state !== "signed-in") return fail("Sign in to change this viewing.");
  const mine = await readMine(session, parsed.data.id);
  if (!mine || !LIVE.includes(mine.state)) return fail("That viewing cannot be moved.");
  if (Date.parse(mine.slot_at ?? mine.requested_at) <= Date.now()) return fail(MOVE_WORDS.viewing_time_passed!);
  const rpc = session.supabase.rpc.bind(session.supabase) as unknown as (
    fn: "viewing_slots",
    args: { p_listing: string; p_days: number },
  ) => PromiseLike<{ data: unknown; error: unknown }>;
  const { data, error } = await rpc("viewing_slots", { p_listing: mine.listing_id, p_days: 14 });
  if (error || !Array.isArray(data)) return fail("Open times could not be read just now. Try again in a moment.");
  const locale = await getLocale();
  const current = mine.slot_at ? Date.parse(mine.slot_at) : null;
  const slots = (data as { slot_at: string }[])
    .filter((s) => typeof s.slot_at === "string" && Date.parse(s.slot_at) !== current)
    .slice(0, 12)
    .map((s) => ({
      slotAt: s.slot_at,
      label: formatDate(new Date(s.slot_at), locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" }),
    }));
  if (slots.length === 0) return fail("There are no other open times for this place. You can ask the lister in your chat.");
  return ok({ listingId: mine.listing_id, slots });
}

/** Move my viewing to another open time, atomically. */
export async function rescheduleMyViewing(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = validate(moveInput, input);
  if (!parsed.ok) return fail("That time could not be read.");
  const session = await resolveSession();
  if (session.state !== "signed-in") return fail("Sign in to change this viewing.");
  const mine = await readMine(session, parsed.data.id);
  if (!mine) return fail(MOVE_WORDS.viewing_not_found!);
  const rpc = session.supabase.rpc.bind(session.supabase) as unknown as (
    fn: "reschedule_my_viewing",
    args: { p_inspection: string; p_slot: string },
  ) => PromiseLike<{ data: unknown; error: { hint?: string } | null }>;
  const { data, error } = await rpc("reschedule_my_viewing", {
    p_inspection: mine.id,
    p_slot: new Date(parsed.data.slotAt).toISOString(),
  });
  if (error || typeof data !== "string") {
    return fail((error?.hint && MOVE_WORDS[error.hint]) || "The viewing could not be moved. Your current time still stands.");
  }
  revalidatePath("/bookings");
  revalidatePath("/agent/inspections");
  revalidatePath(`/listing/${mine.listing_id}`);
  return ok({ id: data });
}
