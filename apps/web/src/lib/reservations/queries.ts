import "server-only";
import { reportReadError } from "@/lib/observability/read-error";

import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveSession } from "../actions/session";
import { flagIsOn } from "../flags/read";
import { RESTAURANT_DEPOSITS_FLAG } from "./deposits";
import type { Database } from "../supabase/database.types";
import type { ReservationStatus } from "./db";
import { readBill, readSeating, type BillView, type SeatingView } from "./seating";
import { billPayOn } from "./bill-pay";
import type { GuestRecord } from "./guest-record";

/**
 * Read side of restaurant reservations.
 *
 * Every read goes through the caller's own RLS-bound client and asks; the
 * policies answer. A guest's client returns their own tables and nothing
 * else (`reservations_select_own`); a host's returns the tables at the
 * restaurants they own, through the listing-agent join or the business-owner
 * helper. Nothing here needs the service role and nothing here re-implements
 * who may see what.
 *
 * Both readers degrade to a renderable answer: null when nobody is signed in
 * (the trips page keeps its signed-out rendering), "unavailable" when the
 * read itself failed, because a dropped read is not an empty account (the
 * lesson `getMyBookings` learned the hard way).
 */

/** The TripSpine-ready shape the ledger's contract names (section 2.1). */
export type ReservationView = {
  id: string;
  /** The restaurant listing, or null when the table is at a business (M7). */
  listingId: string | null;
  businessId: string | null;
  listingTitle: string;
  /** Where it is, "Victoria Island, Lagos", or empty. */
  location: string;
  /** ISO instant of the table. */
  reservedFor: string;
  partySize: number;
  status: ReservationStatus;
  note: string | null;
  respondedAt: string | null;
  /** The thread attached to this table, once reserveTable opened it. */
  conversationId: string | null;
  /** True while the guest may still call it off. */
  cancellable: boolean;
  /**
   * D75: the table deposit, when the restaurant asks for one and
   * `restaurant_deposits` is on. `due` means none is paid yet and the
   * restaurant's rule asks for `amountMinor`; otherwise the deposit's own
   * status (paid, applied, forfeited, refund_due, refunded, pending).
   */
  deposit?: DepositView | null;
  /**
   * Founder decision D: the check-in code and how the table ended, the bill
   * paid through Vallo, and whether the diner reviewed it. Absent until
   * migration 20261013100000 is applied.
   */
  seating?: SeatingView | null;
  bill?: BillView | null;
  reviewed?: boolean;
  /** Whether a bill can be paid through Vallo now (`restaurant_bill_pay`, `bill-pay.ts`). */
  billPay?: boolean;
};

/**
 * A table's deposit as the guest and the venue read it. `venueShareMinor` is
 * the part that reaches the venue's bank (the deposit less Vallo's
 * commission), once a charge exists; the quote for a deposit not yet opened
 * carries it too.
 */
export type DepositView = {
  status: string;
  amountMinor: number;
  refundUntil: string | null;
  venueShareMinor?: number | null;
};

/** The host's view of the same row, with the guest named. */
export type HostReservationView = ReservationView & {
  guestId: string;
  guestName: string;
  /** True while the venue still has to answer. */
  awaitingAnswer: boolean;
  /**
   * RESTAURANT-06: how many past tables this diner kept and missed in the
   * last 12 months, on a request still waiting for an answer. Absent for a
   * first-time diner and whenever the read failed (`lib/reservations/guest-record.ts`).
   */
  guestRecord?: GuestRecord | null;
};

export type ReservationsRead<T> = T[] | null | "unavailable";

const COLUMNS =
  "id, listing_id, business_id, guest_id, party_size, reserved_for, status, note, responded_at, conversation_id";

type Venue = { title: string; location: string };

/**
 * Titles and places for the venues these rows point at, in two reads at most.
 * Read through the same client, so a venue the caller may not see (a listing
 * taken down since) falls back to a plain word rather than leaking.
 */
async function readVenues(
  supabase: SupabaseClient<Database>,
  listingIds: string[],
  businessIds: string[],
): Promise<{ listings: Map<string, Venue>; businesses: Map<string, Venue> }> {
  const listings = new Map<string, Venue>();
  const businesses = new Map<string, Venue>();
  const place = (area: string | null, city: string | null) =>
    [area ?? "", city ?? ""].filter((part) => part.length > 0).join(", ");

  const [listingRead, businessRead] = await Promise.all([
    listingIds.length > 0
      ? supabase.from("listings").select("id, title, area, city").in("id", listingIds)
      : Promise.resolve({ data: [] as { id: string; title: string; area: string | null; city: string | null }[] }),
    businessIds.length > 0
      ? supabase.from("businesses").select("id, name, area, city").in("id", businessIds)
      : Promise.resolve({ data: [] as { id: string; name: string; area: string | null; city: string | null }[] }),
  ]);
  for (const row of listingRead.data ?? []) {
    listings.set(row.id, { title: row.title, location: place(row.area, row.city) });
  }
  for (const row of businessRead.data ?? []) {
    businesses.set(row.id, { title: row.name, location: place(row.area, row.city) });
  }
  return { listings, businesses };
}

function toView(
  row: {
    id: string;
    listing_id: string | null;
    business_id: string | null;
    party_size: number;
    reserved_for: string;
    status: ReservationStatus;
    note: string | null;
    responded_at: string | null;
    conversation_id: string | null;
  },
  venues: { listings: Map<string, Venue>; businesses: Map<string, Venue> },
  now: Date,
): ReservationView {
  const venue =
    (row.listing_id ? venues.listings.get(row.listing_id) : null) ??
    (row.business_id ? venues.businesses.get(row.business_id) : null) ??
    null;
  return {
    id: row.id,
    listingId: row.listing_id,
    businessId: row.business_id,
    listingTitle: venue?.title ?? "Restaurant",
    location: venue?.location ?? "",
    reservedFor: row.reserved_for,
    partySize: row.party_size,
    status: row.status,
    note: row.note,
    respondedAt: row.responded_at,
    conversationId: row.conversation_id,
    // The action refuses a cancel on a CANCELLED row; a table whose moment has
    // passed is a record, not a plan, so the control is not offered either.
    cancellable:
      (row.status === "PENDING" || row.status === "CONFIRMED") &&
      Date.parse(row.reserved_for) > now.getTime(),
  };
}

/**
 * The signed-in person's own tables, newest moment first, for `/trips` and
 * `/bookings`. Null when nobody is signed in.
 */
export async function getMyReservations(now: Date = new Date()): Promise<ReservationsRead<ReservationView>> {
  const session = await resolveSession();
  if (session.state !== "signed-in") return null;
  const supabase = session.supabase;

  const { data: rows, error } = await supabase
    .from("reservations")
    .select(COLUMNS)
    .eq("guest_id", session.user.id)
    .order("reserved_for", { ascending: false })
    .limit(100);
  await reportReadError("read.reservations.getMyReservations", error);
  if (error || !rows) return "unavailable";
  if (rows.length === 0) return [];

  const venues = await readVenues(
    supabase,
    [...new Set(rows.map((r) => r.listing_id).filter((id): id is string => Boolean(id)))],
    [...new Set(rows.map((r) => r.business_id).filter((id): id is string => Boolean(id)))],
  );
  const views = await withSeating(
    supabase as unknown as SupabaseClient,
    rows.map((row) => toView(row, venues, now)),
    session.user.id,
  );
  if (!(await flagIsOn(RESTAURANT_DEPOSITS_FLAG))) return views;
  return withDeposits(supabase as unknown as SupabaseClient, views, now);
}

/**
 * Founder decision D: each table's seating, bill and (for the diner) review,
 * read under the caller's own RLS. Before migration 20261013100000 the reads
 * fail and the views are returned exactly as they were.
 */
async function withSeating<T extends ReservationView>(
  db: SupabaseClient,
  views: T[],
  authorId: string | null,
): Promise<T[]> {
  if (views.length === 0) return views;
  try {
    const ids = views.map((v) => v.id);
    const [seatRead, billRead, reviewRead, billPay] = await Promise.all([
      db.from("reservation_seatings").select("*").in("reservation_id", ids),
      db.from("restaurant_bills").select("*").in("reservation_id", ids).neq("status", "cancelled"),
      authorId
        ? db.from("reservation_reviews").select("reservation_id").in("reservation_id", ids).eq("author_id", authorId)
        : Promise.resolve({ data: [] as { reservation_id: string }[], error: null }),
      billPayOn(),
    ]);
    await reportReadError("read.reservations.seatings", seatRead.error);
    await reportReadError("read.reservations.bills", billRead.error);
    await reportReadError("read.reservations.reviews", reviewRead.error);
    if (seatRead.error) return views;
    const seats = new Map<string, SeatingView>();
    for (const row of (seatRead.data ?? []) as unknown[]) {
      const seat = readSeating(row);
      if (seat) seats.set(seat.reservationId, seat);
    }
    const bills = new Map<string, BillView>();
    for (const row of (billRead.error ? [] : (billRead.data ?? [])) as unknown[]) {
      const bill = readBill(row);
      if (bill) bills.set(bill.reservationId, bill);
    }
    const reviewed = new Set(
      ((reviewRead.error ? [] : (reviewRead.data ?? [])) as { reservation_id: string }[]).map((r) => r.reservation_id),
    );
    return views.map((v) => ({
      ...v,
      seating: seats.get(v.id) ?? null,
      bill: bills.get(v.id) ?? null,
      reviewed: reviewed.has(v.id),
      billPay,
    }));
  } catch {
    return views;
  }
}

/**
 * D75: each table's deposit, read under the caller's own RLS: the guest's
 * (`reservation_deposits_guest_read`) or the venue's (`_venue_read`, the
 * payee). An open table with no deposit yet asks the database whether the
 * restaurant's rule wants one (`reservation_deposit_quote_for`, which answers
 * the guest or the owner and nobody else), all at once rather than one by
 * one. Any failed read leaves the views exactly as they were.
 */
async function withDeposits<T extends ReservationView>(db: SupabaseClient, views: T[], now: Date = new Date()): Promise<T[]> {
  if (views.length === 0) return views;
  try {
    const ids = views.map((v) => v.id);
    const { data, error } = await db
      .from("reservation_deposits")
      .select("reservation_id, status, amount_minor, lister_share_minor, refund_until, created_at")
      .in("reservation_id", ids)
      .order("created_at", { ascending: false });
    if (error) {
      await reportReadError("read.reservations.deposits", error);
      return views;
    }
    const latest = new Map<string, DepositView>();
    for (const row of (data ?? []) as {
      reservation_id: string;
      status: string;
      amount_minor: number;
      lister_share_minor: number | null;
      refund_until: string | null;
    }[]) {
      if (row.status === "failed" || row.status === "abandoned" || latest.has(row.reservation_id)) continue;
      latest.set(row.reservation_id, {
        status: row.status,
        amountMinor: Number(row.amount_minor),
        refundUntil: row.refund_until,
        venueShareMinor: row.lister_share_minor === null ? null : Number(row.lister_share_minor),
      });
    }
    /* No deposit yet on an open table: does the restaurant's rule ask for one? */
    const open = views.filter(
      (v) =>
        !latest.has(v.id) &&
        v.businessId !== null &&
        (v.status === "PENDING" || v.status === "CONFIRMED") &&
        Date.parse(v.reservedFor) > now.getTime(),
    );
    const quotes = await Promise.all(
      open.map(async (v) => {
        const { data: q } = await db.rpc("reservation_deposit_quote_for", { p_reservation: v.id });
        return [v.id, (q ?? {}) as { status?: string; amount_minor?: number; refund_until?: string; lister_share_minor?: number }] as const;
      }),
    );
    for (const [id, quote] of quotes) {
      if (quote.status !== "ok") continue;
      latest.set(id, {
        status: "due",
        amountMinor: Number(quote.amount_minor),
        refundUntil: quote.refund_until ?? null,
        venueShareMinor: Number.isFinite(Number(quote.lister_share_minor)) ? Number(quote.lister_share_minor) : null,
      });
    }
    return views.map((v) => ({ ...v, deposit: latest.get(v.id) ?? null }));
  } catch {
    return views;
  }
}

/** How far back the host desk reads: the bill window plus the days a mark is still asked for. */
export const HOST_DESK_LOOKBACK_DAYS = 30;
/** The live part of the desk: the last three days (bills, marks), today and everything ahead. */
const HOST_DESK_LIVE_FROM_MS = 3 * 24 * 3_600_000;
const HOST_DESK_LIVE_LIMIT = 300;
const HOST_DESK_EARLIER_LIMIT = 60;

/**
 * The tables at the restaurants this person hosts, for the host table desk.
 * The policies decide which restaurants are theirs.
 *
 * TWO READS, BECAUSE ONE WAS WRONG. This used to be one read, oldest first,
 * capped at 200 rows, with no lower bound: a venue past its 200th table saw
 * the oldest 200 and never the new requests at all, which is the one row a
 * desk exists to show. Now the live part (from three days ago onward, soonest
 * first) and the recent past (the rest of the last 30 days, newest first) are
 * read separately, each with its own cap, so history can never crowd out
 * tonight.
 *
 * The guest's name is left as a plain word here. `profiles` is select-own, so
 * a read through the caller's client returns no name for a guest; the board
 * (`app/host/reservations/board.ts`) resolves names for the ids these reads
 * hand back.
 */
export async function getHostReservations(
  now: Date = new Date(),
): Promise<ReservationsRead<HostReservationView>> {
  const session = await resolveSession();
  if (session.state !== "signed-in") return null;
  const supabase = session.supabase;

  const liveFrom = new Date(now.getTime() - HOST_DESK_LIVE_FROM_MS).toISOString();
  const earliest = new Date(now.getTime() - HOST_DESK_LOOKBACK_DAYS * 24 * 3_600_000).toISOString();
  const [live, earlier] = await Promise.all([
    supabase
      .from("reservations")
      .select(COLUMNS)
      .neq("guest_id", session.user.id)
      .gte("reserved_for", liveFrom)
      .order("reserved_for", { ascending: true })
      .limit(HOST_DESK_LIVE_LIMIT),
    supabase
      .from("reservations")
      .select(COLUMNS)
      .neq("guest_id", session.user.id)
      .lt("reserved_for", liveFrom)
      .gte("reserved_for", earliest)
      .order("reserved_for", { ascending: false })
      .limit(HOST_DESK_EARLIER_LIMIT),
  ]);
  await reportReadError("read.reservations.getHostReservations", live.error, earlier.error);
  /* The live read is the desk; without it there is nothing honest to show.
     A failed history read only leaves the Earlier list short. */
  if (live.error || !live.data) return "unavailable";
  const rows = [...live.data, ...(earlier.error ? [] : (earlier.data ?? []))];
  if (rows.length === 0) return [];

  const venues = await readVenues(
    supabase,
    [...new Set(rows.map((r) => r.listing_id).filter((id): id is string => Boolean(id)))],
    [...new Set(rows.map((r) => r.business_id).filter((id): id is string => Boolean(id)))],
  );

  const seated = await withSeating(
    supabase as unknown as SupabaseClient,
    rows.map((row) => ({
      ...toView(row, venues, now),
      guestId: row.guest_id,
      guestName: "A guest",
      awaitingAnswer: row.status === "PENDING" && Date.parse(row.reserved_for) > now.getTime(),
    })),
    null,
  );
  /* D75: the venue reads each table's deposit too, so a request whose
     deposit is unpaid says so beside Confirm. Off, nothing is read. */
  if (!(await flagIsOn(RESTAURANT_DEPOSITS_FLAG))) return seated;
  return withDeposits(supabase as unknown as SupabaseClient, seated, now);
}
