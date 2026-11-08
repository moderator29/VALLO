import type { MovementKind, MovementStatus, OnboardingState, ProfileGap } from "./funds";
import { getDictionary } from "@vallo/i18n";

/**
 * WHAT A MEMBER READS ON THE WALLET SCREEN (founder sections 36 to 46;
 * 13-provider-must-not-leak). No provider name, no provider word and no
 * backend state appears here, with ONE deliberate exception (ADR 0003,
 * consequence 3): `HELD_BY`, the line that says who holds the money.
 *
 * Every waiting sentence says what is known and what is not, and none of
 * them pretends to progress (section 43: no fake progress, no timers).
 *
 * The founder, 7 October: "What is balance? Call it WALLET." Every word a
 * member reads says Wallet; the identifiers keep `balance` to avoid churn.
 */

export const BALANCE_TITLE = "Wallet";
export const BALANCE_LEDE = "Every movement of your money, in one place.";

/**
 * LEGAL REVIEW (founder section 61): names the provider and claims no
 * licence or regulatory status for it beyond what its documentation states.
 * Counsel to confirm the wording before launch.
 */
export const HELD_BY = "Your money is held by our licensed provider, not by Vallo.";
export const HELD_BY_LINK = "How payments work";
export const HELD_BY_HREF = "/safety#how-payments";

export const FIGURE_LABEL = {
  available: "Available",
  protected: "Held for a deal",
  pending: "Pending",
  processing: "Processing",
} as const;

export const FIGURE_HINT = {
  available: "Ready to withdraw, send or pay with.",
  protected: "Committed to a deal and held until it completes.",
  pending: "Coming in, waiting for the bank to confirm.",
  processing: "On its way out, waiting for the bank to confirm.",
} as const;

export const ACTION_LABEL = { add: "Add money", withdraw: "Withdraw", send: "Send" } as const;

/** "Confirmed 2 minutes ago", from the time the provider last said so. */
export function confirmedAgo(iso: string | null, now: number): string {
  if (!iso) return "Nothing yet";
  const ms = now - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return "Confirmed just now";
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "Confirmed just now";
  /* The language inflects the unit, never a hand-written "s"
     (`no-english-plurals.test.ts`): "Confirmed 1 minute ago", "2 minutes ago". */
  const ago = new Intl.RelativeTimeFormat("en", { numeric: "always" });
  if (min < 60) return `Confirmed ${ago.format(-min, "minute")}`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Confirmed ${ago.format(-h, "hour")}`;
  return `Confirmed ${ago.format(-Math.floor(h / 24), "day")}`;
}

/** SW11: wallet status strings from `packages/i18n/src/locales/wallet.en.ts`. */
const _ws = getDictionary("en").wallet.status;
export const STALE_NOTE = _ws.staleNote;

/* ------------------------------------------------------- not connected
   The founder, 7 October: draw the real wallet now, even before the key is
   connected, and say why it waits in ONE short line. Nothing is drawn in the
   figure's place that reads as an amount (any figure would be invented, a
   zero included), and no paragraph about partners or rails. */

export const NOT_CONNECTED_FIGURE = _ws.notConnectedFigure;
export const NOT_CONNECTED_LINE = _ws.notConnected;

/** Connected, but the figures could not be read just now. */
export const UNREACHABLE_FIGURE = _ws.unreachableFigure;
export const UNREACHABLE_LINE = _ws.unreachableLine;

export const ACTIVITY_EMPTY = _ws.activityEmpty;

/* The founder's ruling, 7 October: the wallet is where all money lives, so
   the records the side nav used to list sit on the wallet as one group. */
export const WALLET_RECORDS_LABEL = _ws.recordsLabel;
export const WALLET_RECORDS = [
  { href: "/payments", title: "Payments", icon: "credit-card" },
  { href: "/receipts", title: "Receipts", icon: "receipt" },
  { href: "/payouts", title: "Payouts", icon: "bank" },
  { href: "/refunds", title: "Refunds", icon: "hand-coins" },
] as const;

/* ------------------------------------------------- the D81 Wallet screens
   The founder's governing reference (8 October 2026,
   `docs/design/references/2026-10-08/`): Overview and Transactions tabs,
   Money in and Money out, the protected row, the "Pay for your space"
   banner, More options, and the two bottom capsules, Withdraw and Send.
   "Send" is the one word for moving money to a member (the brief: never
   Send and Transfer as two buttons for one operation). */

export const WALLET_TABS = { overview: "Overview", transactions: "Transactions" } as const;
export const WALLET_SETTINGS_TITLE = "Wallet settings";
export const WALLET_BACK = "Back";

/** Sums over completed movements only (`sumMovements`), so they are facts, never estimates. */
export const TOTALS_LABEL = { in: "Money in", out: "Money out" } as const;
export const TOTALS_NOTE = "Completed movements";

/** The reference's "Your funds are protected" row, said as it is (no claim word: claims.ts). The sub is HELD_BY once connected. */
export const PROTECTED_TITLE = "Who holds your money";
export const PROTECTED_SUB_NOT_CONNECTED = "See how payments work on Vallo";

/** From the left-hand phone, only this (D81). Rent paid from Wallet is held until the move-in (FUND_STEPS). */
export const SPACE_BANNER = {
  title: "Pay for your space with Vallo Wallet",
  body: "Pay agreed rent from Wallet. It is released only when you confirm the move-in.",
  action: "Learn more",
  href: "/safety#how-payments",
} as const;

export const RECENT_LABEL = "Recent activity";
export const SEE_ALL = "See all";
export const MORE_OPTIONS_LABEL = "More options";

/** The overview's compact tools (the founder: "the receipts payout and refunds should be design and put cleanly in the wallet page too"). */
export const MORE_OPTIONS = [
  { href: "/receipts", title: "Receipts", sub: "Every receipt" },
  { href: "/payouts", title: "Payouts", sub: "Paid to your bank" },
  { href: "/refunds", title: "Refunds", sub: "Money returned" },
  { href: "/wallet/settings", title: "Settings", sub: "Tools and methods" },
] as const;

/**
 * THE TOOLS DESTINATION (the brief, section 5): every row leads to a real
 * screen. Cards and bank accounts are one screen on Vallo
 * (/settings/payments), so they are one row, never two labels for one place.
 */
export const WALLET_TOOL_GROUPS = [
  {
    label: "Records",
    tools: [
      { href: "/receipts", title: "Receipts", sub: "Every payment and refund, with its receipt" },
      { href: "/wallet/transactions", title: "Transaction history", sub: "Every movement, with filters" },
    ],
  },
  {
    label: "Payment methods",
    tools: [{ href: "/settings/payments", title: "Cards and bank accounts", sub: "The cards you pay with and the accounts you are paid into" }],
  },
  {
    label: "Money management",
    tools: [
      { href: "/payments", title: "Payments", sub: "What you paid for bookings and rent" },
      { href: "/payouts", title: "Payouts", sub: "What you received, with the platform fee" },
      { href: "/refunds", title: "Refunds", sub: "Where each refund stands" },
    ],
  },
  {
    label: "Security and preferences",
    tools: [
      { href: "/settings/passcode", title: "Passcode", sub: "The lock on your money screens" },
      { href: "/settings/notifications", title: "Notifications", sub: "What we tell you about payments" },
    ],
  },
] as const;

export const FILTER_LABEL = { all: "All", received: "Received", added: "Added", sent: "Sent", withdrawals: "Withdrawals" } as const;
export const FILTER_EMPTY = {
  all: "No activity yet",
  received: "Nothing received yet",
  added: "No money added yet",
  sent: "Nothing sent yet",
  withdrawals: "No withdrawals yet",
} as const;
export const TRANSACTIONS_MORE = "Showing your most recent movements.";

/** SW11: source of truth is now `packages/i18n/src/locales/wallet.en.ts`. */
const _w = getDictionary("en").wallet;
export const MOVE_COPY = _w.move;

/* ---------------------------------------------------------- onboarding */

export const ONBOARDING_COPY = _w.onboarding as Record<OnboardingState, { title: string; body: string }>;

export const PHONE_TAKEN_COPY = _w.phoneTaken;

export const GAP_LABEL: Record<ProfileGap, string> = {
  first_name: "Your first name",
  last_name: "Your surname",
  phone: "A Nigerian mobile number (payments for numbers outside Nigeria are coming)",
  email: "Your email address",
};

export const OPEN_ACTION = "Set up Wallet";

/* ----------------------------------------------------------- movements */

const KIND_TITLE: Record<MovementKind, string> = {
  deposit: "Money added",
  withdrawal: "Withdrawal",
  transfer_out: "Money sent",
  transfer_in: "Money received",
  other: "Movement",
};

export function movementTitle(kind: MovementKind): string {
  return KIND_TITLE[kind];
}

/** The status a member reads, by kind, because "processing" means a different wait for each. */
export function movementStatusLabel(kind: MovementKind, status: MovementStatus): string {
  switch (status) {
    case "preparing":
      return "Getting ready";
    case "awaiting_confirmation":
      return "Waiting for you to confirm";
    case "awaiting_payment":
      return "Waiting for your payment";
    case "processing":
      return kind === "withdrawal" ? "On its way to your bank" : kind === "deposit" ? "Waiting for your bank" : "Sending";
    case "unknown":
      return "Checking";
    case "completed":
      return kind === "deposit" ? "Added" : kind === "transfer_in" ? "Received" : "Completed";
    case "failed":
      return "Not completed";
    case "reversed":
      return "Returned";
    case "cancelled":
      return "Cancelled";
    case "under_review":
      return "Under review";
  }
}

export type StatusTone = "neutral" | "waiting" | "done" | "problem";
export function movementTone(status: MovementStatus): StatusTone {
  if (status === "completed") return "done";
  if (status === "failed" || status === "reversed") return "problem";
  if (status === "cancelled") return "neutral";
  return "waiting";
}

/* ----------------------------------------------------- the waiting room */

export const WAITING_COPY = _w.waiting as Record<"withdrawal" | "deposit" | "send" | "unknown" | "review", { title: string; body: string }>;

export const WAITING_STEPS = {
  withdrawal: ["Request received", "Sent to your bank", "Your bank confirms"],
  deposit: ["You pay", "Your bank confirms", "Added to Available"],
  send: ["Request received", "Sent", "Received"],
} as const;

/* ------------------------------------------------------------- refusals */

export const REFUSAL = {
  notLive: "Wallet is not connected yet, so nothing was sent.",
  notActive: "Your account needs to be open before money can move.",
  amountInvalid: "Enter an amount in naira, like 25,000.",
  belowWithdrawalMinimum: "The smallest withdrawal is ₦1,000.",
  belowMinimum: "The smallest amount is ₦100.",
  aboveMaximum: "That is more than a single movement can carry. Split it into smaller amounts.",
  insufficient: "That is more than you have Available. Nothing has moved.",
  insufficientWithFee: "With the processing fee this comes to more than you have Available. Nothing has moved.",
  accountNotFound: "We could not find that account at that bank. Check the number and the bank, then try again.",
  accountUnreachable: "We could not reach the bank to check this account. Nothing has moved. Try again in a moment.",
  accountChanged: "The name on this account is not the one you were shown, so nothing was sent. Check the account and try again.",
  busy: "Lots of people are moving money right now. Nothing was sent. Try again in a minute.",
  unavailable: "We could not reach our partner just now. Nothing was sent. Try again shortly.",
  stagedUnknown: "We could not confirm this was set up, so nothing was sent. Please try again in a moment.",
  refused: "This could not be completed and nothing has moved. Check the details and try again, or contact support.",
  submittedUnknown: "We sent this and did not hear back in time. Do not try again: we are checking, and this page updates on its own.",
  otpNeeded: "Enter the code sent to your phone to finish.",
  alreadySent: "This was already sent. Showing where it is.",
  noRecipient: "No Vallo member can receive money at that number yet.",
  selfSend: "That is your own number.",
  recipientOnHold: "That member cannot receive money right now. Nothing was sent.",
  depositUnavailable: "Adding money is not available from here yet. Nothing was charged.",
  generic: "Something on our side stopped this, and nothing has moved. Try again shortly.",
  noAnswer: "We did not hear back. Check your connection and try again; anything already sent shows in your activity.",
} as const;
