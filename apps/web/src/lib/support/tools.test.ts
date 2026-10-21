import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { SessionState } from "../actions/session";
import type { Database } from "../supabase/database.types";

/**
 * The support agent's tools, held to the two promises they exist for.
 *
 * ONE: a tool never states something it did not read. The whole class of bug
 * this suite is written against is a read that failed arriving at the reader as
 * a fact about their account: "you have no bookings", "you have paid nothing",
 * "your balance is zero". Every guard below picks at that seam, because it is
 * the one where being wrong costs somebody money rather than a page view.
 *
 * TWO: a tool degrades rather than throws. A tool call happens halfway through
 * a streamed sentence, so an exception is not a failed lookup, it is a dead
 * conversation.
 *
 * `fileSupportTicket` is mocked because it is the one write, and a test that
 * files real tickets is a test nobody runs twice.
 */

const fileSupportTicket = vi.fn();
vi.mock("./actions", () => ({
  fileSupportTicket: (input: unknown) => fileSupportTicket(input),
}));

const { __testing, runSupportTool } = await import("./tools");

/* --------------------------------------------------------------- fake reads */

type QueryResult = { data?: unknown; error?: unknown };

/**
 * A Supabase client that answers from a script.
 *
 * Keyed by table, and an array of results is consumed one per `from()` call,
 * which is what lets a single test give two reads of one table two different
 * answers. Every builder method returns the
 * same object and the object is thenable, so it satisfies both shapes the tools
 * use: `await client.from(t).select().eq()` and `.maybeSingle()`.
 */
function fakeDb(tables: Record<string, QueryResult | QueryResult[]>): SupabaseClient<Database> {
  const calls = new Map<string, number>();
  const empty: QueryResult = {};
  const client = {
    from(table: string) {
      const configured = tables[table];
      const index = calls.get(table) ?? 0;
      calls.set(table, index + 1);
      const picked: QueryResult = Array.isArray(configured)
        ? (configured[Math.min(index, configured.length - 1)] ?? empty)
        : (configured ?? empty);
      const settle = () => ({ data: picked.data ?? null, error: picked.error ?? null });

      const chain: Record<string, unknown> = {};
      for (const method of ["select", "eq", "in", "order", "limit", "gte", "lte", "neq", "or"]) {
        chain[method] = () => chain;
      }
      chain.maybeSingle = () => Promise.resolve(settle());
      chain.single = () => Promise.resolve(settle());
      chain.then = (onDone: (value: unknown) => unknown, onFail?: (reason: unknown) => unknown) =>
        Promise.resolve(settle()).then(onDone, onFail);
      return chain;
    },
  };
  return client as unknown as SupabaseClient<Database>;
}

/** A client that falls over the moment it is touched. */
function brokenDb(): SupabaseClient<Database> {
  return {
    from() {
      throw new Error("connection reset");
    },
  } as unknown as SupabaseClient<Database>;
}

function signedIn(
  supabase: SupabaseClient<Database>,
  user: Record<string, unknown> = {},
): SessionState {
  return {
    state: "signed-in",
    supabase,
    user: {
      id: "guest-1",
      email: "ada@example.com",
      user_metadata: {},
      ...user,
    } as unknown as User,
  };
}

function record(value: unknown): Record<string, unknown> {
  expect(value === null || typeof value !== "object").toBe(false);
  return value as Record<string, unknown>;
}

function rows(value: unknown): Record<string, unknown>[] {
  expect(Array.isArray(value)).toBe(true);
  return value as Record<string, unknown>[];
}

/** Every fact in a tool result, flattened, for "this word must not appear". */
function said(value: unknown): string {
  return JSON.stringify(value);
}

const PERSONAL = [
  "my_bookings",
  "my_agreements",
  "booking_policy",
  "my_tickets",
  "my_messages",
  "my_account",
];

const FUTURE_STAY = {
  id: "b-1",
  listing_id: "l-1",
  check_in: "2026-09-01",
  check_out: "2026-09-04",
  nights: 3,
  adults: 2,
  children: 0,
  total_minor: 1_234_567,
  currency: "NGN",
  status: "CONFIRMED",
};

const LISTING = { id: "l-1", title: "Sea view flat", area: "Lekki", city: "Lagos" };

beforeEach(() => {
  fileSupportTicket.mockReset();
  fileSupportTicket.mockResolvedValue({ ok: true, data: { reference: "VAL-SUP-00042" } });
  // Fixed so "today" and the refund schedule's clock are the same in every run.
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-07T09:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

/* --------------------------------------------------------------- the guards */

describe("who is allowed to ask", () => {
  it("refuses every personal tool for a signed-out caller and offers sign in", async () => {
    for (const name of PERSONAL) {
      const out = await runSupportTool(name, { bookingId: "b-1" }, { state: "signed-out" });
      expect(record(out.result).available, name).toBe(false);
      expect(out.actions?.[0]?.kind, name).toBe("sign-in");
    }
  });

  it("tells an unconfigured instance apart from a signed-out person", async () => {
    /* Both used to answer "they are not signed in, offer sign in", which sends
       somebody to a sign-in form that cannot work either. */
    for (const name of PERSONAL) {
      const out = await runSupportTool(name, {}, { state: "unconfigured" });
      const reason = String(record(out.result).reason);
      expect(record(out.result).available, name).toBe(false);
      expect(reason, name).toMatch(/database is not connected/i);
      expect(reason, name).toMatch(/do not offer sign in/i);
      expect(out.actions, name).toBeUndefined();
    }
  });

  it("answers the help search without any session at all", async () => {
    const out = await runSupportTool("search_help", { query: "how do I cancel" }, { state: "signed-out" });
    expect(rows(record(out.result).matches).length).toBeGreaterThan(0);
  });

  it("says so plainly when the help notes do not cover it", async () => {
    const out = await runSupportTool("search_help", { query: "zzzzz" }, { state: "signed-out" });
    expect(rows(record(out.result).matches)).toEqual([]);
    expect(String(record(out.result).note)).toMatch(/do not invent/i);
  });

  it("names an unknown tool instead of throwing", async () => {
    const out = await runSupportTool("delete_everything", {}, { state: "signed-out" });
    expect(String(record(out.result).error)).toContain("delete_everything");
  });

  it("degrades rather than throwing when the database falls over mid-turn", async () => {
    for (const name of PERSONAL) {
      const out = await runSupportTool(name, { bookingId: "b-1" }, signedIn(brokenDb()));
      expect(record(out.result).available, name).toBe(false);
      expect(String(record(out.result).reason), name).toMatch(/could not be read/i);
    }
  });
});

/* ------------------------------------------------------------- my_bookings */

describe("my_bookings", () => {
  it("never reports a failed read as an empty account", async () => {
    const session = signedIn(fakeDb({ bookings: { error: { message: "timeout" } } }));
    const out = await runSupportTool("my_bookings", {}, session);
    const reason = String(record(out.result).reason);
    expect(reason).toMatch(/could not be read/i);
    expect(reason).toMatch(/do not say it is empty/i);
    expect(record(out.result).bookings).toBeUndefined();
  });

  it("says an empty account is empty, and says it is the read", async () => {
    const session = signedIn(fakeDb({ bookings: { data: [] } }));
    const out = await runSupportTool("my_bookings", {}, session);
    expect(rows(record(out.result).bookings)).toEqual([]);
    expect(String(record(out.result).note)).toMatch(/no bookings on it/i);
  });

  it("gives kobo-exact naira and never a bare number for money", async () => {
    const session = signedIn(
      fakeDb({
        bookings: { data: [FUTURE_STAY] },
        listings: { data: [LISTING] },
        transactions: { data: [{ booking_id: "b-1", amount_minor: 1_234_567, status: "SUCCESSFUL" }] },
      }),
    );
    const out = await runSupportTool("my_bookings", {}, session);
    const booking = rows(record(out.result).bookings)[0] ?? {};
    expect(booking.total).toBe("₦12,345.67");
    expect(booking.paid).toBe("₦12,345.67");
    expect(booking.listing).toBe("Sea view flat");
    expect(booking.where).toBe("Lekki, Lagos");
    // A written date with the year on it, never the raw column, which a model
    // will happily read back to a Nigerian reader in the wrong order.
    expect(String(booking.dates)).toMatch(/^Tue,? 1 Sept? 2026 to Fri,? 4 Sept? 2026$/);
    expect(String(booking.dates)).not.toContain("2026-09-01");
    expect(said(out.result)).not.toContain("1234567");
  });

  it("does not offer the app's cancel button on a stay that has been paid for", async () => {
    /* The trips hub calls a paid future stay cancellable and the cancel action
       then refuses it, because a paid cancellation is a person's decision. The
       agent used to read the first and send people at a button that says no. */
    const session = signedIn(
      fakeDb({
        bookings: { data: [FUTURE_STAY] },
        listings: { data: [LISTING] },
        transactions: { data: [{ booking_id: "b-1", amount_minor: 1_234_567, status: "SUCCESSFUL" }] },
      }),
    );
    const out = await runSupportTool("my_bookings", {}, session);
    const booking = rows(record(out.result).bookings)[0] ?? {};
    expect(booking.cancelInApp).toBe(false);
    expect(String(rows(booking.nextSteps)[0] ?? "")).toMatch(/by a person/i);
  });

  it("does offer it on an unpaid hold, and calls the hold what it is", async () => {
    const session = signedIn(
      fakeDb({
        bookings: { data: [{ ...FUTURE_STAY, status: "PENDING" }] },
        listings: { data: [LISTING] },
        transactions: { data: [] },
      }),
    );
    const out = await runSupportTool("my_bookings", {}, session);
    const booking = rows(record(out.result).bookings)[0] ?? {};
    expect(booking.cancelInApp).toBe(true);
    expect(String(booking.paid)).toMatch(/nothing yet/i);
  });

  it("says paid is unknown, never zero, when the payment read fails", async () => {
    const session = signedIn(
      fakeDb({
        bookings: { data: [FUTURE_STAY] },
        listings: { data: [LISTING] },
        transactions: { error: { message: "denied" } },
      }),
    );
    const out = await runSupportTool("my_bookings", {}, session);
    const booking = rows(record(out.result).bookings)[0] ?? {};
    expect(String(booking.paid)).toMatch(/unknown/i);
    expect(String(booking.paid)).not.toMatch(/₦0/);
    // Unknown is not permission to promise the button either.
    expect(booking.cancelInApp).toBe(false);
  });

  it("counts only successful payments towards what was paid", async () => {
    const session = signedIn(
      fakeDb({
        bookings: { data: [FUTURE_STAY] },
        listings: { data: [LISTING] },
        transactions: {
          data: [
            { booking_id: "b-1", amount_minor: 1_234_567, status: "FAILED" },
            { booking_id: "b-1", amount_minor: 1_234_567, status: "PENDING" },
          ],
        },
      }),
    );
    const out = await runSupportTool("my_bookings", {}, session);
    const booking = rows(record(out.result).bookings)[0] ?? {};
    expect(String(booking.paid)).toMatch(/nothing yet/i);
  });

  it("carries a refund that has already been decided", async () => {
    const session = signedIn(
      fakeDb({
        bookings: { data: [{ ...FUTURE_STAY, status: "CANCELLED" }] },
        listings: { data: [LISTING] },
        transactions: { data: [{ booking_id: "b-1", amount_minor: 1_234_567, status: "SUCCESSFUL" }] },
        booking_refunds: {
          data: [{ booking_id: "b-1", refund_minor: 1_234_567, created_at: "2026-08-01T10:30:00Z" }],
        },
      }),
    );
    const out = await runSupportTool("my_bookings", {}, session);
    const booking = rows(record(out.result).bookings)[0] ?? {};
    expect(String(booking.refund)).toContain("₦12,345.67");
    expect(String(booking.refund)).toContain("1 Aug 2026");
  });

  it("offers a review only on a finished stay that has not been reviewed", async () => {
    const past = { ...FUTURE_STAY, check_in: "2026-07-01", check_out: "2026-07-04" };
    const withoutReview = signedIn(
      fakeDb({ bookings: { data: [past] }, listings: { data: [LISTING] }, transactions: { data: [] } }),
    );
    const first = await runSupportTool("my_bookings", {}, withoutReview);
    expect(said(rows(record(first.result).bookings)[0]?.nextSteps)).toMatch(/write a review/i);

    const withReview = signedIn(
      fakeDb({
        bookings: { data: [past] },
        listings: { data: [LISTING] },
        transactions: { data: [] },
        reviews: { data: [{ booking_id: "b-1" }] },
      }),
    );
    const second = await runSupportTool("my_bookings", {}, withReview);
    expect(said(rows(record(second.result).bookings)[0]?.nextSteps)).toMatch(/already reviewed/i);
  });

  it("leaves the listing title null rather than inventing one", async () => {
    const session = signedIn(
      fakeDb({ bookings: { data: [FUTURE_STAY] }, listings: { error: { message: "gone" } } }),
    );
    const out = await runSupportTool("my_bookings", {}, session);
    const booking = rows(record(out.result).bookings)[0] ?? {};
    expect(booking.listing).toBeNull();
    expect(booking.where).toBeNull();
  });
});

/* ----------------------------------------------------------- booking_policy */

describe("booking_policy", () => {
  const paidStay = (checkIn: string) =>
    signedIn(
      fakeDb({
        bookings: { data: [{ ...FUTURE_STAY, check_in: checkIn, check_out: "2026-09-30" }] },
        listings: { data: [LISTING] },
        transactions: { data: [{ booking_id: "b-1", amount_minor: 1_234_567, status: "SUCCESSFUL" }] },
      }),
    );

  it("does not describe a booking that is not theirs", async () => {
    const session = signedIn(fakeDb({ bookings: { data: [FUTURE_STAY] } }));
    const out = await runSupportTool("booking_policy", { bookingId: "somebody-else" }, session);
    expect(record(out.result).found).toBe(false);
    expect(String(record(out.result).note)).toMatch(/never describe a booking you have not read/i);
  });

  it("quotes the full refund outside the deadline, to the kobo", async () => {
    const out = await runSupportTool("booking_policy", { bookingId: "b-1" }, paidStay("2026-09-01"));
    const now = record(record(out.result).ifCancelledNow);
    expect(now.refunded).toBe("₦12,345.67");
    expect(now.keptByHost).toBe("₦0");
    expect(now.tier).toBe("Everything back");
  });

  it("quotes half inside the deadline, splitting the odd kobo the way the desk does", async () => {
    const out = await runSupportTool("booking_policy", { bookingId: "b-1" }, paidStay("2026-08-08"));
    const now = record(record(out.result).ifCancelledNow);
    expect(now.refunded).toBe("₦6,172.84");
    expect(now.keptByHost).toBe("₦6,172.83");
  });

  it("routes a paid stay to a person, never to the button", async () => {
    const out = await runSupportTool("booking_policy", { bookingId: "b-1" }, paidStay("2026-09-01"));
    expect(String(record(out.result).route)).toMatch(/a person/i);
    expect(String(record(out.result).whatHappens)).toMatch(/not cancelled by the button/i);
  });

  it("routes an unpaid hold to Bookings and promises no refund, because none is owed", async () => {
    const session = signedIn(
      fakeDb({
        bookings: { data: [{ ...FUTURE_STAY, status: "PENDING" }] },
        listings: { data: [LISTING] },
        transactions: { data: [] },
      }),
    );
    const out = await runSupportTool("booking_policy", { bookingId: "b-1" }, session);
    expect(String(record(out.result).route)).toMatch(/from Bookings/i);
    expect(record(out.result).ifCancelledNow).toBeUndefined();
    expect(String(record(out.result).whatHappens)).toMatch(/no refund to work out/i);
  });

  it("states no figure at all when it could not read what was paid", async () => {
    const session = signedIn(
      fakeDb({
        bookings: { data: [FUTURE_STAY] },
        listings: { data: [LISTING] },
        transactions: { error: { message: "denied" } },
      }),
    );
    const out = await runSupportTool("booking_policy", { bookingId: "b-1" }, session);
    expect(record(out.result).route).toBe("unknown");
    expect(record(out.result).ifCancelledNow).toBeUndefined();
    expect(record(out.result).schedule).not.toContain("₦");
  });

  it("says a cancelled booking is already cancelled and does not re-offer the schedule", async () => {
    const session = signedIn(
      fakeDb({
        bookings: { data: [{ ...FUTURE_STAY, status: "CANCELLED" }] },
        listings: { data: [LISTING] },
        transactions: { data: [{ booking_id: "b-1", amount_minor: 1_234_567, status: "SUCCESSFUL" }] },
      }),
    );
    const out = await runSupportTool("booking_policy", { bookingId: "b-1" }, session);
    expect(String(record(out.result).whatHappens)).toMatch(/already cancelled/i);
    expect(record(out.result).ifCancelledNow).toBeUndefined();
    expect(String(record(out.result).refundAlready)).toMatch(/no refund decision is recorded/i);
  });

  it("quotes the host's preset frozen on the booking, not the platform schedule", async () => {
    /* A Strict stay: half back until 7 days before check-in, then nothing. On
       the platform schedule this booking (25 days out) would be everything back. */
    const session = signedIn(
      fakeDb({
        bookings: { data: [{ ...FUTURE_STAY, check_in: "2026-09-01", check_out: "2026-09-30" }] },
        listings: { data: [LISTING] },
        transactions: { data: [{ booking_id: "b-1", amount_minor: 1_234_567, status: "SUCCESSFUL" }] },
        booking_cancellation_terms: {
          data: {
            source: "policy:strict-1",
            terms: { check_in_hour: 14, tiers: [{ closes_hours_before: 168, refund_bps: 5_000 }, { closes_hours_before: 0, refund_bps: 0 }] },
            frozen_at: "2026-08-01T10:00:00Z",
          },
        },
      }),
    );
    const out = await runSupportTool("booking_policy", { bookingId: "b-1" }, session);
    const now = record(record(out.result).ifCancelledNow);
    expect(now.tier).toBe("50% back");
    expect(now.refunded).toBe("₦6,172.84");
    expect(now.keptByHost).toBe("₦6,172.83");
    const schedule = rows(record(out.result).schedule);
    expect(schedule.map((step) => step.worth)).toEqual(["₦6,172.84", "₦0"]);
    expect(said(out.result)).not.toMatch(/Everything back/);
  });

  it("publishes the three steps with what each is worth against this stay", async () => {
    const out = await runSupportTool("booking_policy", { bookingId: "b-1" }, paidStay("2026-09-01"));
    const schedule = rows(record(out.result).schedule);
    expect(schedule.length).toBe(3);
    expect(schedule[0]?.worth).toBe("₦12,345.67");
    expect(schedule[2]?.worth).toBe("₦0");
  });
});

/* ----------------------------------------------------------- my_agreements */

describe("my_agreements", () => {
  it("lists the caller's agreements with their status, total and side", async () => {
    const session = signedIn(
      fakeDb({
        deal_agreements: {
          data: [
            {
              id: "a-1",
              kind: "rent",
              status: "rejected",
              amount_minor: 250_000_000,
              renter_id: "guest-1",
              decision_reason: "The move-in date is before the handover date.",
              updated_at: "2026-09-24T23:40:00Z",
            },
          ],
        },
      }),
    );
    const out = await runSupportTool("my_agreements", {}, session);
    const row = rows(record(out.result).agreements)[0] ?? {};
    expect(row.total).toBe("₦2,500,000");
    expect(row.side).toBe("paying side");
    expect(row.sentBackBecause).toMatch(/move-in date/);
    // 23:40 UTC is the following day in Lagos, which is the reader's day.
    expect(String(row.updated)).toMatch(/^25 Sep/);
    expect(String(record(out.result).howMoneyWorks)).toMatch(/never holds your money/i);
  });

  it("says there are none rather than inventing a balance", async () => {
    const session = signedIn(fakeDb({ deal_agreements: { data: [] } }));
    const out = await runSupportTool("my_agreements", {}, session);
    expect(rows(record(out.result).agreements)).toEqual([]);
    expect(said(out.result)).not.toMatch(/balance of|spendable/i);
  });

  it("says it could not read them when the read fails", async () => {
    const session = signedIn(fakeDb({ deal_agreements: { error: { message: "denied" } } }));
    const out = await runSupportTool("my_agreements", {}, session);
    expect(record(out.result).available).toBe(false);
  });
});

describe("my_tickets", () => {
  it("does not read an empty list as never having contacted us", async () => {
    const session = signedIn(fakeDb({ support_tickets: { data: [] } }));
    const out = await runSupportTool("my_tickets", {}, session);
    expect(rows(record(out.result).tickets)).toEqual([]);
    expect(String(record(out.result).note)).toMatch(/without signing in is not attached/i);
  });

  it("reports the reference, the queue clock and whether a person has replied", async () => {
    const session = signedIn(
      fakeDb({
        support_tickets: {
          data: [
            {
              id: "t-1",
              reference: "VAL-SUP-00042",
              topic: "safety",
              status: "open",
              created_at: "2026-08-06T10:00:00Z",
              updated_at: "2026-08-06T10:00:00Z",
            },
          ],
        },
        support_ticket_messages: {
          data: [{ ticket_id: "t-1", sender_role: "admin", created_at: "2026-08-06T12:00:00Z" }],
        },
      }),
    );
    const out = await runSupportTool("my_tickets", {}, session);
    const ticket = rows(record(out.result).tickets)[0] ?? {};
    expect(ticket.reference).toBe("VAL-SUP-00042");
    expect(ticket.answeredBySupport).toBe(true);
    expect(ticket.answeredWithin).toBe("Within 4 hours");
    expect(String(ticket.about)).toMatch(/pay outside Vallo/i);
    expect(ticket.meaning).toBe("filed and waiting to be picked up");
  });

  it("does not call a thread answered when only the person has written in it", async () => {
    const session = signedIn(
      fakeDb({
        support_tickets: {
          data: [
            {
              id: "t-1",
              reference: "VAL-SUP-00043",
              topic: "booking",
              status: "open",
              created_at: "2026-08-06T10:00:00Z",
              updated_at: "2026-08-06T10:00:00Z",
            },
          ],
        },
        support_ticket_messages: {
          data: [{ ticket_id: "t-1", sender_role: "user", created_at: "2026-08-06T10:00:00Z" }],
        },
      }),
    );
    const out = await runSupportTool("my_tickets", {}, session);
    const ticket = rows(record(out.result).tickets)[0] ?? {};
    expect(ticket.answeredBySupport).toBe(false);
    expect(ticket.answeredWithin).toBe("Within 1 day");
  });
});

/* ------------------------------------------------------------- my_messages */

describe("my_messages", () => {
  it("says there are no threads without inventing a conversation", async () => {
    const session = signedIn(fakeDb({ conversations: { data: [] } }));
    const out = await runSupportTool("my_messages", {}, session);
    expect(rows(record(out.result).threads)).toEqual([]);
    expect(String(record(out.result).note)).toMatch(/Message the agent/i);
  });

  it("says who is waiting on whom", async () => {
    const session = signedIn(
      fakeDb({
        conversations: {
          data: [
            {
              id: "c-1",
              guest_id: "guest-1",
              agent_id: "agent-9",
              last_message_at: "2026-08-06T10:00:00Z",
              listings: { title: "Sea view flat" },
            },
          ],
        },
        messages: [
          {
            data: [
              {
                conversation_id: "c-1",
                sender_id: "guest-1",
                body: "Is it still free in September?",
                created_at: "2026-08-06T10:00:00Z",
                read_at: null,
              },
            ],
          },
          { data: [{ conversation_id: "c-1" }] },
        ],
      }),
    );
    const out = await runSupportTool("my_messages", {}, session);
    const thread = rows(record(out.result).threads)[0] ?? {};
    expect(thread.about).toBe("Sea view flat");
    expect(thread.waitingOnTheOtherSide).toBe(true);
    expect(thread.unread).toBe(0);
    // No line of the conversation is carried into the model's context.
    expect(said(out.result)).not.toContain("still free in September");
  });
});

/* -------------------------------------------------------------- my_account */

describe("my_account", () => {
  it("names what is missing rather than filling it in", async () => {
    const session = signedIn(
      fakeDb({
        profiles: {
          data: {
            display_name: "Ada Obi",
            first_name: "Ada",
            surname: "Obi",
            phone: "",
            avatar_url: "",
            created_at: "2026-01-04T08:00:00Z",
            settings: { notifications: { bookings: true, messages: false, wallet: true, marketing: false } },
          },
        },
      }),
    );
    const out = await runSupportTool("my_account", {}, session);
    expect(record(out.result).email).toBe("ada@example.com");
    expect(record(out.result).phoneOnFile).toBe(false);
    expect(rows(record(out.result).missing).join(" ")).toMatch(/phone number/i);
    expect(record(record(out.result).notifications).messages).toBe(false);
    expect(record(out.result).memberSince).toBe("4 Jan 2026, 09:00");
  });

  it("survives a profile row that is not there", async () => {
    const session = signedIn(fakeDb({ profiles: { data: null } }));
    const out = await runSupportTool("my_account", {}, session);
    expect(record(out.result).name).toBeNull();
    expect(rows(record(out.result).missing).join(" ")).toMatch(/profile row/i);
  });
});

/* ------------------------------------------------------------- file_ticket */

describe("file_ticket", () => {
  it("files nothing for a signed-out caller with no name or email", async () => {
    const out = await runSupportTool(
      "file_ticket",
      { topic: "booking", question: "Where is my money?", summary: "Asked for a person." },
      { state: "signed-out" },
    );
    expect(record(out.result).filed).toBe(false);
    expect(fileSupportTicket).not.toHaveBeenCalled();
    expect(out.reference).toBeUndefined();
  });

  it("uses the account's own address for a signed-in caller, whatever it is told", async () => {
    /* It used to prefer the address in the tool call, which turned a ticket
       filed under somebody's real account into an acknowledgement email sent
       from our domain to whatever address the conversation named. */
    const out = await runSupportTool(
      "file_ticket",
      {
        topic: "payment",
        question: "Refund missing",
        summary: "Checked the wallet, nothing there.",
        name: "Someone Else",
        email: "attacker@example.com",
      },
      signedIn(fakeDb({}), { user_metadata: { full_name: "Ada Obi" } }),
    );
    const filed = record(fileSupportTicket.mock.calls[0]?.[0]);
    expect(filed.email).toBe("ada@example.com");
    expect(filed.name).toBe("Ada Obi");
    expect(out.reference).toBe("VAL-SUP-00042");
    expect(record(out.result).answeredWithin).toBe("Within 1 day");
  });

  it("still takes the conversation's address when there is no account", async () => {
    await runSupportTool(
      "file_ticket",
      {
        topic: "safety",
        question: "Agent wants a bank transfer",
        summary: "Asked to pay outside the platform.",
        name: "Bola",
        email: "bola@example.com",
      },
      { state: "signed-out" },
    );
    const filed = record(fileSupportTicket.mock.calls[0]?.[0]);
    expect(filed.email).toBe("bola@example.com");
    expect(filed.topic).toBe("safety");
  });

  it("stores a topic the queue can sort, and falls back to other", async () => {
    await runSupportTool(
      "file_ticket",
      { topic: "Refund not received", question: "q", summary: "s", name: "Bola", email: "b@example.com" },
      { state: "signed-out" },
    );
    expect(record(fileSupportTicket.mock.calls[0]?.[0]).topic).toBe("other");
  });

  it("reports a write that did not happen without inventing a reference", async () => {
    fileSupportTicket.mockResolvedValue({ ok: false, error: "Ticket filing is paused." });
    const out = await runSupportTool(
      "file_ticket",
      { topic: "other", question: "q", summary: "s", name: "Bola", email: "b@example.com" },
      { state: "signed-out" },
    );
    expect(record(out.result).filed).toBe(false);
    expect(out.reference).toBeUndefined();
    expect(String(record(out.result).note)).toMatch(/do not invent a reference/i);
  });

  it("does not take the whole turn down when the ticket write throws", async () => {
    fileSupportTicket.mockRejectedValue(new Error("network"));
    const out = await runSupportTool(
      "file_ticket",
      { topic: "other", question: "q", summary: "s", name: "Bola", email: "b@example.com" },
      { state: "signed-out" },
    );
    expect(record(out.result).available).toBe(false);
  });
});

/* ---------------------------------------------------- the derived judgements */

describe("cancellableInApp", () => {
  const { cancellableInApp } = __testing;

  it("is true only for a live, unpaid, future stay", () => {
    expect(cancellableInApp("PENDING", "2026-09-01", 0, "2026-08-07")).toBe(true);
    expect(cancellableInApp("CONFIRMED", "2026-09-01", 0, "2026-08-07")).toBe(true);
  });

  it("is false once money has moved, or the stay has started, or it is not live", () => {
    expect(cancellableInApp("CONFIRMED", "2026-09-01", 1, "2026-08-07")).toBe(false);
    expect(cancellableInApp("CONFIRMED", "2026-08-07", 0, "2026-08-07")).toBe(false);
    expect(cancellableInApp("CANCELLED", "2026-09-01", 0, "2026-08-07")).toBe(false);
  });

  it("is false when we do not know whether it was paid", () => {
    expect(cancellableInApp("CONFIRMED", "2026-09-01", null, "2026-08-07")).toBe(false);
  });
});
