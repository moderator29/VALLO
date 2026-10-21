"use server";

import { farEnoughAhead, lagosWallClockToIso } from "./when";
import { oncePerTap, tapKey } from "../offline/replay-guard";
import { revalidatePath } from "next/cache";
import { PHOTO_EXTENSIONS, photoPathBelongsTo } from "./report-photo-path";
import { scrubPublicPhoto } from "../images/scrub";
import { z } from "zod";
import { resolveSession } from "../actions/session";
import { fail, ok, validate, type ActionResult } from "../actions/envelope";
import { startConversation } from "../messages/actions";
import { INSPECTION_OUTCOMES, isClosed, type InspectionState } from "./types";
import { phoneGateFor } from "../phone-otp/gate";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "../locale";
import { videoCallsOn } from "../calls/flags";
import { VISIT_MODES, type VisitMode } from "./visit";

/**
 * MOVING AN INSPECTION.
 *
 * Four actions and no more: ask, answer, take the time you were offered, pull
 * out. Everything about WHO may do WHICH is decided in the database by
 * `private.guard_inspection_transition`, and nothing here re-implements it.
 *
 * That split is deliberate and it is the same one the money layer uses. A
 * state machine written twice is a state machine that will disagree with
 * itself, and the copy that matters is the one an attacker cannot skip. These
 * functions validate shapes, name the row, and translate a refusal into a
 * sentence somebody can act on.
 *
 * WHAT IS NOT HERE: a confirm action for the requester on their own request.
 * The database refuses that transition; there is no reason for a door in front
 * of a wall.
 *
 * WHAT IS HERE, ON TOP OF THE GUARD. Each move reads the row first and writes
 * only from the state it read (`.eq("state", read)`), and asks for the row
 * back. Row-level security answers an update it does not allow with zero rows
 * and no error, and the guard returns early when the state does not change,
 * so without this a stranger's tap, a second tab or a stale screen came back
 * "ok" while nothing moved, or quietly rewrote the agreed time. A write that
 * returns no row is now said as what it is: the request moved on.
 */

const MAX_NOTE = 400;

/** The states a request is alive in: somebody's move, or booked in. */
const LIVE_STATES: readonly InspectionState[] = ["REQUESTED", "PROPOSED", "CONFIRMED"];

const NOT_FOUND_MESSAGE = "We could not find that request. Refresh the page to see your current requests.";

/** The row moved between the read and the write: another tab, or the other side. */
const MOVED_MESSAGE = "This request changed while you were looking at it. Refresh to see where it stands.";

const CLOSED_MESSAGE = "This request has already been closed. Refresh to see where it ended up.";

const ALREADY_ASKED_MESSAGE =
  "You have already asked to see this property. Follow it on your Plans, where you can also withdraw it.";

/**
 * The example refusal, in the one sentence a person can act on.
 *
 * Every listing in the catalogue today carries `is_demo`, and the trigger
 * `inspection_requests_never_against_a_demo_listing` refuses the insert with
 * SQLSTATE 23514. Without this the guest was told "We could not send that
 * request. Try again in a moment", which is false twice over: nothing went
 * wrong, and trying again will never work.
 */
const EXAMPLE_LISTING_MESSAGE =
  "This is an example listing, so there is nothing to inspect. Open a real listing from search and arrange an inspection there.";

/** The furthest ahead somebody may ask to inspect a property. */
const MAX_DAYS_AHEAD = 90;

const whenSchema = z
  .string()
  .min(1, "Pick a day and a time.")
  /* UX-20: a picker's zone-less "2026-10-10T14:30" is Lagos time, whatever
     zone the sender's phone is in; a full ISO instant passes through. */
  .transform((value) => lagosWallClockToIso(value) ?? value)
  .refine((value) => !Number.isNaN(Date.parse(value)), "That is not a time we can read.")
  /* UX-20: at least two hours ahead, so the other side can answer first. */
  .refine((value) => farEnoughAhead(value), "Pick a time at least two hours from now, so they have time to answer.")
  .refine(
    (value) => Date.parse(value) < Date.now() + MAX_DAYS_AHEAD * 86_400_000,
    `Pick a time within the next ${MAX_DAYS_AHEAD} days.`,
  );

const requestSchema = z.object({
  listingId: z.string().uuid("That property could not be found."),
  when: whenSchema,
  note: z.string().trim().max(MAX_NOTE, `Keep this under ${MAX_NOTE} characters.`).optional(),
  /* `inspection_requests.visit_mode`. Absent is the column's own default,
     in person, so every caller written before the visit flow still files
     exactly what it filed. */
  mode: z.enum(VISIT_MODES).optional(),
});

/**
 * A video visit rides on the calls feature, so it is refused while
 * `video_calls` is off, whatever a screen drew: the visit would promise a
 * call the database refuses to place. Null when the mode may be filed. Not
 * exported: in a "use server" module an export is a public endpoint.
 */
async function visitModeRefusal(mode: VisitMode | undefined): Promise<string | null> {
  if (mode !== "video") return null;
  if (await videoCallsOn()) return null;
  return getDictionary(await getLocale()).visit.problems.videoOff;
}

/**
 * Ask to inspect a property.
 *
 * The lister is NOT supplied and cannot be: a trigger resolves it from the
 * listing, so a request always names the person who actually owns the property
 * at the moment it is made. The insert policy refuses a request against an
 * unpublished listing and against your own, so neither is checked here.
 */
export async function requestInspection(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = validate(requestSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const session = await resolveSession();
  if (session.state !== "signed-in") {
    return fail("Sign in to arrange an inspection.");
  }
  /* V-40: a replay of the same tap answers with the first request. */
  const key = tapKey((input as { tapKey?: unknown } | null)?.tapKey);
  return oncePerTap("outbox.inspection", session.user.id, key, () => requestInspectionWork(session, parsed.data));
}

async function requestInspectionWork(
  session: Extract<Awaited<ReturnType<typeof resolveSession>>, { state: "signed-in" }>,
  input: z.infer<typeof requestSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = { data: input };

  /* V-50: the first inspection request needs a confirmed phone, when the
     phone_confirmation flag is on. Null, and nothing read, when it is off. */
  const phoneGate = await phoneGateFor(session.supabase, session.user.id, "inspection");
  if (phoneGate) return phoneGate;

  const modeRefusal = await visitModeRefusal(parsed.data.mode);
  if (modeRefusal) return fail(modeRefusal, { mode: modeRefusal });

  /* Before the write, so the person reads the truth rather than a constraint
     violation. The trigger refuses again underneath: this is the courtesy and
     that is the guarantee. A listing that does not come back at all is left to
     the insert policy's own refusal, which already has its sentence below. */
  const { data: listing } = await session.supabase
    .from("listings")
    .select("id, is_demo")
    .eq("id", parsed.data.listingId)
    .maybeSingle();
  if (listing?.is_demo) return fail(EXAMPLE_LISTING_MESSAGE);

  /* One live request per person per property. The listing page already says
     "you asked" instead of offering a second request, but a second tab, two
     taps that minted two tap keys, or a direct call still reached the insert,
     and a lister's queue then held the same person twice for one home. The
     courtesy, not the guarantee: two calls in the same instant can both pass,
     and the table holds no unique rule for it (book_viewing_slot refuses the
     same case inside its own transaction). */
  const { data: already } = await session.supabase
    .from("inspection_requests")
    .select("id")
    .eq("listing_id", parsed.data.listingId)
    .eq("requester_id", session.user.id)
    .in("state", [...LIVE_STATES])
    .limit(1)
    .maybeSingle();
  if (already) return fail(ALREADY_ASKED_MESSAGE);

  /* V-63: a person on a safety hold is refused by the database, in the same
     words as a listing that is not taking requests (the row-level security
     branch below). There is deliberately no earlier check and no sentence of
     its own: either would tell the held person a report exists, and who
     made it. */

  const { data, error } = await session.supabase
    .from("inspection_requests")
    .insert({
      listing_id: parsed.data.listingId,
      requester_id: session.user.id,
      /* Not null in the table and written by the trigger before the row
         lands. Supplying the caller keeps the insert type-complete without
         claiming anything: whatever goes in here is overwritten. */
      lister_id: session.user.id,
      requested_at: new Date(parsed.data.when).toISOString(),
      ...(parsed.data.note ? { note: parsed.data.note } : {}),
      ...(parsed.data.mode ? { visit_mode: parsed.data.mode } : {}),
    })
    .select("id")
    .single();

  if (error || !data) {
    /*
     * The refusals worth telling apart, read from the constraint that fired
     * rather than guessed at. The example one is first because it is the one
     * a person can do nothing about except go somewhere real, and because a
     * listing can become an example between the read above and this insert.
     */
    const message = error?.message ?? "";
    if (/example/i.test(message)) {
      return fail(EXAMPLE_LISTING_MESSAGE);
    }
    if (message.includes("inspection_requests_parties_differ")) {
      return fail("This is your own property, so there is nothing to arrange.");
    }
    /* `private.inspection_needs_an_open_listing`: both are final for now, so
       neither may end in "try again". */
    if (message.includes("has been closed")) {
      return fail("This listing has been closed, so it is not taking inspection requests.");
    }
    if (message.includes("has not reconfirmed")) {
      return fail(
        "The owner has not yet reconfirmed this property is available, so it is not taking new requests. Message the lister to ask.",
      );
    }
    if (message.includes("row-level security")) {
      return fail("This property is not taking inspection requests just now. Message the lister to ask when viewings open.");
    }
    return fail("We could not send that request. Try again in a moment.");
  }

  /*
   * The thread the request lives beside. Find-or-create the guest to agent
   * conversation about this listing, then stamp its id on the request, so the
   * thread page can draw the inspection card and accept from inside it. The
   * request is already filed and is the thing that matters; the thread is
   * best effort. Messaging paused, the daily new-thread limit reached, a
   * flaky stamp: none of those may cost somebody the request they just made,
   * so every failure here is swallowed and the row simply carries no thread.
   */
  const thread = await startConversation({ listingId: parsed.data.listingId });
  if (thread.ok) {
    await session.supabase
      .from("inspection_requests")
      .update({ conversation_id: thread.data.conversationId })
      .eq("id", data.id);
  }

  revalidatePath(`/listing/${parsed.data.listingId}`);
  revalidatePath("/bookings");
  if (thread.ok) revalidatePath(`/messages/${thread.data.conversationId}`);
  return ok({ id: data.id });
}

const answerSchema = z.object({
  id: z.string().uuid(),
  /* The three answers a lister has. `PROPOSED` needs a time; the others do
     not, and `CONFIRMED` takes the time that was asked for unless one is
     given. */
  state: z.enum(["CONFIRMED", "PROPOSED", "DECLINED"]),
  when: whenSchema.optional(),
  note: z.string().trim().max(MAX_NOTE).optional(),
});

/**
 * The lister's answer: yes, another time, or no. The same three moves serve a
 * viewing that is already booked: another time reschedules it (CONFIRMED to
 * PROPOSED, so it is not confirmed again until the renter takes the new time)
 * and no cancels it (CONFIRMED to DECLINED). The guard has always allowed
 * both; these are the doors to them.
 *
 * A `CONFIRMED` row must carry a slot - the table refuses one without, because
 * an appointment with no time is not an appointment - so "yes" takes the time
 * that was asked for. Only that time: a different one is something the renter
 * has to agree to, which is what offering another time is for.
 */
export async function answerInspection(input: unknown): Promise<ActionResult<null>> {
  const parsed = validate(answerSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const session = await resolveSession();
  if (session.state !== "signed-in") return fail("Sign in to answer this request.");

  const existing = await session.supabase
    .from("inspection_requests")
    .select("id, listing_id, lister_id, requested_at, state")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (existing.error || !existing.data) {
    return fail(NOT_FOUND_MESSAGE);
  }

  const current = existing.data.state as InspectionState;
  const nextState = parsed.data.state as InspectionState;
  if (existing.data.lister_id !== session.user.id) {
    return fail("Only the person who listed this property can answer this request.");
  }
  if (isClosed(current)) return fail(CLOSED_MESSAGE);
  /* The guard waves an unchanged state through, so a second "yes" from a
     stale screen used to rewrite the agreed time back to the asked one, and
     tell nobody. */
  if (current === nextState) {
    return fail(
      nextState === "CONFIRMED"
        ? "This viewing is already confirmed. Refresh to see the agreed time."
        : "You have already offered a time. Their answer will show here, or message them in the chat.",
    );
  }
  if (nextState === "PROPOSED" && !parsed.data.when) {
    return fail("Say which time you can do.", { when: "Pick a day and a time." });
  }
  if (
    nextState === "CONFIRMED" &&
    parsed.data.when &&
    Date.parse(parsed.data.when) !== Date.parse(existing.data.requested_at)
  ) {
    return fail("To confirm a different time, offer it to them instead.", { when: "Offer this time instead." });
  }

  const slot =
    nextState === "CONFIRMED"
      ? existing.data.requested_at
      : nextState === "PROPOSED"
        ? parsed.data.when
        : null;

  /* UX-20: saying yes to a time that has already gone confirms nothing. */
  if (nextState === "CONFIRMED" && slot && Date.parse(slot) <= Date.now()) {
    return fail("The time they asked for has passed. Offer another time instead.");
  }

  const { data: moved, error } = await session.supabase
    .from("inspection_requests")
    .update({
      state: nextState,
      ...(slot ? { slot_at: new Date(slot).toISOString() } : {}),
      ...(parsed.data.note ? { lister_note: parsed.data.note } : {}),
    })
    .eq("id", parsed.data.id)
    .eq("state", current)
    .select("id");

  if (error) return fail(refusalMessage(error.message));
  if (!moved || moved.length === 0) return fail(MOVED_MESSAGE);

  revalidatePath("/agent/dashboard");
  revalidatePath("/agent/inspections");
  revalidatePath("/bookings");
  revalidatePath(`/listing/${existing.data.listing_id}`);
  return ok(null);
}

const takeSchema = z.object({ id: z.string().uuid() });

/**
 * Taking the time the lister offered.
 *
 * The one transition a requester may make into `CONFIRMED`, and only from
 * `PROPOSED`. The slot is already on the row - the lister wrote it when they
 * proposed - so nothing about the time is re-supplied here, which means a
 * requester cannot accept a different time to the one they were offered.
 */
export async function acceptProposedTime(input: unknown): Promise<ActionResult<null>> {
  const parsed = validate(takeSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const session = await resolveSession();
  if (session.state !== "signed-in") return fail("Sign in to confirm this time.");

  const existing = await session.supabase
    .from("inspection_requests")
    .select("id, listing_id, requester_id, state, slot_at")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (existing.error || !existing.data) return fail(NOT_FOUND_MESSAGE);

  /* The guard lets a LISTER move PROPOSED to CONFIRMED too, because a lister
     may confirm. Through this door that would be the lister agreeing to
     their own offer on the renter's behalf, so only the renter comes in. */
  if (existing.data.requester_id !== session.user.id) {
    return fail("Only the person who asked for this viewing can take the time offered.");
  }
  if (existing.data.state === "CONFIRMED") {
    return fail("This viewing is already confirmed. Refresh to see the agreed time.");
  }
  if (existing.data.state !== "PROPOSED") {
    return fail(isClosed(existing.data.state as InspectionState) ? CLOSED_MESSAGE : MOVED_MESSAGE);
  }
  /* UX-20, from the renter's side: taking a time that has already gone books
     nothing anybody can keep. */
  if (!existing.data.slot_at || Date.parse(existing.data.slot_at) <= Date.now()) {
    return fail("The time they offered has passed. Ask them for another time in the chat.");
  }

  const { data: moved, error } = await session.supabase
    .from("inspection_requests")
    .update({ state: "CONFIRMED" })
    .eq("id", parsed.data.id)
    .eq("state", "PROPOSED")
    .select("id");

  if (error) return fail(refusalMessage(error.message));
  if (!moved || moved.length === 0) return fail(MOVED_MESSAGE);

  revalidatePath("/bookings");
  revalidatePath("/agent/inspections");
  revalidatePath(`/listing/${existing.data.listing_id}`);
  return ok(null);
}

const closeSchema = z
  .object({
    id: z.string().uuid(),
    state: z.enum(["WITHDRAWN", "COMPLETED"]),
    /* Why it is complete. Optional, and only meaningful on COMPLETED: the
       database refuses it anywhere else, and so does this schema, so the
       person sees the field light up rather than a refusal after the fact. */
    outcome: z.enum(INSPECTION_OUTCOMES).optional(),
  })
  .refine((value) => value.outcome === undefined || value.state === "COMPLETED", {
    message: "An outcome only goes with a completed inspection.",
    path: ["outcome"],
  });

/**
 * Pulling out, or saying it happened.
 *
 * Withdrawing rather than deleting is the whole reason there is no delete
 * policy on this table: a withdrawn request and a vanished one look the same
 * to the person who was asked, and they mean different things. A renter may
 * withdraw a viewing that is already booked as well: that is how they cancel
 * it, and the lister hears it.
 *
 * "It happened" waits for the agreed time. The table's own account of
 * COMPLETED is "set by either side after the slot has passed", and the guard
 * does not check the clock, so a tap a week early told both sides a visit was
 * done that nobody had made.
 */
export async function closeInspection(input: unknown): Promise<ActionResult<null>> {
  const parsed = validate(closeSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const session = await resolveSession();
  if (session.state !== "signed-in") return fail("Sign in to change this request.");

  const existing = await session.supabase
    .from("inspection_requests")
    .select("id, listing_id, requester_id, state, slot_at, requested_at")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (existing.error || !existing.data) return fail(NOT_FOUND_MESSAGE);

  const current = existing.data.state as InspectionState;
  if (isClosed(current)) return fail(CLOSED_MESSAGE);

  if (parsed.data.state === "WITHDRAWN" && existing.data.requester_id !== session.user.id) {
    return fail("Only the person who asked for this viewing can withdraw it.");
  }
  if (parsed.data.state === "COMPLETED") {
    if (current !== "CONFIRMED") {
      return fail("A viewing is marked as done once a time has been agreed and it has taken place.");
    }
    const agreed = existing.data.slot_at ?? existing.data.requested_at;
    if (Date.parse(agreed) > Date.now()) {
      return fail("You can mark this viewing as done once its time has come.");
    }
  }

  const { data: moved, error } = await session.supabase
    .from("inspection_requests")
    .update({
      state: parsed.data.state,
      ...(parsed.data.outcome ? { outcome: parsed.data.outcome } : {}),
    })
    .eq("id", parsed.data.id)
    .eq("state", current)
    .select("id");

  if (error) return fail(refusalMessage(error.message));
  if (!moved || moved.length === 0) return fail(MOVED_MESSAGE);

  revalidatePath("/bookings");
  revalidatePath("/agent/dashboard");
  revalidatePath("/agent/inspections");
  revalidatePath(`/listing/${existing.data.listing_id}`);
  return ok(null);
}

/**
 * A database refusal, as a sentence.
 *
 * The guard raises `check_violation` with a message naming the transition. The
 * person on the other end does not need the transition; they need to know that
 * somebody got there first, which is what both of these actually mean in
 * practice: a request answered in another tab, or one the other side closed
 * while this screen was open.
 */
function refusalMessage(raw: string): string {
  if (raw.includes("is finished and cannot change")) {
    return "This request has already been closed. Refresh to see where it ended up.";
  }
  if (raw.includes("illegal inspection transition")) {
    return "That is not something you can do to this request now. Refresh and look again.";
  }
  if (raw.includes("outcome is recorded when it is completed")) {
    return "An outcome is recorded when the inspection is marked complete, and not changed afterwards.";
  }
  return "We could not save that. Try again in a moment.";
}

/* ------------------------------------------------------------------ report */

/**
 * THE REPORT: EIGHT ROOMS, A NOTE, AND THE TICK THAT CLOSES THE INSPECTION.
 *
 * `F6A8A482` draws eight rows, a notes field and Add Photos. This is exactly
 * that shape, and the inspection screen is wired to it.
 *
 * NOTHING HERE DECIDES WHO MAY WRITE, AND THAT IS THE POINT. The same split
 * the four actions above use: `inspection_reports_insert_party`,
 * `_update_party` and their siblings decide who and when, and
 * `private.inspection_report_submission` refuses a submission with fewer than
 * eight ticks and closes the parent in the same transaction. This function
 * validates a shape, names a row, and turns a refusal into a sentence.
 *
 * SO THE DISABLED SUBMIT BUTTON IS THE POLITE HALF OF A REAL RULE. Anything
 * that can reach this action can call it with three rooms ticked; the database
 * is what says no.
 */
const REPORT_ITEMS = [
  "exterior",
  "interior",
  "kitchen",
  "bathrooms",
  "utilities",
  "appliances",
  "safety",
  "overall",
] as const;

const saveReportSchema = z.object({
  inspectionId: z.string().uuid(),
  items: z
    .array(
      z.object({
        item: z.enum(REPORT_ITEMS),
        checked: z.boolean(),
        note: z.string().trim().max(MAX_NOTE).optional().nullable(),
      }),
    )
    .max(REPORT_ITEMS.length),
  notes: z.string().trim().max(2000).optional().nullable(),
  submit: z.boolean().optional(),
});

export type InspectionReport = {
  inspectionId: string;
  notes: string | null;
  submittedAt: string | null;
  items: { item: (typeof REPORT_ITEMS)[number]; checked: boolean; note: string | null }[];
};

export async function saveInspectionReport(
  input: unknown,
): Promise<ActionResult<InspectionReport>> {
  const parsed = validate(saveReportSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const session = await resolveSession();
  if (session.state !== "signed-in") return fail("Sign in to write this report.");

  const { inspectionId, items, notes, submit } = parsed.data;
  const db = session.supabase;

  /* The report row is created on first save rather than when the inspection is
     confirmed, so an inspection nobody wrote up carries no empty report. */
  /* Created once, by whoever writes first, and never re-authored: an upsert
     carrying `author_id` rewrote it to whichever party saved last. So the row
     is inserted if missing (a conflict does nothing) and the notes are then
     written on their own. */
  const { error: createError } = await db
    .from("inspection_reports")
    .upsert(
      { inspection_id: inspectionId, author_id: session.user.id, notes: notes ?? null },
      { onConflict: "inspection_id", ignoreDuplicates: true },
    );
  if (createError) return fail(reportRefusal(createError.message));
  const { error: reportError } = await db
    .from("inspection_reports")
    .update({ notes: notes ?? null })
    .eq("inspection_id", inspectionId)
    .is("submitted_at", null);
  if (reportError) return fail(reportRefusal(reportError.message));

  if (items.length > 0) {
    const now = new Date().toISOString();
    const { error: itemsError } = await db.from("inspection_report_items").upsert(
      items.map((row) => ({
        inspection_id: inspectionId,
        item: row.item,
        checked: row.checked,
        note: row.note ?? null,
        /* `checked_at` is when somebody said yes, so it is cleared when they
           change their mind rather than left pointing at a tick that is gone. */
        checked_at: row.checked ? now : null,
      })),
      { onConflict: "inspection_id,item" },
    );
    if (itemsError) return fail(reportRefusal(itemsError.message));
  }

  if (submit) {
    const { error: submitError } = await db
      .from("inspection_reports")
      .update({ submitted_at: new Date().toISOString() })
      .eq("inspection_id", inspectionId);
    if (submitError) return fail(reportRefusal(submitError.message));
  }

  const saved = await readReport(db, inspectionId);
  if (!saved) return fail("We saved that but could not read it back. Refresh to see where it stands.");

  revalidatePath("/bookings");
  revalidatePath("/agent/inspections");
  return ok(saved);
}

/**
 * A SIGNED PATH INTO THE PRIVATE BUCKET, AND THE PATH IS THE PERMISSION.
 *
 * `<inspection_id>/<uuid>.<ext>`, which is what
 * `private.inspection_photo_path_access` reads: the first segment decides, so
 * a person cannot upload into somebody else's inspection even holding a signed
 * URL, and cannot read out of one.
 *
 * The extension is taken from a closed list rather than from the file name,
 * because a name arrives from a browser and a bucket's mime rules are not a
 * substitute for not trusting it.
 */

const photoUploadSchema = z.object({
  inspectionId: z.string().uuid(),
  extension: z.string().trim().toLowerCase().max(8),
  item: z.enum(REPORT_ITEMS).optional().nullable(),
});

export async function createInspectionPhotoUpload(
  input: unknown,
): Promise<ActionResult<{ path: string; token: string }>> {
  const parsed = validate(photoUploadSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const session = await resolveSession();
  if (session.state !== "signed-in") return fail("Sign in to add a photo.");

  const extension = PHOTO_EXTENSIONS[parsed.data.extension as keyof typeof PHOTO_EXTENSIONS];
  if (!extension) {
    return fail("That file type cannot be attached. Use a photo or a PDF.", {
      extension: "Use a JPG, PNG, WEBP, HEIC or PDF.",
    });
  }

  const path = `${parsed.data.inspectionId}/${crypto.randomUUID()}.${extension}`;
  const { data, error } = await session.supabase.storage
    .from("inspection-photos")
    .createSignedUploadUrl(path);

  if (error || !data) return fail(reportRefusal(error?.message ?? ""));
  return ok({ path: data.path, token: data.token });
}

/**
 * I1b. THE ROW THAT MAKES AN UPLOADED OBJECT PART OF THE REPORT.
 *
 * `createInspectionPhotoUpload` hands the browser a signed URL and the browser
 * PUTs the bytes straight at storage. Nothing reaches this server in between,
 * which is the point: a photo of a damp wall does not need to travel through a
 * server action to get into a bucket. But an object sitting in a bucket that no
 * row points at is invisible to every screen, so this is the second half, and
 * the screen calls it once the upload resolves.
 *
 * WHY THE PATH IS CHECKED HERE AS WELL AS IN STORAGE. The bucket's own policies
 * read the first path segment (`private.inspection_photo_path_access`), so a
 * person genuinely cannot write bytes into somebody else's folder. This row is a
 * different object in a different schema, and nothing about the storage policy
 * stops a caller posting `{ inspectionId: mine, storagePath: "<someone else>/x.jpg" }`
 * and hanging their photo off my report. So the path's first segment must equal
 * the inspection it is being attached to, and the extension must be one we
 * issued. **A signed upload proves where the bytes went. It does not prove what
 * the caller then says about them.**
 *
 * The insert itself goes through the caller's own RLS-bound client, so being a
 * party to the inspection, and the report still being open, are both decided by
 * Postgres rather than restated here.
 */
const addPhotoSchema = z.object({
  inspectionId: z.string().uuid(),
  storagePath: z.string().trim().min(3).max(200),
  item: z.enum(REPORT_ITEMS).optional().nullable(),
});

const REPORT_PHOTO_SCRUB_REFUSED =
  "We could not prepare that photo for the report, so it was not added. Use a JPEG, PNG or WebP photo and try again.";

export type ReportPhoto = { id: string; storagePath: string; item: string | null; createdAt: string };

export async function addReportPhoto(input: unknown): Promise<ActionResult<ReportPhoto>> {
  const parsed = validate(addPhotoSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const session = await resolveSession();
  if (session.state !== "signed-in") return fail("Sign in to add a photo.");

  const { inspectionId, storagePath, item } = parsed.data;

  if (!photoPathBelongsTo(inspectionId, storagePath)) {
    return fail("That photo could not be attached to this inspection. Try the upload again.", {
      storagePath: "This file does not belong to this inspection.",
    });
  }

  /*
   * THE PHOTO LOSES ITS LOCATION BEFORE ANY ROW POINTS AT IT, the rule the
   * listing and host photos follow (`lib/images/scrub.ts`). The sheet
   * re-encodes in the browser, which strips EXIF, but a direct upload with a
   * signed URL skips the sheet. The scrub runs through the service role, so
   * the caller must first be a party: the inspection has to be readable
   * through their own RLS-bound client, or nobody's object is touched.
   * A PDF is a document, not a photograph, and is left as uploaded; anything
   * else that is not a JPEG, PNG or WebP is removed and refused (fail closed).
   */
  const { data: party } = await session.supabase
    .from("inspection_requests")
    .select("id")
    .eq("id", inspectionId)
    .maybeSingle();
  if (!party) {
    return fail("That photo could not be attached to this inspection. Try the upload again.");
  }
  if (!storagePath.endsWith(".pdf")) {
    const scrubbed = await scrubPublicPhoto("inspection-photos", storagePath);
    if (!scrubbed.ok) return fail(REPORT_PHOTO_SCRUB_REFUSED);
  }

  const { data, error } = await session.supabase
    .from("inspection_report_photos")
    .insert({ inspection_id: inspectionId, storage_path: storagePath, item: item ?? null })
    .select("id, storage_path, item, created_at")
    .single();

  if (error || !data) {
    /* 23505 is the same object attached twice, which is a double tap on a slow
       connection rather than a fault, so it reads as one. */
    if (error?.code === "23505") return fail("That photo is already on this report.");
    return fail(reportRefusal(error?.message ?? ""));
  }

  revalidatePath("/bookings");
  revalidatePath("/agent/inspections");
  return ok({
    id: data.id,
    storagePath: data.storage_path,
    item: data.item,
    createdAt: data.created_at,
  });
}

/**
 * The row after the write, read back through the caller's own session so it
 * carries exactly what that person is allowed to see.
 */
type ReportClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => Promise<{ data: unknown[] | null }>;
    };
  };
};

async function readReport(db: unknown, inspectionId: string): Promise<InspectionReport | null> {
  const client = db as ReportClient;
  const [report, items] = await Promise.all([
    client.from("inspection_reports").select("inspection_id, notes, submitted_at").eq("inspection_id", inspectionId),
    client.from("inspection_report_items").select("item, checked, note").eq("inspection_id", inspectionId),
  ]);
  const row = (report.data ?? [])[0] as
    | { inspection_id: string; notes: string | null; submitted_at: string | null }
    | undefined;
  if (!row) return null;
  return {
    inspectionId: row.inspection_id,
    notes: row.notes,
    submittedAt: row.submitted_at,
    items: ((items.data ?? []) as { item: string; checked: boolean; note: string | null }[])
      .filter((i): i is { item: (typeof REPORT_ITEMS)[number]; checked: boolean; note: string | null } =>
        (REPORT_ITEMS as readonly string[]).includes(i.item),
      )
      .sort((a, b) => REPORT_ITEMS.indexOf(a.item) - REPORT_ITEMS.indexOf(b.item)),
  };
}

/**
 * A report refusal, as a sentence somebody can act on.
 *
 * The eight-room rule is the one people will actually meet, so it says the
 * number rather than "that could not be saved". The RLS refusals read as a
 * missing row rather than as an error, which is why the closed-inspection case
 * is phrased as a state and not as a permission.
 */
function reportRefusal(raw: string): string {
  if (raw.includes("all eight rooms are checked")) {
    return "Tick all eight rooms before you submit the report.";
  }
  /* A rental's report needs the photos its agreement is drawn up from, and
     cannot take one once it is submitted (migration 20260928233552). */
  const photos = /submitted with at least (\d+) photos, and (\d+) are attached/.exec(raw);
  if (photos) {
    return `Add at least ${photos[1]} photos taken at the property before you submit. ${photos[2]} added so far.`;
  }
  if (raw.includes("row-level security") || raw.includes("violates row-level security policy")) {
    return "This report cannot be changed now. It is either submitted already or the inspection is closed.";
  }
  if (raw.includes("inspection_reports_pkey")) {
    return "A report for this inspection already exists. Refresh to see it.";
  }
  return "We could not save that. Try again in a moment.";
}
