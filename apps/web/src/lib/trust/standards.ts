import { NO_RENTER_FEES_LINE } from "@/lib/money/copy";

/**
 * The response times Vallo publishes, as data.
 *
 * A stated response time is only worth anything if the console that has to
 * keep it reads the same number the public page prints. So the commitments
 * live here, client-safe, and both sides import them: the standards page
 * prints them, and the admin queues compute a due time from them and say when
 * a row is overdue.
 *
 * The numbers are deliberately conservative. A promise of one hour that is
 * kept two thirds of the time is worse than a promise of four hours that is
 * always kept, because the first one teaches people that our promises are
 * decoration.
 */

/** How urgent a piece of incoming work is, in the only three grades staff use. */
export type ResponseGrade = "urgent" | "standard" | "routine";

export type ResponseCommitment = {
  grade: ResponseGrade;
  /** Whole hours from the moment the row is written to the moment it is answered. */
  hours: number;
  label: string;
  /** What lands in this grade, named concretely enough to be checked. */
  covers: string;
};

export const RESPONSE_COMMITMENTS: Record<ResponseGrade, ResponseCommitment> = {
  urgent: {
    grade: "urgent",
    hours: 4,
    label: "Within 4 hours",
    covers:
      "Anyone asked to pay outside Vallo, anything unsafe or threatening, and any report that somebody has already lost money.",
  },
  standard: {
    grade: "standard",
    hours: 24,
    label: "Within 1 day",
    covers:
      "Listings that are not as described, suspected scams, duplicate listings, and content held by the scanner while a person reads it.",
  },
  routine: {
    grade: "routine",
    hours: 72,
    label: "Within 3 days",
    covers:
      "Agent applications, verification documents, appeals against a decision, and everything else that needs judgement rather than speed.",
  },
};

/** The grades in the order they should be read. */
export const RESPONSE_ORDER: ResponseGrade[] = ["urgent", "standard", "routine"];

/**
 * Which grade a risk alert belongs to.
 *
 * `risk_alerts.severity` is low, medium or high, and the mapping is the whole
 * reason the console can put a clock on a row at all.
 */
export function gradeForSeverity(severity: "low" | "medium" | "high"): ResponseGrade {
  if (severity === "high") return "urgent";
  if (severity === "medium") return "standard";
  return "routine";
}

/**
 * Which grade a report belongs to, from the category the reporter chose.
 *
 * The category list in `lib/reports/schema.ts` was written to be short and
 * concrete so the queue would be sortable. This is the payoff: the three
 * categories that mean somebody is being defrauded or is unsafe carry the
 * four-hour clock, and the tidy-up categories do not.
 */
export function gradeForReportCategory(category: string | null): ResponseGrade {
  if (category === "off_platform_payment" || category === "scam" || category === "unsafe") {
    return "urgent";
  }
  if (category === "duplicate") return "routine";
  return "standard";
}

/**
 * V-63: the promise a reporter reads for the category they chose, as the
 * sentence fragment the report sheet and the "I feel unsafe" sheet print:
 * "within 4 hours". One source, the same as the console's clock.
 */
export function responseTimeFor(category: string | null): { grade: ResponseGrade; hours: number; phrase: string } {
  const grade = gradeForReportCategory(category);
  const commitment = RESPONSE_COMMITMENTS[grade];
  return { grade, hours: commitment.hours, phrase: commitment.label.charAt(0).toLowerCase() + commitment.label.slice(1) };
}

export type DueState = {
  grade: ResponseGrade;
  /** When the commitment runs out. */
  dueAt: Date;
  /** Whole hours remaining, negative once the commitment has been missed. */
  hoursLeft: number;
  overdue: boolean;
};

/** When a row opened at `openedAt` must be answered by, and whether it is late. */
export function dueBy(
  openedAtIso: string,
  grade: ResponseGrade,
  now: Date = new Date(),
): DueState {
  const opened = new Date(openedAtIso).getTime();
  const commitment = RESPONSE_COMMITMENTS[grade];
  const base = Number.isNaN(opened) ? now.getTime() : opened;
  const dueAt = new Date(base + commitment.hours * 3_600_000);
  const hoursLeft = Math.floor((dueAt.getTime() - now.getTime()) / 3_600_000);
  return { grade, dueAt, hoursLeft, overdue: dueAt.getTime() < now.getTime() };
}

/**
 * The sentence that matters more than any other on the platform, in one place
 * so it cannot be reworded into something weaker by accident.
 */
export const NO_FEES_LINE = NO_RENTER_FEES_LINE;

export const NEVER_ASK: { title: string; body: string }[] = [
  {
    title: "An account number",
    body: "No Vallo staff member, agent or listing will ever give you a personal or company account number to pay into. Every payment happens inside the platform.",
  },
  {
    title: "A transfer to hold a place",
    body: "There is no holding fee, no inspection fee, no agency fee and no caution fee payable to us. If somebody asks for one to keep a property for you, that is the moment to report them.",
  },
  {
    title: "Your password or a one-time code",
    body: "We will never ask for either, on the phone, by email or in a message. Anyone who does is not us.",
  },
  {
    title: "Payment on WhatsApp or by cash at the gate",
    body: "A conversation that starts on Vallo and moves off it to arrange money is the single clearest warning sign in this market. Keep it here, where there is a record. The only thing a host may ask for at the door is a charge listed on the place before you booked, for the amount and the reason listed.",
  },
];
