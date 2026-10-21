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
