import "server-only";
import { z } from "zod";
import { readMyPayments } from "@/lib/money/history";
import type { HistoryEntry } from "@/lib/money/history-model";
import { readMyBalance } from "@/lib/money/member-wallet";
import { createProposal } from "../proposals";
import { callerOf, naira, NOT_SIGNED_IN, periodBounds, PERIODS, when, type Period } from "./private-common";
import { defineTool } from "./types";

const periodSchema = z.enum(PERIODS);

/** The page of the member's own money history, or null when it could not be read. */
async function readEntries(): Promise<{ entries: HistoryEntry[]; more: boolean } | null> {
  const read = await readMyPayments(null);
  if (read.state !== "ok") return null;
  return { entries: read.entries, more: read.nextBefore !== null };
}

const inPeriod = (e: HistoryEntry, period: Period): boolean => {
  const b = periodBounds(period);
  const t = Date.parse(e.occurredAt);
  return t >= b.from && t < b.to;
};

const LIMITED = "Only the most recent fifty entries were read, so an older total may be missing. Say so.";

export const listMyTransactionsTool = defineTool({
  name: "list_my_transactions",
  description:
    "List the person's own payments and refunds on Vallo for a period, newest first. Read only: it cannot move money. Amounts are as recorded; never round or estimate.",
  input: z.object({ period: periodSchema.optional(), limit: z.number().int().min(1).max(10).optional() }),
  inputSchema: {
    type: "object",
    properties: {
      period: { type: "string", enum: [...PERIODS] },
      limit: { type: "number", description: "How many to show, 1 to 10." },
    },
  },
  mode: "read",
  requires: "transactions",
  workspaces: ["consumer"],
  async run(ctx, input) {
    if (!callerOf(ctx)) return NOT_SIGNED_IN;
    const read = await readEntries();
    if (!read) return { data: { error: "Your payments could not be read just now. Nothing is shown rather than a guess." } };
    const period = input.period ?? "last_30_days";
    const rows = read.entries.filter((e) => inPeriod(e, period)).slice(0, input.limit ?? 5);
    const label = periodBounds(period).label;
    if (rows.length === 0) return { data: { period: label, entries: [] }, note: `There is nothing on record for ${label}. Say so.` };
    const items = rows.map((e) => ({
      label: e.title ?? (e.kind === "refund" ? "Refund" : "Payment"),
      value: `${e.direction === "out" ? "-" : "+"}${naira(e.amountMinor)}`,
      date: when(e.occurredAt),
      status: e.status.toLowerCase(),
    }));
    return {
      data: { period: label, entries: items },
      ...(read.more ? { note: LIMITED } : {}),
      events: [
        { type: "summary", title: `Your payments, ${label}`, rows: items },
        /* The whole record as a file, read under the member's own session (`/api/statement`). */
        { type: "actions", items: [{ id: "statement", label: "Download statement", kind: "download", href: "/api/statement" }] },
      ],
    };
  },
});

export const spendSummaryTool = defineTool({
  name: "spend_summary",
  description: "Add up what the person paid and got refunded on Vallo for a period. Read only. Quote the figures exactly as returned.",
  input: z.object({ period: periodSchema.optional() }),
  inputSchema: { type: "object", properties: { period: { type: "string", enum: [...PERIODS] } } },
  mode: "read",
  requires: "transactions",
  workspaces: ["consumer"],
  async run(ctx, input) {
    if (!callerOf(ctx)) return NOT_SIGNED_IN;
    const read = await readEntries();
    if (!read) return { data: { error: "Your payments could not be read just now. Nothing is shown rather than a guess." } };
    const period = input.period ?? "this_month";
    const rows = read.entries.filter((e) => inPeriod(e, period));
    const paid = rows.filter((e) => e.kind === "payment").reduce((a, e) => a + e.amountMinor, 0);
    const refunded = rows.filter((e) => e.kind === "refund").reduce((a, e) => a + e.amountMinor, 0);
    const label = periodBounds(period).label;
    const table = [
      { label: "Paid", value: naira(paid) },
      { label: "Refunded to you", value: naira(refunded) },
      { label: "Net spent", value: naira(paid - refunded) },
      { label: "Payments counted", value: String(rows.filter((e) => e.kind === "payment").length) },
    ];
    return {
      data: { period: label, paid: naira(paid), refunded: naira(refunded), net: naira(paid - refunded) },
      ...(read.more ? { note: LIMITED } : {}),
      events: [{ type: "summary", title: `What you spent, ${label}`, rows: table }],
    };
  },
});

export const getRefundStatusTool = defineTool({
  name: "get_refund_status",
  description: "Read the status of the person's refunds (processing, completed). Read only. Never promise a refund date.",
  input: z.object({}),
  inputSchema: { type: "object", properties: {} },
  mode: "read",
  requires: "transactions",
  workspaces: ["consumer"],
  async run(ctx) {
    if (!callerOf(ctx)) return NOT_SIGNED_IN;
    const read = await readEntries();
    if (!read) return { data: { error: "Your refunds could not be read just now." } };
    const refunds = read.entries.filter((e) => e.kind === "refund").slice(0, 6);
    if (refunds.length === 0) return { data: { refunds: [] }, note: "There are no refunds on record. Say so." };
    const rows = refunds.map((e) => ({ label: e.title ?? "Refund", value: naira(e.amountMinor), date: when(e.occurredAt), status: e.status.toLowerCase() }));
    return { data: { refunds: rows }, events: [{ type: "summary", title: "Your refunds", rows }] };
  },
});

export const getWalletBalanceTool = defineTool({
  name: "get_wallet_balance",
  description:
    "Read the person's Vallo balance as reported by our licensed provider. If they have no balance account, or it is not open yet, say that plainly. Vallo does not hold customer money itself. Read only.",
  input: z.object({}),
  inputSchema: { type: "object", properties: {} },
  mode: "read",
  requires: "wallet_balance",
  workspaces: ["consumer"],
  async run(ctx) {
    if (!callerOf(ctx)) return NOT_SIGNED_IN;
    const read = await readMyBalance({ limit: 1 });
    if (read.state === "signed-out") return NOT_SIGNED_IN;
    if (read.state === "not-live") {
      return { data: { available: false }, note: "The balance feature is not switched on for accounts yet. Say that plainly. Do not invent a figure." };
    }
    if (read.state === "onboarding") {
      return { data: { available: false }, note: "The person has not opened a balance account yet. Say so and point them to the Balance screen." };
    }
    if (read.state !== "ready" || !read.figures) {
      return { data: { error: "The balance could not be read just now. Nothing is shown rather than a guess." } };
    }
    const f = read.figures;
    const rows = [
      { label: "Available", value: naira(f.available.minor), ...(f.available.confirmedAt ? { date: when(f.available.confirmedAt) } : {}) },
      { label: "Held for a deal", value: naira(f.protected.minor) },
      { label: "Pending in", value: naira(f.pending.minor) },
      { label: "Processing out", value: naira(f.processing.minor) },
    ];
    return {
      data: { available: naira(f.available.minor), protected: naira(f.protected.minor), pending: naira(f.pending.minor), processing: naira(f.processing.minor) },
      note: "Quote the figures exactly. Say they are as last confirmed by the provider.",
      events: [{ type: "summary", title: "Your balance", rows, note: "As reported by our licensed provider." }],
    };
  },
});

/* ---------------------------------------------------------------- payments */

type Row = Record<string, unknown>;
type Q = {
  from: (t: string) => {
    select: (c: string) => {
      eq: (c: string, v: string) => {
        eq: (c: string, v: string) => { maybeSingle: () => PromiseLike<{ data: unknown; error: unknown }> };
        maybeSingle: () => PromiseLike<{ data: unknown; error: unknown }>;
      };
    };
  };
};

export type Payable = {
  bookingId: string;
  title: string;
  service: "Stay booking" | "Rent and move-in costs";
  totalMinor: number;
  currency: string;
  fees: { label: string; value: string }[];
};

/**
 * What a payment would be, read from the database as the member (row level
 * security: their own bookings only). The amount and the lines come from the
 * rows, never from the model. Null when there is nothing payable.
 */
export async function readPayable(supabase: unknown, userId: string, kind: "booking" | "rent", targetId: string): Promise<Payable | null> {
  const db = supabase as Q;
  try {
    let bookingId = targetId;
    let rent: Row | null = null;
    if (kind === "rent") {
      const { data } = await db
        .from("rent_payments")
        .select("booking_id, rent_minor, caution_minor, service_minor, agency_minor, legal_minor, agreement_minor, total_minor")
        .eq("inspection_id", targetId)
        .maybeSingle();
      if (!data) return null;
      rent = data as Row;
      bookingId = String(rent.booking_id ?? "");
    }
    const { data: b } = await db
      .from("bookings")
      .select("id, listing_id, guest_id, total_minor, currency, status, cleaning_fee_minor, service_fee_minor, subtotal_minor")
      .eq("id", bookingId)
      .eq("guest_id", userId)
      .maybeSingle();
    if (!b) return null;
    const booking = b as Row;
    if (booking.status !== "PENDING") return null;
    const total = Number(booking.total_minor);
    if (!Number.isFinite(total) || total <= 0) return null;
    const { data: l } = await db.from("listings").select("title").eq("id", String(booking.listing_id ?? "")).maybeSingle();
    const title = String((l as Row | null)?.title ?? "Your booking");
    const money = (v: unknown) => naira(Number(v ?? 0));
    const fees: { label: string; value: string }[] = [];
    if (rent) {
      fees.push({ label: "Rent", value: money(rent.rent_minor) });
      if (Number(rent.caution_minor) > 0) fees.push({ label: "Caution deposit (held, not spent)", value: money(rent.caution_minor) });
      if (Number(rent.service_minor) > 0) fees.push({ label: "Service charge", value: money(rent.service_minor) });
      if (Number(rent.agency_minor) > 0) fees.push({ label: "Agency fee", value: money(rent.agency_minor) });
      if (Number(rent.legal_minor) > 0) fees.push({ label: "Legal fee", value: money(rent.legal_minor) });
      if (Number(rent.agreement_minor) > 0) fees.push({ label: "Agreement", value: money(rent.agreement_minor) });
    } else {
      fees.push({ label: "Stay", value: money(booking.subtotal_minor) });
      if (Number(booking.cleaning_fee_minor) > 0) fees.push({ label: "Cleaning fee", value: money(booking.cleaning_fee_minor) });
      if (Number(booking.service_fee_minor) > 0) fees.push({ label: "Service fee", value: money(booking.service_fee_minor) });
    }
    return {
      bookingId: String(booking.id),
      title,
      service: kind === "rent" ? "Rent and move-in costs" : "Stay booking",
      totalMinor: total,
      currency: String(booking.currency ?? "NGN"),
      fees,
    };
  } catch {
    return null;
  }
}

export const proposePaymentTool = defineTool({
  name: "propose_payment",
  description:
    "Prepare a payment for something the person owes (a stay booking that is waiting for payment, or the rent charge for an accepted inspection). It moves NO money: it puts a payment summary with a Confirm and pay button on screen, with the real amount from the database. Never say a payment was made. Never state an amount that this tool did not return.",
  input: z.object({ target_kind: z.enum(["booking", "rent"]), target_id: z.string().uuid() }),
  inputSchema: {
    type: "object",
    properties: {
      target_kind: { type: "string", enum: ["booking", "rent"], description: "booking for a stay; rent for an accepted inspection's rent charge." },
      target_id: { type: "string", description: "The booking id, or the inspection id for rent." },
    },
    required: ["target_kind", "target_id"],
  },
  mode: "propose",
  requires: "payment_assist",
  workspaces: ["consumer"],
  async run(ctx, input) {
    const who = callerOf(ctx);
    if (!who) return NOT_SIGNED_IN;
    const payable = await readPayable(who.supabase, who.userId, input.target_kind, input.target_id);
    if (!payable) {
      return { data: { error: "There is nothing waiting for payment under that. Say so, and point the person to their bookings." } };
    }
    const made = await createProposal(who.supabase, "payment_review", {
      target_kind: input.target_kind,
      booking_id: payable.bookingId,
      amount_minor: payable.totalMinor,
      currency: payable.currency,
      title: payable.title,
    });
    if (!made.ok) return { data: { error: "The payment could not be prepared.", reason: made.reason } };
    return {
      data: { prepared: true, service: payable.service, total: naira(payable.totalMinor) },
      note: "A payment summary with a Confirm and pay button is on screen. Say nothing is charged until they confirm and verify.",
      events: [
        {
          type: "payment_review",
          proposalId: made.id,
          payloadHash: made.payloadHash,
          service: `${payable.service}: ${payable.title}`,
          recipient: "The lister of this place, paid through our licensed provider. Vallo does not hold your money.",
          amount: naira(payable.totalMinor),
          fees: payable.fees,
          total: naira(payable.totalMinor),
          expiresAt: made.expiresAt,
        },
      ],
    };
  },
});
