"use server";

/**
 * THE WRITES BEHIND THE HOST'S RATE CALENDAR (C1, 30 September 2026).
 *
 * WHAT THESE WRITE, AND WHAT THEY NEVER DO. They write the host's INPUTS to
 * pricing: a night's own price or a closed night on `rate_calendar`, how many
 * rooms are on sale on `room_inventory`, and a rate plan's own nightly rate.
 * They price nothing. The database prices a stay when it is requested
 * (`private.price_room_booking`: `sum(coalesce(rc.rate_minor, rp.rate_minor))`
 * over the nights, a closed night refused), and a request already made keeps
 * the price it was made at, because the pricing trigger runs on the booking
 * row, not on the calendar. Nothing here touches a booking, a payment, a
 * split or a settlement.
 *
 * EVERY WRITE IS THE CALLER'S OWN CLIENT. `rate_calendar_write`,
 * `rate_plans_write` and `room_inventory_owner_write` all admit only
 * `private.my_room_type_ids()`, so the database decides whose rooms these
 * are. The ownership read before each write is the polite refusal, not the
 * security boundary. The service role appears nowhere in this file.
 *
 * WHAT THE DATABASE REFUSES AND THIS TURNS INTO WORDS: more rooms open than
 * the type holds (`private.room_inventory_within_total`) and fewer open than
 * already sold (`units_booked <= units_open`), both 23514.
 */

import { revalidatePath } from "next/cache";
import { catalogueChanged } from "@/lib/catalogue/invalidate";
import { z } from "zod";
import { fail, ok, validate, type ActionResult } from "../actions/envelope";
import { NOT_CONFIGURED_MESSAGE, SIGNED_OUT_MESSAGE, resolveSession } from "../actions/session";
import { MAX_CALENDAR_NIGHTS, cleanSelection, isIsoDate, lagosToday } from "./rate-calendar";
import { fill, hostRefusals } from "./refusals";

/* The words are the host's (`experienceHost.refusals.calendar`), read per call. */
type Words = Awaited<ReturnType<typeof hostRefusals>>["calendar"];
const words = async (): Promise<Words> => (await hostRefusals()).calendar;

const datesOf = (w: Words) =>
  z
    .array(z.string().refine(isIsoDate, w.notADate))
    .min(1, w.pickOne)
    .max(MAX_CALENDAR_NIGHTS, fill(w.tooMany, { max: MAX_CALENDAR_NIGHTS }));

/** Kobo, whole, at most ₦50m a night (a typo guard, not a policy). */
const minorOf = (w: Words) => z.number().int(w.wholeKobo).min(100, w.atLeast).max(5_000_000_000, w.tooHigh);

const priceSchema = (w: Words) =>
  z.object({
    roomTypeId: z.uuid(w.roomUnknown),
    ratePlanId: z.uuid(w.rateUnknown),
    dates: datesOf(w),
    /** Null puts the nights back on the plan's own rate. */
    rateMinor: minorOf(w).nullable(),
  });

const closeSchema = (w: Words) =>
  z.object({
    roomTypeId: z.uuid(w.roomUnknown),
    dates: datesOf(w),
    closed: z.boolean(),
  });

const roomsSchema = (w: Words) =>
  z.object({
    roomTypeId: z.uuid(w.roomUnknown),
    dates: datesOf(w),
    unitsOpen: z.number().int(w.wholeRooms).min(0).max(500),
  });

const planSchema = (w: Words) =>
  z
    .object({
      ratePlanId: z.uuid(w.rateUnknown),
      rateMinor: minorOf(w),
      minStayNights: z.number().int().min(1, w.minOneNight).max(90, w.maxNinety),
      maxStayNights: z.number().int().min(1).max(365).nullable(),
    })
    .refine((v) => v.maxStayNights === null || v.maxStayNights >= v.minStayNights, {
      message: w.longestShorter,
      path: ["maxStayNights"],
    });

type Owned = { ok: true; planIds: string[]; unitsTotal: number } | { ok: false; result: ActionResult<never> };

async function session() {
  const s = await resolveSession();
  if (s.state === "unconfigured") return { ok: false as const, result: fail<never>(NOT_CONFIGURED_MESSAGE) };
  if (s.state === "signed-out") return { ok: false as const, result: fail<never>(SIGNED_OUT_MESSAGE) };
  return { ok: true as const, s };
}

/** The caller's own room type, its rate plans and its size. */
async function ownedRoom(roomTypeId: string): Promise<Owned> {
  const got = await session();
  if (!got.ok) return got;
  const { data, error } = await got.s.supabase
    .from("room_types")
    .select("id, units_total, rate_plans(id), accommodations!inner(businesses!inner(owner_id))")
    .eq("id", roomTypeId)
    .eq("accommodations.businesses.owner_id", got.s.user.id)
    .maybeSingle();
  if (error) return { ok: false, result: fail((await words()).serviceDown) };
  if (!data) return { ok: false, result: fail((await words()).notYours) };
  const plans = ((data as unknown as { rate_plans: { id: string }[] | null }).rate_plans ?? []).map((p) => p.id);
  return { ok: true, planIds: plans, unitsTotal: data.units_total };
}

function refresh(): void {
  revalidatePath("/host/calendar");
  revalidatePath("/host/rooms");
  catalogueChanged();
  revalidatePath("/stays");
}

function futureOnly(list: string[]): string[] | null {
  const clean = cleanSelection(list, lagosToday());
  return clean.length === list.length ? clean : null;
}

/**
 * Set a price for some nights on one rate plan, or put them back on the
 * plan's own rate (`rateMinor: null`).
 *
 * An upsert that names only `rate_minor`, so a night the host closed stays
 * closed: PostgREST's upsert updates only the columns it is sent.
 */
export async function setNightPrice(input: unknown): Promise<ActionResult<{ nights: number }>> {
  const w = await words();
  const parsed = validate(priceSchema(w), input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const { roomTypeId, ratePlanId, rateMinor } = parsed.data;
  const nights = futureOnly(parsed.data.dates);
  if (!nights) return fail(w.past);

  const owned = await ownedRoom(roomTypeId);
  if (!owned.ok) return owned.result;
  if (!owned.planIds.includes(ratePlanId)) return fail(w.notYours);

  const got = await session();
  if (!got.ok) return got.result;
  const db = got.s.supabase;

  const { error } =
    rateMinor === null
      ? await db.from("rate_calendar").update({ rate_minor: null }).eq("rate_plan_id", ratePlanId).in("date", nights)
      : await db
          .from("rate_calendar")
          .upsert(
            nights.map((date) => ({ rate_plan_id: ratePlanId, date, rate_minor: rateMinor })),
            { onConflict: "rate_plan_id,date" },
          );
  if (error) return fail(error.code === "42501" ? w.notYours : w.serviceDown);

  refresh();
  return ok({ nights: nights.length });
}

/**
 * Close or reopen nights for a whole room type: every rate plan it has, so a
 * guest cannot reach a closed night through a second plan.
 *
 * Closing is `rate_calendar.closed`, not zero rooms, and that is deliberate:
 * the database refuses fewer rooms open than are already booked, so a night
 * with one room held could never be closed by zeroing it. A closed rate stops
 * new requests (`booking_dates_blocked`) and leaves the ones already made
 * exactly as they were.
 */
export async function setNightsClosed(input: unknown): Promise<ActionResult<{ nights: number }>> {
  const w = await words();
  const parsed = validate(closeSchema(w), input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const { roomTypeId, closed } = parsed.data;
  const nights = futureOnly(parsed.data.dates);
  if (!nights) return fail(w.past);

  const owned = await ownedRoom(roomTypeId);
  if (!owned.ok) return owned.result;
  if (owned.planIds.length === 0) {
    return fail(w.noRateToClose);
  }

  const got = await session();
  if (!got.ok) return got.result;
  const db = got.s.supabase;
  /* C2b: a closure carries its source. The host's part is `host_closed`
     (the database keeps `closed = host_closed or import_closed`), so a host
     closing a night another site already holds still records the host's
     choice, and reopening never lifts the other site's hold. A database
     before the C2b migration has no such column: write `closed` alone. */
  const write = (withSource: boolean) => {
    const own = (value: boolean) => (withSource ? { closed: value, host_closed: value } : { closed: value }) as { closed: boolean };
    return closed
      ? db.from("rate_calendar").upsert(
          owned.planIds.flatMap((id) => nights.map((date) => ({ rate_plan_id: id, date, ...own(true) }))),
          { onConflict: "rate_plan_id,date" },
        )
      : db.from("rate_calendar").update(own(false)).in("rate_plan_id", owned.planIds).in("date", nights);
  };
  let { error } = await write(true);
  if (error && (error.code === "42703" || error.code === "PGRST204")) ({ error } = await write(false));
  if (error) return fail(error.code === "42501" ? w.notYours : w.serviceDown);

  refresh();
  return ok({ nights: nights.length });
}

/** How many rooms of this type are on sale across some nights. */
export async function setNightsRooms(input: unknown): Promise<ActionResult<{ nights: number; heldBack: number }>> {
  const w = await words();
  const parsed = validate(roomsSchema(w), input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const { roomTypeId, unitsOpen } = parsed.data;
  const nights = futureOnly(parsed.data.dates);
  if (!nights) return fail(w.past);

  const owned = await ownedRoom(roomTypeId);
  if (!owned.ok) return owned.result;
  if (unitsOpen > owned.unitsTotal) {
    return fail(fill(w.roomsOverTotal, { total: owned.unitsTotal, open: unitsOpen }), {
      unitsOpen: fill(w.atMost, { total: owned.unitsTotal }),
    });
  }

  const got = await session();
  if (!got.ok) return got.result;
  const { error } = await got.s.supabase.from("room_inventory").upsert(
    nights.map((date) => ({ room_type_id: roomTypeId, date, units_open: unitsOpen })),
    { onConflict: "room_type_id,date" },
  );
  if (error) {
    if (error.code === "42501") return fail(w.notYours);
    if (error.code === "23514") {
      if (/cannot be offered/i.test(error.message ?? "")) {
        return fail(w.moreRoomsThanType);
      }
      return fail(w.bookedOverOpen, { unitsOpen: w.fewerThanBooked });
    }
    return fail(w.serviceDown);
  }

  /* C2b: rooms another site holds stay off sale whatever is asked; the
     database clamps the write and says how many it held back. Read it so the
     host is told, rather than shown a number that did not land. A database
     without the column (before the C2b migration) holds nothing back. */
  const { data: heldRows } = await (got.s.supabase as unknown as {
    from: (t: string) => { select: (c: string) => { eq: (c: string, v: string) => { in: (c: string, v: string[]) => PromiseLike<{ data: unknown }> } } };
  })
    .from("room_inventory")
    .select("date, units_held_back")
    .eq("room_type_id", roomTypeId)
    .in("date", nights);
  const heldBack = Array.isArray(heldRows)
    ? (heldRows as { units_held_back?: number }[]).filter((r) => (r.units_held_back ?? 0) > 0).length
    : 0;

  refresh();
  return ok({ nights: nights.length, heldBack });
}

/**
 * Edit a rate plan's own nightly rate and its stay lengths, including on a
 * room already on the shelf.
 *
 * WHAT CHANGES AND WHAT DOES NOT. New requests are priced from the new rate
 * (and from any night's own price, which still wins). A request already made
 * keeps the total it was made at: the pricing trigger fires on the booking's
 * own columns, not on this row. The shelf's "from" price follows through
 * `catalogue_on_rate_plan`.
 */
export async function updateRatePlan(input: unknown): Promise<ActionResult<null>> {
  const w = await words();
  const parsed = validate(planSchema(w), input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const { ratePlanId, rateMinor, minStayNights, maxStayNights } = parsed.data;

  const got = await session();
  if (!got.ok) return got.result;
  const { data, error } = await got.s.supabase
    .from("rate_plans")
    .update({ rate_minor: rateMinor, min_stay_nights: minStayNights, max_stay_nights: maxStayNights })
    .eq("id", ratePlanId)
    .select("id")
    .maybeSingle();
  if (error) return fail(error.code === "42501" ? w.notYours : w.serviceDown);
  if (!data) return fail(w.notYours);

  refresh();
  revalidatePath("/host");
  return ok(null);
}
