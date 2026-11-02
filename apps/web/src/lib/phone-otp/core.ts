/**
 * PHONE CONFIRMATION (V-50), THE PURE HALF. Client-safe: no I/O, no logging.
 *
 * The phone is the scarcity anchor: a mailbox costs nothing to multiply and a
 * working Nigerian SIM, tied to a registered identity by NIN-SIM linkage, does
 * not. So the product asks for a confirmed phone at the consequential moments,
 * and only at the first of each:
 *
 *   inspection  the first inspection request or visit slot (it costs an agent
 *               a Saturday)
 *   review      the first review, a stay review or a tenancy review alike
 *   report      the first report that is NOT about immediate danger. A report
 *               that somebody is unsafe is never delayed by a code, ever.
 *
 * And, by the founder's FULL GATE ruling (13 October 2026), before the first:
 *
 *   message     the first message that opens a new conversation. A reply in a
 *               thread somebody else started is never held, so a host can
 *               always answer and a call's "they have written here" holds.
 *   booking     the first stay booking, room request or table reservation
 *   payment     the first payment of any kind the member starts
 *   listing     the first listing a lister, host or restaurant publishes
 *
 * Browsing and saving stay open, and a member is never asked who they are: a
 * phone is not an ID. A QA account (public.qa_accounts) is never asked at all.
 */

export const OTP_LENGTH = 6;
export const OTP_TTL_MINUTES = 10;

export type PhoneMoment = "inspection" | "review" | "report" | "message" | "booking" | "payment" | "listing";

export const PHONE_MOMENTS: readonly PhoneMoment[] = [
  "inspection",
  "review",
  "report",
  "message",
  "booking",
  "payment",
  "listing",
];

/**
 * THE TWO MOMENTS THAT FAIL CLOSED. The reputation moments (and a message, a
 * visit, a booking) treat a read that blinked as "no need": friction in front
 * of them is not a security wall. Money and a published listing follow the
 * money gate's documented stance instead (`lib/identity/phone-gate.ts`): a
 * read that fails is "unknown", and unknown refuses, with a try-again
 * sentence rather than the confirm-your-phone one. The flag itself still
 * fails to OFF everywhere, so a flag read that fails asks nobody anything.
 */
export const FAIL_CLOSED_MOMENTS: readonly PhoneMoment[] = ["payment", "listing"];

export function failsClosed(moment: PhoneMoment): boolean {
  return FAIL_CLOSED_MOMENTS.includes(moment);
}

/** Report categories that are about immediate danger and are never gated. */
export const DANGER_CATEGORIES: readonly string[] = ["unsafe"];

/**
 * The opening words of the report V-05 files by itself when a renter answers
 * that money was asked for outside Vallo. That report is the renter's answer,
 * not a report they chose to write, so it is not their "first report".
 */
export const AUTO_REPORT_PREFIX = "Filed automatically from the questions after inspection";

/**
 * Does this earlier report count as the member's own first report? Not a
 * danger report (never gated, so it cannot have used up the moment) and not
 * one V-05 filed on their behalf.
 */
export function countsAsOwnReport(row: { category: string | null; reason: string | null }): boolean {
  if (row.category && DANGER_CATEGORIES.includes(row.category)) return false;
  if (typeof row.reason === "string" && row.reason.startsWith(AUTO_REPORT_PREFIX)) return false;
  return true;
}

/**
 * A six-digit code from a source of random integers. The source is injected so
 * the server passes `crypto.randomInt` and a test passes a fixed sequence.
 */
export function generateCode(randomInt: (maxExclusive: number) => number): string {
  let code = "";
  for (let i = 0; i < OTP_LENGTH; i += 1) code += String(randomInt(10));
  return code;
}

/**
 * The words that travel with the code. Short, no link, and the line that
 * protects the person: nobody from Vallo will ever ask for it. The code is
 * the only variable; nothing else about the account is in the message.
 */
export function otpMessage(code: string): string {
  return `Your Vallo code is ${code}. It expires in ${OTP_TTL_MINUTES} minutes. Nobody from Vallo will ever ask you for it.`;
}

/**
 * Must this person confirm a phone before this action?
 *
 * Only with the flag on, only without a confirmed phone, only at the FIRST
 * action of its kind, and never for a danger report.
 */
export function phoneGateNeeded(input: {
  flagOn: boolean;
  confirmed: boolean;
  priorCount: number;
  moment: PhoneMoment;
  reportCategory?: string;
  /** A QA account (`private.is_qa_account`, read on the server): never asked. */
  qa?: boolean;
}): boolean {
  if (!input.flagOn || input.confirmed || input.qa) return false;
  if (input.moment === "report" && input.reportCategory && DANGER_CATEGORIES.includes(input.reportCategory)) {
    return false;
  }
  return input.priorCount === 0;
}

/**
 * NO ENUMERATION (founder's ruling, 13 October 2026). What the MEMBER is told
 * about a number never says whether it is on Vallo: "on another account" and
 * "not a number we can use" are one refusal, `refused`, with one sentence and
 * one shape. The database's own words (`taken`, `invalid`) stay intact for
 * staff, who read them in the audit trail (`phone.number_refused`). Saying a
 * number is already confirmed on the member's OWN account is their own data
 * and is said plainly (`already`).
 */
export type MemberIssueRefusal = "refused" | "already" | "fixed";

export function memberIssueRefusal(outcome: Exclude<IssueOutcome, "issued">): MemberIssueRefusal {
  if (outcome === "fixed") return "fixed";
  return outcome === "already" ? "already" : "refused";
}

/** The confirm answers a member may hear: `taken` becomes `refused`. */
export type MemberConfirmRefusal = Exclude<ConfirmOutcome, "confirmed" | "taken"> | "refused";

export function memberConfirmRefusal(outcome: Exclude<ConfirmOutcome, "confirmed">): MemberConfirmRefusal {
  return outcome === "taken" ? "refused" : outcome;
}

/** What `public.phone_otp_issue` and `public.confirm_phone` answer. */
/* `fixed`: the account already has a confirmed number and asked for a different one;
   a confirmed number never changes (2 November 2026). */
export type IssueOutcome = "issued" | "taken" | "already" | "invalid" | "fixed";
export type ConfirmOutcome = "confirmed" | "wrong" | "expired" | "locked" | "no_code" | "taken" | "signed_out";

export const ISSUE_OUTCOMES: readonly IssueOutcome[] = ["issued", "taken", "already", "invalid", "fixed"];
export const CONFIRM_OUTCOMES: readonly ConfirmOutcome[] = [
  "confirmed",
  "wrong",
  "expired",
  "locked",
  "no_code",
  "taken",
  "signed_out",
];

export function isConfirmOutcome(value: unknown): value is ConfirmOutcome {
  return typeof value === "string" && (CONFIRM_OUTCOMES as readonly string[]).includes(value);
}

export function isIssueOutcome(value: unknown): value is IssueOutcome {
  return typeof value === "string" && (ISSUE_OUTCOMES as readonly string[]).includes(value);
}
