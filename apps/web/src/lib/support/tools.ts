import "server-only";

import { formatMoney } from "@vallo/i18n/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveWriteSession, type SessionState } from "../actions/session";
import { lagosToday } from "../bookings/schema";
import { loadConversationSummaries, type LiveConversationSummary } from "../messages/live";
import { parseSettings } from "../profile/schema";
import type { Database } from "../supabase/database.types";
import {
  CANCELLATION_STOPS,
  FULL_REFUND_HOURS,
  refundAtStop,
  refundForCancellation,
  refundUnderTerms,
  type CancellationTerms,
} from "../trust/cancellation";
import { readFrozenTerms } from "../after-gate/refunds";
import { RESPONSE_COMMITMENTS } from "../trust/standards";
import { SUPPORT_TOPICS, gradeForTopic, supportTopicLabel, type SupportTopic } from "../trust/support-topics";
import { AGREEMENT_STATUS_LABEL } from "@/components/app/agreements/status";
import { DIRECT_RAIL_STANDING, NO_CUSTODY_SENTENCE, PAYMENT_GATE_SENTENCE } from "../money/copy";
import { searchFaq } from "./faq";
import { fileSupportTicket } from "./actions";
import type { SupportAction } from "./types";

/**
 * The support agent's tools, and the only facts it is allowed to state.
 *
 * Authorisation model, in one sentence: every personal tool runs on the
 * caller's own Row Level Security client, resolved once per request from their
 * auth cookies, and never on the service role. `resolveSession()` hands back
 * that client already bound to the signed-in user, and each read is filtered
 * by the caller's own id on top of RLS, so a tool physically cannot return
 * another person's booking, agreement, ticket or thread. A signed-out caller has
 * no such client, so the personal tools answer "unavailable, offer sign-in"
 * rather than guessing, and the model is told to say exactly that.
 *
 * Two service-role touches exist in the whole feature and both are named here
 * rather than buried. The anonymous ticket insert inside `fileSupportTicket` is
 * a write of the name and email the person just gave, never a read. And
 * `loadConversationSummaries` resolves the counterpart's DISPLAY NAME through
 * the admin client strictly after RLS has already chosen which conversations
 * exist for this caller, exactly as the inbox does, because profiles and agents
 * are select-own tables and a thread with "Vallo member" on every row answers
 * nobody's question about whether their agent replied.
 *
 * THE RULE THAT SHAPES EVERY RETURN BELOW: the model never receives a bare
 * number that is money, and never receives a figure the platform was not told.
 * Amounts are formatted here, in kobo-exact naira, and an amount we could not
 * read comes back as an explicit "unknown" the model is instructed to repeat
 * rather than as a zero. A zero beside a currency symbol reads as "free", and
 * this platform has already had one surface tell people that a listing with no
 * price on it cost nothing.
 */

/* ------------------------------------------------------------------ shapes */

/** Whatever a tool returns is JSON encoded straight into the tool result. */
export type ToolOutcome = {
  /** What the model sees. */
  result: unknown;
  /** Quick actions the surface should offer, because the route exists. */
  actions?: SupportAction[];
  /** Set when a ticket was really written, so the UI can show the receipt. */
  reference?: string;
};

type Db = SupabaseClient<Database>;

/** The one session shape the personal tools can act on. */
type SignedIn = Extract<SessionState, { state: "signed-in" }>;

const SIGN_IN_ACTION: SupportAction = {
  kind: "sign-in",
  label: "Sign in",
  href: "/sign-in",
};

const BOOKINGS_ACTION: SupportAction = {
  kind: "bookings",
  label: "Open my bookings",
  href: "/bookings",
};

const AGREEMENTS_ACTION: SupportAction = {
  kind: "agreements",
  label: "Open my agreements",
  href: "/agreements",
};

const MESSAGES_ACTION: SupportAction = {
  kind: "messages",
  label: "Message the agent",
  href: "/messages",
};

const SIGNED_OUT = {
  available: false,
  reason:
    "This person is not signed in, so their own records cannot be read. Say so plainly and offer sign in. Never guess what their booking or balance might be.",
} as const;

/**
 * Not the same answer as signed out, and telling them apart matters.
 *
 * Every personal tool used to hand back SIGNED_OUT for both, so a caller on an
 * instance with no database keys was told to sign in: an instruction that
 * cannot work, on a screen where the sign-in form cannot work either. The
 * honest version names the state and points at the one path that still runs,
 * which is a ticket to a person.
 */
const UNCONFIGURED = {
  available: false,
  reason:
    "This platform's database is not connected on this instance, so no account records exist to read and signing in cannot help. Say that the records cannot be reached right now, do not offer sign in, and offer to put the question in front of a person instead.",
} as const;

/**
 * The one reply for a read that failed.
 *
 * A failed read and an empty account are the same shape in a database client
 * and the opposite thing to a reader, so they are never allowed to share a
 * sentence: "you have no bookings" is a statement of fact about somebody's
 * account and it must not be what a dropped connection sounds like.
 */
function unreadable(what: string): ToolOutcome {
  return {
    result: {
      available: false,
      reason: `Their ${what} could not be read just now. Say plainly that you could not reach it, do not say it is empty, and offer to try again or to bring in a person.`,
    },
  };
}

/* ------------------------------------------------------------ declarations */

/**
 * The tool set. Seven reads and one write, every one of them scoped to the
 * caller's own record: anything wider would be a way for the model to wander
 * off the person it is talking to.
 */
export const SUPPORT_TOOLS = [
  {
    name: "search_help",
    description:
      "Search Vallo's canonical help notes: how bookings, payments, agreements, listing a property, verification, cancellations, refunds, reviews, reporting, languages, privacy and messaging safety actually work. Call this before answering any question about policy or how the platform works, and answer from what it returns rather than from memory.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The person's question, in their own words.",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "my_bookings",
    description:
      "Read the signed-in caller's own bookings: status, dates, listing, total, what they have actually paid, any refund already decided, and what they can do next on each one. Use it whenever they ask about their stay, their dates, their booking or their money on a booking. Returns unavailable when nobody is signed in.",
    input_schema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "my_agreements",
    description:
      "Read the signed-in caller's own agreements: each rental or stay agreement they are a party to, its status (waiting for the parties, with Vallo for review, approved, sent back with a reason, paid), the total and their side. Use it for questions about paying for a rental, why payment is not open yet, an approval, or a Guarantee claim. No Vallo balance holds a payment, so there is no balance to read. Returns unavailable when nobody is signed in.",
    input_schema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "booking_policy",
    description:
      "For one of the caller's own bookings, say exactly how it can be called off, by whom, and what the cancellation terms fixed on that booking are worth against what they actually paid. Pass the booking id returned by my_bookings. Returns unavailable when nobody is signed in, and not found when the booking is not theirs.",
    input_schema: {
      type: "object",
      properties: {
        bookingId: {
          type: "string",
          description: "The booking id from my_bookings.",
        },
      },
      required: ["bookingId"],
      additionalProperties: false,
    },
  },
  {
    name: "my_tickets",
    description:
      "Read the support tickets the signed-in caller has already filed: reference, subject, status, when it was filed and whether the team has replied. Use it whenever they ask what happened to a ticket, quote a VAL-SUP reference, or say nobody has come back to them. Returns unavailable when nobody is signed in.",
    input_schema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "my_messages",
    description:
      "Read the signed-in caller's own message threads with agents: who the thread is with, which listing it is about, how many messages are unread, and whether the last word was theirs or the other side's. Use it when they say an agent has not replied, or ask where a conversation went. It deliberately returns no message text, so you can say who is waiting without reading anybody's conversation back at them.",
    input_schema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "my_account",
    description:
      "Read the signed-in caller's own account: the email replies go to, their name, whether a phone number is set, when they joined, and which notification channels they have switched on. Use it for questions about which address we write to, why they are not hearing from us, or what is missing from their profile.",
    input_schema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "file_ticket",
    description:
      "Hand the matter to the human support team by filing a real support ticket, and return its VAL-SUP reference and the response time it is now under. Call this when the person asks for a human, or when the matter is money lost, safety, fraud, or an account they cannot get into, or when you genuinely cannot answer. For a signed-out caller you must have their name and email first: ask for both in the conversation, or point them at the Talk to a person control. Never say a ticket exists unless this tool returned a reference.",
    input_schema: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          enum: [...SUPPORT_TOPICS],
          description:
            "Which queue this belongs in. Choose safety for anyone asked to pay outside Vallo, anything unsafe, or money already lost: it carries a four hour response time, and the wrong choice here slows a real person down.",
        },
        question: {
          type: "string",
          description: "What the person asked, in their own words.",
        },
        summary: {
          type: "string",
          description:
            "Three or four sentences for the human picking this up: what they want, what you already checked, and what is still open. No speculation.",
        },
        name: {
          type: "string",
          description: "Their name. Required when nobody is signed in.",
        },
        email: {
          type: "string",
          description:
            "Their email address. Required when nobody is signed in, and ignored when they are, because a signed-in ticket always answers to the address on the account.",
        },
      },
      required: ["topic", "question", "summary"],
      additionalProperties: false,
    },
  },
] as const;

/* ----------------------------------------------------------------- helpers */

function asRecord(input: unknown): Record<string, unknown> {
  return typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Money for a machine to read aloud.
 *
 * The only way an amount reaches the model. Integer kobo in, formatted naira
 * out, so there is no path where the model is handed 12000000 and decides for
 * itself whether that is twelve million naira or a hundred and twenty thousand.
 *
 * Kobo-exact, by the same integer split as `nairaExact` in lib/payments/money:
 * `formatMoney` alone renders whole naira, and half of an odd kobo total is
 * exactly the shape a cancellation refund takes, so rounding here would have
 * the agent quoting a figure fifty kobo away from the one the refund desk pays.
 * Written out rather than imported because support has to carry the booking's
 * own currency and the sign of a balance, neither of which refusal copy needed.
 */
function naira(minor: number, currency = "NGN"): string {
  const whole = Math.trunc(minor);
  const abs = Math.abs(whole);
  const kobo = abs % 100;
  const sign = whole < 0 ? "-" : "";
  const major = formatMoney(abs - kobo, "en", currency);
  return kobo === 0 ? `${sign}${major}` : `${sign}${major}.${String(kobo).padStart(2, "0")}`;
}

/** "Fri 14 Aug 2026" from a date-only booking column. */
const DAY_LABEL = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function dayLabel(iso: string): string {
  // Noon UTC, the same trick the trips hub uses: a date-only column has no
  // instant, and midnight would land on the previous day in some zones.
  const at = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(at.getTime()) ? iso : DAY_LABEL.format(at);
}

/** "14 Aug 2026, 09:14" in Lagos, from a true timestamp column. */
const INSTANT_LABEL = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Lagos",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function instantLabel(iso: string): string {
  const at = new Date(iso);
  // Formatted in Lagos rather than handed over as an ISO instant, because a
  // model given "2026-08-14T23:40:00Z" will read the date off the front of it
  // and tell a Nigerian reader the wrong day for anything after 11pm UTC.
  return Number.isNaN(at.getTime()) ? "" : INSTANT_LABEL.format(at);
}

/* -------------------------------------------------------- the bookings read */

/**
 * What one booking looks like to the model.
 *
 * `paid` is a formatted amount or the word unknown, never a number and never a
 * silent zero: a payments read that failed must not come out the other end as
 * "you have paid nothing", which is how a guest ends up being told their money
 * is not there.
 */
type SupportBooking = {
  id: string;
  listing: string | null;
  where: string | null;
  status: Database["public"]["Enums"]["booking_status"];
  stage: "upcoming" | "staying" | "completed" | "cancelled";
  dates: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  total: string;
  paid: string;
  refund?: string;
  cancelInApp: boolean;
  nextSteps: string[];
};

type BookingContext = {
  bookings: SupportBooking[];
  /** The raw figures the policy tool needs; never handed to the model. */
  money: Map<string, { paidMinor: number | null; currency: string; totalMinor: number }>;
};

const BOOKING_LIMIT = 20;

/**
 * The caller's own trips, read as them, with the money on each one.
 *
 * This deliberately does NOT reuse `getMyBookings` from the trips hub, and the
 * reasons are all correctness rather than taste. That read resolves the session
 * from cookies a second time, which defeats the single resolution this whole
 * feature is built on. It returns an empty group set when the query ERRORS, so
 * a dropped connection arrives here indistinguishable from a person with no
 * bookings, and the tool would state the second as fact. It throws rather than
 * degrading, which takes the entire conversation down with it. And it keeps
 * only a formatted total, when a truthful cancellation answer needs the kobo
 * and needs to know what was actually paid, which lives in `transactions`.
 *
 * Five bounded reads, all on the caller's own client: the bookings, the titles,
 * the successful payments, any refund already decided, and which stays they
 * have reviewed. Everything after the first is best effort, because a missing
 * title is worth less than a missing answer, and each failure narrows what may
 * be said rather than what is returned.
 */
async function readBookings(client: Db, userId: string): Promise<BookingContext | null> {
  const { data: rows, error } = await client
    .from("bookings")
    .select(
      "id, listing_id, check_in, check_out, nights, adults, children, total_minor, currency, status",
    )
    .eq("guest_id", userId)
    .order("check_in", { ascending: false })
    .limit(BOOKING_LIMIT);
  if (error || !rows) return null;

  const ids = rows.map((row) => row.id);
  const listingIds = [...new Set(rows.map((row) => row.listing_id).filter((id): id is string => Boolean(id)))];

  const titles = new Map<string, { title: string; area: string | null; city: string | null }>();
  if (listingIds.length > 0) {
    const { data } = await client.from("listings").select("id, title, area, city").in("id", listingIds);
    for (const row of data ?? []) titles.set(row.id, row);
  }

  // Successful payments per booking. `null` for the whole map when the read
  // failed, so every booking says unknown rather than nothing.
  let paidByBooking: Map<string, number> | null = null;
  if (ids.length > 0) {
    const { data, error: payError } = await client
      .from("transactions")
      .select("booking_id, amount_minor, status")
      .in("booking_id", ids);
    if (!payError) {
      paidByBooking = new Map();
      for (const row of data ?? []) {
        if (row.status !== "SUCCESSFUL") continue;
        paidByBooking.set(row.booking_id, (paidByBooking.get(row.booking_id) ?? 0) + row.amount_minor);
      }
    }
  } else {
    paidByBooking = new Map();
  }

  const refunds = new Map<string, { refundMinor: number; createdAt: string }>();
  if (ids.length > 0) {
    const { data } = await client
      .from("booking_refunds")
      .select("booking_id, refund_minor, created_at")
      .in("booking_id", ids);
    for (const row of data ?? []) {
      refunds.set(row.booking_id, { refundMinor: row.refund_minor, createdAt: row.created_at });
    }
  }

  const reviewed = new Set<string>();
  if (ids.length > 0) {
    const { data } = await client
      .from("reviews")
      .select("booking_id")
      .eq("author_id", userId)
      .in("booking_id", ids);
    for (const row of data ?? []) reviewed.add(row.booking_id);
  }

  const today = lagosToday();
  const bookings: SupportBooking[] = [];
  const money: BookingContext["money"] = new Map();

  for (const row of rows) {
    const listing = row.listing_id ? titles.get(row.listing_id) : undefined;
    const paidMinor = paidByBooking ? (paidByBooking.get(row.id) ?? 0) : null;
    const refund = refunds.get(row.id);
    const stage: SupportBooking["stage"] =
      row.status === "CANCELLED"
        ? "cancelled"
        : row.check_out <= today
          ? "completed"
          : row.check_in <= today
            ? "staying"
            : "upcoming";

    const where = [listing?.area ?? "", listing?.city ?? ""].filter(Boolean).join(", ");

    money.set(row.id, {
      paidMinor,
      currency: row.currency,
      totalMinor: row.total_minor,
    });

    bookings.push({
      id: row.id,
      listing: listing?.title ?? null,
      where: where.length > 0 ? where : null,
      status: row.status,
      stage,
      dates: `${dayLabel(row.check_in)} to ${dayLabel(row.check_out)}`,
      checkIn: row.check_in,
      checkOut: row.check_out,
      nights: row.nights,
      guests: row.adults + row.children,
      total: naira(row.total_minor, row.currency),
      paid:
        paidMinor === null
          ? "unknown, the payment record could not be read"
          : paidMinor === 0
            ? "nothing yet, this stay is still an unpaid hold"
            : naira(paidMinor, row.currency),
      ...(refund
        ? {
            refund: `${naira(refund.refundMinor, row.currency)} was refunded to the card or account they paid with on ${instantLabel(refund.createdAt)}`,
          }
        : {}),
      cancelInApp: cancellableInApp(row.status, row.check_in, paidMinor, today),
      nextSteps: nextStepsFor(row.status, stage, paidMinor, reviewed.has(row.id)),
    });
  }

  return { bookings, money };
}

/**
 * Can the guest still cancel this from the app, honestly?
 *
 * The trips hub's own `cancellable` says yes for any live booking with a
 * future check-in, and the cancel action then refuses a stay that has been paid
 * for, because /cancellations says in plain words that once money has moved a
 * person handles it. The support agent was reading the first and telling guests
 * to press a button that would turn them away, which is worse than saying no:
 * it spends their trust to find out. Unknown payment state answers false, so
 * the agent describes the route that always works rather than promising one
 * that might not.
 */
function cancellableInApp(
  status: string,
  checkIn: string,
  paidMinor: number | null,
  today: string,
): boolean {
  if (status !== "PENDING" && status !== "CONFIRMED") return false;
  if (checkIn <= today) return false;
  return paidMinor === 0;
}

/** What this person can actually DO with this booking, from its real state. */
function nextStepsFor(
  status: string,
  stage: SupportBooking["stage"],
  paidMinor: number | null,
  reviewed: boolean,
): string[] {
  if (status === "CANCELLED") {
    return [
      "Nothing to do on this one. The dates were released and the agent was told when it was cancelled.",
    ];
  }
  if (stage === "completed") {
    return reviewed
      ? ["This stay is finished and they have already reviewed it."]
      : [
          "This stay is finished, so they can write a review of it from Bookings. A stay can be reviewed once.",
        ];
  }
  if (stage === "staying") {
    return [
      "They are in this stay now. If they could not get in, or the place is not what was listed, they should message the agent in the thread first so there is a time stamp, then tell support: do not cancel, because that case is refunded in full once it is confirmed.",
    ];
  }
  if (paidMinor === null) {
    return [
      "The payment record could not be read, so do not tell them whether this is paid for. Offer to check it with a person.",
    ];
  }
  if (paidMinor === 0) {
    return [
      "This stay is an unpaid hold. They can pay it from Bookings to confirm the dates, or call it off from Bookings at any hour for nothing while it is unpaid.",
    ];
  }
  return [
    "This stay is paid for, so cancelling it is done by a person rather than by the button: ask support here and the cancellation terms fixed on the booking decide the amount, which is refunded to the card or account they paid with.",
    "Call booking_policy with this booking id before quoting any figure.",
  ];
}

/* ------------------------------------------------------------------- tools */

/** Canonical policy answers. No personal data, so no session needed. */
function runSearchHelp(input: unknown): ToolOutcome {
  const query = asString(asRecord(input).query);
  const entries = query ? searchFaq(query, 3) : [];
  if (entries.length === 0) {
    return {
      result: {
        matches: [],
        note: "Nothing in the help notes covers this. Do not invent an answer: say plainly that you do not know and offer to hand it to a person.",
      },
    };
  }
  return {
    result: {
      matches: entries.map((entry) => ({ topic: entry.id, answer: entry.answer })),
    },
  };
}

/** The caller's own trips, read as them. */
async function runMyBookings(session: SignedIn): Promise<ToolOutcome> {
  const context = await readBookings(session.supabase, session.user.id);
  if (!context) return unreadable("bookings");

  if (context.bookings.length === 0) {
    return {
      result: {
        bookings: [],
        note: "This account has no bookings on it. That is the read, not a failure: say so plainly, and if they believe they have booked, ask whether they might have used another account.",
      },
      actions: [BOOKINGS_ACTION],
    };
  }
  return {
    result: {
      bookings: context.bookings,
      note: "Quote the amounts exactly as they are written here. Where paid says unknown, say the payment record could not be read rather than naming any figure.",
    },
    actions: [BOOKINGS_ACTION, MESSAGES_ACTION],
  };
}

/**
 * The caller's own agreements, read as them. Track A: Vallo holds no money,
 * so there is no balance to report; what a person wants to know about money
 * is where their agreement stands and whether payment is open.
 */
async function runMyAgreements(session: SignedIn): Promise<ToolOutcome> {
  const { data, error } = await session.supabase
    .from("deal_agreements")
    .select("id, kind, status, amount_minor, renter_id, decision_reason, updated_at")
    .order("updated_at", { ascending: false })
    .limit(10);
  if (error) return unreadable("agreements");
  const rows = data ?? [];
  return {
    result: {
      agreements: rows.map((r) => ({
        id: r.id,
        kind: r.kind === "stay" ? "stay" : "rental",
        status: AGREEMENT_STATUS_LABEL[r.status] ?? r.status,
        total: naira(r.amount_minor, "NGN"),
        side: r.renter_id === session.user.id ? "paying side" : "owner or agent",
        ...(r.status === "rejected" && r.decision_reason ? { sentBackBecause: r.decision_reason } : {}),
        updated: instantLabel(r.updated_at),
      })),
      ...(rows.length === 0 ? { note: "This person has no agreements yet. One is drawn up after an inspection report is submitted, or when a host accepts a stay." } : {}),
      howMoneyWorks: `${NO_CUSTODY_SENTENCE} ${PAYMENT_GATE_SENTENCE} ${DIRECT_RAIL_STANDING}`,
    },
    actions: [AGREEMENTS_ACTION],
  };
}

/**
 * How one of the caller's own bookings can be called off, and what that is
 * worth against what they actually paid.
 *
 * A paid stay is answered from the terms frozen on its booking
 * (`booking_cancellation_terms`, read by `readFrozenTerms`), which is the row
 * the admin refund desk computes from: a host business's preset (Flexible,
 * Moderate, Firm or Strict) or the platform schedule. Only a booking with no
 * frozen row falls back to the platform schedule in `lib/trust/cancellation.ts`.
 * So the agent cannot tell somebody a different story about their own money
 * than the booking and the desk do.
 */
async function runBookingPolicy(session: SignedIn, input: unknown): Promise<ToolOutcome> {
  const bookingId = asString(asRecord(input).bookingId);
  const context = await readBookings(session.supabase, session.user.id);
  if (!context) return unreadable("bookings");

  const booking = context.bookings.find((row) => row.id === bookingId);
  const figures = context.money.get(bookingId);
  if (!booking || !figures) {
    return {
      result: {
        found: false,
        note: "No booking with that id belongs to this person. Ask them to confirm which stay they mean; never describe a booking you have not read.",
      },
      actions: [BOOKINGS_ACTION],
    };
  }

  const { paidMinor, currency } = figures;
  const scheduleNote = `A stay listed by an owner or agent follows Vallo's platform schedule, with the free-cancellation deadline ${FULL_REFUND_HOURS} hours before check-in. A hotel, shortlet or serviced apartment run as a business follows the policy it picked (Flexible, Moderate, Firm or Strict), and the terms are fixed on the booking when it is paid. Deadlines are counted in Lagos time.`;

  if (booking.status === "CANCELLED") {
    return {
      result: {
        booking,
        route: "nothing to cancel",
        whatHappens:
          "This booking is already cancelled, so there is nothing left to call off. The dates were released and the agent was told.",
        ...(booking.refund
          ? { refundAlready: booking.refund }
          : {
              refundAlready:
                "No refund decision is recorded against this booking. If they paid and expect money back, do not guess: bring in a person.",
            }),
      },
      actions: [BOOKINGS_ACTION],
    };
  }

  if (paidMinor === null) {
    // Everything below this line is arithmetic on what they paid. Without that
    // figure there is no honest answer, and inventing a zero would turn "we
    // could not check" into "you are owed nothing".
    return {
      result: {
        booking,
        route: "unknown",
        whatHappens:
          "The payment record for this booking could not be read, so nothing can be said about what cancelling is worth. Say exactly that and offer to bring in a person, who can see it.",
        schedule: scheduleNote,
      },
      actions: [BOOKINGS_ACTION],
    };
  }

  if (paidMinor === 0) {
    return {
      result: {
        booking,
        route: booking.cancelInApp ? "the guest, from Bookings" : "a person on the support team",
        whatHappens: booking.cancelInApp
          ? "Nothing has been paid, so this is a hold on the calendar and nothing more. Cancelling it from Bookings releases the dates immediately, costs nothing, and there is no refund to work out because no money moved."
          : "Nothing has been paid, so there is no money to return. The stay has started or is past, so it can no longer be called off from the app and a person has to look at it.",
        where: "Bookings, then the stay, then Cancel booking.",
        schedule: scheduleNote,
      },
      actions: [BOOKINGS_ACTION],
    };
  }

  // Paid. The amount is decided by the terms frozen on the booking when it was
  // paid (`booking_cancellation_terms`), the row the refund desk reads, so what
  // the agent quotes and what the desk pays are one number. A host business's
  // preset (Flexible, Moderate, Firm, Strict) is frozen there; only a booking
  // with no frozen row falls back to the platform schedule.
  const frozen = await readFrozenTerms(session.supabase, bookingId);
  if (frozen) return bookedTermsAnswer(booking, paidMinor, currency, frozen.terms);
  const outcome = refundForCancellation(paidMinor, booking.checkIn);
  return {
    result: {
      booking,
      route: "a person on the support team",
      whatHappens:
        "This stay is paid for, so it is not cancelled by the button in the app: ask here and a person applies the published schedule, refunds the money to the card or account they paid with, and puts the amount and the reason in writing. Cancellation requests are answered within 1 day, sooner when check-in is close.",
      paid: naira(paidMinor, currency),
      ifCancelledNow: {
        tier: outcome.stop.label,
        refunded: naira(outcome.refundMinor, currency),
        keptByHost: naira(outcome.retainedMinor, currency),
        why: outcome.stop.detail,
      },
      schedule: CANCELLATION_STOPS.map((stop) => ({
        step: stop.label,
        when:
          stop.closesHoursBeforeCheckIn === null
            ? "From the start of check-in day onwards"
            : `More than ${stop.closesHoursBeforeCheckIn} hours before check-in`,
        worth: naira(refundAtStop(stop, paidMinor), currency),
        detail: stop.detail,
      })),
      exceptions:
        "The schedule only governs a cancellation the guest chose. If the host cancelled, the place was not what was listed, or they could not get in, everything comes back whatever the hour. Do not cancel in those cases: report it.",
      note: "Quote these amounts exactly. Never round them and never work out a figure of your own.",
    },
    actions: [BOOKINGS_ACTION],
  };
}

/** "Everything back", "Nothing back", "50% back": a tier's share in words. */
function shareWords(refundBps: number): string {
  if (refundBps >= 10_000) return "Everything back";
  if (refundBps <= 0) return "Nothing back";
  const percent = refundBps / 100;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}% back`;
}

/**
 * A paid stay under the terms frozen on its booking. The same arithmetic as
 * the refund desk (`refundUnderTerms`), and the same steps the guest was shown
 * at checkout, so the figure quoted is the figure paid.
 */
function bookedTermsAnswer(
  booking: { checkIn: string },
  paidMinor: number,
  currency: string,
  terms: CancellationTerms,
): ToolOutcome {
  const now = refundUnderTerms(paidMinor, booking.checkIn, terms);
  const lastTier = terms.tiers[terms.tiers.length - 1];
  const paid = Math.max(0, Math.trunc(paidMinor));
  const steps = terms.tiers.map((tier, index) => {
    const earlier = terms.tiers[index - 1];
    const when =
      tier.closesHoursBefore > 0
        ? `More than ${tier.closesHoursBefore} hours before check-in`
        : earlier
          ? `Less than ${earlier.closesHoursBefore} hours before check-in`
          : "Any time before check-in";
    return { step: shareWords(tier.refundBps), when, worth: naira(Math.round((paid * tier.refundBps) / 10_000), currency) };
  });
  if (!lastTier || lastTier.closesHoursBefore > 0 || lastTier.refundBps > 0) {
    steps.push({
      step: "Nothing back",
      when:
        lastTier && lastTier.closesHoursBefore > 0
          ? `Less than ${lastTier.closesHoursBefore} hours before check-in`
          : "From check-in time onwards",
      worth: naira(0, currency),
    });
  }
  return {
    result: {
      booking,
      route: "a person on the support team",
      whatHappens:
        "This stay is paid for, so it is not cancelled by the button in the app: ask here and a person applies the cancellation terms fixed on this booking, refunds the money to the card or account they paid with, and puts the amount and the reason in writing. Cancellation requests are answered within 1 day, sooner when check-in is close.",
      paid: naira(paidMinor, currency),
      ifCancelledNow: {
        tier: shareWords(now.refundBps),
        refunded: naira(now.refundMinor, currency),
        keptByHost: naira(now.retainedMinor, currency),
        why: "These are the cancellation terms fixed on this booking when it was paid, counted in Lagos time from check-in.",
      },
      schedule: steps,
      exceptions:
        "These terms only govern a cancellation the guest chose. If the host cancelled, the place was not what was listed, or they could not get in, everything comes back whatever the hour. Do not cancel in those cases: report it.",
      note: "Quote these amounts exactly. Never round them and never work out a figure of your own.",
    },
    actions: [BOOKINGS_ACTION],
  };
}

/* --------------------------------------------------------------- tickets */

const TICKET_STATUS_MEANING: Record<string, string> = {
  open: "filed and waiting to be picked up",
  pending: "with the team, waiting on something",
  resolved: "answered and closed out",
  closed: "closed",
};

/**
 * Tickets this person has already filed.
 *
 * The single most common thing somebody asks support twice is what happened to
 * the first time they asked, and until now the agent had no way to answer it
 * and would file a second ticket about the first one. Tickets filed while
 * signed out carry no user_id by design, so they are genuinely not lookupable
 * here, and the tool says so rather than reporting an empty list as "you have
 * never contacted us".
 */
async function runMyTickets(session: SignedIn): Promise<ToolOutcome> {
  const { data: tickets, error } = await session.supabase
    .from("support_tickets")
    .select("id, reference, topic, status, created_at, updated_at")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(5);
  if (error || !tickets) return unreadable("support tickets");

  if (tickets.length === 0) {
    return {
      result: {
        tickets: [],
        note: "No ticket is attached to this account. A ticket filed without signing in is not attached to an account at all, so if they filed one that way it exists and the reply comes by email, it simply cannot be looked up here.",
      },
    };
  }

  // One sweep for the whole thread rather than a read per ticket. RLS on
  // support_ticket_messages already limits this to threads they own.
  const byTicket = new Map<string, { replied: boolean; lastAt: string; lastRole: string }>();
  const { data: messages } = await session.supabase
    .from("support_ticket_messages")
    .select("ticket_id, sender_role, created_at")
    .in(
      "ticket_id",
      tickets.map((ticket) => ticket.id),
    )
    .order("created_at", { ascending: false })
    .limit(100);
  for (const row of messages ?? []) {
    const seen = byTicket.get(row.ticket_id);
    if (!seen) {
      byTicket.set(row.ticket_id, {
        replied: row.sender_role === "admin",
        lastAt: row.created_at,
        lastRole: row.sender_role,
      });
      continue;
    }
    if (row.sender_role === "admin") seen.replied = true;
  }

  return {
    result: {
      tickets: tickets.map((ticket) => {
        const thread = byTicket.get(ticket.id);
        return {
          reference: ticket.reference,
          about: supportTopicLabel(ticket.topic) ?? "not stated",
          status: ticket.status,
          meaning: TICKET_STATUS_MEANING[ticket.status] ?? ticket.status,
          filed: instantLabel(ticket.created_at),
          answeredBySupport: thread?.replied ?? false,
          lastActivity: thread ? instantLabel(thread.lastAt) : instantLabel(ticket.updated_at),
          answeredWithin: RESPONSE_COMMITMENTS[gradeForTopic(ticket.topic)].label,
        };
      }),
      note: "Give the reference exactly as written. Replies land by email and in the bell tab. If a ticket is past the response time on it, say so plainly and offer to add a note to it rather than filing a second one.",
    },
  };
}

/* -------------------------------------------------------------- messages */

/** The caller's own agent threads: who is waiting on whom. */
async function runMyMessages(session: SignedIn): Promise<ToolOutcome> {
  let threads: LiveConversationSummary[];
  try {
    threads = await loadConversationSummaries(session.supabase, session.user);
  } catch {
    return unreadable("message threads");
  }

  if (threads.length === 0) {
    return {
      result: {
        threads: [],
        note: "There are no message threads on this account. A conversation starts from a listing page, with Message the agent.",
      },
      actions: [MESSAGES_ACTION],
    };
  }

  return {
    result: {
      threads: threads.slice(0, 6).map((thread) => ({
        with: thread.counterpartName,
        about: thread.listingTitle,
        unread: thread.unread,
        lastWordWas: thread.lastFromMe ? "theirs" : "the other side's",
        when: thread.whenLabel,
        waitingOnTheOtherSide: thread.lastFromMe,
      })),
      note: "No message text is returned here, so do not quote any. If an agent has not replied, say how long it has been and offer to bring in a person; never promise on an agent's behalf.",
    },
    actions: [MESSAGES_ACTION],
  };
}

/* --------------------------------------------------------------- account */

/** The account itself: the address we answer to, and what is missing. */
async function runMyAccount(session: SignedIn): Promise<ToolOutcome> {
  const { data: row, error } = await session.supabase
    .from("profiles")
    .select("display_name, first_name, surname, phone, avatar_url, created_at, settings")
    .eq("id", session.user.id)
    .maybeSingle();
  if (error) return unreadable("profile");

  const email = session.user.email ?? "";
  const settings = parseSettings(row?.settings ?? {});
  const missing: string[] = [];
  if (!row) missing.push("their profile row, which normally exists from sign-up");
  if (!(row?.first_name ?? "").trim() && !(row?.display_name ?? "").trim()) missing.push("a name");
  if (!(row?.phone ?? "").trim()) missing.push("a phone number");
  if (!email) missing.push("an email address on the account");

  return {
    result: {
      email: email || "none on the account, which is unusual and worth a person looking at",
      name: (row?.display_name ?? "").trim() || (row?.first_name ?? "").trim() || null,
      phoneOnFile: Boolean((row?.phone ?? "").trim()),
      memberSince: row?.created_at ? instantLabel(row.created_at) : null,
      notifications: settings.notifications,
      language: settings.locale ?? "en",
      missing,
      note: "Replies to a ticket go to the email above. A channel switched off under notifications is why somebody stops hearing from us, and it is changed in Settings, Notifications. Never read their phone number out unless they ask for it.",
    },
  };
}

/* ---------------------------------------------------------------- ticket */

/**
 * The escalation. A ticket only counts when the row was written, so the model
 * is handed the reference the database gave back and nothing else.
 */
async function runFileTicket(session: SessionState, input: unknown): Promise<ToolOutcome> {
  const raw = asRecord(input);
  const question = asString(raw.question);
  const summary = asString(raw.summary);

  /*
   * The topic is a CODE, not a sentence.
   *
   * `support_tickets.topic` is read back by the admin queue through
   * `supportTopicLabel` and, more importantly, by `gradeForTopic`, which puts
   * the four hour clock on anything filed as safety. A free-text subject line
   * stored here renders raw in the queue and can never match that grade, so an
   * escalation about somebody being asked to pay outside Vallo would sit in
   * the ordinary pile. An unrecognised value falls back to "other" rather than
   * being stored, because a topic the queue does not know is worth less than a
   * topic it can sort.
   */
  const asked = asString(raw.topic);
  const topic: SupportTopic = (SUPPORT_TOPICS as readonly string[]).includes(asked) ? (asked as SupportTopic) : "other";
  const grade = gradeForTopic(topic);

  const signedIn = session.state === "signed-in";
  const accountEmail = signedIn ? asString(session.user.email) : "";
  const metadata = signedIn ? asRecord(session.user.user_metadata) : {};
  const accountName = signedIn
    ? asString(metadata.full_name) || asString(metadata.name)
    : "";

  /*
   * The account's own address wins for a signed-in caller.
   *
   * It used to be `asString(raw.email) || accountEmail`, which let the model
   * name the address instead: the ticket was attributed to the signed-in user
   * and the acknowledgement, carrying our domain and their chosen name, went
   * wherever the conversation said. That is a relay with a person's real
   * account behind it. A signed-out caller has no account address, so there the
   * conversation is the only source there is and it stays that way.
   */
  const email = signedIn ? accountEmail || asString(raw.email) : asString(raw.email);
  const name = accountName || asString(raw.name) || (signedIn ? "Vallo member" : "");

  if (!name || !email) {
    return {
      result: {
        filed: false,
        need: ["name", "email"],
        note: "No ticket was created. Ask for a name and an email address, and tell them that is all support keeps. They can also use the Talk to a person control on this screen.",
      },
    };
  }

  const outcome = await fileSupportTicket({
    name,
    email,
    topic,
    body: question || summary || "Escalated from the support chat.",
    summary: summary
      ? `Support agent summary: ${summary}`
      : "Escalated from the support chat with no summary.",
  });

  if (!outcome.ok) {
    return {
      result: {
        filed: false,
        reason: outcome.error,
        note: "No ticket exists. Repeat the reason above in your own words and do not invent a reference.",
      },
    };
  }

  return {
    result: {
      filed: true,
      reference: outcome.data.reference,
      about: supportTopicLabel(topic) ?? topic,
      answeredWithin: RESPONSE_COMMITMENTS[grade].label,
      note: `The ticket row is written. Give them this reference exactly, tell them it is answered ${RESPONSE_COMMITMENTS[grade].label.toLowerCase()} and that a person replies to ${email}.`,
    },
    reference: outcome.data.reference,
  };
}

/* ------------------------------------------------------------- the switch */

/** The tools that need an account behind them, and cannot answer without one. */
type PersonalTool = (session: SignedIn, input: unknown) => Promise<ToolOutcome>;

const PERSONAL_TOOLS: Record<string, PersonalTool> = {
  my_bookings: (session) => runMyBookings(session),
  my_agreements: (session) => runMyAgreements(session),
  booking_policy: (session, input) => runBookingPolicy(session, input),
  my_tickets: (session) => runMyTickets(session),
  my_messages: (session) => runMyMessages(session),
  my_account: (session) => runMyAccount(session),
};

/**
 * Run one tool call. `session` is resolved once per request and shared, so
 * every tool in a turn acts as the same caller and no tool can widen its own
 * authority mid-conversation.
 *
 * Nothing here is allowed to throw. A tool call happens in the middle of a
 * streamed answer, so an exception does not fail one tool, it takes down the
 * turn: the person watching loses the sentence being written and gets a generic
 * upstream error instead of the honest "I could not read that". The guards are
 * inside each read as well; this is the backstop for the failure nobody
 * predicted, and it degrades to a sentence the model can say out loud.
 */
export async function runSupportTool(
  name: string,
  input: unknown,
  session: SessionState,
): Promise<ToolOutcome> {
  try {
    if (name === "search_help") return runSearchHelp(input);
    if (name === "file_ticket") return await runFileTicket(session, input);

    const personal = PERSONAL_TOOLS[name];
    if (personal) {
      if (session.state === "unconfigured") return { result: UNCONFIGURED };
      if (session.state !== "signed-in") {
        return { result: SIGNED_OUT, actions: [SIGN_IN_ACTION] };
      }
      return await personal(session, input);
    }

    return { result: { error: `No tool named ${name}.` } };
  } catch {
    return unreadable("records");
  }
}

/** One auth round trip per request, shared by the throttle and every tool. */
export async function resolveSupportCaller(): Promise<SessionState> {
  try {
    /* The write resolver: an account that owes the finish-setup step (B-2)
       is helped as a visitor, and no personal tool (a ticket, a booking
       change) runs for it. */
    return await resolveWriteSession();
  } catch {
    // An auth read that cannot run means the caller is treated as signed out:
    // they still get help, and no personal tool will answer.
    return { state: "signed-out" };
  }
}

/**
 * Exported for the unit test that holds the one judgement with no read behind
 * it. Not part of the tool API: everything else is proved through
 * `runSupportTool` with a scripted client, which is the shape the route calls.
 */
export const __testing = { cancellableInApp };
