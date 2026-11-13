"use server";

/**
 * THE HOST'S CALENDAR SYNC WRITES (C2, 30 September 2026).
 *
 * The tables (`calendar_feeds`, `calendar_imports`) arrive with the
 * migration `20260930084937_host_c2_calendar_sync_feeds_out_and_imports_in.sql`
 * (applied 30 September 2026).
 * Until the lead applies it every write here answers with the sentence
 * `refusals.sync.notReady`, never a fault: a missing table is PostgREST's PGRST205
 * or Postgres's 42P01.
 *
 * Every write is the caller's own client and the policies decide ownership
 * (`private.owns_calendar_target`). The links a host pastes are checked
 * against the list of sites in `ical.ts` before they are stored, because the
 * scheduled job fetches them from our server.
 */

import { revalidatePath } from "next/cache";
import { catalogueChanged } from "@/lib/catalogue/invalidate";
import { z } from "zod";
import { fail, ok, validate, type ActionResult } from "../actions/envelope";
import { NOT_CONFIGURED_MESSAGE, SIGNED_OUT_MESSAGE, resolveSession } from "../actions/session";
import { checkFeedUrl } from "./ical";
import { hostRefusals } from "./refusals";

/* The words are the host's (`experienceHost.refusals.sync`), read per call. */
type Words = Awaited<ReturnType<typeof hostRefusals>>["sync"];
const words = async (): Promise<Words> => (await hostRefusals()).sync;

type Untyped = {
  from: (table: string) => {
    insert: (row: Record<string, unknown>) => {
      select: (cols: string) => { single: () => PromiseLike<{ data: unknown; error: DbError | null }> };
    };
    delete: () => { eq: (col: string, v: string) => PromiseLike<{ error: DbError | null }> };
    update: (row: Record<string, unknown>) => {
      eq: (col: string, v: string) => { select: (cols: string) => PromiseLike<{ data: unknown; error: DbError | null }> };
    };
  };
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: DbError | null }>;
};
type DbError = { code?: string | null; message?: string | null };

function missing(error: DbError | null): boolean {
  return Boolean(error && (error.code === "PGRST205" || error.code === "42P01" || error.code === "PGRST202"));
}

async function client(): Promise<{ ok: true; db: Untyped } | { ok: false; result: ActionResult<never> }> {
  const s = await resolveSession();
  if (s.state === "unconfigured") return { ok: false, result: fail(NOT_CONFIGURED_MESSAGE) };
  if (s.state === "signed-out") return { ok: false, result: fail(SIGNED_OUT_MESSAGE) };
  return { ok: true, db: s.supabase as unknown as Untyped };
}

function refresh(): void {
  revalidatePath("/host/calendar");
}

const roomOnly = (w: Words) => z.object({ roomTypeId: z.uuid(w.roomUnknown) });

/**
 * Make (or remake) the room's export link. Remaking deletes the old row
 * first, so the old link stops working at once: that is the point of the
 * button, for a link that was pasted somewhere it should not have been.
 */
export async function makeCalendarFeed(input: unknown): Promise<ActionResult<{ token: string }>> {
  const w = await words();
  const parsed = validate(roomOnly(w).extend({ fresh: z.boolean().optional() }), input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const got = await client();
  if (!got.ok) return got.result;
  if (parsed.data.fresh) {
    const { error } = await got.db.from("calendar_feeds").delete().eq("room_type_id", parsed.data.roomTypeId);
    if (missing(error)) return fail(w.notReady);
    if (error) return fail(w.serviceDown);
  }
  const { data, error } = await got.db
    .from("calendar_feeds")
    .insert({ room_type_id: parsed.data.roomTypeId })
    .select("token")
    .single();
  if (missing(error)) return fail(w.notReady);
  if (error?.code === "23505") return fail(w.linkExists);
  if (error?.code === "42501") return fail(w.notYours);
  if (error || !data) return fail(w.serviceDown);
  refresh();
  return ok({ token: (data as { token: string }).token });
}

const importSchema = (w: Words) =>
  z.object({
    roomTypeId: z.uuid(w.roomUnknown),
    source: z.enum(["airbnb", "booking_com", "other"], w.pickSite),
    url: z.string().trim().min(1, w.pasteLink).max(2000),
  });

/** Link another site's calendar to a room. The first pull happens on the next run. */
export async function addCalendarImport(input: unknown): Promise<ActionResult<null>> {
  const w = await words();
  const parsed = validate(importSchema(w), input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const checked = checkFeedUrl(parsed.data.url);
  if (!checked.ok) return fail(w.feed[checked.reason], { url: w.feed[checked.reason] });
  const got = await client();
  if (!got.ok) return got.result;
  const { error } = await got.db
    .from("calendar_imports")
    .insert({ room_type_id: parsed.data.roomTypeId, source: parsed.data.source, url: checked.url })
    .select("id")
    .single();
  if (missing(error)) return fail(w.notReady);
  if (error?.code === "23505") return fail(w.alreadyLinked, { url: w.alreadyLinkedField });
  if (error?.code === "23514") return fail(w.fiveMax);
  if (error?.code === "42501") return fail(w.notYours);
  if (error) return fail(w.serviceDown);
  refresh();
  return ok(null);
}

const idOnly = (w: Words) => z.object({ importId: z.uuid(w.calendarUnknown) });

/** Unlink a calendar. Every night it closed on Vallo opens again. */
export async function removeCalendarImport(input: unknown): Promise<ActionResult<{ released: number }>> {
  const w = await words();
  const parsed = validate(idOnly(w), input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const got = await client();
  if (!got.ok) return got.result;
  const { data, error } = await got.db.rpc("remove_calendar_import", { p_import: parsed.data.importId });
  if (missing(error)) return fail(w.notReady);
  if (error) return fail(w.serviceDown);
  const result = (data ?? {}) as { status?: string; released?: number };
  if (result.status !== "ok") return fail(w.notYours);
  refresh();
  catalogueChanged();
  revalidatePath("/stays");
  return ok({ released: Number(result.released ?? 0) });
}

/** Pause or resume one linked calendar. A paused one keeps its nights as they are. */
export async function setCalendarImportEnabled(input: unknown): Promise<ActionResult<null>> {
  const w = await words();
  const parsed = validate(idOnly(w).extend({ enabled: z.boolean() }), input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const got = await client();
  if (!got.ok) return got.result;
  const { data, error } = await got.db
    .from("calendar_imports")
    .update({ enabled: parsed.data.enabled })
    .eq("id", parsed.data.importId)
    .select("id");
  if (missing(error)) return fail(w.notReady);
  if (error) return fail(w.serviceDown);
  if (!Array.isArray(data) || data.length === 0) return fail(w.notYours);
  refresh();
  return ok(null);
}
