/**
 * RESTAURANTS EARN ON COMPLETED DEALS ONLY (founder decision D).
 *
 * Booking a table is free for the diner. Vallo earns a flat fee per seated
 * guest, billed to the restaurant at the end of the month. A table is seated
 * when the restaurant types the diner's check-in code, taps Seated, a bill is
 * paid through Vallo, or the diner says yes when asked a day later and the
 * restaurant never answered. A disagreement goes to Vallo.
 *
 * Pure: the words, the rules a screen needs before it asks the database, and
 * the reading of the rows (`reservation_seatings`, `restaurant_bills`) the
 * pending migration 20261013100000 adds. The database decides; this only
 * says it in words and keeps buttons from being offered when they would be
 * refused.
 */

/** The founder's number: 1,000 naira per seated table, in kobo. The database row wins. */
export const SEATED_FEE_MINOR_DEFAULT = 100_000;

/** Seated is offered from three hours before the time, like the database. */
export const SEAT_EARLY_MS = 3 * 3_600_000;
/** The restaurant has a day after the time before the diner is asked. */
export const RESTAURANT_ANSWER_MS = 24 * 3_600_000;
/** A bill can be entered until three days after the time. */
export const BILL_WINDOW_MS = 3 * 24 * 3_600_000;

export type SeatingOutcome = "SEATED" | "NO_SHOW";
export type SeatingBy = "code" | "restaurant" | "diner" | "bill" | "admin";

export type SeatingView = {
  checkInCode: string;
  outcome: SeatingOutcome | null;
  outcomeBy: SeatingBy | null;
  outcomeAt: string | null;
  restaurantAnswer: SeatingOutcome | null;
  dinerAskedAt: string | null;
  dinerAnswer: "dined" | "did_not_dine" | null;
  disputed: boolean;
  resolved: boolean;
};

export type BillStatus = "awaiting_restaurant" | "awaiting_payment" | "pending" | "paid" | "cancelled";

export type BillView = {
  id: string;
  amountMinor: number;
  enteredBy: "restaurant" | "diner";
  status: BillStatus;
  paidAt: string | null;
};

const OUTCOMES = new Set(["SEATED", "NO_SHOW"]);
const BYS = new Set(["code", "restaurant", "diner", "bill", "admin"]);
const BILL_STATUSES = new Set(["awaiting_restaurant", "awaiting_payment", "pending", "paid", "cancelled"]);

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** One `reservation_seatings` row, read defensively. Null when it is not one. */
export function readSeating(row: unknown): (SeatingView & { reservationId: string }) | null {
  if (row === null || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const reservationId = text(r.reservation_id);
  const code = text(r.check_in_code);
  if (!reservationId || !code || !/^[0-9]{6}$/.test(code)) return null;
  const outcome = text(r.outcome);
  const by = text(r.outcome_by);
  const answer = text(r.restaurant_answer);
  const diner = text(r.diner_answer);
  return {
    reservationId,
    checkInCode: code,
    outcome: outcome && OUTCOMES.has(outcome) ? (outcome as SeatingOutcome) : null,
    outcomeBy: by && BYS.has(by) ? (by as SeatingBy) : null,
    outcomeAt: text(r.outcome_at),
    restaurantAnswer: answer && OUTCOMES.has(answer) ? (answer as SeatingOutcome) : null,
    dinerAskedAt: text(r.diner_asked_at),
    dinerAnswer: diner === "dined" || diner === "did_not_dine" ? diner : null,
    disputed: text(r.disputed_at) !== null && text(r.dispute_resolved_at) === null,
    resolved: text(r.dispute_resolved_at) !== null,
  };
}

/** One `restaurant_bills` row, read defensively. */
export function readBill(row: unknown): (BillView & { reservationId: string }) | null {
  if (row === null || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const id = text(r.id);
  const reservationId = text(r.reservation_id);
  const amount = Number(r.amount_minor);
  const status = text(r.status);
  if (!id || !reservationId || !Number.isSafeInteger(amount) || amount <= 0 || !status || !BILL_STATUSES.has(status)) {
    return null;
  }
  return {
    id,
    reservationId,
    amountMinor: amount,
    enteredBy: r.entered_by === "diner" ? "diner" : "restaurant",
    status: status as BillStatus,
    paidAt: text(r.paid_at),
  };
}

/** "123 456": the code, spaced the way a person reads it aloud. */
export function spacedCode(code: string): string {
  return /^[0-9]{6}$/.test(code) ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
}

/** Digits only, from what the restaurant typed ("123 456", "123-456"). Null unless six. */
export function cleanCode(typed: string): string | null {
  const digits = typed.replace(/[^0-9]/g, "");
  return digits.length === 6 ? digits : null;
}

/** Naira typed by a person ("12,500", "12500.50") to kobo. Null when it is not an amount. */
export function nairaToMinor(typed: string): number | null {
  const clean = typed.replace(/[,\s₦]/g, "");
  if (!/^[0-9]+(\.[0-9]{1,2})?$/.test(clean)) return null;
  const [whole, part = ""] = clean.split(".");
  const minor = Number(whole) * 100 + Number(part.padEnd(2, "0"));
  if (!Number.isSafeInteger(minor) || minor <= 0 || minor > 1_000_000_000) return null;
  return minor;
}

type TableMoment = { status: string; reservedFor: string };

/** The diner shows the code while the table is confirmed and not yet decided. */
export function showsCode(table: TableMoment, seating: SeatingView | null, now: Date): boolean {
  if (!seating || seating.outcome) return false;
  if (table.status !== "CONFIRMED") return false;
  return Date.parse(table.reservedFor) + RESTAURANT_ANSWER_MS > now.getTime();
}

/** Whether to ask the diner "Did you dine?": asked by the database, or a day has passed unanswered. */
export function asksDiner(table: TableMoment, seating: SeatingView | null, now: Date): boolean {
  if (!seating || seating.dinerAnswer || seating.outcome || seating.restaurantAnswer) return false;
  if (table.status !== "CONFIRMED") return false;
  return seating.dinerAskedAt !== null || Date.parse(table.reservedFor) + RESTAURANT_ANSWER_MS <= now.getTime();
}

/** A bill can be entered or paid around the table's time, while the table stands. */
export function billOpen(table: TableMoment, now: Date): boolean {
  if (table.status !== "CONFIRMED" && table.status !== "COMPLETED") return false;
  const at = Date.parse(table.reservedFor);
  return at - SEAT_EARLY_MS <= now.getTime() && now.getTime() <= at + BILL_WINDOW_MS;
}

/** Only a seated table, not under dispute, can be reviewed. */
export function reviewable(seating: SeatingView | null): boolean {
  return Boolean(seating && seating.outcome === "SEATED" && !seating.disputed);
}

/** The line under a decided table, for the diner. */
export function seatingLine(seating: SeatingView | null): string | null {
  if (!seating) return null;
  if (seating.disputed) {
    return "You and the restaurant gave different answers about this table. A person at Vallo is checking it.";
  }
  if (seating.outcome === "SEATED") {
    return seating.outcomeBy === "bill" ? "Seated. Your bill was paid through Vallo." : "Seated. Enjoy your meal.";
  }
  if (seating.outcome === "NO_SHOW") {
    return seating.outcomeBy === "diner" ? "You told us you did not dine." : "Marked as not arriving.";
  }
  return null;
}

/** The status word a host board shows for a decided table. */
export function seatingWord(seating: SeatingView | null): string | null {
  if (!seating) return null;
  if (seating.disputed) return "Disputed";
  if (seating.outcome === "SEATED") return "Seated";
  if (seating.outcome === "NO_SHOW") return "No-show";
  return null;
}

/** The bill, in a sentence for the diner. */
export function billLine(bill: BillView | null, money: (minor: number) => string): string | null {
  if (!bill || bill.status === "cancelled") return null;
  switch (bill.status) {
    case "awaiting_restaurant":
      return `You entered a bill of ${money(bill.amountMinor)}. The restaurant confirms it before you can pay.`;
    case "awaiting_payment":
      return `Your bill is ${money(bill.amountMinor)}.`;
    case "pending":
      return `Your payment of ${money(bill.amountMinor)} is being confirmed.`;
    case "paid":
      return `Bill of ${money(bill.amountMinor)} paid through Vallo.`;
    default:
      return null;
  }
}

/** The refusal the database gave, in words. */
export const SEATING_REFUSALS: Record<string, string> = {
  bad_code: "Type the six digits the guest shows you.",
  no_match: "No confirmed table at your restaurant has that code today. Check the digits, or tap Seated on the table.",
  ambiguous: "Two tables share that code. Tap Seated on the right table instead.",
  too_early: "That is too early. Seated opens three hours before the table, and No-show once its time has passed.",
  not_found: "We could not find that table on your account.",
  not_open: "That table is not open for this any more.",
  already: "That table already has an answer.",
  bad_outcome: "Choose Seated or No-show.",
  not_seated: "Only a table you were seated at can be reviewed.",
  bad_rating: "Choose from one to five stars.",
  bad_amount: "Type the bill in naira, for example 12500.",
  locked: "That bill is being paid or is paid already, so it cannot change.",
  awaiting_restaurant: "The restaurant has to confirm the bill first.",
  already_paid: "That bill is paid already.",
  not_staff: "Only Vallo staff can decide this.",
  own_table: "You cannot decide a table you booked or host. Leave it for another reviewer.",
  not_disputed: "That table has no open disagreement to decide.",
  signed_out: "Sign in first.",
};

export const PAY_BILL_NOT_AVAILABLE =
  "Paying the bill through Vallo is not available yet. Pay the restaurant directly. Nothing has been charged.";

export const PAY_BILL_PAYEE_NOT_SET_UP =
  "This restaurant has not finished setting up where it is paid, so the bill cannot be paid through Vallo yet. Pay the restaurant directly. Nothing has been charged.";

export const SEATING_NOT_READY =
  "Seating and bills are not switched on yet. Nothing has changed.";

export function seatingRefusal(status: string | undefined): string {
  return (status && SEATING_REFUSALS[status]) || "That did not go through. Please try again.";
}
